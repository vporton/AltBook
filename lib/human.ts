import { createHash, timingSafeEqual } from "node:crypto";

export function hashEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}

export function assertHumanSubmission(formData: FormData) {
  const honeypot = String(formData.get("website") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  const elapsed = Date.now() - startedAt;

  if (honeypot.trim().length > 0) {
    throw new Error("Submission rejected.");
  }

  if (!Number.isFinite(startedAt) || elapsed < 2500) {
    throw new Error("Please take a moment before submitting.");
  }
}

export function constantTimeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
