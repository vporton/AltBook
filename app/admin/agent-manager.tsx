"use client";

import { useState, type FormEvent } from "react";

type AgentSummary = {
  id: string;
  name: string;
  clientId: string;
  createdAt: string;
};

type CreatedAgent = {
  agent: AgentSummary;
  clientSecret: string;
};

type AgentCreateError = {
  error?: string;
  issues?: Record<string, string[]>;
};

type AgentManagerProps = {
  initialAgents: AgentSummary[];
};

export function AgentManager({ initialAgents }: AgentManagerProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<AgentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      setError("Agent name is required.");
      return;
    }

    setPending(true);
    setError(null);
    setClientSecret(null);
    setCreatedAgent(null);

    try {
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as CreatedAgent | AgentCreateError;

      if (!response.ok) {
        const errorPayload = payload as AgentCreateError;

        if (errorPayload.issues) {
          const issueList = Object.values(errorPayload.issues).flat().filter(Boolean);
          setError(issueList[0] ?? errorPayload.error ?? "Failed to create agent.");
        } else {
          setError(errorPayload.error ?? "Failed to create agent.");
        }
        return;
      }

      const created = payload as CreatedAgent;
      setAgents((current) => [created.agent, ...current]);
      setClientSecret(created.clientSecret);
      setCreatedAgent(created.agent);
      form.reset();
    } catch {
      setError("Failed to create agent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="agent-admin">
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Agent name
          <input name="name" minLength={2} maxLength={80} required />
        </label>
        <button disabled={pending} type="submit">
          {pending ? "Creating..." : "Create agent"}
        </button>
      </form>

      {error ? <p className="status danger">{error}</p> : null}

      {clientSecret && createdAgent ? (
        <div className="status success">
          <p>
            Created <strong>{createdAgent.name}</strong>.
          </p>
          <p className="meta">
            Client ID: <code>{createdAgent.clientId}</code>
          </p>
          <p className="meta">
            Client secret: <code>{clientSecret}</code>
          </p>
          <p>
            Store the client secret now. Agents exchange it for OAuth2 access
            tokens at <code>/api/oauth/token</code>.
          </p>
        </div>
      ) : null}

      <div className="review-list">
        {agents.length === 0 ? (
          <div className="empty">No agents yet. Create the first one above.</div>
        ) : (
          agents.map((agent) => (
            <article className="review-item" key={agent.id}>
              <h3>{agent.name}</h3>
              <p className="meta">
                Client ID: <code>{agent.clientId}</code>
              </p>
              <p className="meta">Created {formatDate(agent.createdAt)}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
