import { fandomRouter } from "#/server/api/routers/fandom";
import { progressRouter } from "#/server/api/routers/progress";
import { storyRouter } from "#/server/api/routers/story";
import { tagRouter } from "#/server/api/routers/tag";
import { viewRouter } from "#/server/api/routers/view";
import { createTRPCRouter } from "#/server/api/trpc";

export const appRouter = createTRPCRouter({
    fandom: fandomRouter,
    tag: tagRouter,
    view: viewRouter,
    story: storyRouter,
    progress: progressRouter,
});

export type AppRouter = typeof appRouter;
