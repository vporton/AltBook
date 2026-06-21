import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { agentApiNotConfigured, isAgentRequestAuthorized } from "@/lib/api-auth";
import { createTopic, PublishingInputError, topicInputSchema } from "@/lib/publishing";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (agentApiNotConfigured()) {
    return NextResponse.json(
      { error: "Agent publishing API is not configured." },
      { status: 503 },
    );
  }

  if (!isAgentRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    const payload = topicInputSchema.parse(body);
    const topic = await createTopic(payload);

    revalidatePath("/");
    revalidatePath(`/topics/${topic.slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json(
      {
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        url: absoluteUrl(`/topics/${topic.slug}`),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid topic payload.", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (error instanceof PublishingInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
