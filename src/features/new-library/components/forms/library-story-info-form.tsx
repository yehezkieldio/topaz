/**
 * Form fields for basic story information (title, author, URL, source).
 */

import { ClipboardIcon } from "lucide-react";
import { memo, useCallback, useRef } from "react";
import type { Control, Path } from "react-hook-form";
import { Button } from "#/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { detectSourceFromUrl, isValidUrl } from "#/lib/utils";
import { sourceEnum, sourceLabels } from "#/server/db/schema";
import { useLibraryFormContext } from "./library-form";

type StoryInfoFields = {
    title: string;
    author: string;
    url: string;
    source: string;
    description?: string;
};

type LibraryStoryInfoFormProps<T extends StoryInfoFields> = {
    readonly control?: Control<T>;
};

/**
 * Normalizes pasted text by collapsing whitespace.
 */
function normalizePastedText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

/**
 * Form fields for story basic information.
 */
export const LibraryStoryInfoForm = memo(function LibraryStoryInfoForm<T extends StoryInfoFields>({
    control: propControl,
}: LibraryStoryInfoFormProps<T> = {}) {
    const context = useLibraryFormContext<T>();
    const control = propControl ?? context.control;
    const sourceOnChangeRef = useRef<((value: string) => void) | null>(null);

    const autoDetectSource = useCallback((url: string) => {
        if (isValidUrl(url) && sourceOnChangeRef.current) {
            const detectedSource = detectSourceFromUrl(url);
            sourceOnChangeRef.current(detectedSource);
        }
    }, []);

    const handlePasteFromClipboard = useCallback(
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

    const handleTextPaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>, onChange: (value: string) => void) => {
            e.preventDefault();
            const pasteText = normalizePastedText(e.clipboardData.getData("text"));
            const target = e.target as HTMLInputElement;
            const { selectionStart, selectionEnd, value } = target;
            const newValue =
                value.slice(0, selectionStart ?? 0) + pasteText + value.slice(selectionEnd ?? value.length);
            onChange(newValue);
        },
        [],
    );

    const handleUrlPaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>, onChange: (value: string) => void) => {
            e.preventDefault();
            const pasteText = normalizePastedText(e.clipboardData.getData("text"));
            autoDetectSource(pasteText);
            const target = e.target as HTMLInputElement;
            const { selectionStart, selectionEnd, value } = target;
            const newValue =
                value.slice(0, selectionStart ?? 0) + pasteText + value.slice(selectionEnd ?? value.length);
            onChange(newValue);
        },
        [autoDetectSource],
    );

    return (
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
                                    {...field}
                                    className="rounded-md"
                                    onPaste={(e) => handleTextPaste(e, field.onChange)}
                                    placeholder="Story title"
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
                                    {...field}
                                    className="rounded-md"
                                    onPaste={(e) => handleTextPaste(e, field.onChange)}
                                    placeholder="Author name"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name={"url" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            URL <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input
                                    {...field}
                                    className="w-full rounded-md pr-9"
                                    onPaste={(e) => handleUrlPaste(e, field.onChange)}
                                    placeholder="https://..."
                                />
                                <Button
                                    className="-translate-y-1/2 absolute top-1/2 right-1 size-7 p-0 sm:hidden"
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
                        <FormItem>
                            <FormLabel>Source</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="w-full rounded-md">
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-w-xs rounded-md">
                                    {sourceEnum.enumValues.map((source) => (
                                        <SelectItem className="truncate" key={source} value={source}>
                                            {sourceLabels[source]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />

            <FormField
                control={control}
                name={"description" as Path<T>}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                className="min-h-[100px] rounded-md"
                                placeholder="Optional story description..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}) as <T extends StoryInfoFields>(props: LibraryStoryInfoFormProps<T>) => React.ReactElement;
