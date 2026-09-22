# Data Integrity and Reconciliation

This is a handoff plan, not an implemented feature. It exists because the oplog (append-only change log, `00_oplog_and_clock.md`) has no way to notice that two devices' data has actually diverged. A sync round only asks "what changed since my last checkpoint" and applies it. Nothing ever asks "do my tables now match this peer's tables." This document scopes the work to close that gap: detecting drift, and reconciling it once found.

This plan is standalone. It does not depend on, and does not cover, the pairing, discovery, or account-bootstrap work already implemented elsewhere in this project's history. An implementer can build this against the sync system as `00_oplog_and_clock.md` and `01_transport_and_pairing.md` describe it, without reading anything else.

## Why Drift Can Happen at All

The single-writer, last-write-wins (LWW) model in `00_oplog_and_clock.md` converges in theory. Every device eventually applies the same total order of changes. In practice, a few real failure modes break that assumption:

```text
- A sync round is interrupted mid-batch (device sleeps, network drops), leaving
  a device with a checkpoint that has advanced past rows it never actually
  applied, if the apply step and the checkpoint advance aren't perfectly atomic.
- A bug in the apply path (apply.ts's per-table switch) silently drops or
  misapplies a row instead of throwing.
- A row is edited directly against a device's SQLite file, bypassing the
  app's own oplog-append path entirely (manual debugging, a failed migration,
  restoring an old backup).
- Clock skew produces a technically-valid but surprising HLC ordering that a
  human would not have picked, even though the mechanism worked correctly.
```

None of these are common, but none of them are detectable today either. The oplog protocol has no self-check.

## Scope: Detection First, Repair Second

Treat this as two separable pieces of work, not one. Detection tells you drift exists. Reconciliation fixes it. Ship detection alone first. Automatically rewriting a device's local data is a much larger blast radius than reporting a mismatch. It needs trust before it runs unattended.

## Part 1: Detecting Drift

### Per-Table Digest

Five tables are synced today: `library_entry`, `reading_state`, `taxonomy_term`, `work`, and `work_source`. These are the same five tables `apply.ts`'s closed switch already knows about. For each one, each device computes a digest, a single value that summarizes the table's current content. Two devices can then compare digests instead of comparing every row over the network.

```text
- For each row: hash a canonical string of (row id, version column, updated_at)
  -- not the full row content, since version + updated_at already changes
  whenever any column does, and hashing fewer bytes keeps this cheap.
- Combine per-row hashes with an order-independent operation (XOR, or sum mod
  a large prime) rather than concatenating them in scan order -- two devices
  will not necessarily iterate rows in the same order, and the digest must not
  depend on iteration order to still detect a real content mismatch correctly.
- Include the row count alongside the combined hash. A table with different
  row counts but a colliding combined hash (rare, but the whole point of a
  digest is accepting some collision risk in exchange for cheap comparison)
  is still caught by the count.
```

This reuses the `version` columns that already exist on `work`, `library_entry`, `reading_state`, and `taxonomy_term` for optimistic concurrency (`03_data/00_schema_contract.md`). `work_source` has no `version` column today. Decide whether to add one, or hash on `updated_at` alone for that table specifically.

### Exchanging and Comparing Digests

Add a new signed endpoint, following the same pattern as `/api/sync` (`01_transport_and_pairing.md`: request signed with the caller's Ed25519 key, verified against the key stored for that peer during pairing). It returns this device's current per-table digests. A sync round, after applying oplog rows as normal, can optionally also fetch the peer's digests and compare them to its own freshly-recomputed ones.

```text
- Comparing digests is strictly heavier than a normal oplog pull (it touches
  every row of every synced table, not just rows changed since the last
  checkpoint), so it should not run on every sync round by default. Run it on
  a lower-frequency trigger: every Nth round, on a manual "Check integrity"
  button, or both.
- A mismatch names the table(s) that disagree, nothing more granular in this
  phase. Do not try to identify the specific divergent row yet -- that's
  Part 2's problem, and conflating detection with diagnosis complicates the
  simpler piece for no benefit at this stage.
- Surface a mismatch as a plain warning in the sync UI: which table, which
  peer, when last checked. No automatic action follows from detection alone.
```

## Part 2: Reconciling Drift

Once a table is known to mismatch, reconciliation finds the actual divergent rows. It then re-establishes a single correct state across both devices. It does this without abandoning the append-only oplog model the rest of the system depends on.

### Full-Table State Pull

Add a second new endpoint, or a mode on the digest endpoint. It returns a full, batched listing of one table's rows: id, version, updated_at, and the columns needed to decide precedence. Gate it with the same peer-signature check as everything else in this system. This is different from the oplog. The oplog answers what changed since a given point. This answers what is true right now.

```text
- Batch it the same way oplog pulls are already batched (a fixed page size,
  07_backend/02_connections_and_scaling_limits.md) -- a library with several
  thousand entries must not require one unbounded response.
- Only fetch this for a table a digest check has already flagged as
  mismatched. Never pull full table state as a matter of course; that
  defeats the entire point of using a cheap digest for the common case.
```

### The Repair Step

With both devices' full row states for the mismatched table in hand, resolve row by row:

```text
- For a row present on both sides with different version/updated_at: the
  later HLC-ordered write wins, exactly as 00_oplog_and_clock.md's normal
  conflict rule already states. Reconciliation does not invent a new
  precedence rule, it just applies the existing one to rows the normal
  incremental oplog flow missed.
- For a row present on only one device: this is very likely a row that was
  correctly created and simply never made it across in an interrupted sync,
  not a real conflict. Treat it as a normal oplog row that arrived late.
- Every correction this step makes must itself be written as a new oplog
  entry on the device being corrected, not applied as a silent direct table
  write. This keeps the oplog the single source of truth for "what happened"
  and lets the correction propagate onward to a third device on its own,
  the same as any other change.
- After applying corrections, recompute the digest and confirm it now
  matches. If it still doesn't, stop and report failure rather than looping
  -- a repair that can't converge after one pass indicates a bug worth
  surfacing, not something to retry silently.
```

### Automatic vs. Manual Trigger

Phase this in rather than wiring it up as a background job from day one:

```text
Phase 1 -- detection only. Digest mismatch surfaces as a warning. No repair
  code exists yet. Ship this alone and let it run for a while before trusting
  it enough to build on top of.

Phase 2 -- manual repair. A "Repair now" action next to a flagged mismatch
  runs the full-table pull and reconciliation described above, on demand,
  with a visible result (what changed, on which device).

Phase 3 -- automatic repair, only after Phase 2 has proven reliable in
  practice. If pursued, trigger it from the same place a normal sync round
  already runs, immediately after a digest mismatch is detected, with the
  outcome still surfaced afterward (not a silent background rewrite) so a
  device's data can visibly change without the admin having caused it
  directly, and they can see why.
```

## Open Decisions for Whoever Picks This Up

```text
- Exact digest algorithm and canonicalization (this document specifies the
  shape -- per-row hash, order-independent combine, row count -- not a
  specific hash function or byte layout).
- Whether work_source needs a version column added, or hashes on updated_at
  alone.
- How often a digest check runs by default (every Nth sync round vs.
  manual-only), and whether that's user-configurable.
- Whether Phase 3 (automatic repair) is worth building at all, versus
  leaving repair as a manual, visible action indefinitely -- automatic
  silent-ish data rewriting is a real tradeoff, not a strictly better
  end state.
```

## Relevant Existing Files

```text
src/server/sync/oplog.ts     - oplog read/observe helpers; the digest and
                                full-table-pull work sits alongside this,
                                not inside it.
src/server/sync/apply.ts     - the closed per-table switch; any new synced
                                table needs a case added here too.
src/server/sync/round.ts     - where a normal sync round is orchestrated;
                                the digest-check trigger hooks in here.
src/app/api/sync/route.ts    - the existing signed-request pattern to copy
                                for the new digest and full-table endpoints.
03_data/00_schema_contract.md - the version/updated_at columns this plan
                                reuses for precedence and hashing.
```
