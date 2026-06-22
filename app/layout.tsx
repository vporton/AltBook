import type { Metadata } from "next";
import Link from "next/link";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AltBook",
  description:
    "Open source social publishing with human submissions and OpenAI moderation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
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
