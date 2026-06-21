import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTHOR_SESSION_COOKIE,
  authorSessionCookieOptions,
  clearCookieOptions,
  createAuthorSessionValue,
  getTwitterConfig,
  registerTwitterAuthorFromCode,
  safeRelativePath,
  TWITTER_NEXT_COOKIE,
  TWITTER_STATE_COOKIE,
  TWITTER_VERIFIER_COOKIE,
  twitterAuthUnavailableReason,
} from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const reason = twitterAuthUnavailableReason();
  const config = getTwitterConfig(request);

  if (reason || !config) {
    return NextResponse.json(
      { error: reason ?? "Twitter registration is not configured." },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  const state = requestUrl.searchParams.get("state");
  const storedState = cookies().get(TWITTER_STATE_COOKIE)?.value;
  const verifier = cookies().get(TWITTER_VERIFIER_COOKIE)?.value;
  const next = safeRelativePath(cookies().get(TWITTER_NEXT_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(next, request.url));

  clearOauthCookies(response);

  if (providerError) {
    console.error("Twitter OAuth returned an error.", {
      error: providerError,
      errorDescription: requestUrl.searchParams.get("error_description"),
    });

    return redirectWithAuthStatus(request, next, "failed");
  }

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    console.error("Twitter OAuth state validation failed.");

    return redirectWithAuthStatus(request, next, "failed");
  }

  try {
    const author = await registerTwitterAuthorFromCode(config, code, verifier);

    response.cookies.set(
      AUTHOR_SESSION_COOKIE,
      createAuthorSessionValue(author.id),
      authorSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error("Twitter OAuth callback failed.", error);

    return redirectWithAuthStatus(request, next, "failed");
  }
}

function redirectWithAuthStatus(request: Request, next: string, status: string) {
  const redirectUrl = new URL(next, request.url);
  redirectUrl.searchParams.set("auth", status);
  const response = NextResponse.redirect(redirectUrl);

  clearOauthCookies(response);

  return response;
}

function clearOauthCookies(response: NextResponse) {
  response.cookies.set(TWITTER_STATE_COOKIE, "", clearCookieOptions());
  response.cookies.set(TWITTER_VERIFIER_COOKIE, "", clearCookieOptions());
  response.cookies.set(TWITTER_NEXT_COOKIE, "", clearCookieOptions());
}
