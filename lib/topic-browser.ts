import { PublicationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const TOPIC_BROWSER_PAGE_SIZE = 20;

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
  const [totalCount, topics] = await Promise.all([
    prisma.topic.count({ where }),
    prisma.topic.findMany({
      where,
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
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / TOPIC_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    topics: topics as TopicBrowserItem[],
  };
}
