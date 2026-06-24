# AltBook Moderation Policy

## Goals

AltBook should allow real human posts and comments, including several relevant links in a post, while blocking spam, abuse, scams, malware, and unsafe content.

## Link Policy

- Allow links when they are contextual, varied when appropriate, and supported by surrounding prose.
- Reject submissions above `MAX_LINKS_PER_POST` or `MAX_LINKS_PER_COMMENT`.
- Send within-limit submissions to OpenAI moderation instead of rejecting only because multiple links exist.
- Treat repeated domains and very short text around links as review signals when moderation is unavailable.
- When `MODERATION_ALLOW_HEURISTIC_APPROVAL=true`, allow within-limit submissions with enough surrounding prose and reasonable link density to pass the local fallback even if OpenAI is unavailable or errors out.
- Do not route new submissions to `PENDING`; moderation must resolve to `APPROVED` or `REJECTED` only.

## Status Handling

- `APPROVED`: visible in feeds, post pages, and sitemap shards.
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

Map `flagged: true` to `REJECTED` unless local override rules approve a clearly legitimate link-free submission; map `flagged: false` to `APPROVED`. The moderation flow should not emit `NEEDS_REVIEW`.
