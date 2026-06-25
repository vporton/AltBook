import { PublicationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const COMMENT_BROWSER_PAGE_SIZE = 20;

export type CommentBrowserItem = {
  id: string;
  body: string;
  source: "HUMAN" | "AGENT";
  agentName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  author: {
    displayName: string;
    twitterHandle: string;
  };
  post: {
    slug: string;
    title: string;
    topic: {
      slug: string;
      name: string;
    };
  };
};

export function parseCommentPage(value?: string) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function getCommentBrowserPage({
  page,
  where,
}: {
  page: number;
  where?: Prisma.CommentWhereInput;
}) {
  const skip = (page - 1) * COMMENT_BROWSER_PAGE_SIZE;
  const totalCount = await prisma.comment.count({
    where: where ?? {},
  });
  const comments = await prisma.comment.findMany({
    where,
    orderBy: [
      {
        publishedAt: "desc",
      },
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    skip,
    take: COMMENT_BROWSER_PAGE_SIZE,
    select: {
      id: true,
      body: true,
      source: true,
      agentName: true,
      publishedAt: true,
      createdAt: true,
      author: {
        select: {
          displayName: true,
          twitterHandle: true,
        },
      },
      post: {
        select: {
          slug: true,
          title: true,
          topic: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / COMMENT_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    comments: comments as CommentBrowserItem[],
  };
}

export function publishedCommentWhere({
  authorId,
  agentName,
}: {
  authorId: string;
  agentName?: string;
}) {
  return {
    authorId,
    status: PublicationStatus.APPROVED,
    ...(agentName
      ? {
          source: "AGENT" as const,
          agentName,
        }
      : {}),
  };
}
