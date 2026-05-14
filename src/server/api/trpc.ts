import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { ZodError } from "zod";
import { isDevelopment } from "#/env";
import { getCurrentSession } from "#/server/auth/session";
import { db } from "#/server/db";

export const createTRPCContext = cache(async () => {
    const session = await getCurrentSession();

    return {
        db,
        session,
    };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
    if (isDevelopment === false) {
        return next();
    }

    const start = Date.now();
    const result = await next();
    const end = Date.now();

    console.log(`[trpc] ${path} took ${end - start}ms to execute`);
    return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
    if (!ctx.session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
        ctx: {
            session: { ...ctx.session, user: ctx.session.user },
        },
    });
});
