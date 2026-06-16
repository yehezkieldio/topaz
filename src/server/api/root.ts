import { libraryRouter } from "#/server/api/routers/library";
import { taxonomyRouter } from "#/server/api/routers/taxonomy";
import { workRouter } from "#/server/api/routers/work";
import { createTRPCRouter } from "#/server/api/trpc";

export const appRouter = createTRPCRouter({
    library: libraryRouter,
    taxonomy: taxonomyRouter,
    work: workRouter,
});

export type AppRouter = typeof appRouter;
