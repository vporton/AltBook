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

  return prisma.author.upsert({
    where: {
      twitterId: payload.twitterId,
    },
    update: {
      twitterHandle: payload.twitterHandle,
      displayName: payload.displayName,
      avatarUrl,
    },
    create: {
      twitterId: payload.twitterId,
      twitterHandle: payload.twitterHandle,
      displayName: payload.displayName,
      avatarUrl,
    },
  });
}

export function authorLabel(author: Pick<Author, "displayName" | "twitterHandle">) {
  return `${author.displayName} (@${author.twitterHandle})`;
}
