/**
 * Form fields for reading progress (status, current chapter, rating, notes).
 */

import { memo, useCallback } from "react";
import type { Control, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";

import { progressStatusEnum, progressStatusLabels } from "#/server/db/schema/progress";
import { useLibraryFormContext } from "./library-form";

type ProgressFields = {
    progressStatus?: string;
    current_chapter?: number;
    rating?: number | string;
    notes?: string;
};

type LibraryStoryProgressFormProps<T extends ProgressFields> = {
    readonly control?: Control<T>;
};

/**
 * Form fields for reading progress and status.
 */
export const LibraryStoryProgressForm = memo(function LibraryStoryProgressForm<T extends ProgressFields>({
    control: propControl,
}: LibraryStoryProgressFormProps<T> = {}) {
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

    const handleRatingChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
            onChange(e.target.value);
        },
        [],
    );

    const handleRatingBlur = useCallback((e: React.FocusEvent<HTMLInputElement>, onChange: (value: string) => void) => {
        if (e.target.value === "" || Number.isNaN(Number(e.target.value))) {
            onChange("");
        } else {
            onChange(e.target.value);
        }
    }, []);

    const handleRatingFocus = useCallback((e: React.FocusEvent<HTMLInputElement>, onChange: (value: "") => void) => {
        if (e.target.value === "0") {
            e.target.value = "";
            onChange("");
        }
    }, []);

    const handleRatingClick = useCallback((e: React.MouseEvent<HTMLInputElement>, onChange: (value: "") => void) => {
        if (e.currentTarget.value === "0") {
            e.currentTarget.value = "";
            onChange("");
        }
    }, []);

    const getNumberValue = useCallback((value: unknown): string | number => {
        if (typeof value === "number") return value;
        if (value === "" || value === undefined) return "";
        return Number(value) || "";
    }, []);

    const getRatingValue = useCallback((value: unknown): string => {
        if (typeof value === "string") return value;
        if (typeof value === "number") return value.toString();
        return "";
    }, []);

    const statusOptions = progressStatusEnum.enumValues;

    return (
        <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <FormField
                    control={control}
                    name={"progressStatus" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                                defaultValue={typeof field.value === "string" ? field.value : undefined}
                                onValueChange={field.onChange}
                            >
                                <FormControl>
                                    <SelectTrigger className="truncate rounded-md">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-md">
                                    {statusOptions.map((status) => (
                                        <SelectItem className="truncate" key={status} value={status}>
                                            {progressStatusLabels[status]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={"current_chapter" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Current Chapter</FormLabel>
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
                    name={"rating" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rating (0-5)</FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    max="5"
                                    min="0"
                                    onBlur={(e) => handleRatingBlur(e, field.onChange)}
                                    onChange={(e) => handleRatingChange(e, field.onChange)}
                                    onClick={(e) => handleRatingClick(e, field.onChange)}
                                    onFocus={(e) => handleRatingFocus(e, field.onChange)}
                                    placeholder="0"
                                    step="0.1"
                                    type="number"
                                    value={getRatingValue(field.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name={"notes" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                className="min-h-[100px] rounded-md"
                                placeholder="Optional notes about your reading experience..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}) as <T extends ProgressFields>(props: LibraryStoryProgressFormProps<T>) => React.ReactElement;
