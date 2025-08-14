import { relations, sql } from "drizzle-orm";
import { index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import type z4 from "zod/v4";
import { storyFandoms } from "#/server/db/schema/story";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const fandoms = createTable(
    "fandom",
    () => ({
        ...ids,
        name: citext().notNull(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("fandom_pid_uidx").on(t.publicId).concurrently(),
        uniqueIndex("fandom_name_uidx").on(t.name).concurrently(),
        index("fandom_created_idx").on(t.created_at).concurrently(),
        index("fandom_updated_idx").on(t.updated_at).concurrently(),
        index("fandom_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`).concurrently(),
    ],
);

export const fandomRelations = relations(fandoms, ({ many }) => ({
    storyFandoms: many(storyFandoms, {
        relationName: "fandom_story_relation",
    }),
}));

export const fandomCreateSchema = createInsertSchema(fandoms);
export const fandomUpdateSchema = createUpdateSchema(fandoms).required({ publicId: true });
export type FandomValues = z4.infer<typeof fandomCreateSchema>;
