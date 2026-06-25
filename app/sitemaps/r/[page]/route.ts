import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITEMAP_URL_LIMIT } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    page: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  const match = params.page.match(/^(\d+)\.xml$/);

  if (!match) {
    notFound();
  }

  const page = Number(match[1]);
  const topics = await prisma.topic.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: page * SITEMAP_URL_LIMIT,
    take: SITEMAP_URL_LIMIT,
    select: {
      slug: true,
      updatedAt: true,
    },
  });

  if (topics.length === 0 && page > 0) {
    notFound();
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${topics
    .map(
      (topic) =>
        `<url><loc>${escapeXml(absoluteUrl(`/r/${topic.slug}`, request))}</loc><lastmod>${topic.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
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
