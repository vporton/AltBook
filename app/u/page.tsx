import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { authorLabel } from "@/lib/author-label";
import { getUserBrowserPage, parseUserPage } from "@/lib/user-browser";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: {
    page?: string;
  };
};

export async function generateMetadata({
  searchParams,
}: UsersPageProps): Promise<Metadata> {
  const page = parseUserPage(searchParams?.page);

  return {
    title: page > 1 ? `Users · Page ${page} · AltBook` : `Users · AltBook`,
    description: "Browse all public authors on AltBook.",
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const page = parseUserPage(searchParams?.page);
  const userPage = await getUserBrowserPage(page);

  if (page > userPage.totalPages) {
    notFound();
  }

  return (
    <main className="content-page">
      <section className="post-full">
        <p className="eyebrow">Users</p>
        <h1>All users</h1>
        <p className="intro">
          Browse public authors and jump to their posts or comments.
        </p>
      </section>

      <section className="comments" aria-labelledby="users-title">
        <div className="section-heading">
          <h2 id="users-title">Users</h2>
          <p>{userPage.totalCount} total</p>
        </div>

        {userPage.users.length === 0 ? (
          <div className="empty">No users yet.</div>
        ) : (
          <div className="review-list">
            {userPage.users.map((user) => (
              <article className="review-item" key={user.id}>
                <h3>
                  <Link href={`/u/${user.twitterHandle}`}>{authorLabel(user)}</Link>
                </h3>
                <p className="meta">
                  @{user.twitterHandle} · Joined {formatDate(user.createdAt)} ·{" "}
                  {user._count.posts} approved posts · {user._count.comments} approved comments
                </p>
                <div className="actions-row">
                  <Link className="button-link" href={`/u/${user.twitterHandle}`}>
                    Posts
                  </Link>
                  <Link className="button-link secondary" href={`/u/${user.twitterHandle}/comments`}>
                    Comments
                  </Link>
                  <Link
                    className="button-link secondary"
                    href={`/authors/${user.twitterHandle}/topics`}
                  >
                    Topics
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <PaginationControls
          ariaLabel="User pagination"
          basePath="/u"
          page={page}
          totalPages={userPage.totalPages}
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
