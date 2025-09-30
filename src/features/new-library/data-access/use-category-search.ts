/**
 * Data access hooks for fandom and tag search with creation support.
 * Used in multiselect components for category selection.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "#/features/new-library/hooks/use-debounce";
import { useTRPC } from "#/trpc/react";

const DEBOUNCE_DELAY_MS = 300;
const FIVE_MINUTES = 1000 * 60 * 5;
const THIRTY_MINUTES = 1000 * 60 * 30;

export type SelectedItem = {
    readonly value: string;
    readonly label: string;
};

/**
 * Hook for searching and creating fandoms in multiselect.
 */
export function useFandomSearch(initialSearch = "") {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [fandomSearch, setFandomSearch] = useState<string>(initialSearch);
    const debouncedFandomSearch = useDebounce(fandomSearch, DEBOUNCE_DELAY_MS);
    const normalizedDebounced = useMemo(() => debouncedFandomSearch.trim(), [debouncedFandomSearch]);

    // Prefetch hot fandoms on mount
    useEffect(() => {
        queryClient.prefetchQuery(
            trpc.fandom.forMultiselect.queryOptions({
                search: undefined,
                limit: 25,
                includeHot: true,
                hotLimit: 20,
            }),
        );
    }, [queryClient, trpc.fandom.forMultiselect]);

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

    const [lastFetchedFandoms, setLastFetchedFandoms] = useState<readonly SelectedItem[]>([]);

    useEffect(() => {
        if (fandomResponse?.fandoms) {
            setLastFetchedFandoms(
                fandomResponse.fandoms.map((fandom) => ({
                    value: fandom.publicId,
                    label: fandom.name,
                })),
            );
        }
    }, [fandomResponse?.fandoms]);

    const localFilteredOptions = useMemo(() => {
        if (!normalizedDebounced) return lastFetchedFandoms;
        const query = normalizedDebounced.toLowerCase();
        return lastFetchedFandoms.filter((f) => f.label.toLowerCase().includes(query));
    }, [lastFetchedFandoms, normalizedDebounced]);

    const fandomOptions = useMemo<readonly SelectedItem[]>(() => {
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

    const handleCreateFandom = useCallback(
        async (name: string): Promise<SelectedItem> => {
            const newFandom = await createFandomMutation.mutateAsync(name);
            return {
                value: newFandom.publicId,
                label: newFandom.name,
            };
        },
        [createFandomMutation],
    );

    const setFandomSearchNormalized = useCallback((val: string) => {
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
        fandomData: fandomResponse?.fandoms,
    };
}

/**
 * Hook for searching and creating tags in multiselect.
 */
export function useTagSearch(initialSearch = "") {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [tagSearch, setTagSearch] = useState<string>(initialSearch);
    const debouncedTagSearch = useDebounce(tagSearch, DEBOUNCE_DELAY_MS);
    const normalizedDebounced = useMemo(() => debouncedTagSearch.trim(), [debouncedTagSearch]);

    // Prefetch hot tags on mount
    useEffect(() => {
        queryClient.prefetchQuery(
            trpc.tag.forMultiselect.queryOptions({
                search: undefined,
                limit: 25,
                includeHot: true,
                hotLimit: 20,
            }),
        );
    }, [queryClient, trpc.tag.forMultiselect]);

    const {
        data: tagResponse,
        isLoading: isLoadingTags,
        isFetching,
    } = useQuery({
        ...trpc.tag.forMultiselect.queryOptions({
            search: normalizedDebounced || undefined,
            limit: 25,
            includeHot: normalizedDebounced.length === 0,
            hotLimit: 20,
        }),
        enabled: normalizedDebounced === debouncedTagSearch,
        staleTime: FIVE_MINUTES,
        gcTime: THIRTY_MINUTES,
    });

    const createTagForMultiselect = useMutation(trpc.tag.createForMultiselect.mutationOptions());

    const createTagMutation = useMutation({
        mutationFn: async (name: string) => {
            const trimmed = name.trim();
            return await createTagForMultiselect.mutateAsync({ name: trimmed });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [["tag", "forMultiselect"]],
            });
        },
    });

    const [lastFetchedTags, setLastFetchedTags] = useState<readonly SelectedItem[]>([]);

    useEffect(() => {
        if (tagResponse?.tags) {
            setLastFetchedTags(
                tagResponse.tags.map((tag) => ({
                    value: tag.publicId,
                    label: tag.name,
                })),
            );
        }
    }, [tagResponse?.tags]);

    const localFilteredOptions = useMemo(() => {
        if (!normalizedDebounced) return lastFetchedTags;
        const query = normalizedDebounced.toLowerCase();
        return lastFetchedTags.filter((t) => t.label.toLowerCase().includes(query));
    }, [lastFetchedTags, normalizedDebounced]);

    const tagOptions = useMemo<readonly SelectedItem[]>(() => {
        if (localFilteredOptions.length > 0) {
            return localFilteredOptions;
        }

        const list = tagResponse?.tags ?? [];
        return list.map((tag) => ({
            value: tag.publicId,
            label: tag.name,
        }));
    }, [tagResponse?.tags, localFilteredOptions]);

    const canCreateTag = tagResponse?.canCreate ?? false;

    const handleCreateTag = useCallback(
        async (name: string): Promise<SelectedItem> => {
            const newTag = await createTagMutation.mutateAsync(name);
            return {
                value: newTag.publicId,
                label: newTag.name,
            };
        },
        [createTagMutation],
    );

    const setTagSearchNormalized = useCallback((val: string) => {
        const next = val.replace(/\s+/g, " ");
        setTagSearch(next);
    }, []);

    return {
        tagSearch,
        debouncedTagSearch: normalizedDebounced,
        tagOptions,
        isLoadingTags: isLoadingTags && !isFetching,
        canCreateTag,
        isCreatingTag: createTagMutation.isPending,
        setTagSearch: setTagSearchNormalized,
        createTag: handleCreateTag,
        tagData: tagResponse?.tags,
    };
}
