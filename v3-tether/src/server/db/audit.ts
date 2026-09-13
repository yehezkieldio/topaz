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

/**
 * What actually gets recorded to the oplog for this mutation. Not always
 * derivable from entityType/entityId/after: those three exist for a human-
 * readable audit trail, and at several real call sites they don't
 * correspond 1:1 to one physical table's own columns -- a rating or
 * reading-progress change is audited under entityType "library_entry" for
 * readability, but the changed column (rating, current_chapter) actually
 * lives on reading_state, a different table with its own row id and
 * version. Applying such a diff generically by table name
 * (08_sync/00_oplog_and_clock.md's sync consumers) against the wrong table,
 * or against columns the named table doesn't have, would be a real
 * correctness bug -- so this is required whenever entityType/entityId/after
 * aren't already exactly the real table/row/columns, not inferred.
 */
export interface OplogPlan {
  tableName: string;
  rowId: string;
  columnDiffs: Record<string, unknown>;
  tombstone?: boolean;
}

export interface AuditPlan {
  entityType: AuditEntityType;
  entityId: string;
  changedColumns: string[];
  before: Record<string, AuditValue> | null;
  after: Record<string, AuditValue> | null;
  version: number;
  /**
   * Defaults to {tableName: entityType, rowId: entityId, columnDiffs: after
   * ?? {}} when omitted -- correct only when the audit framing and the real
   * table/row/columns genuinely coincide (true for plain work/taxonomy_term
   * edits, false for anything touching reading_state under a
   * "library_entry" audit entityType, or an `after` that includes fields
   * that aren't literal columns of `entityType`'s table). See this
   * function's OplogPlan doc.
   */
  oplog?: OplogPlan;
}

/**
 * Inserts one audit_log row for a mutation, inside the same transaction as
 * the mutation itself. `before`/`after` must already be allow-listed by the
 * caller -- never pass a full-row dump (v3-tether/plan-work.md Slice C).
 *
 * Also appends the matching oplog entry (08_sync/00_oplog_and_clock.md) --
 * see AuditPlan.oplog's doc for when the default derived from
 * entityType/entityId/after is (and isn't) correct.
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

  const oplogPlan: OplogPlan = plan.oplog ?? {
    columnDiffs: plan.after ?? {},
    rowId: plan.entityId,
    tableName: plan.entityType,
    tombstone: plan.after === null,
  };
  await appendOplogEntry(tx, oplogPlan);
};
