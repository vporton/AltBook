import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const topics = await prisma.topic.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${topics
    .map(
      (topic) =>
        `<url><loc>${escapeXml(absoluteUrl(`/topics/${topic.slug}`))}</loc><lastmod>${topic.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    )
    .join("")}</urlset>`;

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
