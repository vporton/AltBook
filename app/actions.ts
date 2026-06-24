"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertHumanSubmission } from "@/lib/human";
import { createModeratedComment, createModeratedPost } from "@/lib/publishing";
import { getCurrentAuthor } from "@/lib/twitter-auth";

export async function createPost(formData: FormData) {
  assertHumanSubmission(formData);
  const author = await getCurrentAuthor();

  if (!author) {
    redirect("/?auth=required");
  }

  const { post, moderation } = await createModeratedPost({
    title: formData.get("title"),
    body: formData.get("body"),
    topicId: formData.get("topicId"),
    authorId: author.id,
    source: "HUMAN",
  });
  const isApproved = moderation.status === "APPROVED";

  revalidatePath("/");
  revalidatePath(`/r/${post.topic.slug}`);
  revalidatePath(`/u/${author.twitterHandle}`);
  revalidatePath("/sitemap.xml");

  if (isApproved) {
    redirect(`/posts/${post.slug}?submitted=approved`);
  }

  if (moderation.status === "REJECTED") {
    redirect(`/r/${post.topic.slug}?submitted=rejected`);
  }

  redirect(`/r/${post.topic.slug}?submitted=review`);
}

export async function createComment(formData: FormData) {
  assertHumanSubmission(formData);
  const author = await getCurrentAuthor();
  const postSlug = String(formData.get("postSlug") ?? "");

  if (!author) {
    redirect(postSlug ? `/posts/${postSlug}?auth=required` : "/?auth=required");
  }

  const { comment, moderation, post } = await createModeratedComment({
    postId: formData.get("postId"),
    parentCommentId: formData.get("parentCommentId") || undefined,
    body: formData.get("body"),
    authorId: author.id,
    source: "HUMAN",
  });
  const isApproved = moderation.status === "APPROVED";

  revalidatePath(`/posts/${post.slug}`);
  revalidatePath("/sitemap.xml");

  if (comment.parentId) {
    revalidatePath(`/posts/${post.slug}/comments/${comment.parentId}`);
  }

  revalidatePath(`/posts/${post.slug}/comments/${comment.id}`);

  if (isApproved) {
    redirect(`/posts/${post.slug}/comments/${comment.id}?comment=approved`);
  }

  if (moderation.status === "REJECTED") {
    redirect(`/posts/${post.slug}?comment=rejected`);
  }

  redirect(`/posts/${post.slug}?comment=review`);
}
