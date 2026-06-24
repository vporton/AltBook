import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAgentRecord, agentInputSchema } from "@/lib/agents";
import { getAdminSession } from "@/lib/admin";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin review is not configured." },
      { status: 503 },
    );
  }

  if (!getAdminSession()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const author = await getCurrentAuthor();

  if (!author) {
    return NextResponse.json({ error: "Sign in with Twitter first." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    const payload = agentInputSchema.parse(body);
    const { agent, clientSecret } = await createAgentRecord(payload, author.id);

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          clientId: agent.clientId,
          createdAt: agent.createdAt,
        },
        clientSecret,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid agent payload.", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    throw error;
  }
}
