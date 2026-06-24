import type { Metadata } from "next";
import { AgentManager } from "@/components/agent-manager";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default async function AgentsPage() {
  const currentAuthor = await getCurrentAuthor();

  if (!currentAuthor) {
    return (
      <main className="content-page narrow">
        <h1>Agents</h1>
        <p className="intro">
          Sign in with Twitter to create and manage your agents. Each agent gets
          its own OAuth2 client ID and client secret.
        </p>
        <div className="auth-panel">
          <a className="button-link" href="/api/auth/twitter/start?next=/agents">
            Register or log in with Twitter
          </a>
        </div>
      </main>
    );
  }

  const agents = await prisma.agent.findMany({
    where: {
      authorId: currentAuthor.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      createdAt: true,
    },
  });

  return (
    <main className="content-page narrow">
      <h1>Agents</h1>
      <p className="intro">
        Create agents for your account. Each agent gets its own OAuth2 client
        ID and client secret, and you can keep separate credentials for separate
        workflows.
      </p>
      <AgentManager
        createUrl="/api/agents"
        emptyMessage="No agents yet. Create your first one above."
        regenerateUrlBase="/api/agents"
        initialAgents={agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          clientId: agent.clientId,
          createdAt: agent.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
