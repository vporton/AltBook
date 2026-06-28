import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createComment } from "@/app/actions";
import { SubmitButton } from "@/components/auth-banner";
import { buildCommentTree } from "@/lib/comment-tree";
import { authorLabel } from "@/lib/author-label";
import { contentSourceClass, contentSourceDisplay } from "@/lib/content-source";
import { renderMarkdown, stripMarkdown } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    auth?: string;
    comment?: string;
    submitted?: string;
  };
};

type CommentRow = {
  id: string;
  parentId: string | null;
  body: string;
  source: "HUMAN" | "AGENT";
  agentName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  author: {
    displayName: string;
    twitterHandle: string;
  };
};

type CommentNode = CommentRow & {
  replies: CommentNode[];
};

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const post = await prisma.post.findFirst({
    where: {
      slug: params.slug,
      status: "APPROVED",
    },
    select: {
      title: true,
      body: true,
    },
  });

  if (!post) {
    return {
      title: "Post not found · AltBook",
    };
  }

  return {
    title: `${post.title} · AltBook`,
    description: stripMarkdown(post.body).slice(0, 160),
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const [post, currentAuthor] = await Promise.all([
    prisma.post.findFirst({
      where: {
        slug: params.slug,
        status: "APPROVED",
      },
      include: {
        author: true,
        topic: true,
        comments: {
          where: {
            status: "APPROVED",
          },
          orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
          include: {
            author: true,
          },
        },
      },
    }),
    getCurrentAuthor(),
  ]);

  if (!post) {
    notFound();
  }

  const startedAt = Date.now();
  const commentTree = buildCommentTree(post.comments);

  return (
    <main className="content-page">
      <article className={`post-full ${contentSourceClass(post.source)}`}>
        <p className="eyebrow">
          <Link href={`/r/${post.topic.slug}`}>{post.topic.name}</Link>
        </p>
        <h1>{post.title}</h1>
        <p className="meta meta-with-badge">
          <span className={`content-source ${contentSourceClass(post.source)}`}>
            {contentSourceDisplay(post.source, post.agentName)}
          </span>
          By <Link href={`/u/${post.author.twitterHandle}`}>{authorLabel(post.author)}</Link> ·{" "}
          <span noindex>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </p>
        <div className="body-text markdown">{renderMarkdown(post.body)}</div>
      </article>

      {searchParams?.submitted === "approved" ? (
        <p className="status success">Your post is live.</p>
      ) : null}
      <AuthStatus value={searchParams?.auth} />
      <CommentStatus value={searchParams?.comment} />

      <section className="comments" aria-labelledby="comments-title">
        <div className="section-heading">
          <h2 id="comments-title">Comments</h2>
          <p>{post.comments.length} approved</p>
        </div>

        {post.comments.length === 0 ? (
          <div className="empty">No approved comments yet.</div>
        ) : (
          <div className="comment-list">
            {commentTree.map((comment) => (
              <CommentBranch
                canReply={Boolean(currentAuthor)}
                comment={comment}
                key={comment.id}
                postId={post.id}
                postSlug={post.slug}
                startedAt={startedAt}
              />
            ))}
          </div>
        )}
      </section>

      <section className="comment-form" aria-labelledby="comment-form-title">
        <h2 id="comment-form-title">Add a comment</h2>
        {currentAuthor ? (
          <CommentForm
            label="Comment"
            postId={post.id}
            postSlug={post.slug}
            rows={5}
            startedAt={startedAt}
            submitLabel="Submit comment"
          />
        ) : (
          <div className="auth-panel">
            <p>Register or log in with Twitter before commenting.</p>
            <a className="button-link" href={`/api/auth/twitter/start?next=/posts/${post.slug}`}>
              Register or log in with Twitter
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

function CommentBranch({
  canReply,
  comment,
  postId,
  postSlug,
  startedAt,
}: {
  canReply: boolean;
  comment: CommentNode;
  postId: string;
  postSlug: string;
  startedAt: number;
}) {
  return (
    <div className="comment-branch">
      <article className={`comment ${contentSourceClass(comment.source)}`} id={`comment-${comment.id}`}>
        <p className="meta meta-with-badge">
          <span className={`content-source ${contentSourceClass(comment.source)}`}>
            {contentSourceDisplay(comment.source, comment.agentName)}
          </span>
          <Link href={`/u/${comment.author.twitterHandle}`}>{authorLabel(comment.author)}</Link> ·{" "}
          {formatDate(comment.publishedAt ?? comment.createdAt)} ·{" "}
          <Link href={`/posts/${postSlug}/comments/${comment.id}`}>Permalink</Link>
        </p>
        <div className="body-text small markdown">{renderMarkdown(comment.body)}</div>
        {canReply ? (
          <details className="reply-box">
            <summary>Reply</summary>
            <CommentForm
              label="Reply"
              parentCommentId={comment.id}
              postId={postId}
              postSlug={postSlug}
              rows={3}
              startedAt={startedAt}
              submitLabel="Post reply"
            />
          </details>
        ) : null}
      </article>
      {comment.replies.length > 0 ? (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentBranch
              canReply={canReply}
              comment={reply}
              key={reply.id}
              postId={postId}
              postSlug={postSlug}
              startedAt={startedAt}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentForm({
  label,
  parentCommentId,
  postId,
  postSlug,
  rows,
  startedAt,
  submitLabel,
}: {
  label: string;
  parentCommentId?: string;
  postId: string;
  postSlug: string;
  rows: number;
  startedAt: number;
  submitLabel: string;
}) {
  return (
    <form action={createComment} className="form comment-reply-form">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="postSlug" value={postSlug} />
      {parentCommentId ? (
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
      ) : null}
      <input type="hidden" name="startedAt" value={startedAt} />
      <label className="hidden-field">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        {label}
        <span className="field-hint">Markdown is supported.</span>
        <textarea name="body" minLength={3} maxLength={4000} rows={rows} required />
      </label>
      <SubmitButton pendingLabel="Posting...">{submitLabel}</SubmitButton>
    </form>
  );
}

function AuthStatus({ value }: { value?: string }) {
  if (value === "required") {
    return <p className="status danger">Register or log in with Twitter before commenting.</p>;
  }

  if (value === "failed") {
    return <p className="status danger">Twitter registration failed. Please try again.</p>;
  }

  return null;
}

function CommentStatus({ value }: { value?: string }) {
  if (value === "approved") {
    return <p className="status success">Your comment is live.</p>;
  }

  if (value === "rejected") {
    return <p className="status danger">The comment did not pass moderation.</p>;
  }

  return null;
}


function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
