import { relations, sql } from "drizzle-orm";
import { index, primaryKey, uuid } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";
import { createTable, ids } from "#/server/db/utils";

export const users = createTable("user", (d) => ({
    ...ids,
    email: d.varchar({ length: 255 }).notNull(),
    emailVerified: d
        .timestamp({
            mode: "date",
            withTimezone: true,
        })
        .default(sql`CURRENT_TIMESTAMP`),
    image: d.varchar({ length: 255 }),
    name: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    accounts: many(accounts, {
        relationName: "user_account_relation",
    }),
}));

export const accounts = createTable(
    "account",
    (d) => ({
        access_token: d.text(),
        expires_at: d.integer(),
        id_token: d.text(),
        provider: d.varchar({ length: 255 }).notNull(),
        providerAccountId: d.varchar({ length: 255 }).notNull(),
        refresh_token: d.text(),
        scope: d.varchar({ length: 255 }),
        session_state: d.varchar({ length: 255 }),
        token_type: d.varchar({ length: 255 }),
        type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
        userId: uuid()
            .notNull()
            .references(() => users.id),
    }),
    (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("account_user_id_idx").on(t.userId)]
);

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, { fields: [accounts.userId], references: [users.id], relationName: "account_user_relation" }),
}));

export const sessions = createTable(
    "session",
    (d) => ({
        expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
        sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
        userId: uuid()
            .notNull()
            .references(() => users.id),
    }),
    (t) => [index("t_user_id_idx").on(t.userId)]
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id], relationName: "session_user_relation" }),
}));

export const verificationTokens = createTable(
    "verification_token",
    (d) => ({
        expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
        identifier: d.varchar({ length: 255 }).notNull(),
        token: d.varchar({ length: 255 }).notNull(),
    }),
    (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);
