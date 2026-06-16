import { relations, sql } from "drizzle-orm";
import { type AnyPgColumn, check, index, primaryKey, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { works } from "#/server/db/schema/story";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const taxonomyKindKeys = [
    "fandom",
    "character",
    "relationship",
    "genre",
    "trope",
    "warning",
    "source_category",
    "format",
    "tone",
    "custom",
] as const;
export type TaxonomyKind = (typeof taxonomyKindKeys)[number];

export const taxonomyKindEnum = z.enum(taxonomyKindKeys);

export const taxonomyKindSeeds = [
    { key: "fandom", name: "Fandom", sortOrder: 10 },
    { key: "character", name: "Character", sortOrder: 20 },
    { key: "relationship", name: "Relationship", sortOrder: 30 },
    { key: "genre", name: "Genre", sortOrder: 40 },
    { key: "trope", name: "Trope", sortOrder: 50 },
    { key: "warning", name: "Warning", sortOrder: 60 },
    { key: "source_category", name: "Source category", sortOrder: 70 },
    { key: "format", name: "Format", sortOrder: 80 },
    { key: "tone", name: "Tone", sortOrder: 90 },
    { key: "custom", name: "Custom", sortOrder: 100 },
] satisfies ReadonlyArray<{ key: TaxonomyKind; name: string; sortOrder: number }>;

export const taxonomyKindLabels = {
    fandom: "Fandom",
    character: "Character",
    relationship: "Relationship",
    genre: "Genre",
    trope: "Trope",
    warning: "Warning",
    source_category: "Source category",
    format: "Format",
    tone: "Tone",
    custom: "Custom",
} satisfies Record<TaxonomyKind, string>;

export const taxonomyRelationTypeEnum = z.enum(["broader", "related", "implies", "conflicts_with", "equivalent_to"]);
export type TaxonomyRelationType = z.infer<typeof taxonomyRelationTypeEnum>;
export const taxonomyRelationTypes = taxonomyRelationTypeEnum.options;

export const taxonomyEffectiveReasonEnum = z.enum(["direct", "broader", "implies", "equivalent_to"]);
export type TaxonomyEffectiveReason = z.infer<typeof taxonomyEffectiveReasonEnum>;

export const taxonomyKinds = createTable(
    "taxonomy_kind",
    (d) => ({
        ...ids,
        key: d.text().notNull(),
        name: d.text().notNull(),
        description: d.text(),
        is_assignable: d.boolean().notNull().default(true),
        allows_relations: d.boolean().notNull().default(true),
        sort_order: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomy_kind_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomy_kind_key_uidx").on(t.key).concurrently(),
        index("taxonomy_kind_sort_order_idx").on(t.sort_order).concurrently(),
    ]
);

export const taxonomyTerms = createTable(
    "taxonomy_term",
    (d) => ({
        ...ids,
        kindId: uuid()
            .notNull()
            .references(() => taxonomyKinds.id, { onDelete: "restrict" }),
        slug: d.text().notNull(),
        name: citext().notNull(),
        normalized_name: d.text().notNull(),
        description: d.text(),
        disambiguation: d.text(),
        status: d.text().notNull().default("active"),
        mergedIntoId: uuid().references((): AnyPgColumn => taxonomyTerms.id, { onDelete: "set null" }),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomy_term_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomy_term_kind_slug_uidx").on(t.kindId, t.slug).concurrently(),
        uniqueIndex("taxonomy_term_kind_active_normalized_name_uidx")
            .on(t.kindId, t.normalized_name)
            .where(sql`${t.status} = 'active'`)
            .concurrently(),
        index("taxonomy_term_kind_idx").on(t.kindId).concurrently(),
        index("taxonomy_term_merged_into_idx").on(t.mergedIntoId).concurrently(),
        index("taxonomy_term_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")).concurrently(),
        index("taxonomy_term_slug_trgm_idx").using("gin", t.slug.op("gin_trgm_ops")).concurrently(),
    ]
);

export const taxonomyLabels = createTable(
    "taxonomy_label",
    (d) => ({
        ...ids,
        termId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        label: citext().notNull(),
        normalized_label: d.text().notNull(),
        label_type: d.text().notNull().default("alias"),
        is_primary: d.boolean().notNull().default(false),
        is_searchable: d.boolean().notNull().default(true),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomy_label_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomy_label_term_normalized_uidx").on(t.termId, t.normalized_label).concurrently(),
        uniqueIndex("taxonomy_label_primary_term_uidx").on(t.termId).where(sql`${t.is_primary} = true`).concurrently(),
        index("taxonomy_label_normalized_idx").on(t.normalized_label).concurrently(),
        index("taxonomy_label_term_idx").on(t.termId).concurrently(),
        index("taxonomy_label_label_trgm_idx").using("gin", t.label.op("gin_trgm_ops")).concurrently(),
    ]
);

export const taxonomyRelations = createTable(
    "taxonomy_relation",
    (d) => ({
        ...ids,
        fromTermId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        toTermId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        relation_type: d.text().notNull(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomy_relation_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomy_relation_edge_uidx").on(t.fromTermId, t.toTermId, t.relation_type).concurrently(),
        index("taxonomy_relation_from_idx").on(t.fromTermId).concurrently(),
        index("taxonomy_relation_to_idx").on(t.toTermId).concurrently(),
        index("taxonomy_relation_type_idx").on(t.relation_type).concurrently(),
        check("taxonomy_relation_no_self_edge", sql`${t.fromTermId} <> ${t.toTermId}`),
    ]
);

export const workTaxonomyAssignments = createTable(
    "work_taxonomy_assignment",
    (d) => ({
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
        termId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        created_at: d.timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    }),
    (t) => [
        primaryKey({ columns: [t.workId, t.termId] }),
        index("work_taxonomy_assignment_work_idx").on(t.workId).concurrently(),
        index("work_taxonomy_assignment_term_idx").on(t.termId).concurrently(),
    ]
);

export const workTaxonomyEffective = createTable(
    "work_taxonomy_effective",
    (d) => ({
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
        termId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        sourceTermId: uuid().references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        reason: d.text().notNull(),
        depth: d.integer().notNull().default(0),
        created_at: d.timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    }),
    (t) => [
        primaryKey({ columns: [t.workId, t.termId] }),
        index("work_taxonomy_effective_work_idx").on(t.workId).concurrently(),
        index("work_taxonomy_effective_term_idx").on(t.termId).concurrently(),
        index("work_taxonomy_effective_source_term_idx").on(t.sourceTermId).concurrently(),
        index("work_taxonomy_effective_reason_idx").on(t.reason).concurrently(),
        check("work_taxonomy_effective_depth_nonnegative", sql`${t.depth} >= 0`),
    ]
);

export const taxonomyKindsRelations = relations(taxonomyKinds, ({ many }) => ({
    terms: many(taxonomyTerms),
}));

export const taxonomyTermsRelations = relations(taxonomyTerms, ({ one, many }) => ({
    kind: one(taxonomyKinds, {
        fields: [taxonomyTerms.kindId],
        references: [taxonomyKinds.id],
    }),
    mergedInto: one(taxonomyTerms, {
        fields: [taxonomyTerms.mergedIntoId],
        references: [taxonomyTerms.id],
        relationName: "taxonomy_term_merge_relation",
    }),
    labels: many(taxonomyLabels),
    fromRelations: many(taxonomyRelations, { relationName: "taxonomy_relation_from_relation" }),
    toRelations: many(taxonomyRelations, { relationName: "taxonomy_relation_to_relation" }),
}));

export const taxonomyLabelsRelations = relations(taxonomyLabels, ({ one }) => ({
    term: one(taxonomyTerms, {
        fields: [taxonomyLabels.termId],
        references: [taxonomyTerms.id],
    }),
}));

export const taxonomyRelationsRelations = relations(taxonomyRelations, ({ one }) => ({
    fromTerm: one(taxonomyTerms, {
        fields: [taxonomyRelations.fromTermId],
        references: [taxonomyTerms.id],
        relationName: "taxonomy_relation_from_relation",
    }),
    toTerm: one(taxonomyTerms, {
        fields: [taxonomyRelations.toTermId],
        references: [taxonomyTerms.id],
        relationName: "taxonomy_relation_to_relation",
    }),
}));

export const workTaxonomyAssignmentsRelations = relations(workTaxonomyAssignments, ({ one }) => ({
    work: one(works, { fields: [workTaxonomyAssignments.workId], references: [works.id] }),
    term: one(taxonomyTerms, { fields: [workTaxonomyAssignments.termId], references: [taxonomyTerms.id] }),
}));

export const workTaxonomyEffectiveRelations = relations(workTaxonomyEffective, ({ one }) => ({
    work: one(works, { fields: [workTaxonomyEffective.workId], references: [works.id] }),
    term: one(taxonomyTerms, { fields: [workTaxonomyEffective.termId], references: [taxonomyTerms.id] }),
    sourceTerm: one(taxonomyTerms, {
        fields: [workTaxonomyEffective.sourceTermId],
        references: [taxonomyTerms.id],
    }),
}));

export const taxonomyKindCreateSchema = createInsertSchema(taxonomyKinds);
export const taxonomyTermCreateSchema = createInsertSchema(taxonomyTerms).extend({
    kind: taxonomyKindEnum.optional(),
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255).optional(),
});
export const taxonomyTermUpdateSchema = createUpdateSchema(taxonomyTerms)
    .extend({
        kind: taxonomyKindEnum.optional(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().min(1).max(255).optional(),
    })
    .required({ publicId: true });
export type TaxonomyTermValues = z.infer<typeof taxonomyTermCreateSchema>;
