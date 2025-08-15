import * as React from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { useFandomSearch } from "#/features/library/api/use-fandom-search";
import { type SelectedItem, useTagSearch } from "#/features/library/api/use-tag-search";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { LibraryFandomMultiselect } from "#/features/library/components/ui/library-fandom-multiselect";
import { LibraryTagMultiselect } from "#/features/library/components/ui/library-tag-multiselect";

interface Categories {
    fandomIds?: string[];
    tagIds?: string[];
}

interface LibraryStoryCategoriesFormProps<T extends Categories & FieldValues> {
    control?: Control<T>;
    fandomsField?: Path<T>;
    tagsField?: Path<T>;
    initialFandoms?: Array<{ publicId: string; name: string }>;
    initialTags?: Array<{ publicId: string; name: string }>;
}

export function LibraryStoryCategoriesForm<T extends Categories & FieldValues>({
    control: propControl,
    fandomsField = "fandomIds" as Path<T>,
    tagsField = "tagIds" as Path<T>,
    initialFandoms = [],
    initialTags = [],
}: LibraryStoryCategoriesFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;
    const control = context?.control ?? propControl;

    if (!control) {
        throw new Error("LibraryStoryCategoriesForm requires either control prop or compound component context");
    }

    const { fandomData } = useFandomSearch();
    const { tagData } = useTagSearch();

    const [createdFandoms, setCreatedFandoms] = React.useState<Map<string, string>>(new Map());
    const [createdTags, setCreatedTags] = React.useState<Map<string, string>>(new Map());

    const fandomIdToName = React.useMemo(() => {
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

    const tagIdToName = React.useMemo(() => {
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

    const handleFandomsChange = React.useCallback(
        (fandoms: SelectedItem[]) => {
            const newCreatedFandoms = new Map(createdFandoms);
            for (const fandom of fandoms) {
                if (!fandomIdToName.has(fandom.value)) {
                    newCreatedFandoms.set(fandom.value, fandom.label);
                }
            }
            setCreatedFandoms(newCreatedFandoms);
        },
        [createdFandoms, fandomIdToName],
    );

    const handleTagsChange = React.useCallback(
        (tags: SelectedItem[]) => {
            const newCreatedTags = new Map(createdTags);
            for (const tag of tags) {
                if (!tagIdToName.has(tag.value)) {
                    newCreatedTags.set(tag.value, tag.label);
                }
            }
            setCreatedTags(newCreatedTags);
        },
        [createdTags, tagIdToName],
    );

    const formFields = (
        <>
            <FormField
                control={control}
                name={fandomsField}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fandoms</FormLabel>
                        <FormControl>
                            <LibraryFandomMultiselect
                                onFandomsChange={(fandoms: SelectedItem[]) => {
                                    handleFandomsChange(fandoms);
                                    field.onChange(fandoms.map((fandom) => fandom.value));
                                }}
                                placeholder="Select fandoms..."
                                selectedFandoms={
                                    Array.isArray(field.value)
                                        ? (field.value as string[]).map((fandomId: string) => ({
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
                name={tagsField}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                            <LibraryTagMultiselect
                                onTagsChange={(tags: SelectedItem[]) => {
                                    handleTagsChange(tags);
                                    field.onChange(tags.map((tag) => tag.value));
                                }}
                                placeholder="Select tags..."
                                selectedTags={
                                    Array.isArray(field.value)
                                        ? (field.value as string[]).map((tagId: string) => ({
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

    if (isInCompoundContext) {
        return formFields;
    }

    return (
        <div className="space-y-4">
            <h3 className="font-medium font-serif text-lg">Categories</h3>
            {formFields}
        </div>
    );
}
