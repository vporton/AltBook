import Link from "next/link";
import { authorLabel } from "@/lib/authors";
import type { TopicBrowserItem } from "@/lib/topic-browser";

type TopicListProps = {
  topics: TopicBrowserItem[];
  emptyMessage: string;
  showCreator?: boolean;
};

export function TopicList({
  topics,
  emptyMessage,
  showCreator = true,
}: TopicListProps) {
  if (topics.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <div className="topic-list">
      {topics.map((topic) => (
        <article className="post-card" key={topic.id}>
          <div>
            <h3>
              <Link href={`/topics/${topic.slug}`}>{topic.name}</Link>
            </h3>
            <p className="meta">
              {topic._count.posts} approved{" "}
              {topic._count.posts === 1 ? "post" : "posts"}
              {showCreator && topic.createdByAuthor ? (
                <>
                  {" · Created by "}
                  <Link href={`/authors/${topic.createdByAuthor.twitterHandle}/topics`}>
                    {authorLabel(topic.createdByAuthor)}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {topic.description ? (
            <p className="preview">{topic.description}</p>
          ) : (
            <p className="preview">Posts grouped under {topic.name}.</p>
          )}
        </article>
      ))}
    </div>
  );
}
