import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { regenerateAgentClientSecret } from "@/lib/agents";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin review is not configured." },
      { status: 503 },
    );
  }

  if (!getAdminSession()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = context.params;

  if (!id) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
  }

  try {
    const { agent, clientSecret } = await regenerateAgentClientSecret(id);

    return NextResponse.json(
      {
        agent,
        clientSecret,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    if (isMissingAgent(error)) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    throw error;
  }
}

function isMissingAgent(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025";
}
