import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { enumCheck, jsonText } from "./_shared";

export const auditEntityTypeValues = [
  "work",
  "work_source",
  "library_entry",
  "taxonomy_term",
] as const;
export type AuditEntityType = (typeof auditEntityTypeValues)[number];

/**
 * Shared, generic audit trail for catalog/library/taxonomy edits. Append-only
 * -- no publicId, no updatedAt (v3-tether/plan-work.md Slice C). `before`/`after`
 * must stay allow-listed by callers (src/server/db/audit.ts), never a
 * full-row dump.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    after: jsonText<Record<string, unknown>>("after"),
    before: jsonText<Record<string, unknown>>("before"),
    // text[] has no SQLite equivalent -- stored as a JSON array instead,
    // enforced by the json_type = 'array' check below.
    changedColumns: jsonText<string[]>("changed_columns").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    entityId: text("entity_id").notNull(),
    entityType: text("entity_type", { enum: auditEntityTypeValues }).notNull(),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    version: integer("version").notNull(),
  },
  (t) => [
    index("audit_entity_time_idx").on(t.entityType, t.entityId, t.createdAt),
    check(
      "audit_before_is_object",
      sql`${t.before} is null or (json_valid(${t.before}) and json_type(${t.before}) = 'object')`
    ),
    check(
      "audit_after_is_object",
      sql`${t.after} is null or (json_valid(${t.after}) and json_type(${t.after}) = 'object')`
    ),
    check(
      "audit_changed_columns_is_array",
      sql`json_valid(${t.changedColumns}) and json_type(${t.changedColumns}) = 'array'`
    ),
    enumCheck("audit_entity_type_valid", t.entityType, auditEntityTypeValues),
  ]
);
