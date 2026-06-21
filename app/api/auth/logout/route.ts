import { NextResponse } from "next/server";
import {
  AUTHOR_SESSION_COOKIE,
  clearCookieOptions,
  safeRelativePath,
} from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeRelativePath(requestUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));

  response.cookies.set(AUTHOR_SESSION_COOKIE, "", clearCookieOptions());

  return response;
}
