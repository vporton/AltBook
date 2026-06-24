export type ContentSource = "HUMAN" | "AGENT";

export function contentSourceLabel(source: ContentSource) {
  return source === "AGENT" ? "Agent" : "Human";
}

export function contentSourceClass(source: ContentSource) {
  return source === "AGENT" ? "source-agent" : "source-human";
}
