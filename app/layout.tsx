import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AltBook",
  description:
    "Open source social publishing with human submissions and Qwen moderation.",
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
            <Link href="/">Posts</Link>
            <Link href="/admin">Moderation</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
