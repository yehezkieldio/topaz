import { appendOplogEntry } from "@/server/sync/oplog";

import type { db } from "./client";
import { auditLog } from "./schema/audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AuditEntityType = (typeof auditLog.entityType.enumValues)[number];

/**
 * The jsonb `before`/`after` columns hold an allow-listed slice of a row's
 * columns (see the callers, and audit_log's schema comment) -- their values
 * are whatever plain-data shape a Postgres column can hold, i.e. any JSON
 * value, never a function or class instance.
 */
type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

export interface AuditContext {
  actorId: string;
  action: string;
}

export interface AuditPlan {
  entityType: AuditEntityType;
  entityId: string;
  changedColumns: string[];
  before: Record<string, AuditValue> | null;
  after: Record<string, AuditValue> | null;
  version: number;
}

/**
 * Inserts one audit_log row for a mutation, inside the same transaction as
 * the mutation itself. `before`/`after` must already be allow-listed by the
 * caller -- never pass a full-row dump (v3-tether/plan-work.md Slice C).
 *
 * Also appends the matching oplog entry (08_sync/00_oplog_and_clock.md):
 * every call site that already tracks "this entity's columns changed, to
 * this version" for the audit trail needs the identical fact recorded for
 * sync, so this is the one place both are written together rather than
 * duplicating that bookkeeping at each of this function's call sites.
 * `plan.entityType`'s values ("work", "work_source", "library_entry",
 * "taxonomy_term") are already the real table names oplog.table_name needs,
 * with no separate mapping to keep in sync. `after: null` (no call site
 * currently passes this) is treated as the entity's tracked state being
 * gone -- a tombstone, not an empty diff.
 */
export const recordAudit = async (
  tx: Tx,
  ctx: AuditContext,
  plan: AuditPlan
): Promise<void> => {
  await tx.insert(auditLog).values({
    action: ctx.action,
    actorId: ctx.actorId,
    after: plan.after,
    before: plan.before,
    changedColumns: plan.changedColumns,
    entityId: plan.entityId,
    entityType: plan.entityType,
    version: plan.version,
  });

  await appendOplogEntry(tx, {
    columnDiffs: plan.after ?? {},
    rowId: plan.entityId,
    tableName: plan.entityType,
    tombstone: plan.after === null,
  });
};
