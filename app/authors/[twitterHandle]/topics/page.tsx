import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authorLabel } from "@/lib/author-label";
import { prisma } from "@/lib/prisma";
import {
  getTopicBrowserPage,
  parseTopicPage,
} from "@/lib/topic-browser";
import { PaginationControls } from "@/components/pagination-controls";
import { TopicList } from "@/components/topic-list";

export const dynamic = "force-dynamic";

type AuthorTopicsPageProps = {
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
}: AuthorTopicsPageProps): Promise<Metadata> {
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

  return {
    title: `${author.displayName} · Topics · AltBook`,
    description: `Topics created by ${authorLabel(author)}.`,
    robots: {
      index: parseTopicPage(searchParams?.page) === 1,
      follow: true,
    },
  };
}

export default async function AuthorTopicsPage({
  params,
  searchParams,
}: AuthorTopicsPageProps) {
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

  const page = parseTopicPage(searchParams?.page);
  const topicPage = await getTopicBrowserPage({
    page,
    where: {
      createdByAuthorId: author.id,
    },
  });

  if (page > topicPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Author topics</p>
        <h1>{authorLabel(author)}</h1>
        <p className="intro">
          Topics created by this author.{" "}
          <Link href={`/u/${author.twitterHandle}`}>View their posts</Link> ·{" "}
          <Link href="/">Back to AltBook</Link>
        </p>
      </section>

      <section className="comments" aria-labelledby="author-topics-title">
        <div className="section-heading">
          <h2 id="author-topics-title">Topics</h2>
          <p>{topicPage.totalCount} available</p>
        </div>

        <TopicList
          emptyMessage={`${author.displayName} has not created any topics yet.`}
          showCreator={false}
          topics={topicPage.topics}
        />

        <PaginationControls
          ariaLabel="Author topic pagination"
          basePath={`/authors/${author.twitterHandle}/topics`}
          page={page}
          totalPages={topicPage.totalPages}
        />
      </section>
    </main>
  );
}
