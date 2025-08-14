"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useDebounce } from "#/hooks/use-debounce";
import { useTRPC } from "#/trpc/react";

export type SelectedItem = {
    value: string;
    label: string;
};

export const useTagSearch = (initialSearch = "") => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [tagSearch, setTagSearch] = React.useState<string>(initialSearch);
    const debouncedTagSearch = useDebounce(tagSearch, 300);
    const normalizedDebounced = React.useMemo(() => debouncedTagSearch.trim(), [debouncedTagSearch]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: This is a dependency for the query.
    React.useEffect(() => {
        queryClient.prefetchQuery(
            trpc.tag.forMultiselect.queryOptions({
                search: undefined,
                limit: 25,
                includeHot: true,
                hotLimit: 20,
            }),
        );
    }, []);

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
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
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

    const [lastFetchedTags, setLastFetchedTags] = React.useState<SelectedItem[]>([]);

    React.useEffect(() => {
        if (tagResponse?.tags) {
            setLastFetchedTags(
                tagResponse.tags.map((tag) => ({
                    value: tag.publicId,
                    label: tag.name,
                })),
            );
        }
    }, [tagResponse?.tags]);

    const localFilteredOptions = React.useMemo(() => {
        if (!normalizedDebounced) return lastFetchedTags;
        const query = normalizedDebounced.toLowerCase();
        return lastFetchedTags.filter((f) => f.label.toLowerCase().includes(query));
    }, [lastFetchedTags, normalizedDebounced]);

    const tagOptions = React.useMemo<SelectedItem[]>(() => {
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

    const handleCreateTag = React.useCallback(
        async (name: string): Promise<SelectedItem> => {
            const newTag = await createTagMutation.mutateAsync(name);
            return {
                value: newTag.publicId,
                label: newTag.name,
            };
        },
        [createTagMutation],
    );

    const setTagSearchNormalized = React.useCallback((val: string) => {
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
        hotTagData: tagResponse?.tags,
        tagData: tagResponse?.tags,
    };
};
