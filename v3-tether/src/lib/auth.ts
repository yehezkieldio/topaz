import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, bearer } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";

import { ac, admin, user as userRole } from "@/auth/permissions";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/**
 * The single-user invite gate's local-first equivalent of the old Discord-ID
 * allow-list (02_stack/04_auth_and_authorization.md): sign-up is refused once
 * a user row already exists, so there is never a second account to
 * authorize against in the first place. Exported so the auth UI can decide
 * whether to render a sign-up form or a sign-in form -- this device either
 * has its one account already or it doesn't, there's no third state.
 */
export const hasExistingUser = async (): Promise<boolean> => {
  const [row] = await db.select({ value: count() }).from(schema.user);
  return (row?.value ?? 0) > 0;
};

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          // The one account this device will ever have is also its admin --
          // there is no separate promotion step to run once sign-up is
          // limited to a single user (the `before` hook below).
          await db
            .update(schema.user)
            .set({ role: "admin" })
            .where(eq(schema.user.id, newUser.id));
        },
        before: async () => {
          if (await hasExistingUser()) {
            return false;
          }
          return true;
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [adminPlugin({ ac, roles: { admin, user: userRole } }), bearer()],
  secret: env.BETTER_AUTH_SECRET,
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
