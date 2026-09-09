import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { ac, admin, user as userRole } from "@/auth/permissions";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

const isAdminDiscordAccount = (account: {
  providerId: string;
  accountId: string;
}) =>
  account.providerId === "discord" &&
  account.accountId === env.ADMIN_DISCORD_ID;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          // The `role` field only ever defaults to "user" -- nothing else
          // promotes an account to admin, so the one allowed Discord sign-in
          // is promoted here, right after its account row is created.
          if (isAdminDiscordAccount(account)) {
            await db
              .update(schema.user)
              .set({ role: "admin" })
              .where(eq(schema.user.id, account.userId));
          }
        },
        before: (account) => {
          const isAllowedAdmin =
            account.providerId !== "discord" ||
            account.accountId === env.ADMIN_DISCORD_ID;
          return Promise.resolve(isAllowedAdmin ? { data: account } : false);
        },
      },
    },
  },
  plugins: [adminPlugin({ ac, roles: { admin, user: userRole } }), bearer()],
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      role: {
        defaultValue: "user",
        input: false,
        required: false,
        type: ["user", "admin"],
      },
    },
  },
});
