import type { Author } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

export async function registerTwitterAuthor(input: unknown) {
  const payload = twitterAuthorInputSchema.parse(input);
  const avatarUrl = payload.avatarUrl || null;

  return prisma.$transaction(async (tx) => {
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
        data: {
          twitterHandle: payload.twitterHandle,
          displayName: payload.displayName,
          avatarUrl,
        },
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
        data: {
          twitterId: payload.twitterId,
          twitterHandle: payload.twitterHandle,
          displayName: payload.displayName,
          avatarUrl,
        },
      });
    }

    return tx.author.create({
      data: {
        twitterId: payload.twitterId,
        twitterHandle: payload.twitterHandle,
        displayName: payload.displayName,
        avatarUrl,
      },
    });
  });
}

export function authorLabel(author: Pick<Author, "displayName" | "twitterHandle">) {
  return `${author.displayName} (@${author.twitterHandle})`;
}
