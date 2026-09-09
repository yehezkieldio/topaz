# Audit Logging (Without Triggers)

Every mutable, version-tracked table (`work`, `library_entry`, `reading_state`, `taxonomy_term`) already carries a `version` column for optimistic concurrency (`03_data/00_schema_contract.md`). This file specifies how a change-history trail for those mutations is built, when it's added -- not a requirement for the initial slices, but the pattern to reach for the moment "what did I change and when" becomes a real question for a single-admin app auditing its own edits.

## Why Not Triggers

A Postgres trigger-based audit log keeps the diffing/permission logic in SQL, invisible to the TypeScript layer that already owns every write path (there is no direct SQL access from anywhere but Server Actions in this architecture -- `02_stack/00_stack_contract.md`). Session-variable plumbing (`SET LOCAL app.actor_id`) to get the acting user into a trigger is also exactly the kind of implicit, easy-to-forget-to-set state this spec avoids elsewhere (`01_principles/01_invariants.md`'s stance on explicit checks over implicit conventions).

## The Pattern: Audit Context as a Type-Enforced Precondition

Instead of a trigger, the Drizzle client used for writes is wrapped so that an insert/update/delete on an audited table is only reachable after an explicit audit-context call -- making "who did this and why" a compile-time precondition, not a hopeful convention every Server Action has to remember:

```typescript
const auditedDb = db.withAuditLogCtx({
  actorId: session.user.id,
  action: "update-work",
  reason: "edit-sheet-submit",
});

await auditedDb.update(works).set({ ... }).where(eq(works.id, workId));
// the plain `db` client's write methods on audited tables are typed as
// unreachable without first calling withAuditLogCtx -- there is no path
// that writes to an audited table without an actor and an action attached.
```

## Companion Audit Table Shape

One `*_audit_logs` table per audited entity (or one shared table with a discriminated `entityType` column, if the volume never justifies per-entity tables at this scale -- start with the shared table):

```text
audit_log
  id, publicId, entityType, entityId, action,
  actorId, changedColumns (text[]), before (jsonb), after (jsonb),
  version (the entity's version after this change), created_at
```

The `before`/`after` snapshot is the minimal diff-relevant column set, not a full-row dump -- captured by the same Server Action that performs the write, since it already has both the pre-write row (fetched for the version-conflict check, `06_library/06_mutation_lifecycle_and_transitions.md`) and the post-write values.

## When This Gets Built

Not part of the initial implementation slices (`04_implementation/00_roadmap.md`) -- it's a real, correctly-designed answer for the moment "show me the edit history of this work" or "what did I change last week" becomes an actual need, which for a single-admin personal app may be never, or may be immediately useful once the library has real content in it. Documented here so the pattern doesn't need to be redesigned when that need shows up, and so the `version` columns already in the schema are recognized as the natural hook point for it (each version bump is one audit-log row) rather than something a later audit feature has to reconstruct from scratch.
