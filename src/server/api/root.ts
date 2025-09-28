import { createTRPCRouter } from "#/server/api/trpc";

export const appRouter = createTRPCRouter({
    // fandom: fandomRouter,
    // tag: tagRouter,
    // view: viewRouter,
    // story: storyRouter,
    // progress: progressRouter,
});

export type AppRouter = typeof appRouter;
