import { NextResponse } from "next/server";
import { authenticateAgentAccessToken, hasConfiguredAgents, readBearerToken } from "@/lib/agents";

export async function authorizeAgentRequest(request: Request) {
  if (!(await hasConfiguredAgents())) {
    return NextResponse.json(
      { error: "Agent publishing API is not configured yet." },
      { status: 503 },
    );
  }

  const accessToken = readBearerToken(request.headers.get("authorization") ?? "");

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const agent = await authenticateAgentAccessToken(accessToken);

  if (!agent) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
