import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, bearer, magicLink } from "better-auth/plugins";
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

export const MOBILE_CONNECT_EXPIRY_SECONDS = 5 * 60;

/**
 * The magic-link plugin only hands the raw token/url to its `sendMagicLink`
 * callback -- `auth.api.signInMagicLink`'s own response is just
 * `{ status: true }` (better-auth assumes you're emailing the link, not
 * reading it back). This device never emails anything: the "connect a
 * phone" flow (mobile-connect-card.tsx) calls signInMagicLink and needs
 * that token synchronously to build the QR code. captureNextMagicLink()
 * arms a one-shot resolver the callback below fires into; safe without a
 * request-scoped store because this is a single-admin local app -- there is
 * never more than one in-flight signInMagicLink call at a time in
 * practice, and even if two overlapped, the worst case is a QR code for the
 * wrong (but still admin-issued, still short-lived) link, not a
 * cross-request leak to a different user.
 */
let pendingMagicLinkCapture: ((data: { url: string; token: string }) => void) | null =
  null;

export const captureNextMagicLink = () =>
  new Promise<{ url: string; token: string }>((resolve) => {
    pendingMagicLinkCapture = (data) => {
      pendingMagicLinkCapture = null;
      resolve(data);
    };
  });

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
  plugins: [
    adminPlugin({ ac, roles: { admin, user: userRole } }),
    bearer(),
    // Powers "connect a phone": a QR code that logs the scanning device
    // straight in, no password typed on a phone keyboard
    // (thin-client mobile mode -- the phone has no local database of its
    // own, it just talks to this device's server, so all it needs is a
    // session). disableSignUp is true because the only email this app
    // ever issues a magic link for is the existing admin's own -- there is
    // no flow where scanning a QR should be able to create a new account.
    magicLink({
      disableSignUp: true,
      expiresIn: MOBILE_CONNECT_EXPIRY_SECONDS,
      sendMagicLink: ({ url, token }) => {
        pendingMagicLinkCapture?.({ token, url });
      },
    }),
  ],
  secret: env.BETTER_AUTH_SECRET,
  // baseURL (and thus its origin) is auto-trusted, but "Connect a phone"
  // deliberately mints its magic link against this device's *tailnet*
  // origin instead (generateMobileConnectAction), since BETTER_AUTH_URL is
  // typically a localhost value meaningless to another device. That second
  // origin has to be declared here too, or requests from it hit
  // better-auth's CSRF/origin checks.
  trustedOrigins: [`http://${env.SYNC_TAILNET_HOSTNAME}:${env.SYNC_PORT}`],
  advanced: {
    // This app never terminates TLS itself -- Tailscale is the transport
    // security layer (encrypted tunnel, device-authenticated by the
    // tailnet), and every device is reached over plain http, whether via
    // `bun dev` or the compiled binary (docs/GETTING_STARTED_SYNC.md,
    // "Connect a phone"). better-auth's default is to mark session cookies
    // `Secure` whenever NODE_ENV is production, which the compiled binary
    // is -- browsers silently refuse to store a `Secure` cookie set over a
    // non-localhost http origin, so without this override the "Connect a
    // phone" magic-link sign-in (and any Tailscale-only access in general)
    // would look like it succeeds but leave the device signed out.
    useSecureCookies: false,
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
