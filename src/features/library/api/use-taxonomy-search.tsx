"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useDebounce } from "#/hooks/use-debounce";
import { DEBOUNCE_DELAY_MS } from "#/lib/utils";
import type { TaxonomyKind } from "#/server/db/schema";
import { FIVE_MINUTES, THIRTY_MINUTES } from "#/trpc/query-client";
import { useTRPC } from "#/trpc/react";

export type SelectedTaxonomyItem = {
    kind?: string;
    value: string;
    label: string;
};

export const useTaxonomySearch = (initialSearch = "", kind?: TaxonomyKind) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [taxonomySearch, setTaxonomySearch] = React.useState<string>(initialSearch);
    const debouncedTaxonomySearch = useDebounce(taxonomySearch, DEBOUNCE_DELAY_MS);
    const normalizedDebounced = React.useMemo(() => debouncedTaxonomySearch.trim(), [debouncedTaxonomySearch]);
    const hotTaxonomyQueryOptions = React.useMemo(
        () =>
            trpc.taxonomy.forMultiselect.queryOptions({
                kind,
                search: undefined,
                limit: 25,
                includeHot: true,
                hotLimit: 20,
            }),
        [kind, trpc]
    );

    React.useEffect(() => {
        queryClient.prefetchQuery(hotTaxonomyQueryOptions);
    }, [hotTaxonomyQueryOptions, queryClient]);

    const {
        data: taxonomyResponse,
        isLoading: isLoadingTaxonomy,
        isFetching,
    } = useQuery({
        ...trpc.taxonomy.forMultiselect.queryOptions({
            kind,
            search: normalizedDebounced || undefined,
            limit: 25,
            includeHot: normalizedDebounced.length === 0,
            hotLimit: 20,
        }),
        enabled: normalizedDebounced === debouncedTaxonomySearch,
        staleTime: FIVE_MINUTES,
        gcTime: THIRTY_MINUTES,
    });

    const createTermForMultiselect = useMutation(trpc.taxonomy.createForMultiselect.mutationOptions());

    const createTermMutation = useMutation({
        mutationFn: async (name: string) => {
            const trimmed = name.trim();
            return await createTermForMultiselect.mutateAsync({ kind: kind ?? "trope", name: trimmed });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(trpc.taxonomy.forMultiselect.queryFilter());
        },
    });

    const [lastFetchedTerms, setLastFetchedTerms] = React.useState<SelectedTaxonomyItem[]>([]);

    React.useEffect(() => {
        if (taxonomyResponse?.terms) {
            setLastFetchedTerms(
                taxonomyResponse.terms.map((term) => ({
                    value: term.publicId,
                    label: term.name,
                    kind: term.kind,
                }))
            );
        }
    }, [taxonomyResponse?.terms]);

    const localFilteredOptions = React.useMemo(() => {
        if (!normalizedDebounced) return lastFetchedTerms;
        const query = normalizedDebounced.toLowerCase();
        return lastFetchedTerms.filter((term) => term.label.toLowerCase().includes(query));
    }, [lastFetchedTerms, normalizedDebounced]);

    const taxonomyOptions = React.useMemo<SelectedTaxonomyItem[]>(() => {
        if (localFilteredOptions.length > 0) {
            return localFilteredOptions;
        }

        const list = taxonomyResponse?.terms ?? [];
        return list.map((term) => ({
            value: term.publicId,
            label: term.name,
            kind: term.kind,
        }));
    }, [taxonomyResponse?.terms, localFilteredOptions]);

    const canCreateTaxonomyTerm = taxonomyResponse?.canCreate ?? false;

    const handleCreateTerm = React.useCallback(
        async (name: string): Promise<SelectedTaxonomyItem> => {
            const newTerm = await createTermMutation.mutateAsync(name);
            return {
                value: newTerm.publicId,
                label: newTerm.name,
                kind: newTerm.kind,
            };
        },
        [createTermMutation]
    );

    const setTaxonomySearchNormalized = React.useCallback((val: string) => {
        const next = val.replace(/\s+/g, " ");
        setTaxonomySearch(next);
    }, []);

    return {
        taxonomySearch,
        debouncedTaxonomySearch: normalizedDebounced,
        taxonomyOptions,
        isLoadingTaxonomy: isLoadingTaxonomy && !isFetching,
        canCreateTaxonomyTerm,
        isCreatingTaxonomyTerm: createTermMutation.isPending,
        setTaxonomySearch: setTaxonomySearchNormalized,
        createTaxonomyTerm: handleCreateTerm,
        hotTaxonomyData: taxonomyResponse?.terms,
        taxonomyData: taxonomyResponse?.terms,
    };
};
