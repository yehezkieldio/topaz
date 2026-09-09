# ADR-0008: next-bun-compile Packaging Over Vercel Serverless

## Status

Accepted.

## Context

With no shared server (ADR-0006), there is no Vercel deployment to build for. Each device needs to run the app as a local process it starts on demand (`08_sync/02_packaging_and_lifecycle.md`), ideally without a `bun install`/Node toolchain setup step on every device.

## Decision

`next-bun-compile` is adopted as the Next.js Build Adapter (`adapterPath: "next-bun-compile"` in `next.config.ts`). `next build` emits a single self-contained Bun executable per platform, assets embedded, with no separate `output: "standalone"` step. This is the shippable unit for every device.

The sync transport (`08_sync/01_transport_and_pairing.md`) is deliberately kept to an ordinary Next.js Route Handler rather than a hand-rolled `Bun.serve` server with a WebSocket upgrade, specifically so it bundles into this same binary with no extra plumbing -- a custom server entrypoint would have meant working around, rather than with, the adapter's build model.

## Consequences

```text
- Deployment to a device is "copy one binary over, run it" -- no package
  manager, no lockfile, no runtime install step on target devices.
- Native/dynamically-required dependencies are a known risk under single-file
  compilation (the adapter's own troubleshooting docs call out dynamic
  require() issues, e.g. with logging libraries). This is a direct factor in
  ADR-0006's choice of bun:sqlite (a Bun-runtime-native module, not an N-API
  addon) over better-sqlite3 or libsql's native bindings.
- Before wiring the real schema and auth stack through this adapter, run a
  throwaway spike compiling a minimal app using bun:sqlite and better-auth's
  SQLite adapter, to catch any bundling failure early rather than discovering
  it after the full port is done.
- Because sync stays an ordinary Route Handler instead of a custom server,
  adopting or dropping next-bun-compile later would not require redesigning
  the sync transport -- the two decisions are deliberately decoupled.
```
