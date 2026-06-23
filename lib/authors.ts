import "server-only";
import type { Author, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const AUTHOR_REGISTRATION_RETRY_ATTEMPTS = 3;
const AUTHOR_REGISTRATION_RETRY_DELAY_MS = 50;
const RETRYABLE_PRISMA_ERROR_CODES = new Set(["P2002", "P2034"]);
const RETRYABLE_POSTGRES_ERROR_CODES = new Set(["40P01", "40001"]);

export const twitterHandleSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, "").toLowerCase())
  .pipe(z.string().min(1).max(15).regex(/^[a-z0-9_]+$/));

export const twitterAuthorInputSchema = z.object({
  twitterId: z.string().trim().min(1).max(80),
  twitterHandle: twitterHandleSchema,
  displayName: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
});

type TwitterAuthorInput = z.infer<typeof twitterAuthorInputSchema>;

export async function registerTwitterAuthor(input: unknown) {
  const payload = twitterAuthorInputSchema.parse(input);

  return retryTransientRegistrationConflict(() =>
    prisma.$transaction((tx) => registerTwitterAuthorInTransaction(tx, payload)),
  );
}

async function registerTwitterAuthorInTransaction(
  tx: Prisma.TransactionClient,
  payload: TwitterAuthorInput,
): Promise<Author> {
  const avatarUrl = payload.avatarUrl || null;

  const updateData = {
    twitterId: payload.twitterId,
    twitterHandle: payload.twitterHandle,
    displayName: payload.displayName,
    avatarUrl,
  };

  await lockCandidateAuthors(tx, payload);

  const existingByTwitterId = await tx.author.findUnique({
    where: {
      twitterId: payload.twitterId,
    },
  });

  if (existingByTwitterId) {
    return tx.author.update({
      where: {
        twitterId: payload.twitterId,
      },
      data: updateData,
    });
  }

  const existingByHandle = await tx.author.findUnique({
    where: {
      twitterHandle: payload.twitterHandle,
    },
  });

  if (existingByHandle) {
    return tx.author.update({
      where: {
        id: existingByHandle.id,
      },
      data: updateData,
    });
  }

  return tx.author.create({
    data: updateData,
  });
}

async function lockCandidateAuthors(tx: Prisma.TransactionClient, payload: TwitterAuthorInput) {
  const candidates = await tx.author.findMany({
    where: {
      OR: [
        {
          twitterId: payload.twitterId,
        },
        {
          twitterHandle: payload.twitterHandle,
        },
      ],
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  // Lock by primary key so competing callbacks update unique Twitter identifiers in the same order.
  for (const candidate of candidates) {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Author"
      WHERE "id" = ${candidate.id}
      FOR UPDATE
    `;
  }
}

async function retryTransientRegistrationConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= AUTHOR_REGISTRATION_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt === AUTHOR_REGISTRATION_RETRY_ATTEMPTS ||
        !isRetryableRegistrationConflict(error)
      ) {
        throw error;
      }

      await sleep(AUTHOR_REGISTRATION_RETRY_DELAY_MS * attempt);
    }
  }

  return operation();
}

function isRetryableRegistrationConflict(error: unknown) {
  return (
    hasErrorCode(error, RETRYABLE_PRISMA_ERROR_CODES) ||
    hasErrorCode(error, RETRYABLE_POSTGRES_ERROR_CODES)
  );
}

function hasErrorCode(error: unknown, codes: ReadonlySet<string>): boolean {
  if (!isRecord(error)) {
    return false;
  }

  if (typeof error.code === "string" && codes.has(error.code)) {
    return true;
  }

  if (isRecord(error.meta) && typeof error.meta.code === "string" && codes.has(error.meta.code)) {
    return true;
  }

  if (typeof error.message === "string") {
    const message = error.message.toLowerCase();

    if (
      (codes.has("40P01") && message.includes("deadlock detected")) ||
      (codes.has("40001") && message.includes("could not serialize access"))
    ) {
      return true;
    }
  }

  return hasErrorCode(error.cause, codes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
