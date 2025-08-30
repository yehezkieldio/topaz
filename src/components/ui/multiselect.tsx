"use client";

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "#/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";

type MultiSelectOption = {
    value: string;
    label: string;
};

type MultiSelectProps = {
    options: MultiSelectOption[];
    selectedValues: MultiSelectOption[];
    onSelectionChangeAction: (selected: MultiSelectOption[]) => void;
    onSearchAction?: (query: string) => void;
    onCreateAction?: (value: string) => void;
    placeholder?: string;
    emptyMessage?: string;
    isLoading?: boolean;
    canCreate?: boolean;
    canCreateCurrent?: boolean;
    className?: string;
    disableClientFilter?: boolean;
    keepOpenOnSelect?: boolean;
};

export function MultiSelect({
    options,
    selectedValues,
    onSelectionChangeAction,
    onSearchAction,
    onCreateAction,
    placeholder = "Select items...",
    emptyMessage = "No items found.",
    isLoading = false,
    canCreate = false,
    canCreateCurrent = false,
    className,
    disableClientFilter = false,
    keepOpenOnSelect = false,
}: MultiSelectProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    const displayOptions = React.useMemo(() => {
        if (disableClientFilter) return options;
        if (!inputValue.trim()) return options;

        const query = inputValue.toLowerCase();
        return options.filter((option) => option.label.toLowerCase().includes(query));
    }, [options, inputValue, disableClientFilter]);

    const handleInputChange = React.useCallback(
        (value: string) => {
            setInputValue(value);
            onSearchAction?.(value);
        },
        [onSearchAction],
    );

    const selectedValueSet = React.useMemo(() => new Set(selectedValues.map((item) => item.value)), [selectedValues]);

    const toggleOption = React.useCallback(
        (option: MultiSelectOption) => {
            const isSelected = selectedValueSet.has(option.value);
            if (isSelected) {
                onSelectionChangeAction(selectedValues.filter((item) => item.value !== option.value));
            } else {
                onSelectionChangeAction([...selectedValues, option]);
            }

            if (!keepOpenOnSelect) {
                setOpen(false);
            }
        },
        [selectedValues, selectedValueSet, onSelectionChangeAction, keepOpenOnSelect],
    );

    const removeOption = React.useCallback(
        (option: MultiSelectOption) => {
            onSelectionChangeAction(selectedValues.filter((item) => item.value !== option.value));
        },
        [selectedValues, onSelectionChangeAction],
    );

    const handleCreate = React.useCallback(() => {
        if (inputValue.trim() && onCreateAction) {
            onCreateAction(inputValue.trim());
            setInputValue("");
        }
    }, [inputValue, onCreateAction]);

    const displayText = React.useMemo(() => {
        if (selectedValues.length === 0) return placeholder;
        if (selectedValues.length === 1) return selectedValues[0].label;
        if (selectedValues.length === 2) return selectedValues.map(({ label }) => label).join(", ");
        return `${selectedValues.length} items selected`;
    }, [selectedValues, placeholder]);

    const shouldShowCreateOption =
        canCreate &&
        inputValue.trim() &&
        !isLoading &&
        canCreateCurrent &&
        !displayOptions.some((opt) => opt.label.toLowerCase() === inputValue.toLowerCase()) &&
        !options.some((opt) => opt.label.toLowerCase() === inputValue.toLowerCase());

    const handleOpenChange = React.useCallback(
        (newOpen: boolean) => {
            setOpen(newOpen);
            if (newOpen) {
                if (inputValue === "") {
                    onSearchAction?.("");
                }
                setTimeout(() => inputRef.current?.focus(), 0);
            } else {
                setInputValue("");
            }
        },
        [inputValue, onSearchAction],
    );

    return (
        <div className={cn("w-full", className)}>
            <Popover modal={true} onOpenChange={handleOpenChange} open={open}>
                <PopoverTrigger asChild>
                    <Button
                        aria-expanded={open}
                        aria-haspopup="listbox"
                        className="w-full justify-between rounded-md text-left font-normal"
                        variant="outline"
                    >
                        <span className="truncate">{displayText}</span>
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="max-h-[300px] w-full overflow-hidden rounded-md p-0"
                    side="bottom"
                    style={{
                        minWidth: "var(--radix-popover-trigger-width)",
                        WebkitOverflowScrolling: "touch",
                        touchAction: "pan-y",
                        overflow: "hidden",
                    }}
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            onValueChange={handleInputChange}
                            placeholder="Search..."
                            ref={inputRef}
                            value={inputValue}
                        />
                        <CommandList
                            className="max-h-[200px] touch-pan-y overflow-y-auto overscroll-contain"
                            onWheel={(e) => e.stopPropagation()}
                            style={{
                                WebkitOverflowScrolling: "touch",
                                touchAction: "pan-y",
                            }}
                        >
                            {isLoading ? (
                                <CommandEmpty>Loading...</CommandEmpty>
                            ) : (
                                <>
                                    <CommandEmpty>
                                        {inputValue.trim() && shouldShowCreateOption
                                            ? `Create "${inputValue}"`
                                            : emptyMessage}
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {displayOptions.map((option) => {
                                            const isSelected = selectedValueSet.has(option.value);
                                            return (
                                                <CommandItem
                                                    key={option.value}
                                                    onSelect={() => toggleOption(option)}
                                                    value={option.value}
                                                >
                                                    <CheckIcon
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            isSelected ? "opacity-100" : "opacity-0",
                                                        )}
                                                    />
                                                    {option.label}
                                                </CommandItem>
                                            );
                                        })}
                                        {shouldShowCreateOption && (
                                            <CommandItem onSelect={handleCreate}>
                                                <div className="mr-2 h-4 w-4" />
                                                Create "{inputValue}"
                                            </CommandItem>
                                        )}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedValues.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {selectedValues.map((option) => (
                        <Badge className="gap-1 pr-1" key={option.value} variant="secondary">
                            {option.label}
                            <Button
                                aria-label={`Remove ${option.label}`}
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => removeOption(option)}
                                size="sm"
                                variant="ghost"
                            >
                                <XIcon className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
