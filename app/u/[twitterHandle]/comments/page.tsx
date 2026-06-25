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

type UserCommentsPageProps = {
  params: {
    twitterHandle: string;
  };
  searchParams?: {
    page?: string;
  };
};

export async function generateMetadata({
  params,
  searchParams,
}: UserCommentsPageProps): Promise<Metadata> {
  const author = await prisma.author.findUnique({
    where: {
      twitterHandle: params.twitterHandle.toLowerCase(),
    },
    select: {
      displayName: true,
      twitterHandle: true,
    },
  });

  if (!author) {
    return {
      title: "Author not found · AltBook",
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
        ? `${author.displayName} · Comments · Page ${page} · AltBook`
        : `${author.displayName} · Comments · AltBook`,
    description: `Comments by ${authorLabel(author)}.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function UserCommentsPage({
  params,
  searchParams,
}: UserCommentsPageProps) {
  const author = await prisma.author.findUnique({
    where: {
      twitterHandle: params.twitterHandle.toLowerCase(),
    },
    select: {
      id: true,
      displayName: true,
      twitterHandle: true,
    },
  });

  if (!author) {
    notFound();
  }

  const page = parseCommentPage(searchParams?.page);
  const commentPage = await getCommentBrowserPage({
    page,
    where: {
      authorId: author.id,
      status: "APPROVED",
    },
  });

  if (page > commentPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Author comments</p>
        <h1>{authorLabel(author)}</h1>
        <p className="intro">
          Comments by this author.{" "}
          <Link href={`/u/${author.twitterHandle}`}>View their posts</Link> ·{" "}
          <Link href={`/authors/${author.twitterHandle}/topics`}>View their topics</Link>
        </p>
      </section>

      <section className="comments" aria-labelledby="author-comments-title">
        <div className="section-heading">
          <h2 id="author-comments-title">Comments</h2>
          <p>{commentPage.totalCount} approved</p>
        </div>

        {commentPage.comments.length === 0 ? (
          <div className="empty">
            {author.displayName} has not published any approved comments yet.
          </div>
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
          ariaLabel="Author comment pagination"
          basePath={`/u/${author.twitterHandle}/comments`}
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
