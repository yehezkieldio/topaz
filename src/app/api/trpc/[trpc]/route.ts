import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "#/env";
import { appRouter } from "#/server/api/root";
import { createTRPCContext } from "#/server/api/trpc";

const CACHEABLE_QUERY_PATHS = new Set(["library.all", "library.getStats"]);
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

const handler = (req: NextRequest) =>
    fetchRequestHandler({
        createContext: createTRPCContext,
        endpoint: "/api/trpc",
        onError:
            env.NODE_ENV === "development"
                ? ({ path, error }) => {
                      console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
                  }
                : undefined,
        req,
        responseMeta({ info, errors }) {
            const paths: string[] | undefined = info?.calls.map((call) => call.path);
            const allCacheable = paths?.every((path) => CACHEABLE_QUERY_PATHS.has(path));
            const allOk = errors.length === 0;
            const isQuery = info?.type === "query";

            if (allCacheable && allOk && isQuery) {
                return {
                    headers: new Headers([
                        ["cache-control", `s-maxage=1, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`],
                    ]),
                };
            }

            return {};
        },
        router: appRouter,
    });

export { handler as GET, handler as POST };
