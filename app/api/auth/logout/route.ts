import { NextResponse } from "next/server";
import {
  AUTHOR_SESSION_COOKIE,
  clearCookieOptions,
  safeRelativePath,
} from "@/lib/twitter-auth";
import { getSiteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeRelativePath(requestUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, getSiteOrigin(request)));

  response.cookies.set(AUTHOR_SESSION_COOKIE, "", clearCookieOptions());

  return response;
}
