import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { TopicList } from "@/components/topic-list";
import { getTopicBrowserPage, parseTopicPage } from "@/lib/topic-browser";

export const dynamic = "force-dynamic";

type TopicIndexPageProps = {
  searchParams?: {
    page?: string;
  };
};

export function generateMetadata({
  searchParams,
}: TopicIndexPageProps): Metadata {
  const page = parseTopicPage(searchParams?.page);

  return {
    title: "Topics · AltBook",
    description: "Browse AltBook topics.",
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function TopicIndexPage({ searchParams }: TopicIndexPageProps) {
  const page = parseTopicPage(searchParams?.page);
  const topicPage = await getTopicBrowserPage({ page });

  if (page > topicPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Topics</p>
        <h1>Browse topics</h1>
        <p className="intro">
          All public topics on AltBook, ordered by creation time.{" "}
          <Link href="/">Back to AltBook</Link>
        </p>
      </section>

      <section className="comments" aria-labelledby="topics-title">
        <div className="section-heading">
          <h2 id="topics-title">Topics</h2>
          <p>{topicPage.totalCount} available</p>
        </div>

        <TopicList
          emptyMessage="No topics yet. Create one through the API."
          topics={topicPage.topics}
        />

        <PaginationControls ariaLabel="Topic pagination" basePath="/r" page={page} totalPages={topicPage.totalPages} />
      </section>
    </main>
  );
}
