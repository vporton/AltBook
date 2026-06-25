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
  const comments = await prisma.comment.findMany({
    where: {
      status: "APPROVED",
      post: {
        status: "APPROVED",
      },
    },
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    skip: page * SITEMAP_URL_LIMIT,
    take: SITEMAP_URL_LIMIT,
    select: {
      id: true,
      updatedAt: true,
      publishedAt: true,
      post: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (comments.length === 0 && page > 0) {
    notFound();
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${comments
    .map(
      (comment) =>
        `<url><loc>${escapeXml(absoluteUrl(`/posts/${comment.post.slug}/comments/${comment.id}`, request))}</loc><lastmod>${(
          comment.publishedAt ?? comment.updatedAt
        ).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.5</priority></url>`,
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
