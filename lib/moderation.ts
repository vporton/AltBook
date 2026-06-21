import { PublicationStatus } from "@prisma/client";
import { assessLinks, type LinkAssessment } from "@/lib/links";

type ModerationKind = "post" | "comment";

export type ModerationInput = {
  kind: ModerationKind;
  title?: string;
  body: string;
};

export type ModerationResult = {
  outcome: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  status: PublicationStatus;
  score: number | null;
  reason: string;
  categories: string[];
  links: LinkAssessment;
  provider: "qwen" | "heuristic";
  model: string;
  rawResponse: unknown;
};

type QwenJson = {
  outcome?: string;
  score?: number;
  reason?: string;
  categories?: string[];
};

export async function moderateSubmission(
  input: ModerationInput,
): Promise<ModerationResult> {
  const maxLinks =
    input.kind === "post"
      ? numberFromEnv("MAX_LINKS_PER_POST", 8)
      : numberFromEnv("MAX_LINKS_PER_COMMENT", 4);
  const linkAssessment = assessLinks(`${input.title ?? ""}\n${input.body}`, maxLinks);

  if (linkAssessment.flags.includes("too_many_links")) {
    return resultFromOutcome({
      outcome: "REJECTED",
      score: 0.96,
      reason: `Submission has ${linkAssessment.linkCount} links, above the configured limit of ${linkAssessment.maxAllowed}.`,
      categories: ["link_spam"],
      links: linkAssessment,
      provider: "heuristic",
      model: "local-link-policy",
      rawResponse: null,
    });
  }

  const apiKey = process.env.QWEN_API_KEY;

  if (!apiKey) {
    return fallbackWithoutQwen(input, linkAssessment);
  }

  try {
    const qwen = await callQwen(input, linkAssessment, apiKey);
    return resultFromOutcome({
      ...qwen,
      links: linkAssessment,
      provider: "qwen",
      model: process.env.QWEN_MODEL || "qwen-plus",
      rawResponse: qwen.rawResponse,
    });
  } catch (error) {
    return resultFromOutcome({
      outcome: "NEEDS_REVIEW",
      score: null,
      reason:
        error instanceof Error
          ? `Qwen moderation failed: ${error.message}`
          : "Qwen moderation failed.",
      categories: ["moderation_unavailable"],
      links: linkAssessment,
      provider: "qwen",
      model: process.env.QWEN_MODEL || "qwen-plus",
      rawResponse: null,
    });
  }
}

function fallbackWithoutQwen(
  input: ModerationInput,
  links: LinkAssessment,
): ModerationResult {
  const allowHeuristicApproval =
    process.env.MODERATION_ALLOW_HEURISTIC_APPROVAL === "true";

  if (links.flags.includes("low_context_per_link") || links.flags.includes("repeated_domains")) {
    return resultFromOutcome({
      outcome: "NEEDS_REVIEW",
      score: 0.55,
      reason:
        "Qwen is not configured and the local link assessment found promotional link patterns.",
      categories: ["needs_manual_moderation"],
      links,
      provider: "heuristic",
      model: "local-link-policy",
      rawResponse: null,
    });
  }

  if (allowHeuristicApproval && input.body.trim().length >= 20) {
    return resultFromOutcome({
      outcome: "APPROVED",
      score: 0.15,
      reason: "Qwen is not configured; local heuristic approval is enabled.",
      categories: [],
      links,
      provider: "heuristic",
      model: "local-link-policy",
      rawResponse: null,
    });
  }

  return resultFromOutcome({
    outcome: "NEEDS_REVIEW",
    score: null,
    reason: "Qwen moderation is not configured, so the submission needs manual review.",
    categories: ["moderation_unavailable"],
    links,
    provider: "heuristic",
    model: "local-link-policy",
    rawResponse: null,
  });
}

async function callQwen(
  input: ModerationInput,
  links: LinkAssessment,
  apiKey: string,
): Promise<Omit<ModerationResult, "status" | "links" | "provider" | "model">> {
  const base = (process.env.QWEN_API_BASE || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.QWEN_MODEL || "qwen-plus";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You moderate a public social publishing app. Return only JSON with outcome, score, reason, and categories. outcome must be APPROVED, REJECTED, or NEEDS_REVIEW. Approve natural writing that includes several relevant links. Reject spam, scams, harassment, sexual exploitation, illegal instructions, malware, and link stuffing.",
        },
        {
          role: "user",
          content: JSON.stringify({
            contentKind: input.kind,
            title: input.title ?? null,
            body: input.body,
            linkAssessment: links,
            policy:
              "Links are allowed when they are relevant, contextual, and not repetitive. Several links in a long post are acceptable.",
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Qwen API returned ${response.status}`);
  }

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Qwen response had no content");
  }

  const parsed = parseJsonObject(content);
  const normalized = normalizeQwenJson(parsed);

  return {
    outcome: normalized.outcome,
    score: normalized.score,
    reason: normalized.reason,
    categories: normalized.categories,
    rawResponse: raw,
  };
}

function parseJsonObject(content: string): QwenJson {
  try {
    return JSON.parse(content) as QwenJson;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Qwen response was not JSON");
    }

    return JSON.parse(match[0]) as QwenJson;
  }
}

function normalizeQwenJson(
  parsed: QwenJson,
): Pick<ModerationResult, "outcome" | "score" | "reason" | "categories"> {
  const outcome =
    parsed.outcome === "APPROVED" ||
    parsed.outcome === "REJECTED" ||
    parsed.outcome === "NEEDS_REVIEW"
      ? parsed.outcome
      : "NEEDS_REVIEW";

  return {
    outcome,
    score: typeof parsed.score === "number" ? parsed.score : null,
    reason: parsed.reason || "No moderation reason returned.",
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
  };
}

function resultFromOutcome(
  result: Omit<ModerationResult, "status">,
): ModerationResult {
  return {
    ...result,
    status:
      result.outcome === "APPROVED"
        ? PublicationStatus.APPROVED
        : result.outcome === "REJECTED"
          ? PublicationStatus.REJECTED
          : PublicationStatus.PENDING,
  };
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
