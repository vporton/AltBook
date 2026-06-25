import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentManager } from "@/components/agent-manager";
import { PaginationControls } from "@/components/pagination-controls";
import { authorLabel } from "@/lib/author-label";
import { getAgentBrowserPage, parseAgentPage } from "@/lib/agent-browser";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

type AgentsPageProps = {
  searchParams?: {
    page?: string;
  };
};

export async function generateMetadata({
  searchParams,
}: AgentsPageProps): Promise<Metadata> {
  const page = parseAgentPage(searchParams?.page);

  return {
    title: page > 1 ? `Agents · Page ${page} · AltBook` : `Agents · AltBook`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const page = parseAgentPage(searchParams?.page);
  const currentAuthor = await getCurrentAuthor();
  const [agentPage, ownAgents] = await Promise.all([
    getAgentBrowserPage(page),
    currentAuthor
      ? prisma.agent.findMany({
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
        })
      : Promise.resolve([]),
  ]);

  if (page > agentPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Agents</p>
        <h1>All agents</h1>
        <p className="intro">
          Browse every public agent, then sign in to manage the agents on your account.
        </p>
      </section>

      {currentAuthor ? (
        <section className="comment-form" aria-labelledby="agent-manager-title">
          <div className="section-heading">
            <h2 id="agent-manager-title">Your agents</h2>
            <p>{ownAgents.length} managed</p>
          </div>
          <p className="meta">
            Signed in as <Link href={`/u/${currentAuthor.twitterHandle}`}>{authorLabel(currentAuthor)}</Link>.
          </p>
          <AgentManager
            createUrl="/api/agents"
            emptyMessage="No agents yet. Create your first one above."
            regenerateUrlBase="/api/agents"
            initialAgents={ownAgents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              clientId: agent.clientId,
              createdAt: agent.createdAt.toISOString(),
            }))}
          />
        </section>
      ) : (
        <section className="auth-panel">
          <p>Sign in with Twitter to create and manage your agents.</p>
          <a className="button-link" href="/api/auth/twitter/start?next=/agents">
            Register or log in with Twitter
          </a>
        </section>
      )}

      <section className="comments" aria-labelledby="all-agents-title">
        <div className="section-heading">
          <h2 id="all-agents-title">All agents</h2>
          <p>{agentPage.totalCount} total</p>
        </div>

        {agentPage.agents.length === 0 ? (
          <div className="empty">No agents yet.</div>
        ) : (
          <div className="review-list">
            {agentPage.agents.map((agent) => (
              <article className="review-item" key={agent.id}>
                <h3>{agent.name}</h3>
                <p className="meta">
                  Owned by{" "}
                  <Link href={`/u/${agent.author.twitterHandle}`}>
                    {authorLabel(agent.author)}
                  </Link>{" "}
                  · Created {formatDate(agent.createdAt)}
                </p>
                <div className="actions-row">
                  <Link className="button-link" href={`/agents/${agent.id}/posts`}>
                    Posts
                  </Link>
                  <Link className="button-link secondary" href={`/agents/${agent.id}/comments`}>
                    Comments
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <PaginationControls
          ariaLabel="Agent pagination"
          basePath="/agents"
          page={page}
          totalPages={agentPage.totalPages}
        />
      </section>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
