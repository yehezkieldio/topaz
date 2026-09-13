import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { enumCheck, idColumns, nocaseText, timestampColumns } from "./_shared";
import { work } from "./catalog";

export const taxonomyTermStatusValues = ["active", "merged"] as const;
export type TaxonomyTermStatus = (typeof taxonomyTermStatusValues)[number];

export const taxonomyRelationTypeValues = [
  "broader",
  "related",
  "implies",
  "conflicts_with",
  "equivalent_to",
] as const;
export type TaxonomyRelationType = (typeof taxonomyRelationTypeValues)[number];

export const taxonomyEffectiveReasonValues = ["direct", "inferred"] as const;
export type TaxonomyEffectiveReason =
  (typeof taxonomyEffectiveReasonValues)[number];

export const taxonomyKind = sqliteTable("taxonomy_kind", {
  ...idColumns(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestampColumns(),
});

// Free-text/fuzzy search over name moves to the work_fts-style FTS5 virtual
// table pattern (07_backend/03_search_and_filtering.md), not a column-level
// index here -- see the note in catalog.ts.
export const taxonomyTerm = sqliteTable(
  "taxonomy_term",
  {
    ...idColumns(),
    mergedIntoId: text("merged_into_id"),
    name: nocaseText("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: taxonomyTermStatusValues })
      .default("active")
      .notNull(),
    taxonomyKindId: text("taxonomy_kind_id")
      .notNull()
      .references(() => taxonomyKind.id),
    version: integer("version").default(1).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("taxonomy_term_kind_slug_uidx").on(
      table.taxonomyKindId,
      table.slug
    ),
    index("taxonomy_term_normalized_name_idx").on(table.normalizedName),
    index("taxonomy_term_merged_into_id_idx").on(table.mergedIntoId),
    enumCheck("taxonomy_term_status_valid", table.status, taxonomyTermStatusValues),
  ]
);

export const taxonomyLabel = sqliteTable(
  "taxonomy_label",
  {
    ...idColumns(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .default(false)
      .notNull(),
    label: nocaseText("label").notNull(),
    taxonomyTermId: text("taxonomy_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    index("taxonomy_label_term_id_idx").on(table.taxonomyTermId),
    uniqueIndex("taxonomy_label_term_primary_uidx")
      .on(table.taxonomyTermId)
      .where(sql`${table.isPrimary} = true`),
    uniqueIndex("taxonomy_label_term_label_uidx").on(
      table.taxonomyTermId,
      table.label
    ),
  ]
);

export const taxonomyRelation = sqliteTable(
  "taxonomy_relation",
  {
    ...idColumns(),
    fromTermId: text("from_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    relationType: text("relation_type", {
      enum: taxonomyRelationTypeValues,
    }).notNull(),
    toTermId: text("to_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("taxonomy_relation_from_to_type_uidx").on(
      table.fromTermId,
      table.toTermId,
      table.relationType
    ),
    index("taxonomy_relation_to_term_id_idx").on(table.toTermId),
    check(
      "taxonomy_relation_no_self_edge",
      sql`${table.fromTermId} != ${table.toTermId}`
    ),
    enumCheck(
      "taxonomy_relation_type_valid",
      table.relationType,
      taxonomyRelationTypeValues
    ),
  ]
);

export const workTaxonomyAssignment = sqliteTable(
  "work_taxonomy_assignment",
  {
    taxonomyTermId: text("taxonomy_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.taxonomyTermId] }),
    index("work_taxonomy_assignment_term_id_idx").on(table.taxonomyTermId),
  ]
);

export const workTaxonomyEffective = sqliteTable(
  "work_taxonomy_effective",
  {
    depth: integer("depth").notNull(),
    reason: text("reason", { enum: taxonomyEffectiveReasonValues }).notNull(),
    taxonomyTermId: text("taxonomy_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.taxonomyTermId] }),
    index("work_taxonomy_effective_term_id_idx").on(table.taxonomyTermId),
    check("work_taxonomy_effective_depth_bounded", sql`${table.depth} <= 4`),
    enumCheck(
      "work_taxonomy_effective_reason_valid",
      table.reason,
      taxonomyEffectiveReasonValues
    ),
  ]
);
