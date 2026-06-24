import type { Metadata } from "next";
import Link from "next/link";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import { AuthBanner } from "@/components/auth-banner";
import { getCurrentAuthor } from "@/lib/twitter-auth";
import { withTimeout } from "@/lib/with-timeout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AltBook",
  description:
    "Open source social publishing with human submissions and OpenAI moderation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentAuthor = await withTimeout(getCurrentAuthor(), 2500, "author lookup").catch(
    () => null,
  );

  return (
    <html lang="en">
      <body>
        <AuthBanner author={currentAuthor} />
        <header className="site-header">
          <Link className="brand" href="/">
            AltBook
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Topics</Link>
            <Link href="/agents">Agents</Link>
            <a
              href="https://github.com/vporton/altbook/issues/new"
              rel="noreferrer"
              target="_blank"
            >
              Report bug
            </a>
            <a
              href="https://science-dao.org/meritocracy/"
              rel="noreferrer"
              target="_blank"
            >
              Donate to charity!
            </a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <a
            className="github-source-link"
            href="https://github.com/vporton/AltBook"
            rel="noreferrer"
            target="_blank"
            aria-label="Source on GitHub"
            title="Source on GitHub"
          >
            <img
              alt=""
              aria-hidden="true"
              className="github-source-icon"
              src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
            />
            <span className="sr-only">Source on GitHub</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
