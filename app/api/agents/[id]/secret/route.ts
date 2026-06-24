import { NextResponse } from "next/server";
import { getCurrentAuthor } from "@/lib/twitter-auth";
import { regenerateOwnedAgentClientSecret } from "@/lib/agents";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const author = await getCurrentAuthor();

  if (!author) {
    return NextResponse.json({ error: "Sign in with Twitter first." }, { status: 401 });
  }

  const { id } = context.params;

  if (!id) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
  }

  const rotated = await regenerateOwnedAgentClientSecret(id, author.id);

  if (!rotated) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json(
    rotated,
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}
