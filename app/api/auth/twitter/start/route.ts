import { NextResponse } from "next/server";
import {
  createTwitterAuthorizationUrl,
  getTwitterConfig,
  oauthCookieOptions,
  safeRelativePath,
  TWITTER_NEXT_COOKIE,
  TWITTER_STATE_COOKIE,
  TWITTER_VERIFIER_COOKIE,
  twitterAuthUnavailableReason,
  randomToken,
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
  const next = safeRelativePath(requestUrl.searchParams.get("next"));
  const state = randomToken();
  const { url, verifier } = createTwitterAuthorizationUrl(config, state);
  const authorizationUrl = new URL(url);
  const response = NextResponse.redirect(url);
  const cookieOptions = oauthCookieOptions();

  console.info("Starting Twitter OAuth.", {
    redirectUri: authorizationUrl.searchParams.get("redirect_uri"),
    scope: authorizationUrl.searchParams.get("scope"),
    next,
  });

  response.cookies.set(TWITTER_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(TWITTER_VERIFIER_COOKIE, verifier, cookieOptions);
  response.cookies.set(TWITTER_NEXT_COOKIE, next, cookieOptions);

  return response;
}
