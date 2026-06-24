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
            <Link href="/admin">Moderation</Link>
            <a
              href="https://science-dao.org/meritocracy/"
              rel="noreferrer"
              target="_blank"
            >
              Science DAO
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
