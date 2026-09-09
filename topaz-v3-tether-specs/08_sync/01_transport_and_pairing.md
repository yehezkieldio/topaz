# Transport and Pairing

## Transport: an Ordinary Route Handler, Not a Socket

Store-and-forward sync doesn't need a live connection -- it needs "ask a peer for everything since seq N, get a bounded batch back." That's a request/response shape, so it's implemented as exactly that: a Next.js Route Handler, the same primitive already used elsewhere in this stack for TanStack-Query-facing reads (`02_stack/00_stack_contract.md`).

```text
app/api/sync/route.ts   POST -- body: { deviceId, sinceHlc }, signed (see below).
                          Response: { rows: OplogRow[], nextHlc }, capped at
                          the fixed per-round batch size. sinceHlc/nextHlc are
                          hlc_timestamp values, not seq numbers -- seq is
                          per-device-file and isn't comparable across devices
                          (08_sync/00_oplog_and_clock.md's Checkpointing).
```

```text
- No WebSocket, no persistent socket, no custom Bun.serve wrapper. Because
  next-bun-compile compiles the whole Next.js app (02_stack/00_stack_contract.md),
  this Route Handler ships in the same binary with zero extra transport code.
- A sync round is: pull (ask each known peer for rows since our checkpoint of
  them) then push (the same request shape, reversed -- a peer's sync round
  against this device is this device acting as the server for that request).
  There is no separate "push" code path; every device runs the identical
  Route Handler and every device is, symmetrically, sometimes the caller and
  sometimes the callee.
- Bound to the device's Tailscale interface/address, not 0.0.0.0 -- the sync
  endpoint should not be reachable from outside the tailnet at all.
```

## Discovery: Tailscale, Nothing Custom

```text
- Each device's `known_peer` row (03_data/00_schema_contract.md) stores the
  peer's Tailscale hostname (e.g. laptop-a.tailnet-name.ts.net) and port, not
  an IP -- Tailscale hostnames stay stable across network changes, IPs don't.
- No mDNS, no Bluetooth, no custom rendezvous/discovery service
  (01_principles/02_non_goals.md). If a device is reachable on the tailnet,
  its hostname resolves; if it isn't (asleep, offline, not on the tailnet
  right now), the sync attempt for that peer this round simply fails silently
  and is retried next time the app opens -- this is what "store-and-forward,
  devices don't need to be online together" means operationally.
```

## Pairing: the One Real Trust Boundary

Tailscale gets two devices onto the same private network; it does not by itself mean this app's `/api/sync` endpoint should accept anything a peer on that tailnet sends it without question. Pairing establishes application-level trust once, per device pair, so a sync payload can be authenticated as actually coming from a device the admin deliberately paired, not just "some device on my tailnet."

```text
- Each device generates an Ed25519 keypair on first run (Bun's Web Crypto API
  supports Ed25519 sign/verify natively -- no extra dependency needed for
  this).
- Pairing (one-time, per device pair): one device displays a short code or QR
  encoding its public key fingerprint + Tailscale hostname; the admin enters
  or scans it on the other device. Both devices store the other's public key
  in known_peer. This is a deliberate, manual, admin-initiated action -- there
  is no automatic "trust any new device on the tailnet" path.
- Every /api/sync request body is signed with the caller's private key; the
  receiver verifies the signature against the caller's stored public key in
  known_peer before applying anything, and rejects (no partial apply) if the
  signature doesn't verify or the caller isn't a known, paired peer.
- Losing a device (e.g. a laptop is wiped) means removing its known_peer
  row on the remaining devices -- there is no separate revocation protocol
  beyond "the other devices simply stop trusting that key," which is
  sufficient for a fixed, admin-controlled set of trusted devices.
```
