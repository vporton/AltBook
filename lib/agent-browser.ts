import { prisma } from "@/lib/prisma";

export const AGENT_BROWSER_PAGE_SIZE = 20;

export type AgentBrowserItem = {
  id: string;
  name: string;
  createdAt: Date;
  author: {
    displayName: string;
    twitterHandle: string;
  };
};

export function parseAgentPage(value?: string) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function getAgentBrowserPage(page: number) {
  const skip = (page - 1) * AGENT_BROWSER_PAGE_SIZE;
  const totalCount = await prisma.agent.count();
  const agents = await prisma.agent.findMany({
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    skip,
    take: AGENT_BROWSER_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      createdAt: true,
      author: {
        select: {
          displayName: true,
          twitterHandle: true,
        },
      },
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / AGENT_BROWSER_PAGE_SIZE));

  return {
    totalCount,
    totalPages,
    agents: agents as AgentBrowserItem[],
  };
}
