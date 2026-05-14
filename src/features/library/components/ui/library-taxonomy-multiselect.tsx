"use client";

import * as React from "react";
import { MultiSelect } from "#/components/ui/multiselect";
import { type SelectedTaxonomyItem, useTaxonomySearch } from "#/features/library/api/use-taxonomy-search";
import type { TaxonomyKind } from "#/server/db/schema";

type LibraryTaxonomyMultiselectProps = {
    selectedTerms: SelectedTaxonomyItem[];
    onTermsChangeAction: (terms: SelectedTaxonomyItem[]) => void;
    kind?: TaxonomyKind;
    placeholder?: string;
    className?: string;
};

export function LibraryTaxonomyMultiselect({
    selectedTerms,
    onTermsChangeAction,
    kind,
    placeholder = "Select taxonomy terms...",
    className,
}: LibraryTaxonomyMultiselectProps) {
    const {
        taxonomyOptions,
        isLoadingTaxonomy,
        canCreateTaxonomyTerm,
        isCreatingTaxonomyTerm,
        setTaxonomySearch,
        createTaxonomyTerm,
    } = useTaxonomySearch("", kind);

    const handleCreateTerm = React.useCallback(
        async (name: string) => {
            try {
                const newTerm = await createTaxonomyTerm(name);
                onTermsChangeAction([...selectedTerms, newTerm]);
            } catch (error) {
                console.error("Failed to create taxonomy term:", error);
            }
        },
        [createTaxonomyTerm, selectedTerms, onTermsChangeAction]
    );

    return (
        <MultiSelect
            canCreate={true}
            canCreateCurrent={canCreateTaxonomyTerm}
            className={className}
            disableClientFilter={true}
            emptyMessage="Start typing to search or create a new taxonomy term."
            isLoading={isLoadingTaxonomy || isCreatingTaxonomyTerm}
            keepOpenOnSelect={true}
            onCreateAction={handleCreateTerm}
            onSearchAction={setTaxonomySearch}
            onSelectionChangeAction={onTermsChangeAction}
            options={taxonomyOptions}
            placeholder={placeholder}
            selectedValues={selectedTerms}
        />
    );
}
