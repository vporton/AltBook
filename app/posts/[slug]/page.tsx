import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createComment } from "@/app/actions";
import { authorLabel } from "@/lib/author-label";
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
    description: post.body.slice(0, 160),
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

  return (
    <main className="content-page">
      <article className="post-full">
        <p className="eyebrow">
          <Link href={`/topics/${post.topic.slug}`}>{post.topic.name}</Link>
        </p>
        <h1>{post.title}</h1>
        <p className="meta">
          By {authorLabel(post.author)} · {formatDate(post.publishedAt ?? post.createdAt)}
        </p>
        <div className="body-text">{post.body}</div>
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
            {post.comments.map((comment) => (
              <article className="comment" key={comment.id}>
                <p className="meta">
                  {authorLabel(comment.author)} ·{" "}
                  {formatDate(comment.publishedAt ?? comment.createdAt)}
                </p>
                <div className="body-text small">{comment.body}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="comment-form" aria-labelledby="comment-form-title">
        <h2 id="comment-form-title">Add a comment</h2>
        {currentAuthor ? (
          <form action={createComment} className="form">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="postSlug" value={post.slug} />
            <input type="hidden" name="startedAt" value={startedAt} />
            <label className="hidden-field">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              Comment
              <textarea name="body" minLength={3} maxLength={4000} rows={5} required />
            </label>
            <button type="submit">Submit comment</button>
          </form>
        ) : (
          <div className="auth-panel">
            <p>Register through Twitter before commenting.</p>
            <a className="button-link" href={`/api/auth/twitter/start?next=/posts/${post.slug}`}>
              Register with Twitter
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

function AuthStatus({ value }: { value?: string }) {
  if (value === "required") {
    return <p className="status danger">Register with Twitter before commenting.</p>;
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

  if (value === "review") {
    return <p className="status">Your comment is waiting for moderation review.</p>;
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
