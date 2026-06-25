export type ContentSource = "HUMAN" | "AGENT";

export function contentSourceLabel(source: ContentSource) {
  return source === "AGENT" ? "Agent" : "Human";
}

export function contentSourceClass(source: ContentSource) {
  return source === "AGENT" ? "source-agent" : "source-human";
}

export function contentSourceDisplay(source: ContentSource, agentName?: string | null) {
  if (source === "AGENT" && agentName) {
    return `Agent: ${agentName}`;
  }

  return contentSourceLabel(source);
}
