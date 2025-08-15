import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "#/env";
import { db } from "#/server/db";
import { accounts, sessions, users, verificationTokens } from "#/server/db/schema";

declare module "next-auth" {
    type Session = {
        user: {
            id: string;
            publicId: string;
        } & DefaultSession["user"];
    };
    type User = {
        id: string;
        publicId: string;
    };
}

export const authConfig = {
    adapter: DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
    }),
    callbacks: {
        authorized: ({ auth }) => {
            return Boolean(auth);
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
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.publicId = user.publicId;
            }
            return token;
        },
    },
    pages: {
        signIn: "/auth",
        signOut: "/auth",
        error: "/auth/error",
        newUser: undefined,
    },
    providers: [
        DiscordProvider({
            clientId: env.AUTH_DISCORD_ID,
            clientSecret: env.AUTH_DISCORD_SECRET,
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
} satisfies NextAuthConfig;
