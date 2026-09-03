"use client";

import * as React from "react";
import { toast } from "sonner";
import { MultiSelect } from "#/components/ui/multiselect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { type SelectedTaxonomyItem, useTaxonomySearch } from "#/features/library/api/use-taxonomy-search";
import { type TaxonomyKind, taxonomyKindKeys, taxonomyKindLabels } from "#/server/db/schema";

type LibraryTaxonomyMultiselectProps = {
    selectedTerms: SelectedTaxonomyItem[];
    onTermsChangeAction: (terms: SelectedTaxonomyItem[]) => void;
    onTermCreatedAction?: (term: SelectedTaxonomyItem) => void;
    kind?: TaxonomyKind;
    placeholder?: string;
    className?: string;
};

export function LibraryTaxonomyMultiselect({
    selectedTerms,
    onTermsChangeAction,
    onTermCreatedAction,
    kind,
    placeholder = "Select taxonomy terms...",
    className,
}: LibraryTaxonomyMultiselectProps) {
    const [pendingKind, setPendingKind] = React.useState<TaxonomyKind>("trope");
    const effectiveCreateKind = kind ?? pendingKind;

    const {
        taxonomyOptions,
        similarTaxonomyTerms,
        isLoadingTaxonomy,
        canCreateTaxonomyTerm,
        isCreatingTaxonomyTerm,
        setTaxonomySearch,
        createTaxonomyTerm,
    } = useTaxonomySearch("", kind);

    const handleCreateTerm = React.useCallback(
        async (name: string) => {
            try {
                const { wasCreated, ...newTerm } = await createTaxonomyTerm(name, effectiveCreateKind);
                onTermsChangeAction([...selectedTerms, newTerm]);
                if (wasCreated) {
                    onTermCreatedAction?.(newTerm);
                }
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to create taxonomy term.");
            }
        },
        [createTaxonomyTerm, effectiveCreateKind, selectedTerms, onTermsChangeAction, onTermCreatedAction]
    );

    const createSlot = kind ? null : (
        <div className="space-y-2">
            <Select onValueChange={(value) => setPendingKind(value as TaxonomyKind)} value={pendingKind}>
                <SelectTrigger className="h-8 w-full text-xs" size="sm">
                    <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                    {taxonomyKindKeys.map((kindKey) => (
                        <SelectItem key={kindKey} value={kindKey}>
                            {taxonomyKindLabels[kindKey]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {similarTaxonomyTerms.length > 0 ? (
                <p className="px-1 text-muted-foreground text-xs">
                    Similar: {similarTaxonomyTerms.map((term) => term.label).join(", ")}
                </p>
            ) : null}
        </div>
    );

    return (
        <MultiSelect
            canCreate={true}
            canCreateCurrent={canCreateTaxonomyTerm}
            className={className}
            createSlot={createSlot}
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
