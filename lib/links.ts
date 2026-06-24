export type ExtractedLink = {
  href: string;
  hostname: string;
};

export type LinkAssessment = {
  links: ExtractedLink[];
  linkCount: number;
  maxAllowed: number;
  repeatedHostnames: string[];
  wordsPerLink: number | null;
  flags: string[];
};

const urlPattern = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

export function extractLinks(text: string): ExtractedLink[] {
  const matches = text.match(urlPattern) ?? [];
  const seen = new Set<string>();

  return matches.flatMap((rawHref) => {
    const href = rawHref.replace(/[.,;:!?]+$/, "");

    if (seen.has(href)) {
      return [];
    }

    seen.add(href);

    try {
      const url = new URL(href);
      return [
        {
          href: url.toString(),
          hostname: url.hostname.toLowerCase().replace(/^www\./, ""),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function assessLinks(text: string, maxAllowed: number): LinkAssessment {
  const links = extractLinks(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const hostnameCounts = links.reduce<Record<string, number>>((counts, link) => {
    counts[link.hostname] = (counts[link.hostname] ?? 0) + 1;
    return counts;
  }, {});
  const repeatedHostnames = Object.entries(hostnameCounts)
    .filter(([, count]) => count > 1)
    .map(([hostname]) => hostname);
  const wordsPerLink = links.length > 0 ? words.length / links.length : null;
  const flags: string[] = [];

  if (links.length > maxAllowed) {
    flags.push("too_many_links");
  }

  if (links.length > 0 && wordsPerLink !== null && wordsPerLink < 8) {
    flags.push("low_context_per_link");
  }

  if (repeatedHostnames.length > 0 && links.length > 3) {
    flags.push("repeated_domains");
  }

  return {
    links,
    linkCount: links.length,
    maxAllowed,
    repeatedHostnames,
    wordsPerLink,
    flags,
  };
}
