import { NextResponse } from "next/server";
import {
  agentAccessTokenLifetimeSeconds,
  authenticateAgentClient,
  generateAgentAccessToken,
  hasConfiguredAgents,
  oauthTokenResponse,
  parseBasicAuth,
  storeAgentAccessToken,
} from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const credentials = await readTokenCredentials(request);

  if ("response" in credentials) {
    return credentials.response;
  }

  if (credentials.grantType !== "client_credentials") {
    return jsonOAuthError("unsupported_grant_type", 400, "grant_type must be client_credentials.");
  }

  if (!(await hasConfiguredAgents())) {
    return jsonOAuthError(
      "server_error",
      503,
      "Create an agent in /admin before requesting a token.",
    );
  }

  const agent = await authenticateAgentClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  });

  if (!agent) {
    return jsonOAuthError("invalid_client", 401, "Client credentials are invalid.");
  }

  const accessToken = generateAgentAccessToken();
  const expiresAt = new Date(Date.now() + agentAccessTokenLifetimeSeconds * 1000);

  await storeAgentAccessToken({
    agentId: agent.id,
    accessToken,
    expiresAt,
  });

  return NextResponse.json(oauthTokenResponse(accessToken), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

async function readTokenCredentials(request: Request):
  Promise<
    | {
        grantType: string;
        clientId: string;
        clientSecret: string;
      }
    | {
        response: NextResponse;
      }
  > {
  const contentType = request.headers.get("content-type") ?? "";
  const basic = parseBasicAuth(request.headers.get("authorization") ?? "");
  let grantType = "";
  let clientId = basic?.clientId ?? "";
  let clientSecret = basic?.clientSecret ?? "";

  if (contentType.includes("application/json")) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return {
        response: NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }),
      };
    }

    if (!body || typeof body !== "object") {
      return {
        response: NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }),
      };
    }

    const payload = body as Record<string, unknown>;
    grantType = typeof payload.grant_type === "string" ? payload.grant_type : grantType;
    clientId = typeof payload.client_id === "string" ? payload.client_id : clientId;
    clientSecret = typeof payload.client_secret === "string" ? payload.client_secret : clientSecret;
  } else {
    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      return {
        response: NextResponse.json(
          { error: "Request body must be form data or JSON." },
          { status: 400 },
        ),
      };
    }

    grantType = String(form.get("grant_type") ?? grantType);
    clientId = String(form.get("client_id") ?? clientId);
    clientSecret = String(form.get("client_secret") ?? clientSecret);
  }

  if (!clientId || !clientSecret) {
    return {
      response: jsonOAuthError("invalid_request", 400, "client_id and client_secret are required."),
    };
  }

  return {
    grantType,
    clientId,
    clientSecret,
  };
}

function jsonOAuthError(error: string, status: number, description: string) {
  return NextResponse.json(
    {
      error,
      error_description: description,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}
