"use client";

import { useState } from "react";

type AdminAgentSummary = {
  id: string;
  name: string;
  clientId: string;
  createdAt: string;
  author?: {
    displayName: string;
    twitterHandle: string;
  } | null;
};

type RegeneratedAgent = {
  agent: AdminAgentSummary;
  clientSecret: string;
};

type AgentListProps = {
  initialAgents: AdminAgentSummary[];
  regenerateUrlBase: string;
  emptyMessage?: string;
};

export function AgentList({
  initialAgents,
  regenerateUrlBase,
  emptyMessage,
}: AgentListProps) {
  const [agents] = useState(initialAgents);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [rotatedAgent, setRotatedAgent] = useState<AdminAgentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

  async function handleRegenerate(agentId: string) {
    setPendingAgentId(agentId);
    setError(null);
    setClientSecret(null);
    setRotatedAgent(null);

    try {
      const response = await fetch(`${regenerateUrlBase}/${agentId}/secret`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as RegeneratedAgent | { error?: string };

      if (!response.ok) {
        setError(isErrorPayload(payload) ? payload.error ?? "Failed to regenerate agent secret." : "Failed to regenerate agent secret.");
        return;
      }

      const rotated = payload as RegeneratedAgent;
      setClientSecret(rotated.clientSecret);
      setRotatedAgent(rotated.agent);
    } catch {
      setError("Failed to regenerate agent secret.");
    } finally {
      setPendingAgentId(null);
    }
  }

  return (
    <div className="agent-admin">
      {error ? <p className="status danger">{error}</p> : null}

      {clientSecret && rotatedAgent ? (
        <div className="status success">
          <p>
            Regenerated secret for <strong>{rotatedAgent.name}</strong>.
          </p>
          <p className="meta">
            Client ID: <code>{rotatedAgent.clientId}</code>
          </p>
          <p className="meta">
            Client secret: <code>{clientSecret}</code>
          </p>
          <p>
            Store the new client secret now. The previous secret stops working as
            soon as this update is saved.
          </p>
        </div>
      ) : null}

      <div className="review-list">
        {agents.length === 0 ? (
          <div className="empty">
            {emptyMessage ?? "No agents yet."}
          </div>
        ) : (
          agents.map((agent) => (
            <article className="review-item" key={agent.id}>
              <h3>{agent.name}</h3>
              <p className="meta">
                Client ID: <code>{agent.clientId}</code>
              </p>
              <p className="meta">
                Owner: {agent.author ? formatOwner(agent.author) : "Unknown"}
              </p>
              <p className="meta">Created {formatDate(agent.createdAt)}</p>
              <div className="actions-row">
                <button
                  className="secondary"
                  disabled={pendingAgentId === agent.id}
                  onClick={() => handleRegenerate(agent.id)}
                  type="button"
                >
                  {pendingAgentId === agent.id ? "Regenerating..." : "Regenerate secret"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function formatOwner(author: { displayName: string; twitterHandle: string }) {
  return `${author.displayName} (@${author.twitterHandle})`;
}

function isErrorPayload(value: RegeneratedAgent | { error?: string }): value is { error?: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
