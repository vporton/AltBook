import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function slugify(input: string, fallback = "post") {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

export async function createUniqueSlug(title: string) {
  return createUniquePostSlug(title);
}

export async function createUniquePostSlug(title: string) {
  const base = slugify(title, "post");
  let candidate = base;
  let counter = 2;

  while (await prisma.post.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export async function createUniqueTopicSlug(
  name: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const base = slugify(name, "topic");
  let candidate = base;
  let counter = 2;

  while (await tx.topic.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}
