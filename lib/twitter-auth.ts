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
const TWITTER_DEFAULT_SCOPE = "tweet.read users.read";
const TWITTER_ALLOWED_SCOPES = new Set([
  "tweet.read",
  "tweet.write",
  "tweet.moderate.write",
  "users.email",
  "users.read",
  "follows.read",
  "follows.write",
  "offline.access",
  "space.read",
  "mute.read",
  "mute.write",
  "like.read",
  "like.write",
  "list.read",
  "list.write",
  "block.read",
  "block.write",
  "bookmark.read",
  "bookmark.write",
  "dm.read",
  "dm.write",
  "media.write",
]);

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

type TwitterErrorResponse = {
  title?: string;
  detail?: string;
  error?: string;
  status?: number;
};

type TwitterUserMeResponse = {
  data?: {
    id?: string;
    name?: string;
    username?: string;
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
    scope: twitterScopes(),
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

  if (!profile.data?.id || !profile.data?.username) {
    throw new Error("X did not return a valid user profile payload.");
  }

  return registerTwitterAuthor({
    twitterId: profile.data.id,
    twitterHandle: profile.data.username,
    displayName: profile.data.name ?? profile.data.username,
    avatarUrl: "",
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
    expires: new Date(Date.now() + maxAge * 1000),
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
  const { payload: token, rawBody } = await readJsonResponse<
    TwitterTokenResponse & TwitterErrorResponse
  >(response);

  if (!response.ok || !token.access_token) {
    throw new Error(
      formatXError(
        "Twitter token exchange failed",
        response.status,
        response.statusText,
        token.error_description ?? token.detail ?? token.error ?? rawBody,
      ),
    );
  }

  return token.access_token;
}

async function fetchTwitterProfile(accessToken: string) {
  const primary = await fetchTwitterProfileFromEndpoint(
    "https://api.x.com/2/users/me",
    accessToken,
  );

  if (primary.response.ok) {
    return primary.payload;
  }

  if (primary.response.status === 403) {
    const fallback = await fetchTwitterProfileFromEndpoint(
      "https://api.twitter.com/2/users/me",
      accessToken,
    );

    if (fallback.response.ok) {
      return fallback.payload;
    }

    throw new Error(
      formatXError(
        "X profile lookup failed",
        fallback.response.status,
        fallback.response.statusText,
        extractXErrorDetail(fallback.payload, fallback.rawBody),
      ),
    );
  }

  throw new Error(
    formatXError(
      "X profile lookup failed",
      primary.response.status,
      primary.response.statusText,
      extractXErrorDetail(primary.payload, primary.rawBody),
    ),
  );
}

function twitterScopes() {
  const configured = envValue("TWITTER_SCOPES") ?? TWITTER_DEFAULT_SCOPE;
  const scopes = new Set(
    configured.split(/\s+/).filter((scope) => scope && TWITTER_ALLOWED_SCOPES.has(scope)),
  );

  scopes.add("tweet.read");
  scopes.add("users.read");

  return Array.from(scopes).join(" ");
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

async function fetchTwitterProfileFromEndpoint(url: string, accessToken: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const { payload, rawBody } = await readJsonResponse<TwitterUserMeResponse & TwitterErrorResponse>(
    response,
  );

  return { response, payload, rawBody };
}

async function readJsonResponse<T>(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return { payload: {} as T, rawBody };
  }

  try {
    return { payload: JSON.parse(rawBody) as T, rawBody };
  } catch {
    return { payload: {} as T, rawBody };
  }
}

function extractXErrorDetail(
  payload: TwitterErrorResponse | TwitterUserMeResponse,
  rawBody: string,
) {
  const detail =
    "detail" in payload
      ? payload.detail ?? payload.title ?? payload.error
      : undefined;

  if (detail) {
    return detail;
  }

  const trimmed = rawBody.trim();

  return trimmed ? trimmed.slice(0, 300) : undefined;
}

function formatXError(
  prefix: string,
  status: number,
  statusText: string,
  detail?: string | null,
) {
  const statusLabel = statusText ? `${status} ${statusText}` : `${status}`;

  if (detail) {
    return `${prefix} (${statusLabel}): ${detail}`;
  }

  return `${prefix} (${statusLabel}).`;
}
