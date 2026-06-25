import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${absoluteUrl("/sitemap.xml", request)}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
