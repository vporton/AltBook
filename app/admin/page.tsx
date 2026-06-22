import {
  adminLogin,
  adminLogout,
  approveComment,
  approvePost,
  rejectComment,
  rejectPost,
} from "@/app/admin/actions";
import { AgentManager } from "@/app/admin/agent-manager";
import { authorLabel } from "@/lib/authors";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!process.env.ADMIN_TOKEN) {
    return (
      <main className="content-page narrow">
        <h1>Moderation</h1>
        <p className="status danger">
          Admin review is disabled until ADMIN_TOKEN is configured.
        </p>
      </main>
    );
  }

  if (!getAdminSession()) {
    return (
      <main className="content-page narrow">
        <h1>Moderation</h1>
        {searchParams?.error ? (
          <p className="status danger">Invalid admin token.</p>
        ) : null}
        <form action={adminLogin} className="form">
          <label>
            Admin token
            <input name="token" type="password" required />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  const [posts, comments, agents] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
      include: {
        author: true,
        topic: true,
        decisions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.comment.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
      include: {
        author: true,
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
        decisions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.agent.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <main className="content-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1>Review Queue</h1>
        </div>
        <form action={adminLogout}>
          <button className="secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <section aria-labelledby="pending-posts">
        <div className="section-heading">
          <h2 id="pending-posts">Pending posts</h2>
          <p>{posts.length}</p>
        </div>
        {posts.length === 0 ? (
          <div className="empty">No pending posts.</div>
        ) : (
          <div className="review-list">
            {posts.map((post) => (
              <article className="review-item" key={post.id}>
                <h3>{post.title}</h3>
                <p className="meta">
                  {post.topic.name} · By {authorLabel(post.author)} ·{" "}
                  {formatDate(post.createdAt)}
                </p>
                <div className="body-text small">{post.body}</div>
                <Decision decision={post.decisions[0]} />
                <div className="actions-row">
                  <form action={approvePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={rejectPost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button className="danger-button" type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="pending-comments">
        <div className="section-heading">
          <h2 id="pending-comments">Pending comments</h2>
          <p>{comments.length}</p>
        </div>
        {comments.length === 0 ? (
          <div className="empty">No pending comments.</div>
        ) : (
          <div className="review-list">
            {comments.map((comment) => (
              <article className="review-item" key={comment.id}>
                <h3>On {comment.post.title}</h3>
                <p className="meta">
                  By {authorLabel(comment.author)} · {formatDate(comment.createdAt)}
                </p>
                <div className="body-text small">{comment.body}</div>
                <Decision decision={comment.decisions[0]} />
                <div className="actions-row">
                  <form action={approveComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={rejectComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <button className="danger-button" type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="agents">
        <div className="section-heading">
          <h2 id="agents">Agents</h2>
          <p>{agents.length}</p>
        </div>
        <AgentManager
          initialAgents={agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            clientId: agent.clientId,
            createdAt: agent.createdAt.toISOString(),
          }))}
        />
      </section>
    </main>
  );
}

function Decision({
  decision,
}: {
  decision?: {
    provider: string;
    model: string;
    outcome: string;
    reason: string;
  };
}) {
  if (!decision) {
    return null;
  }

  return (
    <p className="moderation-note">
      {decision.provider}/{decision.model}: {decision.outcome}. {decision.reason}
    </p>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
