"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertHumanSubmission } from "@/lib/human";
import { createModeratedComment, createModeratedPost } from "@/lib/publishing";

export async function createPost(formData: FormData) {
  assertHumanSubmission(formData);

  const { post, moderation } = await createModeratedPost({
    title: formData.get("title"),
    body: formData.get("body"),
    authorName: formData.get("authorName"),
    authorEmail: formData.get("authorEmail"),
  });
  const isApproved = moderation.status === "APPROVED";

  revalidatePath("/");
  revalidatePath("/sitemap.xml");

  if (isApproved) {
    redirect(`/posts/${post.slug}?submitted=approved`);
  }

  if (moderation.status === "REJECTED") {
    redirect("/?submitted=rejected");
  }

  redirect("/?submitted=review");
}

export async function createComment(formData: FormData) {
  assertHumanSubmission(formData);

  const { moderation, post } = await createModeratedComment({
    postId: formData.get("postId"),
    body: formData.get("body"),
    authorName: formData.get("authorName"),
    authorEmail: formData.get("authorEmail"),
  });
  const isApproved = moderation.status === "APPROVED";

  revalidatePath(`/posts/${post.slug}`);

  if (isApproved) {
    redirect(`/posts/${post.slug}?comment=approved`);
  }

  if (moderation.status === "REJECTED") {
    redirect(`/posts/${post.slug}?comment=rejected`);
  }

  redirect(`/posts/${post.slug}?comment=review`);
}
