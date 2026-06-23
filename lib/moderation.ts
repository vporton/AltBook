import { PublicationStatus } from "@/lib/generated/prisma";
import { assessLinks, type LinkAssessment } from "@/lib/links";

type ModerationKind = "post" | "comment";
type ModerationProvider = "openai" | "heuristic";

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
  provider: ModerationProvider;
  model: string;
  rawResponse: unknown;
};

type OpenAIModerationResponse = {
  id?: string;
  model?: string;
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

const OPENAI_MODERATION_MODEL = "omni-moderation-latest";
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

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

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackWithoutOpenAI(input, linkAssessment);
  }

  try {
    const openaiModeration = await callOpenAIModeration(input, apiKey);
    return resultFromOutcome({
      ...openaiModeration,
      links: linkAssessment,
      provider: "openai",
      model: openaiModeration.model,
      rawResponse: openaiModeration.rawResponse,
    });
  } catch (error) {
    return resultFromOutcome({
      outcome: "NEEDS_REVIEW",
      score: null,
      reason:
        error instanceof Error
          ? `OpenAI moderation failed: ${error.message}`
          : "OpenAI moderation failed.",
      categories: ["moderation_unavailable"],
      links: linkAssessment,
      provider: "openai",
      model: OPENAI_MODERATION_MODEL,
      rawResponse: null,
    });
  }
}

function fallbackWithoutOpenAI(
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
        "OpenAI moderation is not configured and the local link assessment found promotional link patterns.",
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
      reason: "OpenAI moderation is not configured; local heuristic approval is enabled.",
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
    reason: "OpenAI moderation is not configured, so the submission needs manual review.",
    categories: ["moderation_unavailable"],
    links,
    provider: "heuristic",
    model: "local-link-policy",
    rawResponse: null,
  });
}

async function callOpenAIModeration(
  input: ModerationInput,
  apiKey: string,
): Promise<{
  outcome: "APPROVED" | "REJECTED";
  score: number | null;
  reason: string;
  categories: string[];
  model: string;
  rawResponse: OpenAIModerationResponse;
}> {
  const response = await fetch(OPENAI_MODERATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODERATION_MODEL,
      input: buildModerationInput(input),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI moderation API returned ${response.status}${await readResponseError(
        response,
      )}`,
    );
  }

  const raw = (await response.json()) as OpenAIModerationResponse;
  const result = raw.results?.[0];

  if (!result) {
    throw new Error("OpenAI moderation response had no results");
  }

  const normalized = normalizeOpenAIModerationResult(result);

  return {
    ...normalized,
    model: raw.model || OPENAI_MODERATION_MODEL,
    rawResponse: raw,
  };
}

function buildModerationInput(input: ModerationInput) {
  if (input.title) {
    return `Title: ${input.title}\n\nBody: ${input.body}`;
  }

  return input.body;
}

async function readResponseError(response: Response) {
  const text = await response.text();

  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string;
      };
      message?: string;
    };
    const message = parsed.error?.message || parsed.message;

    return message ? `: ${message}` : "";
  } catch {
    return `: ${text}`;
  }
}

function normalizeOpenAIModerationResult(
  result: NonNullable<OpenAIModerationResponse["results"]>[number],
): {
  outcome: "APPROVED" | "REJECTED";
  score: number | null;
  reason: string;
  categories: string[];
} {
  const categories = collectFlaggedCategories(result.categories);
  const score = highestCategoryScore(result.category_scores, categories);
  const flagged = result.flagged ?? categories.length > 0;

  return {
    outcome: flagged ? "REJECTED" : "APPROVED",
    score,
    reason: flagged
      ? categories.length > 0
        ? `OpenAI moderation flagged ${formatCategoryList(categories)}.`
        : "OpenAI moderation flagged the submission."
      : "OpenAI moderation found no flagged categories.",
    categories,
  };
}

function collectFlaggedCategories(categories?: Record<string, boolean>) {
  return Object.entries(categories ?? {})
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);
}

function highestCategoryScore(
  scores?: Record<string, number>,
  categories?: string[],
) {
  if (!scores) {
    return null;
  }

  const selectedScores = (categories ?? [])
    .map((category) => scores[category])
    .filter((score): score is number => typeof score === "number");

  if (selectedScores.length > 0) {
    return Math.max(...selectedScores);
  }

  const allScores = Object.values(scores).filter(
    (score): score is number => typeof score === "number",
  );

  return allScores.length > 0 ? Math.max(...allScores) : null;
}

function formatCategoryList(categories: string[]) {
  if (categories.length === 1) {
    return categories[0];
  }

  if (categories.length === 2) {
    return `${categories[0]} and ${categories[1]}`;
  }

  return `${categories.slice(0, -1).join(", ")}, and ${
    categories[categories.length - 1]
  }`;
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
