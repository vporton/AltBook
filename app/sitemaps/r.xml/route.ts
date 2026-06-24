import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITEMAP_URL_LIMIT } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const topicCount = await prisma.topic.count({});

  if (topicCount > SITEMAP_URL_LIMIT) {
    const shardCount = Math.ceil(topicCount / SITEMAP_URL_LIMIT);
    const sitemapUrls = Array.from(
      { length: shardCount },
      (_, index) => absoluteUrl(`/sitemaps/r/${index}.xml`),
    );
    const body = xmlDocument(
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls
        .map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
        .join("")}</sitemapindex>`,
    );

    return xmlResponse(body);
  }

  const topics = await prisma.topic.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      slug: true,
      updatedAt: true,
    },
  });

  const body = xmlDocument(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${topics
      .map(
        (topic) =>
          `<url><loc>${escapeXml(absoluteUrl(`/r/${topic.slug}`))}</loc><lastmod>${topic.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
      )
      .join("")}</urlset>`,
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
