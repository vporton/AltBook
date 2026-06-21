import { Prisma, PublicationStatus } from "@prisma/client";
import { z } from "zod";
import { hashEmail } from "@/lib/human";
import { moderateSubmission, type ModerationResult } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { createUniqueSlug } from "@/lib/slug";

export const postInputSchema = z.object({
  title: z.string().trim().min(4).max(140),
  body: z.string().trim().min(20).max(12000),
  authorName: z.string().trim().min(2).max(80),
  authorEmail: z.string().trim().email().optional().or(z.literal("")),
});

export const commentInputSchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(3).max(4000),
  authorName: z.string().trim().min(2).max(80),
  authorEmail: z.string().trim().email().optional().or(z.literal("")),
});

export async function createModeratedPost(input: unknown) {
  const payload = postInputSchema.parse(input);
  const moderation = await moderateSubmission({
    kind: "post",
    title: payload.title,
    body: payload.body,
  });
  const slug = await createUniqueSlug(payload.title);
  const isApproved = moderation.status === PublicationStatus.APPROVED;
  const post = await prisma.post.create({
    data: {
      title: payload.title,
      slug,
      body: payload.body,
      authorName: payload.authorName,
      authorEmailHash: hashEmail(payload.authorEmail),
      status: moderation.status,
      links: toJson(moderation.links.links),
      publishedAt: isApproved ? new Date() : null,
      decisions: {
        create: moderationDecisionData("post", moderation),
      },
    },
  });

  return {
    post,
    moderation,
  };
}

export async function createModeratedComment(input: unknown) {
  const payload = commentInputSchema.parse(input);
  const post = await prisma.post.findFirstOrThrow({
    where: {
      id: payload.postId,
      status: PublicationStatus.APPROVED,
    },
    select: {
      id: true,
      slug: true,
    },
  });
  const moderation = await moderateSubmission({
    kind: "comment",
    body: payload.body,
  });
  const isApproved = moderation.status === PublicationStatus.APPROVED;
  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      body: payload.body,
      authorName: payload.authorName,
      authorEmailHash: hashEmail(payload.authorEmail),
      status: moderation.status,
      links: toJson(moderation.links.links),
      publishedAt: isApproved ? new Date() : null,
      decisions: {
        create: moderationDecisionData("comment", moderation),
      },
    },
  });

  return {
    comment,
    moderation,
    post,
  };
}

function moderationDecisionData(
  contentKind: "post" | "comment",
  moderation: ModerationResult,
) {
  return {
    contentKind,
    provider: moderation.provider,
    model: moderation.model,
    outcome: moderation.outcome,
    score: moderation.score,
    reason: moderation.reason,
    links: toJson(moderation.links.links),
    categories: toJson(moderation.categories),
    rawResponse: toNullableJson(moderation.rawResponse),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toNullableJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null || value === undefined ? Prisma.JsonNull : toJson(value);
}
