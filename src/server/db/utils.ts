import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { customType, pgTableCreator, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `topaz_${name}`);

export const publicId = varchar({ length: 128 })
    .notNull()
    .$defaultFn(() => createId());

export const ids = {
    id: uuid()
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    publicId,
};

export const timestamps = {
    created_at: timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    updated_at: timestamp({ mode: "date", withTimezone: true }).$onUpdate((): Date => new Date()),
};

export const citext = customType<{ data: string }>({
    dataType() {
        return "citext";
    },
    toDriver(value: string) {
        return value;
    },
    fromDriver(value: unknown) {
        return value as string;
    },
});
