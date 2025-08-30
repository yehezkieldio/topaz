"use client";

import * as React from "react";
import { MultiSelect } from "#/components/ui/multiselect";
import { type SelectedItem, useTagSearch } from "#/features/library/api/use-tag-search";

type LibraryTagMultiselectProps = {
    selectedTags: SelectedItem[];
    onTagsChangeAction: (tags: SelectedItem[]) => void;
    placeholder?: string;
    className?: string;
};

export function LibraryTagMultiselect({
    selectedTags,
    onTagsChangeAction,
    placeholder = "Select tags...",
    className,
}: LibraryTagMultiselectProps) {
    const { tagOptions, isLoadingTags, canCreateTag, isCreatingTag, setTagSearch, createTag } = useTagSearch();

    const handleCreateTag = React.useCallback(
        async (name: string) => {
            try {
                const newTag = await createTag(name);
                onTagsChangeAction([...selectedTags, newTag]);
            } catch (error) {
                console.error("Failed to create tag:", error);
            }
        },
        [createTag, selectedTags, onTagsChangeAction],
    );

    return (
        <MultiSelect
            canCreate={true}
            canCreateCurrent={canCreateTag}
            className={className}
            disableClientFilter={true}
            emptyMessage="Start typing to search or create a new tag."
            isLoading={isLoadingTags || isCreatingTag}
            keepOpenOnSelect={true}
            onCreateAction={handleCreateTag}
            onSearchAction={setTagSearch}
            onSelectionChangeAction={onTagsChangeAction}
            options={tagOptions}
            placeholder={placeholder}
            selectedValues={selectedTags}
        />
    );
}
