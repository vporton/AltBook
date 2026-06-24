import { createHash, randomBytes } from "node:crypto";
import type { Agent } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const agentInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const agentAccessTokenLifetimeSeconds = 60 * 60;

export function generateAgentClientId() {
  return `agent_${randomBytes(12).toString("base64url")}`;
}

export function generateAgentClientSecret() {
  return `secret_${randomBytes(24).toString("base64url")}`;
}

export function generateAgentAccessToken() {
  return `access_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createAgentRecord(input: unknown, authorId: string) {
  const payload = agentInputSchema.parse(input);
  const clientId = generateAgentClientId();
  const clientSecret = generateAgentClientSecret();

  const agent = await prisma.agent.create({
    data: {
      name: payload.name,
      authorId,
      clientId,
      clientSecretHash: hashAgentCredential(clientSecret),
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      createdAt: true,
    },
  });

  return {
    agent,
    clientSecret,
  };
}

export async function regenerateAgentClientSecret(agentId: string) {
  const clientSecret = generateAgentClientSecret();

  const agent = await prisma.agent.update({
    where: {
      id: agentId,
    },
    data: {
      clientSecretHash: hashAgentCredential(clientSecret),
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      createdAt: true,
    },
  });

  return {
    agent,
    clientSecret,
  };
}

export async function regenerateOwnedAgentClientSecret(agentId: string, authorId: string) {
  const existingAgent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      authorId,
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      createdAt: true,
    },
  });

  if (!existingAgent) {
    return null;
  }

  const clientSecret = generateAgentClientSecret();

  const result = await prisma.agent.updateMany({
    where: {
      id: existingAgent.id,
      authorId,
    },
    data: {
      clientSecretHash: hashAgentCredential(clientSecret),
    },
  });

  if (result.count === 0) {
    return null;
  }

  return {
    agent: existingAgent,
    clientSecret,
  };
}

export async function authenticateAgentClient(input: {
  clientId: string;
  clientSecret: string;
}) {
  const agent = await prisma.agent.findUnique({
    where: {
      clientId: input.clientId,
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      clientSecretHash: true,
    },
  });

  if (!agent) {
    return null;
  }

  if (hashAgentCredential(input.clientSecret) !== agent.clientSecretHash) {
    return null;
  }

  return agent;
}

export async function storeAgentAccessToken(input: {
  agentId: string;
  accessToken: string;
  expiresAt: Date;
}) {
  return prisma.agent.update({
    where: {
      id: input.agentId,
    },
    data: {
      accessTokenHash: hashAgentCredential(input.accessToken),
      accessTokenExpiresAt: input.expiresAt,
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      accessTokenExpiresAt: true,
    },
  });
}

export async function authenticateAgentAccessToken(accessToken: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      accessTokenHash: hashAgentCredential(accessToken),
      accessTokenExpiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      name: true,
      clientId: true,
    },
  });

  return agent;
}

export async function hasConfiguredAgents() {
  return (await prisma.agent.count({})) > 0;
}

export type AgentSummary = Pick<Agent, "id" | "name" | "clientId" | "createdAt">;

export function parseBasicAuth(header: string) {
  const [scheme, payload] = header.split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "basic" || !payload) {
    return null;
  }

  let decoded: string;

  try {
    decoded = Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");

  if (separator <= 0) {
    return null;
  }

  return {
    clientId: decoded.slice(0, separator),
    clientSecret: decoded.slice(separator + 1),
  };
}

export function readBearerToken(header: string) {
  const [scheme, token] = header.split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function oauthTokenResponse(accessToken: string, expiresInSeconds = agentAccessTokenLifetimeSeconds) {
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresInSeconds,
  };
}
