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

// Topic slugs stay lowercase and underscore-separated.
function topicSlugify(input: string, fallback = "topic") {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

function topicSlugSuffix(index: number) {
  let value = index;
  let suffix = "";

  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }

  return suffix;
}

function topicSlugVariant(base: string, index: number) {
  const suffix = topicSlugSuffix(index);
  const maxBaseLength = Math.max(1, 80 - suffix.length - 1);
  const trimmedBase = base.slice(0, maxBaseLength).replace(/_+$/g, "") || "topic";

  return `${trimmedBase}_${suffix}`;
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
  const base = topicSlugify(name, "topic");
  let candidate = base;
  let counter = 1;

  while (await tx.topic.findUnique({ where: { slug: candidate } })) {
    candidate = topicSlugVariant(base, counter);
    counter += 1;
  }

  return candidate;
}
