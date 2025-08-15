"use client";

import * as React from "react";
import { MultiSelect } from "#/components/ui/multiselect";
import { type SelectedItem, useFandomSearch } from "#/features/library/api/use-fandom-search";

type LibraryFandomMultiselectProps = {
    selectedFandoms: SelectedItem[];
    onFandomsChange: (fandoms: SelectedItem[]) => void;
    placeholder?: string;
    className?: string;
};

export function LibraryFandomMultiselect({
    selectedFandoms,
    onFandomsChange,
    placeholder = "Select fandoms...",
    className,
}: LibraryFandomMultiselectProps) {
    const { fandomOptions, isLoadingFandoms, canCreateFandom, isCreatingFandom, setFandomSearch, createFandom } =
        useFandomSearch();

    const handleCreateFandom = React.useCallback(
        async (name: string) => {
            try {
                const newFandom = await createFandom(name);
                onFandomsChange([...selectedFandoms, newFandom]);
            } catch (error) {
                console.error("Failed to create fandom:", error);
            }
        },
        [createFandom, selectedFandoms, onFandomsChange],
    );

    return (
        <MultiSelect
            canCreate={true}
            canCreateCurrent={canCreateFandom}
            className={className}
            disableClientFilter={true}
            emptyMessage="Start typing to search or create a new fandom."
            isLoading={isLoadingFandoms || isCreatingFandom}
            keepOpenOnSelect={true}
            onCreate={handleCreateFandom}
            onSearch={setFandomSearch}
            onSelectionChange={onFandomsChange}
            options={fandomOptions}
            placeholder={placeholder}
            selectedValues={selectedFandoms}
        />
    );
}
