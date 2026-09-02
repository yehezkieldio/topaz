"use client";

import { useMutation } from "@tanstack/react-query";
import { ClipboardIcon, LoaderCircleIcon, WandSparklesIcon } from "lucide-react";
import * as React from "react";
import type { Control, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { detectSourceFromUrl, isValidUrl } from "#/lib/utils";
import { type Source, sourceEnum, sourceLabels } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

type WorkSourceFields = {
    title: string;
    author: string;
    url: string;
    source: Source;
    description?: string;
    word_count?: number;
    chapter_count?: number;
    status?: string;
};

type LibraryWorkSourceFieldsFormProps<T extends WorkSourceFields> = {
    control?: Control<T>;
};

function insertTextAtSelection(
    field: HTMLInputElement | HTMLTextAreaElement,
    text: string,
    onChange: (value: string) => void
) {
    const { selectionStart, selectionEnd, value } = field;
    onChange(value.slice(0, selectionStart ?? 0) + text + value.slice(selectionEnd ?? value.length));
}

function cleanSingleLinePaste(text: string) {
    return text.replace(/\s+/g, " ").trim();
}

function useWorkSourceHandlers(
    sourceOnChangeRef: React.MutableRefObject<((value: Source) => void) | null>,
    onUrlProvided?: (url: string) => void
) {
    const autoDetectSource = React.useCallback(
        (url: string) => {
            if (!isValidUrl(url)) return;

            if (sourceOnChangeRef.current) {
                const detectedSource = detectSourceFromUrl(url);
                sourceOnChangeRef.current(detectedSource);

                if (detectedSource === "Other") {
                    toast.warning("Could not detect source from URL", {
                        description: "Please select the source manually.",
                    });
                } else {
                    toast.success(`Detected source: ${sourceLabels[detectedSource]}`);
                }
            }

            onUrlProvided?.(url);
        },
        [sourceOnChangeRef, onUrlProvided]
    );

    const handlePasteFromClipboard = React.useCallback(
        async (onChange: (value: string) => void) => {
            if (!navigator?.clipboard) {
                toast.error("Clipboard API not supported", {
                    description:
                        "Your browser does not support reading from the clipboard. Please paste the URL manually.",
                });
                return;
            }

            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    onChange(text);
                    autoDetectSource(text);
                    toast.success("Pasted URL from clipboard");
                } else {
                    toast.warning("Clipboard is empty");
                }
            } catch (error) {
                console.error("Failed to read clipboard:", error);
                toast.error("Failed to access clipboard", {
                    description: "Please check permissions or paste the URL manually.",
                });
            }
        },
        [autoDetectSource]
    );

    return { autoDetectSource, handlePasteFromClipboard };
}

const METADATA_PROVIDER_LABELS = {
    fichub: "FicHub",
    opengraph: "the page's metadata",
} as const;

function useWorkMetadataFetch() {
    const trpc = useTRPC();
    // This hook only ever reads/writes fields declared directly on WorkSourceFields, so it's
    // typed against that concrete shape rather than the generic `T extends WorkSourceFields`
    // the surrounding component is parameterized over — react-hook-form can correlate
    // Path/PathValue per field normally once T is concrete, avoiding the cast that a generic
    // `useFormContext<T>()` would otherwise need here.
    const { setValue, getValues } = useFormContext<WorkSourceFields>();
    const lastFetchedUrlRef = React.useRef<string | null>(null);

    const fetchMetadataMutation = useMutation(trpc.work.fetchMetadata.mutationOptions());

    const setFieldIfEmpty = React.useCallback(
        <K extends keyof WorkSourceFields>(name: K, value: WorkSourceFields[K] | undefined) => {
            if (value === undefined || value === "") {
                return;
            }
            if (getValues(name)) {
                return;
            }
            // WORKAROUND: react-hook-form can't statically prove PathValue<WorkSourceFields, K>
            // equals WorkSourceFields[K] for a generic K, even though it always does for this
            // flat, non-dotted shape. Isolated to this one call — everything else here is
            // properly typed against the concrete WorkSourceFields shape.
            setValue(name, value as never, { shouldDirty: true });
        },
        [getValues, setValue]
    );

    const applyFetchedMetadata = React.useCallback(
        (metadata: {
            title?: string;
            author?: string;
            description?: string;
            status?: string;
            wordCount?: number;
            chapterCount?: number;
            provider: "fichub" | "opengraph";
        }) => {
            setFieldIfEmpty("title", metadata.title);
            setFieldIfEmpty("author", metadata.author);
            setFieldIfEmpty("description", metadata.description);
            setFieldIfEmpty("status", metadata.status);
            setFieldIfEmpty("word_count", metadata.wordCount);
            setFieldIfEmpty("chapter_count", metadata.chapterCount);

            toast.success(`Fetched story info from ${METADATA_PROVIDER_LABELS[metadata.provider]}.`);
        },
        [setFieldIfEmpty]
    );

    const fetchMetadataForUrl = React.useCallback(
        (url: string, options: { force?: boolean } = {}) => {
            if (!isValidUrl(url) || fetchMetadataMutation.isPending) {
                return;
            }
            if (!options.force && lastFetchedUrlRef.current === url) {
                return;
            }

            lastFetchedUrlRef.current = url;
            fetchMetadataMutation.mutate(
                { url },
                {
                    onError: (error) => {
                        lastFetchedUrlRef.current = null;
                        toast.error(error instanceof Error ? error.message : "Failed to fetch story info.");
                    },
                    onSuccess: applyFetchedMetadata,
                }
            );
        },
        [fetchMetadataMutation, applyFetchedMetadata]
    );

    return { fetchMetadataForUrl, isFetchingMetadata: fetchMetadataMutation.isPending };
}

export function LibraryWorkSourceFieldsForm<T extends WorkSourceFields>({
    control: propControl,
}: LibraryWorkSourceFieldsFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;

    const control = context?.control ?? propControl;
    const sourceOnChangeRef = React.useRef<((value: Source) => void) | null>(null);

    if (!control) {
        throw new Error("LibraryWorkSourceFieldsForm requires either control prop or compound component context");
    }

    const { fetchMetadataForUrl, isFetchingMetadata } = useWorkMetadataFetch();
    const { autoDetectSource, handlePasteFromClipboard } = useWorkSourceHandlers(
        sourceOnChangeRef,
        fetchMetadataForUrl
    );

    const handleUrlBlur = React.useCallback(
        (event: React.FocusEvent<HTMLInputElement>) => {
            fetchMetadataForUrl(event.currentTarget.value);
        },
        [fetchMetadataForUrl]
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
                                    placeholder="Work title"
                                    {...field}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        insertTextAtSelection(
                                            e.currentTarget,
                                            cleanSingleLinePaste(e.clipboardData.getData("text")),
                                            field.onChange
                                        );
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
                                        insertTextAtSelection(
                                            e.currentTarget,
                                            cleanSingleLinePaste(e.clipboardData.getData("text")),
                                            field.onChange
                                        );
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
                                        className="w-full rounded-md pr-16"
                                        placeholder="https://..."
                                        {...field}
                                        onBlur={(e) => {
                                            field.onBlur();
                                            handleUrlBlur(e);
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            const pasteText = cleanSingleLinePaste(e.clipboardData.getData("text"));

                                            autoDetectSource(pasteText);

                                            insertTextAtSelection(e.currentTarget, pasteText, field.onChange);
                                        }}
                                    />
                                    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
                                        <Button
                                            className="size-7 p-0"
                                            disabled={isFetchingMetadata || !isValidUrl(String(field.value ?? ""))}
                                            onClick={() =>
                                                fetchMetadataForUrl(String(field.value ?? ""), { force: true })
                                            }
                                            size="sm"
                                            title="Fetch story info from URL"
                                            type="button"
                                            variant="ghost"
                                        >
                                            {isFetchingMetadata ? (
                                                <LoaderCircleIcon className="size-4 animate-spin" />
                                            ) : (
                                                <WandSparklesIcon className="size-4" />
                                            )}
                                            <span className="sr-only">Fetch story info</span>
                                        </Button>
                                        <Button
                                            className="size-7 p-0 sm:hidden"
                                            onClick={() => handlePasteFromClipboard(field.onChange)}
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <ClipboardIcon className="size-4" />
                                            <span className="sr-only">Paste from clipboard</span>
                                        </Button>
                                    </div>
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
                                <Select onValueChange={field.onChange} value={field.value as Source}>
                                    <FormControl>
                                        <SelectTrigger className="w-full rounded-md">
                                            <SelectValue className="truncate" placeholder="Select source" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="w-[20rem] max-w-xs rounded-md sm:w-[16rem]">
                                        {sourceEnum.options.map((source) => (
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
                                placeholder="Work description or summary..."
                                {...field}
                                onPaste={(e) => {
                                    e.preventDefault();
                                    const pasteText = e.clipboardData
                                        .getData("text")
                                        .trim()
                                        .replace(/(\r?\n){3,}/g, "\n\n");
                                    insertTextAtSelection(e.currentTarget, pasteText, field.onChange);
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
