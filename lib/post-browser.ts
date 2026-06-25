import { PublicationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const POST_BROWSER_PAGE_SIZE = 20;

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
