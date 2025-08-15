"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useDebounce } from "#/hooks/use-debounce";
import { DEBOUNCE_DELAY_MS } from "#/lib/utils";
import { FIVE_MINUTES, THIRTY_MINUTES } from "#/trpc/query-client";
import { useTRPC } from "#/trpc/react";

export type SelectedItem = {
    value: string;
    label: string;
};

export const useFandomSearch = (initialSearch = "") => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [fandomSearch, setFandomSearch] = React.useState<string>(initialSearch);
    const debouncedFandomSearch = useDebounce(fandomSearch, DEBOUNCE_DELAY_MS);
    const normalizedDebounced = React.useMemo(() => debouncedFandomSearch.trim(), [debouncedFandomSearch]);

    // Prefetch hot fandoms on mount for snappy UX
    // biome-ignore lint/correctness/useExhaustiveDependencies: This is a dependency for the query.
    React.useEffect(() => {
        queryClient.prefetchQuery(
            trpc.fandom.forMultiselect.queryOptions({
                search: undefined,
                limit: 25,
                includeHot: true,
                hotLimit: 20,
            }),
        );
    }, []);

    const {
        data: fandomResponse,
        isLoading: isLoadingFandoms,
        isFetching,
    } = useQuery({
        ...trpc.fandom.forMultiselect.queryOptions({
            search: normalizedDebounced || undefined,
            limit: 25,
            includeHot: normalizedDebounced.length === 0,
            hotLimit: 20,
        }),
        enabled: normalizedDebounced === debouncedFandomSearch,
        staleTime: FIVE_MINUTES,
        gcTime: THIRTY_MINUTES,
    });

    const createFandomForMultiselect = useMutation(trpc.fandom.createForMultiselect.mutationOptions());

    const createFandomMutation = useMutation({
        mutationFn: async (name: string) => {
            const trimmed = name.trim();
            return await createFandomForMultiselect.mutateAsync({ name: trimmed });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [["fandom", "forMultiselect"]],
            });
        },
    });

    const [lastFetchedFandoms, setLastFetchedFandoms] = React.useState<SelectedItem[]>([]);

    React.useEffect(() => {
        if (fandomResponse?.fandoms) {
            setLastFetchedFandoms(
                fandomResponse.fandoms.map((fandom) => ({
                    value: fandom.publicId,
                    label: fandom.name,
                })),
            );
        }
    }, [fandomResponse?.fandoms]);

    const localFilteredOptions = React.useMemo(() => {
        if (!normalizedDebounced) return lastFetchedFandoms;
        const query = normalizedDebounced.toLowerCase();
        return lastFetchedFandoms.filter((f) => f.label.toLowerCase().includes(query));
    }, [lastFetchedFandoms, normalizedDebounced]);

    const fandomOptions = React.useMemo<SelectedItem[]>(() => {
        if (localFilteredOptions.length > 0) {
            return localFilteredOptions;
        }

        const list = fandomResponse?.fandoms ?? [];
        return list.map((fandom) => ({
            value: fandom.publicId,
            label: fandom.name,
        }));
    }, [fandomResponse?.fandoms, localFilteredOptions]);

    const canCreateFandom = fandomResponse?.canCreate ?? false;

    const handleCreateFandom = React.useCallback(
        async (name: string): Promise<SelectedItem> => {
            const newFandom = await createFandomMutation.mutateAsync(name);
            return {
                value: newFandom.publicId,
                label: newFandom.name,
            };
        },
        [createFandomMutation],
    );

    const setFandomSearchNormalized = React.useCallback((val: string) => {
        const next = val.replace(/\s+/g, " ");
        setFandomSearch(next);
    }, []);

    return {
        fandomSearch,
        debouncedFandomSearch: normalizedDebounced,
        fandomOptions,
        isLoadingFandoms: isLoadingFandoms && !isFetching,
        canCreateFandom,
        isCreatingFandom: createFandomMutation.isPending,
        setFandomSearch: setFandomSearchNormalized,
        createFandom: handleCreateFandom,
        hotFandomData: fandomResponse?.fandoms,
        fandomData: fandomResponse?.fandoms,
    };
};
