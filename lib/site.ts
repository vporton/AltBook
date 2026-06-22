export const SITEMAP_URL_LIMIT = 50_000;

export function getSiteUrl() {
  const configured =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return configured.replace(/\/+$/, "");
}

export function getSiteOrigin(request?: Request) {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}
