import { constantTimeEquals } from "@/lib/human";

export function agentApiNotConfigured() {
  return !process.env.AGENT_API_TOKEN;
}

export function isAgentRequestAuthorized(request: Request) {
  const configured = process.env.AGENT_API_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);

  return (
    typeof configured === "string" &&
    typeof scheme === "string" &&
    scheme.toLowerCase() === "bearer" &&
    typeof token === "string" &&
    token.length > 0 &&
    constantTimeEquals(token, configured)
  );
}
