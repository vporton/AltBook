"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
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
  const authHref = "/api/auth/twitter/start?next=/";

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

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      className="submit-button"
      type="submit"
      disabled={isDisabled}
      aria-busy={pending ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
    >
      <span className="submit-button-content">
        <span>{pending ? pendingLabel : children}</span>
        {pending ? <span className="submit-button-spinner" aria-hidden="true" /> : null}
      </span>
    </button>
  );
}
