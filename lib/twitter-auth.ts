import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { registerTwitterAuthor } from "@/lib/authors";
import { prisma } from "@/lib/prisma";

export const AUTHOR_SESSION_COOKIE = "altbook_author_session";
export const TWITTER_STATE_COOKIE = "altbook_twitter_state";
export const TWITTER_VERIFIER_COOKIE = "altbook_twitter_verifier";
export const TWITTER_NEXT_COOKIE = "altbook_twitter_next";

const AUTHOR_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const OAUTH_COOKIE_MAX_AGE = 60 * 10;
const TWITTER_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const TWITTER_ME_URLS = [
  "https://api.x.com/2/users/me?user.fields=profile_image_url",
  "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
];
const TWITTER_DEFAULT_SCOPE = "users.read";

type TwitterConfig = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
};

type TwitterTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type TwitterMeResponse = {
  data?: {
    id?: string;
    name?: string;
    username?: string;
    profile_image_url?: string;
  };
};

export function getTwitterConfig(request: Request): TwitterConfig | null {
  const clientId = envValue("TWITTER_CLIENT_ID");

  if (!clientId || hasInvalidTwitterClientId(clientId) || !getSessionSecret()) {
    return null;
  }

  return {
    clientId,
    clientSecret: envValue("TWITTER_CLIENT_SECRET"),
    redirectUri: envValue("TWITTER_REDIRECT_URI") ?? twitterRedirectUri(request),
  };
}

export function twitterAuthUnavailableReason() {
  const clientId = envValue("TWITTER_CLIENT_ID");

  if (!clientId) {
    return "Twitter registration is disabled until TWITTER_CLIENT_ID is configured.";
  }

  if (hasInvalidTwitterClientId(clientId)) {
    return "TWITTER_CLIENT_ID looks like a Twitter access token. Use the OAuth 2.0 Client ID from the X Developer Console user authentication settings.";
  }

  if (!getSessionSecret()) {
    return "Twitter registration is disabled until AUTH_SECRET is configured.";
  }

  return null;
}

export function createTwitterAuthorizationUrl(config: TwitterConfig, state: string) {
  const verifier = randomToken(64);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: envValue("TWITTER_SCOPES") ?? TWITTER_DEFAULT_SCOPE,
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });

  return {
    url: `${TWITTER_AUTHORIZE_URL}?${params.toString()}`,
    verifier,
  };
}

export async function registerTwitterAuthorFromCode(
  config: TwitterConfig,
  code: string,
  verifier: string,
) {
  const token = await exchangeCodeForToken(config, code, verifier);
  const profile = await fetchTwitterProfile(token);

  if (!profile.data?.id || !profile.data.username || !profile.data.name) {
    throw new Error("Twitter did not return a complete user profile.");
  }

  return registerTwitterAuthor({
    twitterId: profile.data.id,
    twitterHandle: profile.data.username,
    displayName: profile.data.name,
    avatarUrl: profile.data.profile_image_url ?? "",
  });
}

export async function getCurrentAuthor() {
  const value = cookies().get(AUTHOR_SESSION_COOKIE)?.value;
  const authorId = value ? verifyAuthorSession(value) : null;

  if (!authorId) {
    return null;
  }

  return prisma.author.findUnique({
    where: {
      id: authorId,
    },
  });
}

export function createAuthorSessionValue(authorId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      authorId,
      issuedAt: Date.now(),
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyAuthorSession(value: string) {
  const [payload, signature] = value.split(".", 2);

  if (!payload || !signature || !constantTimeEquals(signature, sign(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      authorId?: unknown;
      issuedAt?: unknown;
    };

    if (
      typeof parsed.authorId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      Date.now() - parsed.issuedAt > AUTHOR_SESSION_MAX_AGE * 1000
    ) {
      return null;
    }

    return parsed.authorId;
  } catch {
    return null;
  }
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function authorSessionCookieOptions() {
  return authCookieOptions(AUTHOR_SESSION_MAX_AGE);
}

export function oauthCookieOptions() {
  return authCookieOptions(OAUTH_COOKIE_MAX_AGE);
}

export function clearCookieOptions() {
  return {
    ...authCookieOptions(0),
    maxAge: 0,
  };
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function safeRelativePath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

async function exchangeCodeForToken(
  config: TwitterConfig,
  code: string,
  verifier: string,
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
    client_id: config.clientId,
  });
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (config.clientSecret) {
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
        "base64",
      )}`,
    );
  }

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  const token = (await response.json()) as TwitterTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(
      token.error_description ?? token.error ?? "Twitter token exchange failed.",
    );
  }

  return token.access_token;
}

async function fetchTwitterProfile(accessToken: string) {
  const failures: Array<{ url: string; status: number; body: string }> = [];

  for (const url of TWITTER_ME_URLS) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as TwitterMeResponse;
    }

    failures.push({
      url,
      status: response.status,
      body: await response.text(),
    });
  }

  const detail = failures
    .map(({ url, status, body }) => `${url} returned ${status}: ${body}`)
    .join(" | ");

  throw new Error(`Twitter profile lookup failed. ${detail}`);
}

function twitterRedirectUri(request: Request) {
  const origin = envValue("SITE_URL") ?? new URL(request.url).origin;

  return new URL("/api/auth/twitter/callback", origin).toString();
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function sign(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("AUTH_SECRET is required for author sessions.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function getSessionSecret() {
  return envValue("AUTH_SECRET") ?? envValue("SESSION_SECRET") ?? null;
}

function constantTimeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function envValue(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function hasInvalidTwitterClientId(clientId: string) {
  return /^\d+-/.test(clientId);
}
