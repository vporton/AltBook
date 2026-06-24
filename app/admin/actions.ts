"use server";

import { PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  getAdminSession,
  isAdminTokenValid,
  setAdminSession,
} from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function adminLogin(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  if (!isAdminTokenValid(token)) {
    redirect("/admin?error=1");
  }

  setAdminSession(token);
  redirect("/admin");
}

export async function adminLogout() {
  clearAdminSession();
  redirect("/admin");
}

export async function approvePost(formData: FormData) {
  assertAdmin();
  const id = String(formData.get("id") ?? "");

  const post = await prisma.post.update({
    where: { id },
    data: {
      status: PublicationStatus.APPROVED,
      publishedAt: new Date(),
      decisions: {
        create: {
          contentKind: "post",
          provider: "admin",
          model: "manual-review",
          outcome: "APPROVED",
          reason: "Approved by an administrator.",
        },
      },
    },
    select: {
      slug: true,
      topic: {
        select: {
          slug: true,
        },
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/r/${post.topic.slug}`);
  revalidatePath(`/posts/${post.slug}`);
  revalidatePath("/sitemap.xml");
}

export async function rejectPost(formData: FormData) {
  assertAdmin();
  const id = String(formData.get("id") ?? "");

  const post = await prisma.post.update({
    where: { id },
    data: {
      status: PublicationStatus.REJECTED,
      decisions: {
        create: {
          contentKind: "post",
          provider: "admin",
          model: "manual-review",
          outcome: "REJECTED",
          reason: "Rejected by an administrator.",
        },
      },
    },
    select: {
      topic: {
        select: {
          slug: true,
        },
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/r/${post.topic.slug}`);
  revalidatePath("/sitemap.xml");
}

export async function approveComment(formData: FormData) {
  assertAdmin();
  const id = String(formData.get("id") ?? "");

  const comment = await prisma.comment.update({
    where: { id },
    data: {
      status: PublicationStatus.APPROVED,
      publishedAt: new Date(),
      decisions: {
        create: {
          contentKind: "comment",
          provider: "admin",
          model: "manual-review",
          outcome: "APPROVED",
          reason: "Approved by an administrator.",
        },
      },
    },
    select: {
      post: {
        select: {
          slug: true,
          topic: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/posts/${comment.post.slug}`);
  revalidatePath(`/r/${comment.post.topic.slug}`);
}

export async function rejectComment(formData: FormData) {
  assertAdmin();
  const id = String(formData.get("id") ?? "");

  const comment = await prisma.comment.update({
    where: { id },
    data: {
      status: PublicationStatus.REJECTED,
      decisions: {
        create: {
          contentKind: "comment",
          provider: "admin",
          model: "manual-review",
          outcome: "REJECTED",
          reason: "Rejected by an administrator.",
        },
      },
    },
    select: {
      post: {
        select: {
          slug: true,
          topic: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/posts/${comment.post.slug}`);
  revalidatePath(`/r/${comment.post.topic.slug}`);
}

function assertAdmin() {
  if (!getAdminSession()) {
    redirect("/admin");
  }
}
