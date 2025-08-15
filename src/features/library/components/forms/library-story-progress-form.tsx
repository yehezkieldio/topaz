import type { Control, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { useLibraryFormContext } from "#/features/library/components/forms/library-form";
import { progressStatusEnum, progressStatusLabels } from "#/server/db/schema";

interface ProgressFormFields {
    progressStatus?: string;
    current_chapter?: number;
    rating?: number | string;
    notes?: string;
}

interface LibraryStoryProgressFormProps<T extends ProgressFormFields> {
    control?: Control<T>;
    progressStatusField?: Path<T>;
    currentChapterField?: Path<T>;
    ratingField?: Path<T>;
    notesField?: Path<T>;
}

export function LibraryStoryProgressForm<T extends ProgressFormFields>({
    control: propControl,
    progressStatusField = "progressStatus" as Path<T>,
    currentChapterField = "current_chapter" as Path<T>,
    ratingField = "rating" as Path<T>,
    notesField = "notes" as Path<T>,
}: LibraryStoryProgressFormProps<T>) {
    const context = useLibraryFormContext<T>();
    const isInCompoundContext = context !== null;
    const control = context?.control ?? propControl;

    if (!control) {
        throw new Error("LibraryStoryProgressForm requires either control prop or compound component context");
    }

    const formFields = (
        <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <FormField
                    control={control}
                    name={progressStatusField}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>Status</FormLabel>
                            <Select
                                defaultValue={typeof field.value === "string" ? field.value : undefined}
                                onValueChange={field.onChange}
                            >
                                <FormControl>
                                    <SelectTrigger className="w-full truncate rounded-md">
                                        <SelectValue className="truncate" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="min-w-[12rem] max-w-[20rem] rounded-md">
                                    {progressStatusEnum.enumValues.map((status) => (
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
                    name={currentChapterField}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>Current</FormLabel>
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
                    name={ratingField}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>Rating (0-5)</FormLabel>
                            <FormControl>
                                <Input
                                    className="rounded-md"
                                    max="5"
                                    min="0"
                                    placeholder="0"
                                    step="0.1"
                                    type="number"
                                    {...field}
                                    onBlur={(e) => {
                                        // Allow empty string, otherwise keep as string
                                        if (e.target.value === "" || Number.isNaN(Number(e.target.value))) {
                                            field.onChange("");
                                        } else {
                                            field.onChange(e.target.value);
                                        }
                                    }}
                                    onChange={(e) => {
                                        // Always store as string
                                        field.onChange(e.target.value);
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
                                    value={field.value ?? ""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
                control={control}
                name={notesField}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                            <Textarea
                                className="min-h-[80px] resize-none rounded-none"
                                placeholder="Personal notes about this story..."
                                {...field}
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
            <h3 className="font-medium text-lg">Reading Progress</h3>
            {formFields}
        </div>
    );
}
