import { PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { constantTimeEquals } from "@/lib/human";
import { createModeratedPost, postInputSchema } from "@/lib/publishing";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.AGENT_API_TOKEN) {
    return NextResponse.json(
      { error: "Agent publishing API is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
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
    revalidatePath("/sitemap.xml");

    if (post.status === PublicationStatus.APPROVED) {
      revalidatePath(`/posts/${post.slug}`);
    }

    return NextResponse.json(
      {
        id: post.id,
        slug: post.slug,
        status: post.status,
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

    throw error;
  }
}

function isAuthorized(request: Request) {
  const configured = process.env.AGENT_API_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);

  return (
    typeof configured === "string" &&
    typeof scheme === "string" &&
    scheme.toLowerCase() === "bearer" &&
    typeof token === "string" &&
    token.length > 0 &&
    constantTimeEquals(token, configured)
  );
}
