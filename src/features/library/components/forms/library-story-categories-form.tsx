"use client";

import * as React from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { type SelectedTaxonomyItem, useTaxonomySearch } from "#/features/library/api/use-taxonomy-search";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { LibraryTaxonomyMultiselect } from "#/features/library/components/ui/library-taxonomy-multiselect";

type Categories = {
    taxonomyTermIds?: string[];
};

type InitialTaxonomyTerm = {
    kind?: string;
    publicId: string;
    name: string;
};

type LibraryStoryCategoriesFormProps<T extends Categories & FieldValues> = {
    control?: Control<T>;
    taxonomyTermsField?: Path<T>;
    initialTaxonomyTerms?: InitialTaxonomyTerm[];
};

const EMPTY_INITIAL_TAXONOMY_TERMS: InitialTaxonomyTerm[] = [];

export function LibraryStoryCategoriesForm<T extends Categories & FieldValues>({
    control: propControl,
    taxonomyTermsField = "taxonomyTermIds" as Path<T>,
    initialTaxonomyTerms = EMPTY_INITIAL_TAXONOMY_TERMS,
}: LibraryStoryCategoriesFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;
    const control = context?.control ?? propControl;

    if (!control) {
        throw new Error("LibraryStoryCategoriesForm requires either control prop or compound component context");
    }

    const { taxonomyData } = useTaxonomySearch();
    const [createdTerms, setCreatedTerms] = React.useState<Map<string, SelectedTaxonomyItem>>(new Map());

    const termIdToItem = React.useMemo(() => {
        const map = new Map<string, SelectedTaxonomyItem>();

        for (const term of initialTaxonomyTerms) {
            map.set(term.publicId, {
                value: term.publicId,
                label: term.name,
                kind: term.kind,
            });
        }

        if (taxonomyData) {
            for (const term of taxonomyData) {
                map.set(term.publicId, {
                    value: term.publicId,
                    label: term.name,
                    kind: term.kind,
                });
            }
        }

        for (const [id, term] of createdTerms) {
            map.set(id, term);
        }

        return map;
    }, [initialTaxonomyTerms, taxonomyData, createdTerms]);

    const handleTermsChange = React.useCallback(
        (terms: SelectedTaxonomyItem[]) => {
            const newCreatedTerms = new Map(createdTerms);
            for (const term of terms) {
                if (!termIdToItem.has(term.value)) {
                    newCreatedTerms.set(term.value, term);
                }
            }
            setCreatedTerms(newCreatedTerms);
        },
        [createdTerms, termIdToItem]
    );

    const formFields = (
        <FormField
            control={control}
            name={taxonomyTermsField}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Taxonomy</FormLabel>
                    <FormControl>
                        <LibraryTaxonomyMultiselect
                            onTermsChangeAction={(terms: SelectedTaxonomyItem[]) => {
                                handleTermsChange(terms);
                                field.onChange(terms.map((term) => term.value));
                            }}
                            placeholder="Select fandoms, tags, genres..."
                            selectedTerms={
                                Array.isArray(field.value)
                                    ? (field.value as string[]).map((termId: string) => {
                                          const term = termIdToItem.get(termId);
                                          return term ?? { value: termId, label: termId };
                                      })
                                    : []
                            }
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    if (isInCompoundContext) {
        return formFields;
    }

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-lg">Taxonomy</h3>
            {formFields}
        </div>
    );
}
