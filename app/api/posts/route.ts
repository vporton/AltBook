import { PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { agentApiNotConfigured, isAgentRequestAuthorized } from "@/lib/api-auth";
import {
  createModeratedPost,
  postInputSchema,
  PublishingInputError,
} from "@/lib/publishing";
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
    const payload = postInputSchema.parse(body);
    const { post, moderation } = await createModeratedPost(payload);

    revalidatePath("/");
    revalidatePath(`/topics/${post.topic.slug}`);
    revalidatePath("/sitemap.xml");

    if (post.status === PublicationStatus.APPROVED) {
      revalidatePath(`/posts/${post.slug}`);
    }

    return NextResponse.json(
      {
        id: post.id,
        slug: post.slug,
        status: post.status,
        topic: {
          id: post.topic.id,
          slug: post.topic.slug,
          name: post.topic.name,
          url: absoluteUrl(`/topics/${post.topic.slug}`),
        },
        author: {
          id: post.author.id,
          twitterId: post.author.twitterId,
          twitterHandle: post.author.twitterHandle,
          displayName: post.author.displayName,
        },
        url:
          post.status === PublicationStatus.APPROVED
            ? absoluteUrl(`/posts/${post.slug}`)
            : null,
        moderation: {
          outcome: moderation.outcome,
          reason: moderation.reason,
          provider: moderation.provider,
          model: moderation.model,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid post payload.", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (error instanceof PublishingInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
