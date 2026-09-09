# Auth and Authorization

## Setup

```text
better-auth + drizzleAdapter(db, { provider: "pg" })
Discord OAuth as the only social provider (default scopes: identify, email)
admin plugin from better-auth/plugins for real role-based access
```

```text
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin as adminPlugin } from "better-auth/plugins";
import { ac, admin, user } from "@/auth/permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  user: {
    additionalFields: {
      role: { type: ["user", "admin"], required: false, defaultValue: "user", input: false },
    },
  },
  plugins: [adminPlugin({ ac, roles: { admin, user } })],
});
```

`input: false` on the `role` field is load-bearing -- it prevents a client from self-assigning a role on sign-up/update. Role changes go through the admin plugin's own `POST /admin/set-role` endpoint, never a raw field write.

## Session Access

Server Components / Server Actions:

```text
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
const session = await auth.api.getSession({ headers: await headers() });
```

Route handler mount: `export const { POST, GET } = toNextJsHandler(auth)` from `better-auth/next-js`.

## Authorization Boundary

Authentication (who signed in) and authorization (what they're allowed to do) are kept strictly separate:

```text
- Every mutation Server Action checks session.user.role === "admin" (or the
  admin plugin's permission-check API) itself, explicitly, at the top of the
  function body -- not via a naming convention that implies but doesn't perform a check.
- A single shared requireAdmin(session) helper in features/auth/ throws/redirects
  consistently; every admin-only Server Action calls it first.
- Public reads (library browsing, taxonomy browsing) never call requireAdmin.
- The Discord-ID allow-list still exists at sign-in time as the single-user
  invite gate (only one person should ever be able to create a session at all),
  but it is not the sole authorization mechanism -- role checks are real and
  independent of it.
```

## Staying Single-User

better-auth's admin plugin supports multiple roles and its organization plugin supports multi-tenancy -- neither is adopted beyond what's needed for one admin role. No org tables, no team invites, no per-resource ACLs. The role field exists so authorization is *correct*, not so the app can scale to multiple users.
