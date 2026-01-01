"use client";

import { ClipboardIcon } from "lucide-react";
import * as React from "react";
import type { Control, Path } from "react-hook-form";
import { Button } from "#/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { detectSourceFromUrl, isValidUrl } from "#/lib/utils";
import { sourceEnum, sourceLabels } from "#/server/db/schema";

type StoryInfo = {
    title: string;
    author: string;
    url: string;
    source: string;
    description?: string;
};

type LibraryStoryInfoFormProps<T extends StoryInfo> = {
    control?: Control<T>;
};

export function LibraryStoryInfoForm<T extends StoryInfo>({ control: propControl }: LibraryStoryInfoFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;

    const control = context?.control ?? propControl;
    const sourceOnChangeRef = React.useRef<((value: string) => void) | null>(null);

    if (!control) {
        throw new Error("LibraryStoryInfoForm requires either control prop or compound component context");
    }

    const autoDetectSource = React.useCallback((url: string) => {
        if (isValidUrl(url) && sourceOnChangeRef.current) {
            const detectedSource = detectSourceFromUrl(url);
            sourceOnChangeRef.current(detectedSource);
        }
    }, []);

    const handlePasteFromClipboard = React.useCallback(
        async (onChange: (value: string) => void) => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    onChange(text);
                    autoDetectSource(text);
                }
            } catch (error) {
                console.error("Failed to read clipboard:", error);
            }
        },
        [autoDetectSource],
    );

    const formFields = (
        <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FormField
                    control={control}
                    name={"title" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Title <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    placeholder="Story title"
                                    {...field}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pasteText = e.clipboardData.getData("text").replace(/\s+/g, " ").trim();
                                        const target = e.target as HTMLInputElement;
                                        const { selectionStart, selectionEnd, value } = target;
                                        const newValue =
                                            value.slice(0, selectionStart ?? 0) +
                                            pasteText +
                                            value.slice(selectionEnd ?? value.length);
                                        field.onChange(newValue);
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={"author" as Path<T>}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Author <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    placeholder="Author name"
                                    {...field}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pasteText = e.clipboardData.getData("text").replace(/\s+/g, " ").trim();
                                        const target = e.target as HTMLInputElement;
                                        const { selectionStart, selectionEnd, value } = target;
                                        const newValue =
                                            value.slice(0, selectionStart ?? 0) +
                                            pasteText +
                                            value.slice(selectionEnd ?? value.length);
                                        field.onChange(newValue);
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
                <FormField
                    control={control}
                    name={"url" as Path<T>}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>
                                URL <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        className="w-full rounded-md pr-9"
                                        placeholder="https://..."
                                        {...field}
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            const pasteText = e.clipboardData
                                                .getData("text")
                                                .replace(/\s+/g, " ")
                                                .trim();

                                            autoDetectSource(pasteText);

                                            const target = e.target as HTMLInputElement;
                                            const { selectionStart, selectionEnd, value } = target;
                                            const newValue =
                                                value.slice(0, selectionStart ?? 0) +
                                                pasteText +
                                                value.slice(selectionEnd ?? value.length);
                                            field.onChange(newValue);
                                        }}
                                    />
                                    <Button
                                        className="absolute top-1/2 right-1 size-7 -translate-y-1/2 p-0 sm:hidden"
                                        onClick={() => handlePasteFromClipboard(field.onChange)}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <ClipboardIcon className="size-4" />
                                        <span className="sr-only">Paste from clipboard</span>
                                    </Button>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={"source" as Path<T>}
                    render={({ field }) => {
                        sourceOnChangeRef.current = field.onChange;

                        return (
                            <FormItem className="w-full">
                                <FormLabel>Source</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="w-full rounded-md">
                                            <SelectValue className="truncate" placeholder="Select source" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="w-[20rem] max-w-xs rounded-md sm:w-[16rem]">
                                        {sourceEnum.enumValues.map((source) => (
                                            <SelectItem
                                                className="truncate"
                                                key={source}
                                                title={sourceLabels[source]}
                                                value={source}
                                            >
                                                <span className="block max-w-[18rem] truncate sm:max-w-[14rem]">
                                                    {sourceLabels[source]}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            </div>

            <FormField
                control={control}
                name={"description" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea
                                className="min-h-[80px] resize-none rounded-md"
                                placeholder="Story description or summary..."
                                {...field}
                                onPaste={(e) => {
                                    e.preventDefault();
                                    const pasteText = e.clipboardData
                                        .getData("text")
                                        .trim()
                                        .replace(/(\r?\n){3,}/g, "\n\n");
                                    const target = e.target as HTMLTextAreaElement;
                                    const { selectionStart, selectionEnd, value } = target;
                                    const newValue =
                                        value.slice(0, selectionStart ?? 0) +
                                        pasteText +
                                        value.slice(selectionEnd ?? value.length);
                                    field.onChange(newValue);
                                }}
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
            <h3 className="font-medium text-lg">Information</h3>
            {formFields}
        </div>
    );
}
