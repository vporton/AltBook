import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITEMAP_URL_LIMIT } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [topicCount, postCount] = await Promise.all([
    prisma.topic.count({}),
    prisma.post.count({
      where: {
        status: "APPROVED",
      },
    }),
  ]);
  const topicSitemapUrls =
    topicCount <= SITEMAP_URL_LIMIT
      ? [absoluteUrl("/sitemaps/r.xml")]
      : Array.from(
          { length: Math.ceil(topicCount / SITEMAP_URL_LIMIT) },
          (_, index) => absoluteUrl(`/sitemaps/r/${index}.xml`),
        );
  const postSitemapCount = Math.ceil(postCount / SITEMAP_URL_LIMIT);
  const sitemapUrls = [
    absoluteUrl("/sitemaps/static.xml"),
    ...topicSitemapUrls,
    ...Array.from({ length: postSitemapCount }, (_, index) =>
      absoluteUrl(`/sitemaps/posts/${index}.xml`),
    ),
  ];
  const body = xmlDocument(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls
      .map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
      .join("")}</sitemapindex>`,
  );

  return xmlResponse(body);
}

function xmlDocument(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>${body}`;
}

function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
