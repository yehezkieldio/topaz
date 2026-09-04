import { createId } from "@paralleldrive/cuid2";
import { customType, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/**
 * Factory, not a shared object -- every pgTable() call must get its own
 * column-builder instances. Spreading a module-scope singleton here would
 * hand every table the *same* `publicId` builder, and Drizzle would then
 * derive the same unique-constraint name for every table that uses it.
 */
export const idColumns = () => ({
  id: uuid("id").defaultRandom().primaryKey(),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => createId()),
});

export const timestampColumns = () => ({
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
