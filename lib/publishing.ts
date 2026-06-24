import { Prisma, PublicationStatus } from "@prisma/client";
import { z } from "zod";
import { moderateSubmission, type ModerationResult } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { createUniquePostSlug, createUniqueTopicSlug } from "@/lib/slug";

const authorRefSchema = {
  authorId: z.string().trim().min(1).optional(),
  authorTwitterId: z.string().trim().min(1).max(80).optional(),
};

const topicSlugPattern = /^[a-z]+(?:_[a-z]+)*$/;
const topicSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(topicSlugPattern);

const topicRefSchema = {
  topicId: z.string().trim().min(1).optional(),
  topicSlug: topicSlugSchema.optional(),
};

const postRefSchema = {
  id: z.string().trim().min(1).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
};

const contentSourceSchema = z.enum(["HUMAN", "AGENT"]).default("HUMAN");

export const postInputSchema = z
  .object({
    title: z.string().trim().min(4).max(140),
    body: z.string().trim().min(20).max(12000),
    source: contentSourceSchema,
    ...authorRefSchema,
    ...topicRefSchema,
  })
  .superRefine((payload, context) => {
    if (!payload.authorId && !payload.authorTwitterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A registered Twitter author is required.",
        path: ["authorTwitterId"],
      });
    }

    if (!payload.topicId && !payload.topicSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A topic is required.",
        path: ["topicSlug"],
      });
    }
  });

export const postUpdateSchema = z
  .object({
    ...postRefSchema,
    title: z.string().trim().min(4).max(140).optional(),
    body: z.string().trim().min(20).max(12000).optional(),
    ...authorRefSchema,
    ...topicRefSchema,
  })
  .superRefine((payload, context) => {
    requirePostRef(payload, context);

    if (
      !payload.title &&
      !payload.body &&
      !payload.authorId &&
      !payload.authorTwitterId &&
      !payload.topicId &&
      !payload.topicSlug
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one post field is required.",
        path: ["title"],
      });
    }
  });

export const postDeleteSchema = z.object(postRefSchema).superRefine(requirePostRef);

export const commentInputSchema = z
  .object({
    postId: z.string().min(1),
    parentCommentId: z.string().trim().min(1).optional(),
    body: z.string().trim().min(3).max(4000),
    source: contentSourceSchema,
    ...authorRefSchema,
  })
  .superRefine((payload, context) => {
    if (!payload.authorId && !payload.authorTwitterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A registered Twitter author is required.",
        path: ["authorTwitterId"],
      });
    }
  });

export const topicInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: topicSlugSchema.optional(),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  ...authorRefSchema,
});

export class PublishingInputError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PublishingInputError";
  }
}

export async function createModeratedPost(input: unknown) {
  const payload = postInputSchema.parse(input);
  const [author, topic] = await Promise.all([
    resolveAuthor(payload),
    resolveTopic(payload),
  ]);
  const moderation = await moderateSubmission({
    kind: "post",
    title: payload.title,
    body: payload.body,
  });
  const slug = await createUniquePostSlug(payload.title);
  const isApproved = moderation.status === PublicationStatus.APPROVED;
  const post = await prisma.post.create({
    data: {
      topicId: topic.id,
      authorId: author.id,
      source: payload.source,
      title: payload.title,
      slug,
      body: payload.body,
      status: moderation.status,
      links: toJson(moderation.links.links),
      publishedAt: isApproved ? new Date() : null,
      decisions: {
        create: moderationDecisionData("post", moderation),
      },
    },
    include: {
      author: true,
      topic: true,
    },
  });

  return {
    post,
    moderation,
  };
}

export async function updatePost(input: unknown) {
  const payload = postUpdateSchema.parse(input);
  const existing = await prisma.post.findUnique({
    where: postWhereUnique(payload),
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      publishedAt: true,
      author: {
        select: {
          twitterHandle: true,
        },
      },
      topic: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!existing) {
    throw new PublishingInputError("Post not found.", 404);
  }

  const [author, topic] = await Promise.all([
    hasAuthorRef(payload) ? resolveAuthor(payload) : null,
    hasTopicRef(payload) ? resolveTopic(payload) : null,
  ]);
  const shouldModerate = Boolean(payload.title || payload.body);
  const moderation = shouldModerate
    ? await moderateSubmission({
        kind: "post",
        title: payload.title ?? existing.title,
        body: payload.body ?? existing.body,
      })
    : null;
  const data: Prisma.PostUpdateInput = {};

  if (payload.title) {
    data.title = payload.title;
  }

  if (payload.body) {
    data.body = payload.body;
  }

  if (author) {
    data.author = {
      connect: {
        id: author.id,
      },
    };
  }

  if (topic) {
    data.topic = {
      connect: {
        id: topic.id,
      },
    };
  }

  if (moderation) {
    const isApproved = moderation.status === PublicationStatus.APPROVED;

    data.status = moderation.status;
    data.links = toJson(moderation.links.links);
    data.publishedAt = isApproved ? existing.publishedAt ?? new Date() : null;
    data.decisions = {
      create: moderationDecisionData("post", moderation),
    };
  }

  const post = await prisma.post.update({
    where: {
      id: existing.id,
    },
    data,
    include: {
      author: true,
      topic: true,
    },
  });

  return {
    post,
    moderation,
    previous: existing,
  };
}

export async function deletePost(input: unknown) {
  const payload = postDeleteSchema.parse(input);
  const post = await prisma.post.findUnique({
    where: postWhereUnique(payload),
    select: {
      id: true,
      slug: true,
      author: {
        select: {
          twitterHandle: true,
        },
      },
      topic: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!post) {
    throw new PublishingInputError("Post not found.", 404);
  }

  await prisma.post.delete({
    where: {
      id: post.id,
    },
  });

  return post;
}

export async function createModeratedComment(input: unknown) {
  const payload = commentInputSchema.parse(input);
  const [author, post] = await Promise.all([
    resolveAuthor(payload),
    prisma.post.findFirstOrThrow({
      where: {
        id: payload.postId,
        status: PublicationStatus.APPROVED,
      },
      select: {
        id: true,
        slug: true,
      },
    }),
  ]);
  const parentComment = payload.parentCommentId
    ? await prisma.comment.findFirst({
        where: {
          id: payload.parentCommentId,
          postId: post.id,
          status: PublicationStatus.APPROVED,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (payload.parentCommentId && !parentComment) {
    throw new PublishingInputError("Parent comment not found.", 404);
  }

  const moderation = await moderateSubmission({
    kind: "comment",
    body: payload.body,
  });
  const isApproved = moderation.status === PublicationStatus.APPROVED;
  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      parentId: parentComment?.id ?? null,
      authorId: author.id,
      source: payload.source,
      body: payload.body,
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

export async function createTopic(input: unknown) {
  const payload = topicInputSchema.parse(input);
  const createdByAuthor = await resolveOptionalAuthor(payload);
  const slug = payload.slug ?? (await createUniqueTopicSlug(payload.name));

  if (await prisma.topic.findUnique({ where: { slug } })) {
    throw new PublishingInputError("Topic slug already exists.", 409);
  }

  return prisma.topic.create({
    data: {
      name: payload.name,
      slug,
      description: payload.description || null,
      createdByAuthorId: createdByAuthor?.id ?? null,
    },
  });
}

async function resolveAuthor(input: {
  authorId?: string;
  authorTwitterId?: string;
}) {
  const author = await resolveOptionalAuthor(input);

  if (!author) {
    throw new PublishingInputError("Registered Twitter author not found.", 404);
  }

  return author;
}

async function resolveOptionalAuthor(input: {
  authorId?: string;
  authorTwitterId?: string;
}) {
  if (input.authorId) {
    return prisma.author.findUnique({
      where: {
        id: input.authorId,
      },
    });
  }

  if (input.authorTwitterId) {
    return prisma.author.findUnique({
      where: {
        twitterId: input.authorTwitterId,
      },
    });
  }

  return null;
}

function requirePostRef(
  input: {
    id?: string;
    slug?: string;
  },
  context: z.RefinementCtx,
) {
  if (!input.id && !input.slug) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A post id or slug is required.",
      path: ["id"],
    });
  }
}

function postWhereUnique(input: {
  id?: string;
  slug?: string;
}): Prisma.PostWhereUniqueInput {
  if (input.id) {
    return {
      id: input.id,
    };
  }

  if (input.slug) {
    return {
      slug: input.slug,
    };
  }

  throw new PublishingInputError("A post id or slug is required.");
}

function hasAuthorRef(input: {
  authorId?: string;
  authorTwitterId?: string;
}) {
  return Boolean(input.authorId || input.authorTwitterId);
}

function hasTopicRef(input: { topicId?: string; topicSlug?: string }) {
  return Boolean(input.topicId || input.topicSlug);
}

async function resolveTopic(input: { topicId?: string; topicSlug?: string }) {
  if (input.topicId) {
    const topic = await prisma.topic.findUnique({
      where: {
        id: input.topicId,
      },
    });

    if (topic) {
      return topic;
    }
  }

  if (input.topicSlug) {
    const topic = await prisma.topic.findUnique({
      where: {
        slug: input.topicSlug,
      },
    });

    if (topic) {
      return topic;
    }
  }

  throw new PublishingInputError("Topic not found.", 404);
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
