import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPost } from "@/app/actions";
import { authorLabel } from "@/lib/author-label";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

type TopicPageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    auth?: string;
    submitted?: string;
  };
};

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const topic = await prisma.topic.findUnique({
    where: {
      slug: params.slug,
    },
    select: {
      name: true,
      description: true,
    },
  });

  if (!topic) {
    return {
      title: "Topic not found · AltBook",
    };
  }

  return {
    title: `${topic.name} · AltBook`,
    description: topic.description ?? `Posts in ${topic.name}.`,
  };
}

export default async function TopicPage({ params, searchParams }: TopicPageProps) {
  const [topic, currentAuthor] = await Promise.all([
    prisma.topic.findUnique({
      where: {
        slug: params.slug,
      },
      include: {
        createdByAuthor: true,
        posts: {
          where: {
            status: "APPROVED",
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          include: {
            author: true,
            _count: {
              select: {
                comments: {
                  where: {
                    status: "APPROVED",
                  },
                },
              },
            },
          },
        },
      },
    }),
    getCurrentAuthor(),
  ]);

  if (!topic) {
    notFound();
  }

  const startedAt = Date.now();

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Topic</p>
        <h1>{topic.name}</h1>
        {topic.description ? <p className="intro">{topic.description}</p> : null}
      </section>

      {topic.createdByAuthor ? (
        <p className="meta">
          Created by{" "}
          <Link href={`/authors/${topic.createdByAuthor.twitterHandle}/topics`}>
            {authorLabel(topic.createdByAuthor)}
          </Link>
        </p>
      ) : null}

      <AuthStatus value={searchParams?.auth} />
      <SubmissionStatus value={searchParams?.submitted} />

      <section className="comment-form" aria-labelledby="topic-post-form-title">
        <h2 id="topic-post-form-title">Post to {topic.name}</h2>
        {currentAuthor ? (
          <form action={createPost} className="form">
            <input type="hidden" name="topicId" value={topic.id} />
            <input type="hidden" name="startedAt" value={startedAt} />
            <label className="hidden-field">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              Title
              <input name="title" minLength={4} maxLength={140} required />
            </label>
            <label>
              Post
              <textarea name="body" minLength={20} maxLength={12000} rows={9} required />
            </label>
            <button type="submit">Submit post</button>
          </form>
        ) : (
          <div className="auth-panel">
            <p>Register or log in with Twitter before posting to this topic.</p>
            <a className="button-link" href={`/api/auth/twitter/start?next=/topics/${topic.slug}`}>
              Register or log in with Twitter
            </a>
          </div>
        )}
      </section>

      <section className="comments" aria-labelledby="topic-posts-title">
        <div className="section-heading">
          <h2 id="topic-posts-title">Posts</h2>
          <p>{topic.posts.length} approved</p>
        </div>

        {topic.posts.length === 0 ? (
          <div className="empty">No approved posts in this topic yet.</div>
        ) : (
          <div className="post-list">
            {topic.posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div>
                  <h3>
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="meta">
                    By {authorLabel(post.author)} ·{" "}
                    {formatDate(post.publishedAt ?? post.createdAt)} ·{" "}
                    {post._count.comments} comments
                  </p>
                </div>
                <p className="preview">{post.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AuthStatus({ value }: { value?: string }) {
  if (value === "required") {
    return <p className="status danger">Register or log in with Twitter before posting.</p>;
  }

  if (value === "failed") {
    return <p className="status danger">Twitter registration failed. Please try again.</p>;
  }

  return null;
}

function SubmissionStatus({ value }: { value?: string }) {
  if (value === "approved") {
    return <p className="status success">Your post is live.</p>;
  }

  if (value === "rejected") {
    return <p className="status danger">The post did not pass moderation.</p>;
  }

  return null;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
