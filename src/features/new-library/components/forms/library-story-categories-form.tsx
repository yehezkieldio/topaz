/**
 * Form fields for story categories (fandoms and tags).
 * Uses multiselect components with async search and creation.
 */

import { memo, useCallback, useMemo, useState } from "react";
import type { Control, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { MultiSelect } from "#/components/ui/multiselect";
import {
    type SelectedItem,
    useFandomSearch,
    useTagSearch,
} from "#/features/new-library/data-access/use-category-search";
import { useLibraryFormContext } from "./library-form";

type CategoriesFields = {
    fandomIds?: readonly string[];
    tagIds?: readonly string[];
};

type LibraryStoryCategoriesFormProps<T extends CategoriesFields> = {
    readonly control?: Control<T>;
    readonly initialFandoms?: readonly { publicId: string; name: string }[];
    readonly initialTags?: readonly { publicId: string; name: string }[];
};

/**
 * Form fields for fandoms and tags selection.
 */
export const LibraryStoryCategoriesForm = memo(function LibraryStoryCategoriesForm<T extends CategoriesFields>({
    control: propControl,
    initialFandoms = [],
    initialTags = [],
}: LibraryStoryCategoriesFormProps<T> = {}) {
    const context = useLibraryFormContext<T>();
    const control = propControl ?? context.control;

    const {
        fandomSearch,
        fandomOptions,
        isLoadingFandoms,
        canCreateFandom,
        setFandomSearch,
        createFandom,
        fandomData,
    } = useFandomSearch();

    const { tagSearch, tagOptions, isLoadingTags, canCreateTag, setTagSearch, createTag, tagData } = useTagSearch();

    // Track created items
    const [createdFandoms, setCreatedFandoms] = useState<Map<string, string>>(new Map());
    const [createdTags, setCreatedTags] = useState<Map<string, string>>(new Map());

    // Build fandom ID to name mapping
    const fandomIdToName = useMemo(() => {
        const map = new Map<string, string>();

        for (const fandom of initialFandoms) {
            map.set(fandom.publicId, fandom.name);
        }

        if (fandomData) {
            for (const fandom of fandomData) {
                map.set(fandom.publicId, fandom.name);
            }
        }

        for (const [id, name] of createdFandoms) {
            map.set(id, name);
        }

        return map;
    }, [initialFandoms, fandomData, createdFandoms]);

    // Build tag ID to name mapping
    const tagIdToName = useMemo(() => {
        const map = new Map<string, string>();

        for (const tag of initialTags) {
            map.set(tag.publicId, tag.name);
        }

        if (tagData) {
            for (const tag of tagData) {
                map.set(tag.publicId, tag.name);
            }
        }

        for (const [id, name] of createdTags) {
            map.set(id, name);
        }

        return map;
    }, [initialTags, tagData, createdTags]);

    // Handle fandom creation
    const handleCreateFandom = useCallback(
        async (name: string) => {
            const newFandom = await createFandom(name);
            setCreatedFandoms((prev) => new Map(prev).set(newFandom.value, newFandom.label));
        },
        [createFandom],
    );

    // Handle tag creation
    const handleCreateTag = useCallback(
        async (name: string) => {
            const newTag = await createTag(name);
            setCreatedTags((prev) => new Map(prev).set(newTag.value, newTag.label));
        },
        [createTag],
    );

    // Track whether current search can create
    const canCreateCurrentFandom = useMemo(() => {
        const hasFandomSearch = fandomSearch.trim().length > 0;
        const canCreate = canCreateFandom && hasFandomSearch;
        if (!canCreate) return false;
        const query = fandomSearch.toLowerCase();
        return !fandomOptions.some((opt) => opt.label.toLowerCase() === query);
    }, [canCreateFandom, fandomSearch, fandomOptions]);

    const canCreateCurrentTag = useMemo(() => {
        const hasTagSearch = tagSearch.trim().length > 0;
        const canCreate = canCreateTag && hasTagSearch;
        if (!canCreate) return false;
        const query = tagSearch.toLowerCase();
        return !tagOptions.some((opt) => opt.label.toLowerCase() === query);
    }, [canCreateTag, tagSearch, tagOptions]);

    return (
        <>
            <FormField
                control={control}
                name={"fandomIds" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fandoms</FormLabel>
                        <FormControl>
                            <MultiSelect
                                canCreate={canCreateFandom}
                                canCreateCurrent={canCreateCurrentFandom}
                                disableClientFilter
                                emptyMessage={isLoadingFandoms ? "Loading..." : "No fandoms found"}
                                isLoading={isLoadingFandoms}
                                keepOpenOnSelect
                                onCreateAction={handleCreateFandom}
                                onSearchAction={setFandomSearch}
                                onSelectionChangeAction={(fandoms: SelectedItem[]) => {
                                    field.onChange(fandoms.map((f) => f.value));
                                }}
                                options={fandomOptions as SelectedItem[]}
                                placeholder="Select fandoms..."
                                selectedValues={
                                    Array.isArray(field.value)
                                        ? (field.value as readonly string[]).map((fandomId: string) => ({
                                              value: fandomId,
                                              label: fandomIdToName.get(fandomId) ?? fandomId,
                                          }))
                                        : []
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name={"tagIds" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                            <MultiSelect
                                canCreate={canCreateTag}
                                canCreateCurrent={canCreateCurrentTag}
                                disableClientFilter
                                emptyMessage={isLoadingTags ? "Loading..." : "No tags found"}
                                isLoading={isLoadingTags}
                                keepOpenOnSelect
                                onCreateAction={handleCreateTag}
                                onSearchAction={setTagSearch}
                                onSelectionChangeAction={(tags: SelectedItem[]) => {
                                    field.onChange(tags.map((t) => t.value));
                                }}
                                options={tagOptions as SelectedItem[]}
                                placeholder="Select tags..."
                                selectedValues={
                                    Array.isArray(field.value)
                                        ? (field.value as readonly string[]).map((tagId: string) => ({
                                              value: tagId,
                                              label: tagIdToName.get(tagId) ?? tagId,
                                          }))
                                        : []
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}) as <T extends CategoriesFields>(props: LibraryStoryCategoriesFormProps<T>) => React.ReactElement;
