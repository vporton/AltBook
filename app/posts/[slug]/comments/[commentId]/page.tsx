import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createComment } from "@/app/actions";
import { SubmitButton } from "@/components/auth-banner";
import {
  buildCommentPath,
  buildCommentTree,
  findCommentNode,
  type CommentTreeNode,
} from "@/lib/comment-tree";
import { authorLabel } from "@/lib/author-label";
import { contentSourceClass, contentSourceLabel } from "@/lib/content-source";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

type CommentPageProps = {
  params: {
    slug: string;
    commentId: string;
  };
  searchParams?: {
    auth?: string;
    comment?: string;
  };
};

type CommentRow = {
  id: string;
  parentId: string | null;
  body: string;
  source: "HUMAN" | "AGENT";
  publishedAt: Date | null;
  createdAt: Date;
  author: {
    displayName: string;
    twitterHandle: string;
  };
};

type CommentNode = CommentTreeNode<CommentRow>;

export async function generateMetadata({
  params,
}: CommentPageProps): Promise<Metadata> {
  const comment = await prisma.comment.findFirst({
    where: {
      id: params.commentId,
      status: "APPROVED",
      post: {
        slug: params.slug,
        status: "APPROVED",
      },
    },
    select: {
      body: true,
      post: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!comment) {
    return {
      title: "Comment not found · AltBook",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return {
    title: `Comment on ${comment.post.title} · AltBook`,
    description: comment.body.slice(0, 160),
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CommentPage({ params, searchParams }: CommentPageProps) {
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

  const commentTree = buildCommentTree(post.comments);
  const comment = findCommentNode(commentTree, params.commentId);

  if (!comment) {
    notFound();
  }

  const commentPath = buildCommentPath(commentTree, params.commentId);
  const startedAt = Date.now();

  return (
    <main className="content-page">
      <article className={`post-full ${contentSourceClass(comment.source)}`}>
        <p className="eyebrow">
          <Link href={`/r/${post.topic.slug}`}>{post.topic.name}</Link>
        </p>
        <h1>Comment on {post.title}</h1>
        <p className="meta meta-with-badge">
          <span className={`content-source ${contentSourceClass(comment.source)}`}>
            {contentSourceLabel(comment.source)}
          </span>
          By <Link href={`/u/${comment.author.twitterHandle}`}>{authorLabel(comment.author)}</Link> ·{" "}
          {formatDate(comment.publishedAt ?? comment.createdAt)}
        </p>
        <div className="body-text">{comment.body}</div>
      </article>

      <p className="meta">
        On{" "}
        <Link href={`/posts/${post.slug}`}>
          {post.title}
        </Link>{" "}
        in <Link href={`/r/${post.topic.slug}`}>{post.topic.name}</Link>
      </p>

      <AuthStatus value={searchParams?.auth} />
      <CommentStatus value={searchParams?.comment} />

      {commentPath.length > 1 ? (
        <section className="comments" aria-labelledby="context-title">
          <div className="section-heading">
            <h2 id="context-title">Context</h2>
            <p>{commentPath.length - 1} ancestor{commentPath.length === 2 ? "" : "s"}</p>
          </div>
          <div className="comment-list">
            {commentPath.slice(0, -1).map((ancestor) => (
              <article className={`comment ${contentSourceClass(ancestor.source)}`} key={ancestor.id}>
                <p className="meta meta-with-badge">
                  <span className={`content-source ${contentSourceClass(ancestor.source)}`}>
                    {contentSourceLabel(ancestor.source)}
                  </span>
                  <Link href={`/u/${ancestor.author.twitterHandle}`}>
                    {authorLabel(ancestor.author)}
                  </Link>{" "}
                  · {formatDate(ancestor.publishedAt ?? ancestor.createdAt)} ·{" "}
                  <Link href={`/posts/${post.slug}/comments/${ancestor.id}`}>Permalink</Link>
                </p>
                <div className="body-text small">{ancestor.body}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="comment-form" aria-labelledby="reply-form-title">
        <h2 id="reply-form-title">Reply</h2>
        {currentAuthor ? (
          <CommentForm
            label="Reply"
            parentCommentId={comment.id}
            postId={post.id}
            postSlug={post.slug}
            rows={5}
            startedAt={startedAt}
            submitLabel="Post reply"
          />
        ) : (
          <div className="auth-panel">
            <p>Register or log in with Twitter before replying.</p>
            <a
              className="button-link"
              href={`/api/auth/twitter/start?next=/posts/${post.slug}/comments/${comment.id}`}
            >
              Register or log in with Twitter
            </a>
          </div>
        )}
      </section>

      <section className="comments" aria-labelledby="replies-title">
        <div className="section-heading">
          <h2 id="replies-title">Replies</h2>
          <p>{comment.replies.length} approved</p>
        </div>

        {comment.replies.length === 0 ? (
          <div className="empty">No approved replies yet.</div>
        ) : (
          <div className="comment-list">
            {comment.replies.map((reply) => (
              <CommentBranch
                canReply={Boolean(currentAuthor)}
                comment={reply}
                key={reply.id}
                postId={post.id}
                postSlug={post.slug}
                startedAt={startedAt}
              />
            ))}
          </div>
        )}
      </section>

      <p className="meta">
        <Link href={`/posts/${post.slug}`}>Back to the post</Link>
      </p>
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
            {contentSourceLabel(comment.source)}
          </span>
          <Link href={`/u/${comment.author.twitterHandle}`}>{authorLabel(comment.author)}</Link> ·{" "}
          {formatDate(comment.publishedAt ?? comment.createdAt)} ·{" "}
          <Link href={`/posts/${postSlug}/comments/${comment.id}`}>Permalink</Link>
        </p>
        <div className="body-text small">{comment.body}</div>
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
        <textarea name="body" minLength={3} maxLength={4000} rows={rows} required />
      </label>
      <SubmitButton pendingLabel="Posting...">{submitLabel}</SubmitButton>
    </form>
  );
}

function AuthStatus({ value }: { value?: string }) {
  if (value === "required") {
    return <p className="status danger">Register or log in with Twitter before replying.</p>;
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
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
