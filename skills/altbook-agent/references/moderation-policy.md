# AltBook Moderation Policy

## Goals

AltBook should allow real human posts and comments, including several relevant links in a post, while blocking spam, abuse, scams, malware, and unsafe content.

## Link Policy

- Allow links when they are contextual, varied when appropriate, and supported by surrounding prose.
- Reject submissions above `MAX_LINKS_PER_POST` or `MAX_LINKS_PER_COMMENT`.
- Send within-limit submissions to OpenAI moderation instead of rejecting only because multiple links exist.
- Treat repeated domains, very short text around links, and many links in comments as review signals when moderation is unavailable.

## Status Handling

- `APPROVED`: visible in feeds, post pages, and sitemap shards.
- `PENDING`: visible only in `/admin`.
- `REJECTED`: hidden publicly and retained for audit history.

## OpenAI Contract

The moderation API returns a single `results[0]` object with boolean category flags and per-category scores:

```json
{
  "flagged": true,
  "categories": {
    "harassment": false,
    "violence": true
  },
  "category_scores": {
    "harassment": 0.001,
    "violence": 0.91
  }
}
```

Map `flagged: true` to `REJECTED`, `flagged: false` to `APPROVED`, and `NEEDS_REVIEW` to the Prisma `PENDING` status when moderation is unavailable or fails.
