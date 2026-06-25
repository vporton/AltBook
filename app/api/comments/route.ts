import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { CursorPaginationError, parseCursorPagination } from "@/lib/cursor-pagination";
import { authorizeAgentRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);

  if ("response" in auth) {
    return auth.response;
  }

  const searchParams = new URL(request.url).searchParams;
  let pagination;

  try {
    pagination = parseCursorPagination(searchParams);
  } catch (error) {
    if (error instanceof CursorPaginationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const filter = await resolvePostFilter(searchParams);

  if ("response" in filter) {
    return filter.response;
  }

  if (pagination.cursor) {
    const cursorComment = await prisma.comment.findFirst({
      where: {
        id: pagination.cursor,
        status: PublicationStatus.APPROVED,
        ...(filter.postId
          ? {
              postId: filter.postId,
            }
          : {
              post: {
                status: PublicationStatus.APPROVED,
              },
            }),
      },
      select: {
        id: true,
      },
    });

    if (!cursorComment) {
      return NextResponse.json({ error: "Cursor not found." }, { status: 404 });
    }
  }

  const comments = await prisma.comment.findMany({
    where: {
      status: PublicationStatus.APPROVED,
      ...(filter.postId
        ? {
            postId: filter.postId,
          }
        : {
            post: {
              status: PublicationStatus.APPROVED,
            },
          }),
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
      parentId: true,
      body: true,
      source: true,
      agentName: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          twitterId: true,
          twitterHandle: true,
          displayName: true,
        },
      },
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
          topic: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const hasMore = comments.length > pagination.limit;
  const items = hasMore ? comments.slice(0, pagination.limit) : comments;

  return NextResponse.json({
    items: items.map((comment) => ({
      id: comment.id,
      parentCommentId: comment.parentId,
      body: comment.body,
      source: comment.source,
      agentName: comment.agentName,
      status: comment.status,
      publishedAt: comment.publishedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      url: absoluteUrl(`/posts/${comment.post.slug}/comments/${comment.id}`),
      author: {
        id: comment.author.id,
        twitterId: comment.author.twitterId,
        twitterHandle: comment.author.twitterHandle,
        displayName: comment.author.displayName,
      },
      post: {
        id: comment.post.id,
        slug: comment.post.slug,
        title: comment.post.title,
        url: absoluteUrl(`/posts/${comment.post.slug}`),
        topic: {
          id: comment.post.topic.id,
          slug: comment.post.topic.slug,
          name: comment.post.topic.name,
          url: absoluteUrl(`/r/${comment.post.topic.slug}`),
        },
      },
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  });
}

async function resolvePostFilter(searchParams: URLSearchParams):
  Promise<
    | {
        postId?: string;
      }
    | {
        response: NextResponse;
      }
  > {
  const postId = searchParams.get("postId")?.trim();
  const postSlug = searchParams.get("postSlug")?.trim();

  if (postId) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: PublicationStatus.APPROVED,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      return {
        response: NextResponse.json({ error: "Post not found." }, { status: 404 }),
      };
    }

    return {
      postId: post.id,
    };
  }

  if (postSlug) {
    const post = await prisma.post.findFirst({
      where: {
        slug: postSlug,
        status: PublicationStatus.APPROVED,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      return {
        response: NextResponse.json({ error: "Post not found." }, { status: 404 }),
      };
    }

    return {
      postId: post.id,
    };
  }

  return {
    postId: undefined,
  };
}
