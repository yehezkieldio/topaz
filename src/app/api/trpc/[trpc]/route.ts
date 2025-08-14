import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "#/env";
import { appRouter } from "#/server/api/root";
import { createTRPCContext } from "#/server/api/trpc";

const handler = (req: NextRequest) =>
    fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: createTRPCContext,
        onError:
            env.NODE_ENV === "development"
                ? ({ path, error }) => {
                      console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
                  }
                : undefined,
        responseMeta({ info, errors }) {
            const paths: string[] | undefined = info?.calls.map((call) => call.path);
            const allPublic = paths?.every((path) => path.includes("public"));
            const allOk = errors.length === 0;
            const isQuery = info?.type === "query";

            if (allPublic && allOk && isQuery) {
                // cache request for 1 day + revalidate once every second
                const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

                return {
                    headers: new Headers([
                        ["cache-control", `s-maxage=1, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`],
                    ]),
                };
            }

            return {};
        },
    });

export { handler as GET, handler as POST };
