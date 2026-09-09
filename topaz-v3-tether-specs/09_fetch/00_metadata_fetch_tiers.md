# Tiered Fanfiction Metadata Fetch: Obscura, Then FicHub

Replaces the single-path FicHub-then-OpenGraph fetch (`features/catalog/server/fetch-metadata-action.ts` in the prior iteration) with two tiers, in this order.

## Tier 1: Obscura

```text
Obscura (https://github.com/h4ckf0r0day/obscura) is a Rust headless-browser
engine, driven over the Chrome DevTools Protocol, run as a native binary --
it cannot be deployed to a serverless platform (long-running process,
~70MB binary, spawns worker processes), which is one of the reasons this
whole rework moved off Vercel. On a local-first, always-locally-available
device, that's not a constraint at all -- it's just another local process.
```

```text
- One Obscura `serve` process per device, started lazily on first fetch
  request (not at app startup) and killed after an idle timeout rather than
  kept warm indefinitely -- consistent with the memory-budget posture in
  07_backend/02_connections_and_scaling_limits.md: a personal single-user app
  has no reason to hold a browser engine's footprint open when nothing is
  fetching.
- Topaz drives it over CDP/WebSocket from a small server-side client module:
  navigate to the story URL, wait for load, pull the rendered HTML. This is
  what gets past FanFiction.net's (and FictionPress's) Cloudflare
  bot-challenge -- a bare fetch() only ever sees the "Just a moment..."
  interstitial, the existing FICHUB_ONLY_HOSTNAMES workaround from the prior
  iteration exists specifically because of this.
- The existing meta-tag extraction logic (OG_TITLE_PATTERNS,
  OG_DESCRIPTION_PATTERNS, OG_AUTHOR_PATTERNS, looksLikeChallengePage, and the
  HTML-entity decoding helpers in the prior work-metadata.ts) is reused as-is
  against Obscura's rendered HTML output, not rewritten -- the extraction
  logic was never the part that needed Obscura; getting past the
  Cloudflare challenge to reach real HTML at all was.
- Concurrency capped at 1 in-flight Obscura page load. This is a personal
  library, not a scraper -- there's no throughput requirement that justifies
  more, and it keeps the memory ceiling predictable.
- A fetch attempt is considered failed (falls through to Tier 2) on: a CDP
  connection/navigation error, a timeout, or looksLikeChallengePage still
  matching Obscura's rendered output (a small number of hosts may have
  challenge tiers Obscura itself can't clear either).
```

## Tier 2: FicHub

```text
Used only when Tier 1 fails or is unavailable (e.g. Obscura failed to start).
This is the prior iteration's fetchFromFicHub, unchanged: a plain fetch()
against FicHub's public /api/v0/epub endpoint, which covers AO3, FFN, and
most other fic archives via FicHub's own server-side scrape. No rework
needed here -- it already didn't depend on anything Postgres/Vercel-specific.
```

## What's Dropped

```text
The prior iteration's third tier -- a raw fetch() against the source URL
directly for OpenGraph meta tags, used when a host wasn't FicHub-only and
FicHub itself returned nothing -- is dropped. Obscura's rendered-HTML path
supersedes it for every host that tier could have served (Obscura renders
the real page including OG tags; a bare fetch() could only ever get a
subset of what Obscura gets, for hosts where a bare fetch works at all).
If a future case shows up where Obscura is running but a specific host's OG
tags are cheaper to grab via a direct fetch than a full Obscura navigation,
that's a scoped addition to evaluate then, not a default kept "just in case."
```

## Provider Attribution

The fetched-metadata shape keeps a `provider` field (`"obscura" | "fichub"`) exactly as the prior `FetchedWorkMetadata` type did with `"fichub" | "opengraph"` -- knowing which tier actually served a given work's metadata matters for debugging a bad scrape, and costs nothing to keep.
