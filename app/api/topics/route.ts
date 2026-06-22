import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeAgentRequest } from "@/lib/api-auth";
import { createTopic, PublishingInputError, topicInputSchema } from "@/lib/publishing";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = await authorizeAgentRequest(request);

  if (authError) {
    return authError;
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

    if (topic.createdByAuthorId) {
      const createdByAuthor = await prisma.author.findUnique({
        where: {
          id: topic.createdByAuthorId,
        },
        select: {
          twitterHandle: true,
        },
      });

      if (createdByAuthor) {
        revalidatePath(`/authors/${createdByAuthor.twitterHandle}/topics`);
      }
    }

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
