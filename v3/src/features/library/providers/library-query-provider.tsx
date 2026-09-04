"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/query-client";

/**
 * No useState wrapper: getQueryClient() already returns a module-cached
 * singleton in the browser, and TanStack's own guidance is to avoid useState
 * here specifically -- if this component suspends before a Suspense boundary
 * exists beneath it, React would discard a useState-held client and create a
 * new one, losing the point of memoizing it in the first place.
 */
export const LibraryQueryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <QueryClientProvider client={getQueryClient()}>
    {children}
  </QueryClientProvider>
);
