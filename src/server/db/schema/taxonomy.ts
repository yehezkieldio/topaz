import { relations } from "drizzle-orm";
import { index, pgEnum, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod/v4";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const taxonomyKindEnum = pgEnum("taxonomy_kind", [
    "Fandom",
    "Tag",
    "Genre",
    "Character",
    "Relationship",
    "Warning",
    "SourceCategory",
    "Custom",
]);
export type TaxonomyKind = (typeof taxonomyKindEnum.enumValues)[number];

export const taxonomyKindLabels = {
    Fandom: "Fandom",
    Tag: "Tag",
    Genre: "Genre",
    Character: "Character",
    Relationship: "Relationship",
    Warning: "Warning",
    SourceCategory: "Source category",
    Custom: "Custom",
} satisfies Record<TaxonomyKind, string>;

export const taxonomyTerms = createTable(
    "taxonomy_term",
    (d) => ({
        ...ids,
        kind: taxonomyKindEnum("kind").notNull().default("Tag"),
        name: citext().notNull(),
        slug: varchar({ length: 255 }).notNull(),
        description: d.text(),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomyterm_pid_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomyterm_kind_slug_uidx").on(t.kind, t.slug).concurrently(),
        uniqueIndex("taxonomyterm_kind_name_uidx").on(t.kind, t.name).concurrently(),
        index("taxonomyterm_kind_idx").on(t.kind).concurrently(),
        index("taxonomyterm_created_idx").on(t.created_at).concurrently(),
        index("taxonomyterm_updated_idx").on(t.updated_at).concurrently(),
        index("taxonomyterm_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")).concurrently(),
        index("taxonomyterm_slug_trgm_idx").using("gin", t.slug.op("gin_trgm_ops")).concurrently(),
    ]
);

export const taxonomyAliases = createTable(
    "taxonomy_alias",
    (_d) => ({
        ...ids,
        termId: uuid()
            .notNull()
            .references(() => taxonomyTerms.id, { onDelete: "cascade" }),
        name: citext().notNull(),
        slug: varchar({ length: 255 }).notNull(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("taxonomyalias_pid_uidx").on(t.publicId).concurrently(),
        uniqueIndex("taxonomyalias_term_slug_uidx").on(t.termId, t.slug).concurrently(),
        uniqueIndex("taxonomyalias_term_name_uidx").on(t.termId, t.name).concurrently(),
        index("taxonomyalias_term_idx").on(t.termId).concurrently(),
        index("taxonomyalias_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")).concurrently(),
    ]
);

export const taxonomyTermsRelations = relations(taxonomyTerms, ({ many }) => ({
    aliases: many(taxonomyAliases),
}));

export const taxonomyAliasesRelations = relations(taxonomyAliases, ({ one }) => ({
    term: one(taxonomyTerms, {
        fields: [taxonomyAliases.termId],
        references: [taxonomyTerms.id],
    }),
}));

export const taxonomyTermCreateSchema = createInsertSchema(taxonomyTerms).extend({
    kind: z.enum(taxonomyKindEnum.enumValues).default("Tag"),
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
});
export const taxonomyTermUpdateSchema = createUpdateSchema(taxonomyTerms)
    .extend({
        name: z.string().min(1).max(255).optional(),
        slug: z.string().min(1).max(255).optional(),
    })
    .required({ publicId: true });
export type TaxonomyTermValues = z.infer<typeof taxonomyTermCreateSchema>;
