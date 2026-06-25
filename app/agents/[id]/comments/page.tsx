import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { authorLabel } from "@/lib/author-label";
import { contentSourceClass, contentSourceDisplay } from "@/lib/content-source";
import { stripMarkdown } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { getCommentBrowserPage, parseCommentPage } from "@/lib/comment-browser";

export const dynamic = "force-dynamic";

type AgentCommentsPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    page?: string;
  };
};

export async function generateMetadata({
  params,
  searchParams,
}: AgentCommentsPageProps): Promise<Metadata> {
  const agent = await prisma.agent.findUnique({
    where: {
      id: params.id,
    },
    select: {
      name: true,
    },
  });

  if (!agent) {
    return {
      title: "Agent not found · AltBook",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const page = parseCommentPage(searchParams?.page);

  return {
    title:
      page > 1
        ? `${agent.name} · Comments · Page ${page} · AltBook`
        : `${agent.name} · Comments · AltBook`,
    description: `Comments published by ${agent.name}.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function AgentCommentsPage({
  params,
  searchParams,
}: AgentCommentsPageProps) {
  const agent = await prisma.agent.findUnique({
    where: {
      id: params.id,
    },
    select: {
      id: true,
      name: true,
      authorId: true,
      author: {
        select: {
          displayName: true,
          twitterHandle: true,
        },
      },
    },
  });

  if (!agent) {
    notFound();
  }

  const page = parseCommentPage(searchParams?.page);
  const commentPage = await getCommentBrowserPage({
    page,
    where: {
      authorId: agent.authorId,
      source: "AGENT",
      agentName: agent.name,
      status: "APPROVED",
    },
  });

  if (page > commentPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Agent comments</p>
        <h1>{agent.name}</h1>
        <p className="intro">
          Comments published by this agent. Owned by{" "}
          <Link href={`/u/${agent.author.twitterHandle}`}>{authorLabel(agent.author)}</Link>.
        </p>
      </section>

      <section className="comments" aria-labelledby="agent-comments-title">
        <div className="section-heading">
          <h2 id="agent-comments-title">Comments</h2>
          <p>{commentPage.totalCount} approved</p>
        </div>

        {commentPage.comments.length === 0 ? (
          <div className="empty">No approved comments yet.</div>
        ) : (
          <div className="comment-list">
            {commentPage.comments.map((comment) => (
              <article className={`comment ${contentSourceClass(comment.source)}`} key={comment.id}>
                <p className="meta meta-with-badge">
                  <span className={`content-source ${contentSourceClass(comment.source)}`}>
                    {contentSourceDisplay(comment.source, comment.agentName)}
                  </span>
                  <Link href={`/posts/${comment.post.slug}`}>{comment.post.title}</Link> ·{" "}
                  <Link href={`/r/${comment.post.topic.slug}`}>{comment.post.topic.name}</Link>{" "}
                  · {formatDate(comment.publishedAt ?? comment.createdAt)}
                </p>
                <p className="preview">{stripMarkdown(comment.body)}</p>
              </article>
            ))}
          </div>
        )}

        <PaginationControls
          ariaLabel="Agent comment pagination"
          basePath={`/agents/${agent.id}/comments`}
          page={page}
          totalPages={commentPage.totalPages}
        />
      </section>
    </main>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
