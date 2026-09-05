import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Shared, generic audit trail for catalog/library/taxonomy edits. Append-only
 * -- no publicId, no updatedAt (v3/plan-work.md Slice C). `before`/`after`
 * must stay allow-listed by callers (src/server/db/audit.ts), never a
 * full-row dump.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    after: jsonb("after"),
    before: jsonb("before"),
    changedColumns: text("changed_columns").array().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entityId: uuid("entity_id").notNull(),
    entityType: text("entity_type", {
      enum: ["work", "work_source", "library_entry", "taxonomy_term"],
    }).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    version: integer("version").notNull(),
  },
  (t) => [
    index("audit_entity_time_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_created_brin_idx").using("brin", t.createdAt),
    check(
      "audit_before_is_object",
      sql`${t.before} is null or jsonb_typeof(${t.before}) = 'object'`
    ),
    check(
      "audit_after_is_object",
      sql`${t.after} is null or jsonb_typeof(${t.after}) = 'object'`
    ),
  ]
);
