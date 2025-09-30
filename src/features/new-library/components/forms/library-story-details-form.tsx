/**
 * Form fields for story details (word count, chapter count, status, NSFW flag).
 */

import { memo, useCallback } from "react";
import type { Control, Path } from "react-hook-form";
import { Checkbox } from "#/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { storyStatusEnum, storyStatusLabels } from "#/server/db/schema";
import { useLibraryFormContext } from "./library-form";

type StoryDetailsFields = {
    word_count?: number;
    chapter_count?: number;
    status?: string;
    is_nsfw?: boolean;
};

type LibraryStoryDetailsFormProps<T extends StoryDetailsFields> = {
    readonly control?: Control<T>;
};

/**
 * Form fields for story metadata and details.
 */
export const LibraryStoryDetailsForm = memo(function LibraryStoryDetailsForm<T extends StoryDetailsFields>({
    control: propControl,
}: LibraryStoryDetailsFormProps<T> = {}) {
    const context = useLibraryFormContext<T>();
    const control = propControl ?? context.control;

    const handleNumberInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: number | "") => void) => {
            const value = e.target.value === "" ? "" : Number(e.target.value);
            onChange(value);
        },
        [],
    );

    const handleNumberBlur = useCallback((e: React.FocusEvent<HTMLInputElement>, onChange: (value: number) => void) => {
        if (e.target.value === "") {
            e.target.value = "0";
            onChange(0);
        }
    }, []);

    const handleNumberFocus = useCallback((e: React.FocusEvent<HTMLInputElement>, onChange: (value: "") => void) => {
        if (e.target.value === "0") {
            e.target.value = "";
            onChange("");
        }
    }, []);

    const handleNumberClick = useCallback((e: React.MouseEvent<HTMLInputElement>, onChange: (value: "") => void) => {
        if (e.currentTarget.value === "0") {
            e.currentTarget.value = "";
            onChange("");
        }
    }, []);

    const handleWordCountPaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>, onChange: (value: number) => void) => {
            e.preventDefault();
            let pasted = e.clipboardData.getData("text");
            pasted = pasted.replace(/[\s,.]/g, "");
            const num = Number(pasted);
            if (!Number.isNaN(num)) {
                onChange(num);
            }
        },
        [],
    );

    const getNumberValue = useCallback((value: unknown): string | number => {
        if (typeof value === "number") return value;
        if (value === "" || value === undefined) return "";
        return Number(value) || "";
    }, []);

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                    control={control}
                    name={"word_count" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Word Count</FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    onBlur={(e) => handleNumberBlur(e, field.onChange)}
                                    onChange={(e) => handleNumberInput(e, field.onChange)}
                                    onClick={(e) => handleNumberClick(e, field.onChange)}
                                    onFocus={(e) => handleNumberFocus(e, field.onChange)}
                                    onPaste={(e) => handleWordCountPaste(e, field.onChange)}
                                    placeholder="0"
                                    type="number"
                                    value={getNumberValue(field.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={"chapter_count" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Chapters</FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    onBlur={(e) => handleNumberBlur(e, field.onChange)}
                                    onChange={(e) => handleNumberInput(e, field.onChange)}
                                    onClick={(e) => handleNumberClick(e, field.onChange)}
                                    onFocus={(e) => handleNumberFocus(e, field.onChange)}
                                    placeholder="0"
                                    type="number"
                                    value={getNumberValue(field.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={"status" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Story Status</FormLabel>
                            <Select
                                defaultValue={typeof field.value === "string" ? field.value : undefined}
                                onValueChange={field.onChange}
                            >
                                <FormControl>
                                    <SelectTrigger className="rounded-md">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-md">
                                    {storyStatusEnum.enumValues.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {storyStatusLabels[status]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name={"is_nsfw" as Path<T>}
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                            <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>NSFW Content</FormLabel>
                            <FormDescription>Mark this story as containing adult or explicit content</FormDescription>
                        </div>
                    </FormItem>
                )}
            />
        </>
    );
}) as <T extends StoryDetailsFields>(props: LibraryStoryDetailsFormProps<T>) => React.ReactElement;
