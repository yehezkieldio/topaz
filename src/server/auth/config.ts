import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env, isDevelopment } from "#/env";
import { db } from "#/server/db";
import { accounts, sessions, users, verificationTokens } from "#/server/db/schema";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            publicId: string;
        } & DefaultSession["user"];
    }
    interface User {
        id: string;
        // publicId: string;
    }
}

const THIRTY_DAYS = 30;
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * THIRTY_DAYS;

export const authConfig = {
    adapter: DrizzleAdapter(db, {
        accountsTable: accounts,
        sessionsTable: sessions,
        usersTable: users,
        verificationTokensTable: verificationTokens,
    }),
    callbacks: {
        authorized: ({ auth }) => Boolean(auth),
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                // token.publicId = user.publicId;
            }
            return token;
        },
        session: ({ session, token }) => ({
            ...session,
            user: {
                ...session.user,
                id: token?.id as string,
                publicId: token?.publicId as string,
            },
        }),
        signIn({ account, profile }) {
            if (account?.provider === "discord" && env.ALLOWED_DISCORD_ID && profile?.id !== env.ALLOWED_DISCORD_ID) {
                return "/auth/unauthorized";
            }
            return true;
        },
    },
    pages: {
        error: "/auth/error",
        newUser: undefined,
        signIn: "/auth",
        signOut: "/auth",
    },
    providers: [
        DiscordProvider({
            clientId: env.AUTH_DISCORD_ID,
            clientSecret: env.AUTH_DISCORD_SECRET,
        }),
    ],
    session: {
        maxAge: THIRTY_DAYS_IN_SECONDS, // 30 days
        strategy: "jwt",
    },
    trustHost: isDevelopment,
} satisfies NextAuthConfig;
