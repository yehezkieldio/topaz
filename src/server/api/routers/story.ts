import { storyProcedures } from "#/server/api/procedures/story";
import { createTRPCRouter } from "#/server/api/trpc";

export const storyRouter = createTRPCRouter(storyProcedures);
