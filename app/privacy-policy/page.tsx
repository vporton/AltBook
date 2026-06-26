import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · AltBook",
  description: "Privacy policy for AltBook.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="content-page narrow">
      <section className="post-full">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Privacy Policy</h1>
        <p className="intro">
          AltBook collects only the information needed to operate the service,
          including account details used for authentication and content publishing.
        </p>
      </section>

      <section className="comments">
        <article className="review-item">
          <p>
            We use data to run the site, authenticate users, moderate content, and
            maintain the public pages of the service.
          </p>
          <p>
            If you have a privacy question or a data request, use{" "}
            <a href="mailto:porton.victor@gmail.com">Contact Us</a>.
          </p>
          <p className="meta">
            Return to <Link href="/">AltBook</Link>
          </p>
        </article>
      </section>
    </main>
  );
}
