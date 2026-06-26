import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(
    absoluteUrl("/", request),
  )}</loc><lastmod>${now}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url><url><loc>${escapeXml(
    absoluteUrl("/topics", request),
  )}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url></urlset>`;

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
