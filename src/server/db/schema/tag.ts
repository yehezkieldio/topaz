import { relations } from "drizzle-orm";
import { index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import type z4 from "zod/v4";
import { storyTags } from "#/server/db/schema/story";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const tags = createTable(
    "tag",
    () => ({
        ...ids,
        name: citext().notNull(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("tag_pid_uidx").on(t.publicId).concurrently(),
        uniqueIndex("tag_name_uidx").on(t.name).concurrently(),
        index("tag_created_idx").on(t.created_at).concurrently(),
        index("tag_updated_idx").on(t.updated_at).concurrently(),
    ],
);

export const tagsRelations = relations(tags, ({ many }) => ({
    storyTags: many(storyTags, {
        relationName: "tag_story_relation",
    }),
}));

export const tagCreateSchema = createInsertSchema(tags);
export const tagUpdateSchema = createUpdateSchema(tags).required({
    publicId: true,
});
export type TagValues = z4.infer<typeof tagCreateSchema>;
