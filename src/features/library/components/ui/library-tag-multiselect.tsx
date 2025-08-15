"use client";

import * as React from "react";
import { MultiSelect } from "#/components/ui/multiselect";
import { type SelectedItem, useTagSearch } from "#/features/library/api/use-tag-search";

type LibraryTagMultiselectProps = {
    selectedTags: SelectedItem[];
    onTagsChange: (tags: SelectedItem[]) => void;
    placeholder?: string;
    className?: string;
};

export function LibraryTagMultiselect({
    selectedTags,
    onTagsChange,
    placeholder = "Select tags...",
    className,
}: LibraryTagMultiselectProps) {
    const { tagOptions, isLoadingTags, canCreateTag, isCreatingTag, setTagSearch, createTag } = useTagSearch();

    const handleCreateTag = React.useCallback(
        async (name: string) => {
            try {
                const newTag = await createTag(name);
                onTagsChange([...selectedTags, newTag]);
            } catch (error) {
                console.error("Failed to create tag:", error);
            }
        },
        [createTag, selectedTags, onTagsChange],
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
            onCreate={handleCreateTag}
            onSearch={setTagSearch}
            onSelectionChange={onTagsChange}
            options={tagOptions}
            placeholder={placeholder}
            selectedValues={selectedTags}
        />
    );
}
