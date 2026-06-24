"use client";

import { usePathname } from "next/navigation";
import { authorLabel } from "@/lib/author-label";

type AuthBannerProps = {
  author: {
    displayName: string;
    twitterHandle: string;
  } | null;
};

export function AuthBanner({ author }: AuthBannerProps) {
  const pathname = usePathname() || "/";
  const next = pathname.startsWith("/") ? pathname : "/";
  const authHref = `/api/auth/twitter/start?next=${encodeURIComponent(next)}`;

  if (!author) {
    return (
      <div className="auth-banner">
        <span>Register or log in with Twitter to post and comment.</span>
        <a href={authHref}>Register or log in with Twitter</a>
      </div>
    );
  }

  return (
    <div className="auth-banner">
      <span>Signed in as {authorLabel(author)}.</span>
      <a href={`/api/auth/logout?next=${encodeURIComponent(next)}`}>Sign out</a>
    </div>
  );
}
