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
 * caller -- never pass a full-row dump (v3/plan-work.md Slice C).
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
};
