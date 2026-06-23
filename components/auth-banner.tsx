"use client";

import { usePathname } from "next/navigation";
import { authorLabel } from "@/lib/author-label";

type AuthBannerProps = {
  author: {
    displayName: string;
    twitterHandle: string;
  };
};

export function AuthBanner({ author }: AuthBannerProps) {
  const pathname = usePathname() || "/";
  const next = pathname.startsWith("/") ? pathname : "/";

  return (
    <div className="auth-banner">
      <span>Signed in as {authorLabel(author)}.</span>
      <a href={`/api/auth/logout?next=${encodeURIComponent(next)}`}>Sign out</a>
    </div>
  );
}
