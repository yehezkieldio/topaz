"use client";

import type { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createTRPCClient, httpBatchStreamLink, loggerLink } from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { Suspense, lazy, useState } from "react";
import SuperJSON from "superjson";
import type { AppRouter } from "#/server/api/root";
import { getPersister } from "#/trpc/persister";
import { createQueryClient } from "#/trpc/query-client";

const ReactQueryDevtools = lazy(() =>
    import("@tanstack/react-query-devtools").then((mod) => ({ default: mod.ReactQueryDevtools })),
);

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
    if (typeof window === "undefined") {
        return createQueryClient();
    }

    clientQueryClientSingleton ??= createQueryClient();
    return clientQueryClientSingleton;
};

export function TRPCReactProvider(props: { children: React.ReactNode }) {
    const queryClient = getQueryClient();
    const persister = getPersister();

    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [
                loggerLink({
                    enabled: (op) =>
                        process.env.NODE_ENV === "development" ||
                        (op.direction === "down" && op.result instanceof Error),
                }),
                httpBatchStreamLink({
                    transformer: SuperJSON,
                    url: `${getBaseUrl()}/api/trpc`,
                    headers: () => {
                        const headers = new Headers();
                        headers.set("x-trpc-source", "nextjs-react");
                        return headers;
                    },
                }),
            ],
        }),
    );

    const shouldShowDevtools = process.env.NODE_ENV === "development" || process.env.USE_REACTQUERY_DEVTOOLS;

    return (
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
            <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
                {props.children}
            </TRPCProvider>
            {shouldShowDevtools && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} />
                </Suspense>
            )}
        </PersistQueryClientProvider>
    );
}

const httpUrlRegex = /^https?:\/\//;

function getBaseUrl() {
    if (typeof window !== "undefined") {
        return window.location.origin;
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    if (process.env.AUTH_URL && httpUrlRegex.test(process.env.AUTH_URL)) {
        return process.env.AUTH_URL;
    }

    return `http://localhost:${process.env.PORT ?? 3000}`;
}
