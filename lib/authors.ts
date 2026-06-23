import "server-only";
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

  const updateData = {
    twitterId: payload.twitterId,
    twitterHandle: payload.twitterHandle,
    displayName: payload.displayName,
    avatarUrl,
  };

  const existingByTwitterId = await prisma.author.findUnique({
    where: {
      twitterId: payload.twitterId,
    },
  });

  if (existingByTwitterId) {
    return prisma.author.update({
      where: {
        twitterId: payload.twitterId,
      },
      data: updateData,
    });
  }

  const existingByHandle = await prisma.author.findUnique({
    where: {
      twitterHandle: payload.twitterHandle,
    },
  });

  if (existingByHandle) {
    return prisma.author.update({
      where: {
        id: existingByHandle.id,
      },
      data: updateData,
    });
  }

  try {
    return await prisma.author.create({
      data: updateData,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const conflictedAuthor =
      (await prisma.author.findUnique({
        where: {
          twitterId: payload.twitterId,
        },
      })) ??
      (await prisma.author.findUnique({
        where: {
          twitterHandle: payload.twitterHandle,
        },
      }));

    if (!conflictedAuthor) {
      throw error;
    }

    return prisma.author.update({
      where: {
        id: conflictedAuthor.id,
      },
      data: updateData,
    });
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
