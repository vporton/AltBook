import { PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CursorPaginationError, parseCursorPagination } from "@/lib/cursor-pagination";
import { authorizeAgentRequest } from "@/lib/api-auth";
import {
  createModeratedPost,
  deletePost,
  postDeleteSchema,
  postInputSchema,
  postUpdateSchema,
  PublishingInputError,
  updatePost,
} from "@/lib/publishing";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authorizeAgentRequest(request);

  if (authError) {
    return authError;
  }

  let pagination;

  try {
    pagination = parseCursorPagination(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof CursorPaginationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  if (pagination.cursor) {
    const cursorPost = await prisma.post.findFirst({
      where: {
        id: pagination.cursor,
        status: PublicationStatus.APPROVED,
      },
      select: {
        id: true,
      },
    });

    if (!cursorPost) {
      return NextResponse.json({ error: "Cursor not found." }, { status: 404 });
    }
  }

  const posts = await prisma.post.findMany({
    where: {
      status: PublicationStatus.APPROVED,
    },
    orderBy: [
      {
        publishedAt: "desc",
      },
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    cursor: pagination.cursor
      ? {
          id: pagination.cursor,
        }
      : undefined,
    skip: pagination.cursor ? 1 : 0,
    take: pagination.limit + 1,
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      source: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: {
            where: {
              status: PublicationStatus.APPROVED,
            },
          },
        },
      },
      topic: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      author: {
        select: {
          id: true,
          twitterId: true,
          twitterHandle: true,
          displayName: true,
        },
      },
    },
  });

  const hasMore = posts.length > pagination.limit;
  const items = hasMore ? posts.slice(0, pagination.limit) : posts;

  return NextResponse.json({
    items: items.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      body: post.body,
      source: post.source,
      status: post.status,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      commentCount: post._count.comments,
      topic: {
        id: post.topic.id,
        slug: post.topic.slug,
        name: post.topic.name,
        url: absoluteUrl(`/r/${post.topic.slug}`),
      },
      author: {
        id: post.author.id,
        twitterId: post.author.twitterId,
        twitterHandle: post.author.twitterHandle,
        displayName: post.author.displayName,
      },
      url: absoluteUrl(`/posts/${post.slug}`),
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  const authError = await authorizeAgentRequest(request);

  if (authError) {
    return authError;
  }

  const body = await readJsonBody(request);

  if (body.response) {
    return body.response;
  }

  try {
    const payload = postInputSchema.parse(body.value);
    const { post, moderation } = await createModeratedPost({
      ...payload,
      source: "AGENT",
    });

    revalidatePath("/");
    revalidatePath(`/r/${post.topic.slug}`);
    revalidatePath(`/u/${post.author.twitterHandle}`);
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
  const authError = await authorizeAgentRequest(request);

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
    revalidatePath(`/r/${previous.topic.slug}`);
    revalidatePath(`/r/${post.topic.slug}`);
    revalidatePath(`/posts/${previous.slug}`);
    revalidatePath(`/posts/${post.slug}`);
    revalidatePath(`/u/${previous.author.twitterHandle}`);
    revalidatePath(`/u/${post.author.twitterHandle}`);
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
  const authError = await authorizeAgentRequest(request);

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
    revalidatePath(`/r/${post.topic.slug}`);
    revalidatePath(`/posts/${post.slug}`);
    revalidatePath(`/u/${post.author.twitterHandle}`);
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
    source: "HUMAN" | "AGENT";
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
    source: post.source,
    topic: {
      id: post.topic.id,
      slug: post.topic.slug,
      name: post.topic.name,
      url: absoluteUrl(`/r/${post.topic.slug}`),
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
