"use client";

import type { Control, Path } from "react-hook-form";
import { Checkbox } from "#/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { storyStatusEnum, storyStatusLabels } from "#/server/db/schema";

type StoryDetails = {
    word_count?: number;
    chapter_count?: number;
    status?: string;
    is_nsfw?: boolean;
};

type LibraryStoryDetailsFormProps<T extends StoryDetails> = {
    control?: Control<T>;
};

export function LibraryStoryDetailsForm<T extends StoryDetails>({
    control: propControl,
}: LibraryStoryDetailsFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;
    const control = context?.control ?? propControl;

    if (!control) {
        throw new Error("LibraryStoryDetailsForm requires either control prop or compound component context");
    }

    const formFields = (
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
                                    placeholder="0"
                                    type="number"
                                    {...field}
                                    onBlur={(e) => {
                                        if (e.target.value === "") {
                                            e.target.value = "0";
                                            field.onChange(0);
                                        }
                                    }}
                                    onChange={(e) => {
                                        const value = e.target.value === "" ? "" : Number(e.target.value);
                                        field.onChange(value);
                                    }}
                                    onClick={(e) => {
                                        if (e.currentTarget.value === "0") {
                                            e.currentTarget.value = "";
                                            field.onChange("");
                                        }
                                    }}
                                    onFocus={(e) => {
                                        if (e.target.value === "0") {
                                            e.target.value = "";
                                            field.onChange("");
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        let pasted = e.clipboardData.getData("text");
                                        pasted = pasted.replace(/[\s,.]/g, "");
                                        const num = Number(pasted);
                                        if (!Number.isNaN(num)) {
                                            field.onChange(num);
                                        }
                                    }}
                                    value={
                                        typeof field.value === "number"
                                            ? field.value
                                            : field.value === "" || field.value === undefined
                                              ? ""
                                              : Number(field.value) || ""
                                    }
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
                                    placeholder="0"
                                    type="number"
                                    {...field}
                                    onBlur={(e) => {
                                        if (e.target.value === "") {
                                            e.target.value = "0";
                                            field.onChange(0);
                                        }
                                    }}
                                    onChange={(e) => {
                                        const value = e.target.value === "" ? "" : Number(e.target.value);
                                        field.onChange(value);
                                    }}
                                    onClick={(e) => {
                                        if (e.currentTarget.value === "0") {
                                            e.currentTarget.value = "";
                                            field.onChange("");
                                        }
                                    }}
                                    onFocus={(e) => {
                                        if (e.target.value === "0") {
                                            e.target.value = "";
                                            field.onChange("");
                                        }
                                    }}
                                    value={
                                        typeof field.value === "number"
                                            ? field.value
                                            : field.value === "" || field.value === undefined
                                              ? ""
                                              : Number(field.value) || ""
                                    }
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
                        <FormItem className="w-full">
                            <FormLabel>Story Status</FormLabel>
                            <Select
                                defaultValue={typeof field.value === "string" ? field.value : undefined}
                                onValueChange={field.onChange}
                            >
                                <FormControl className="w-full">
                                    <SelectTrigger className="rounded-md">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="w-full rounded-md">
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
                            <Checkbox
                                checked={typeof field.value === "boolean" ? field.value : false}
                                className="rounded-md"
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>NSFW Content</FormLabel>
                            <FormDescription>Mark this story as containing adult or explicit content.</FormDescription>
                        </div>
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
            <h3 className="font-medium text-lg">Details</h3>
            {formFields}
        </div>
    );
}
