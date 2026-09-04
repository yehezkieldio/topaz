import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { citext, idColumns, timestampColumns } from "./_shared";
import { work } from "./catalog";

export const taxonomyTermStatusEnum = pgEnum("taxonomy_term_status", [
  "active",
  "merged",
]);

export const taxonomyRelationTypeEnum = pgEnum("taxonomy_relation_type", [
  "broader",
  "related",
  "implies",
  "conflicts_with",
  "equivalent_to",
]);

export const taxonomyEffectiveReasonEnum = pgEnum("taxonomy_effective_reason", [
  "direct",
  "inferred",
]);

export const taxonomyKind = pgTable("taxonomy_kind", {
  ...idColumns(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestampColumns(),
});

export const taxonomyTerm = pgTable(
  "taxonomy_term",
  {
    ...idColumns(),
    mergedIntoId: uuid("merged_into_id"),
    name: citext("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    slug: text("slug").notNull(),
    status: taxonomyTermStatusEnum("status").default("active").notNull(),
    taxonomyKindId: uuid("taxonomy_kind_id")
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
    index("taxonomy_term_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`
    ),
    index("taxonomy_term_merged_into_id_idx").on(table.mergedIntoId),
  ]
);

export const taxonomyLabel = pgTable(
  "taxonomy_label",
  {
    ...idColumns(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    label: citext("label").notNull(),
    taxonomyTermId: uuid("taxonomy_term_id")
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

export const taxonomyRelation = pgTable(
  "taxonomy_relation",
  {
    ...idColumns(),
    fromTermId: uuid("from_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    relationType: taxonomyRelationTypeEnum("relation_type").notNull(),
    toTermId: uuid("to_term_id")
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
  ]
);

export const workTaxonomyAssignment = pgTable(
  "work_taxonomy_assignment",
  {
    taxonomyTermId: uuid("taxonomy_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.taxonomyTermId] }),
    index("work_taxonomy_assignment_term_id_idx").on(table.taxonomyTermId),
  ]
);

export const workTaxonomyEffective = pgTable(
  "work_taxonomy_effective",
  {
    depth: integer("depth").notNull(),
    reason: taxonomyEffectiveReasonEnum("reason").notNull(),
    taxonomyTermId: uuid("taxonomy_term_id")
      .notNull()
      .references(() => taxonomyTerm.id, { onDelete: "cascade" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.taxonomyTermId] }),
    index("work_taxonomy_effective_term_id_idx").on(table.taxonomyTermId),
    check("work_taxonomy_effective_depth_bounded", sql`${table.depth} <= 4`),
  ]
);
