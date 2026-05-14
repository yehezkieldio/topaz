import { progressRouter } from "#/server/api/routers/progress";
import { storyRouter } from "#/server/api/routers/story";
import { taxonomyRouter } from "#/server/api/routers/taxonomy";
import { viewRouter } from "#/server/api/routers/view";
import { createTRPCRouter } from "#/server/api/trpc";

export const appRouter = createTRPCRouter({
    taxonomy: taxonomyRouter,
    view: viewRouter,
    story: storyRouter,
    progress: progressRouter,
});

export type AppRouter = typeof appRouter;
