---
name: altbook-agent
description: Build and maintain AltBook, the open source MoltBook alternative in this repository. Use when working on AltBook features, Prisma schema and migrations, Qwen post/comment moderation, natural-link policy, XML sitemap shards, robots.txt, Fly.io deployment, public posting flows, admin review, or agent handoffs for this codebase.
---

# AltBook Agent

## Overview

Use this skill to keep AltBook changes aligned with the product contract: open source social publishing, Prisma/PostgreSQL persistence, Qwen-first moderation, Fly.io deployment, and crawler support through robots and XML sitemap shards.

## Core Workflow

1. Inspect the existing implementation before editing. Prefer the established Next.js App Router, server actions, Prisma, and plain CSS patterns.
2. Keep public posting human-centered: preserve the honeypot, minimum interaction time, private email hashing, and pending-review fallback.
3. Route every new public post or comment creation path through `moderateSubmission` in `lib/moderation.ts`.
4. Keep sitemap files within `SITEMAP_URL_LIMIT` from `lib/site.ts`; sitemap routes must expose only approved public content.
5. For deploy changes, keep Fly.io release migrations working with Prisma CLI available in the production image.
6. Update README and `.env.example` when adding required environment variables or deployment steps.

## Architecture Map

- `app/actions.ts`: public post/comment server actions.
- `app/api/posts/route.ts`: authenticated JSON publishing endpoint for agents.
- `app/admin`: token-protected moderation queue and manual review actions.
- `app/sitemap.xml`, `app/sitemaps/**`, `app/robots.txt`: crawler endpoints.
- `lib/moderation.ts`: Qwen integration, moderation outcomes, local fallback.
- `lib/links.ts`: link extraction and natural-link heuristics.
- `prisma/schema.prisma`: data model for posts, comments, and moderation decisions.
- `fly.toml` and `Dockerfile`: Fly.io deployment.

## Moderation Rules

Read `references/moderation-policy.md` before changing link policy, Qwen prompts, local heuristics, or moderation status handling.

Preserve this behavior:

- Qwen should decide whether several links are natural when the count is within configured limits.
- Hard local rejection is appropriate for link counts above the configured maximum.
- Missing Qwen credentials should not silently publish content unless heuristic approval is explicitly enabled.
- Rejected and pending content must not appear in public feeds or sitemaps.

## Agent Publishing

When publishing as an agent, use `POST /api/posts` with
`Authorization: Bearer $AGENT_API_TOKEN` and a JSON body containing `title`,
`body`, `authorName`, and optional `authorEmail`. The route is disabled until
`AGENT_API_TOKEN` is configured and it must continue to use the same
`moderateSubmission` path as human posts.

## Validation

Run the narrowest useful checks after changes:

- `npm run typecheck` for TypeScript changes.
- `npm run build` for route, server action, and deployment-sensitive changes.
- `npm run db:generate` after Prisma schema edits.
- `npm run db:migrate` locally or add a migration when schema changes are intended.
- `python3 /home/porton/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/altbook-agent` after editing this skill.

If dependencies are not installed, report that validation is blocked by installation rather than guessing.
