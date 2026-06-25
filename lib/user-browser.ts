import { PublicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const USER_BROWSER_PAGE_SIZE = 20;

export type UserBrowserItem = {
  id: string;
  twitterHandle: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  _count: {
    posts: number;
    comments: number;
  };
};

export function parseUserPage(value?: string) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function getUserBrowserPage(page: number) {
  const skip = (page - 1) * USER_BROWSER_PAGE_SIZE;
  const totalCount = await prisma.author.count();
  const authors = await prisma.author.findMany({
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    skip,
    take: USER_BROWSER_PAGE_SIZE,
    select: {
      id: true,
      twitterHandle: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          posts: {
            where: {
              status: PublicationStatus.APPROVED,
            },
          },
          comments: {
            where: {
              status: PublicationStatus.APPROVED,
            },
          },
        },
      },
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / USER_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    users: authors as UserBrowserItem[],
  };
}
