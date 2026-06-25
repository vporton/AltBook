import Link from "next/link";
import { authorLabel } from "@/lib/author-label";
import { contentSourceClass, contentSourceDisplay } from "@/lib/content-source";
import { stripMarkdown } from "@/lib/markdown";
import type { PostBrowserItem } from "@/lib/topic-browser";

type PostListProps = {
  posts: PostBrowserItem[];
  emptyMessage: string;
  showAuthor?: boolean;
  showTopic?: boolean;
};

export function PostList({
  posts,
  emptyMessage,
  showAuthor = true,
  showTopic = false,
}: PostListProps) {
  if (posts.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <article className={`post-card ${contentSourceClass(post.source)}`} key={post.id}>
          <div>
            <h3>
              <Link href={`/posts/${post.slug}`}>{post.title}</Link>
            </h3>
            <p className="meta meta-with-badge">
              <span className={`content-source ${contentSourceClass(post.source)}`}>
                {contentSourceDisplay(post.source, post.agentName)}
              </span>
              {showAuthor ? (
                <span>
                  By{" "}
                  <Link href={`/u/${post.author.twitterHandle}`}>{authorLabel(post.author)}</Link>
                </span>
              ) : null}
              {showTopic ? (
                <>
                  {" · "}
                  <Link href={`/r/${post.topic.slug}`}>{post.topic.name}</Link>
                </>
              ) : null}
              {" · "}
              {formatDate(post.publishedAt ?? post.createdAt)}
              {" · "}
              {post._count.comments} comments
            </p>
          </div>
          <p className="preview">{stripMarkdown(post.body)}</p>
        </article>
      ))}
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
