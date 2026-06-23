"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authorLabel } from "@/lib/authors";

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
      <Link href={`/api/auth/logout?next=${encodeURIComponent(next)}`}>Sign out</Link>
    </div>
  );
}
