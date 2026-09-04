import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, bearer } from "better-auth/plugins";

import { ac, admin, user as userRole } from "@/auth/permissions";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    account: {
      create: {
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
