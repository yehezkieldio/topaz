# ADR-0009: Tiered Obscura-Then-FicHub Metadata Fetch

## Status

Accepted.

## Context

The prior iteration fetched fanfiction metadata via FicHub's API first, falling back to a raw `fetch()` for OpenGraph tags (blocked outright on Cloudflare-gated hosts like FanFiction.net). Obscura (https://github.com/h4ckf0r0day/obscura) -- a native, CDP-driven headless-browser binary that cannot run on a serverless platform -- is available once the app runs as a local process on every device (ADR-0006), and is a more capable first attempt: it renders the real page, including past Cloudflare's bot challenge.

## Decision

Metadata fetch becomes two-tiered: **Tier 1** drives a locally-running Obscura process over CDP to fetch and render the story URL, reusing the existing OG-tag extraction logic against its rendered HTML. **Tier 2**, used only when Tier 1 fails or is unavailable, is the prior iteration's unchanged FicHub API call. The prior third tier (a raw direct `fetch()` for OpenGraph tags) is dropped -- Obscura's rendered-HTML path supersedes everything that tier could serve.

## Consequences

```text
- Obscura is started lazily per fetch request and killed after an idle
  timeout, not kept always-running -- consistent with the local
  resource-conscious posture in 07_backend/02_connections_and_scaling_limits.md.
- Concurrency is capped at one in-flight Obscura page load; this is a
  personal library's occasional metadata fetch, not a scraping workload.
- The existing meta-tag extraction and challenge-page-detection code is
  reused as-is against Obscura's output -- only the transport to get real
  HTML changes, not the parsing logic built around it.
- Fetch reliability now depends on a local Obscura process being available
  and startable on the device performing the fetch, not just on network
  reachability to FicHub -- Tier 2 exists specifically to cover the case
  where that dependency isn't met.
```
