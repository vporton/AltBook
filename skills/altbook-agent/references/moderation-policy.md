# AltBook Moderation Policy

## Goals

AltBook should allow real human posts and comments, including several relevant links in a post, while blocking spam, abuse, scams, malware, and unsafe content.

## Link Policy

- Allow links when they are contextual, varied when appropriate, and supported by surrounding prose.
- Reject submissions above `MAX_LINKS_PER_POST` or `MAX_LINKS_PER_COMMENT`.
- Send within-limit link decisions to Qwen instead of rejecting only because multiple links exist.
- Treat repeated domains, very short text around links, and many links in comments as review signals.

## Status Handling

- `APPROVED`: visible in feeds, post pages, and sitemap shards.
- `PENDING`: visible only in `/admin`.
- `REJECTED`: hidden publicly and retained for audit history.

## Qwen Contract

The Qwen call should request strict JSON:

```json
{
  "outcome": "APPROVED | REJECTED | NEEDS_REVIEW",
  "score": 0.0,
  "reason": "short explanation",
  "categories": ["optional labels"]
}
```

Map `NEEDS_REVIEW` to the Prisma `PENDING` status.
