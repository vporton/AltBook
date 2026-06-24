import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { authorLabel } from "@/lib/author-label";
import { contentSourceClass, contentSourceLabel } from "@/lib/content-source";
import { stripMarkdown } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { getPostBrowserPage, parsePostPage } from "@/lib/topic-browser";

export const dynamic = "force-dynamic";

type UserPageProps = {
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
}: UserPageProps): Promise<Metadata> {
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

  const page = parsePostPage(searchParams?.page);

  return {
    title:
      page > 1
        ? `${author.displayName} · Posts · Page ${page} · AltBook`
        : `${author.displayName} · Posts · AltBook`,
    description: `Posts by ${authorLabel(author)}.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function UserPage({ params, searchParams }: UserPageProps) {
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

  const page = parsePostPage(searchParams?.page);
  const postPage = await getPostBrowserPage({
    page,
    where: {
      authorId: author.id,
      status: "APPROVED",
    },
  });

  if (page > postPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Author</p>
        <h1>{authorLabel(author)}</h1>
        <p className="intro">
          Public posts by this author.{" "}
          <Link href={`/authors/${author.twitterHandle}/topics`}>View their topics</Link>
        </p>
      </section>

      <section className="comments" aria-labelledby="author-posts-title">
        <div className="section-heading">
          <h2 id="author-posts-title">Posts</h2>
          <p>{postPage.totalCount} approved</p>
        </div>

        {postPage.posts.length === 0 ? (
          <div className="empty">
            {author.displayName} has not published any approved posts yet.
          </div>
        ) : (
          <div className="post-list">
            {postPage.posts.map((post) => (
              <article className={`post-card ${contentSourceClass(post.source)}`} key={post.id}>
                <div>
                  <h3>
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="meta meta-with-badge">
                    <span className={`content-source ${contentSourceClass(post.source)}`}>
                      {contentSourceLabel(post.source)}
                    </span>
                    <Link href={`/r/${post.topic.slug}`}>{post.topic.name}</Link> ·{" "}
                    {formatDate(post.publishedAt ?? post.createdAt)} ·{" "}
                    {post._count.comments} comments
                  </p>
                </div>
                <p className="preview">{stripMarkdown(post.body)}</p>
              </article>
            ))}
          </div>
        )}

        <PaginationControls
          ariaLabel="User post pagination"
          basePath={`/u/${author.twitterHandle}`}
          page={page}
          totalPages={postPage.totalPages}
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
