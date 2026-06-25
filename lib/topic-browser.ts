import { PublicationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const TOPIC_BROWSER_PAGE_SIZE = 20;
export const POST_BROWSER_PAGE_SIZE = 20;

export type TopicBrowserItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdByAuthor: {
    twitterHandle: string;
    displayName: string;
  } | null;
  _count: {
    posts: number;
  };
};

export function parseTopicPage(value?: string) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function getTopicBrowserPage({
  page,
  where,
}: {
  page: number;
  where?: Prisma.TopicWhereInput;
}) {
  const skip = (page - 1) * TOPIC_BROWSER_PAGE_SIZE;
  const queryWhere = where ? { where } : undefined;
  const totalCount = await prisma.topic.count({ where: where ?? {} });
  const topics = await prisma.topic.findMany({
    ...(queryWhere ?? {}),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip,
    take: TOPIC_BROWSER_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      createdByAuthor: {
        select: {
          twitterHandle: true,
          displayName: true,
        },
      },
      _count: {
        select: {
          posts: {
            where: {
              status: PublicationStatus.APPROVED,
            },
          },
        },
      },
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / TOPIC_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    topics: topics as TopicBrowserItem[],
  };
}

export type PostBrowserItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  source: "HUMAN" | "AGENT";
  agentName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  author: {
    displayName: string;
    twitterHandle: string;
  };
  topic: {
    slug: string;
    name: string;
  };
  _count: {
    comments: number;
  };
};

export function parsePostPage(value?: string) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function getPostBrowserPage({
  page,
  where,
}: {
  page: number;
  where?: Prisma.PostWhereInput;
}) {
  const skip = (page - 1) * POST_BROWSER_PAGE_SIZE;
  const totalCount = await prisma.post.count({
    where: where ?? {},
  });
  const posts = await prisma.post.findMany({
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
    take: POST_BROWSER_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      title: true,
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
      topic: {
        select: {
          slug: true,
          name: true,
        },
      },
      _count: {
        select: {
          comments: {
            where: {
              status: PublicationStatus.APPROVED,
            },
          },
        },
      },
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / POST_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    posts: posts as PostBrowserItem[],
  };
}
