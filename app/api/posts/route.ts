import { PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { agentApiNotConfigured, isAgentRequestAuthorized } from "@/lib/api-auth";
import {
  createModeratedPost,
  deletePost,
  postDeleteSchema,
  postInputSchema,
  postUpdateSchema,
  PublishingInputError,
  updatePost,
} from "@/lib/publishing";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = authorizeAgentRequest(request);

  if (authError) {
    return authError;
  }

  const body = await readJsonBody(request);

  if (body.response) {
    return body.response;
  }

  try {
    const payload = postInputSchema.parse(body.value);
    const { post, moderation } = await createModeratedPost(payload);

    revalidatePath("/");
    revalidatePath(`/topics/${post.topic.slug}`);
    revalidatePath("/sitemap.xml");

    if (post.status === PublicationStatus.APPROVED) {
      revalidatePath(`/posts/${post.slug}`);
    }

    return NextResponse.json(
      postResponseBody(post, moderation),
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

export async function PUT(request: Request) {
  const authError = authorizeAgentRequest(request);

  if (authError) {
    return authError;
  }

  const body = await readJsonBody(request);

  if (body.response) {
    return body.response;
  }

  try {
    const payload = postUpdateSchema.parse(body.value);
    const { post, moderation, previous } = await updatePost(payload);

    revalidatePath("/");
    revalidatePath(`/topics/${previous.topic.slug}`);
    revalidatePath(`/topics/${post.topic.slug}`);
    revalidatePath(`/posts/${previous.slug}`);
    revalidatePath(`/posts/${post.slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json(postResponseBody(post, moderation));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid post update payload.", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (error instanceof PublishingInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
  const authError = authorizeAgentRequest(request);

  if (authError) {
    return authError;
  }

  const body = await readJsonBody(request);

  if (body.response) {
    return body.response;
  }

  try {
    const payload = postDeleteSchema.parse(body.value);
    const post = await deletePost(payload);

    revalidatePath("/");
    revalidatePath(`/topics/${post.topic.slug}`);
    revalidatePath(`/posts/${post.slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({
      id: post.id,
      slug: post.slug,
      deleted: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid post delete payload.", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (error instanceof PublishingInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

function authorizeAgentRequest(request: Request) {
  if (agentApiNotConfigured()) {
    return NextResponse.json(
      { error: "Agent publishing API is not configured." },
      { status: 503 },
    );
  }

  if (!isAgentRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

async function readJsonBody(request: Request) {
  try {
    return {
      value: await request.json(),
    };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 },
      ),
    };
  }
}

function postResponseBody(
  post: {
    id: string;
    slug: string;
    status: PublicationStatus;
    topic: {
      id: string;
      slug: string;
      name: string;
    };
    author: {
      id: string;
      twitterId: string;
      twitterHandle: string;
      displayName: string;
    };
  },
  moderation?: {
    outcome: string;
    reason: string;
    provider: string;
    model: string;
  } | null,
) {
  return {
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
    moderation: moderation
      ? {
          outcome: moderation.outcome,
          reason: moderation.reason,
          provider: moderation.provider,
          model: moderation.model,
        }
      : null,
  };
}
