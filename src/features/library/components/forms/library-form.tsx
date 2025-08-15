import * as React from "react";
import type { Control, FieldValues } from "react-hook-form";

interface LibraryFormContextValue {
    control: Control<FieldValues>;
    isLoading?: boolean;
}

const LibraryFormContext = React.createContext<LibraryFormContextValue | null>(null);

export function useLibraryFormContext<T extends FieldValues = FieldValues>() {
    const context = React.useContext(LibraryFormContext);
    return context as (LibraryFormContextValue & { control: Control<T> }) | null;
}

interface LibraryFormProps<T extends FieldValues = FieldValues> extends React.HTMLAttributes<HTMLDivElement> {
    control: Control<T>;
    isLoading?: boolean;
    children: React.ReactNode;
}

function LibraryFormRoot<T extends FieldValues = FieldValues>({
    control,
    isLoading = false,
    children,
    ...divProps
}: LibraryFormProps<T>) {
    const contextValue = React.useMemo(
        () => ({
            control: control as Control<FieldValues>,
            isLoading,
        }),
        [control, isLoading],
    );

    return (
        <LibraryFormContext.Provider value={contextValue}>
            <div {...divProps}>{children}</div>
        </LibraryFormContext.Provider>
    );
}

interface LibraryFormInfoProps {
    children?: React.ReactNode;
}

function LibraryFormInfo({ children }: LibraryFormInfoProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-medium font-serif text-lg">Information</h3>
            {children}
        </div>
    );
}

interface LibraryFormDetailsProps {
    children?: React.ReactNode;
}

function LibraryFormDetails({ children }: LibraryFormDetailsProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-medium font-serif text-lg">Details</h3>
            {children}
        </div>
    );
}

interface LibraryFormCategoriesProps {
    children?: React.ReactNode;
    initialFandoms?: Array<{ publicId: string; name: string }>;
    initialTags?: Array<{ publicId: string; name: string }>;
}

function LibraryFormCategories({
    children,
    initialFandoms: _initialFandoms,
    initialTags: _initialTags,
}: LibraryFormCategoriesProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-medium font-serif text-lg">Categories</h3>
            {children}
        </div>
    );
}

interface LibraryFormProgressProps {
    children?: React.ReactNode;
}

function LibraryFormProgress({ children }: LibraryFormProgressProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-medium font-serif text-lg">Reading Progress</h3>
            {children}
        </div>
    );
}

export const LibraryForm = Object.assign(LibraryFormRoot, {
    Info: LibraryFormInfo,
    Details: LibraryFormDetails,
    Categories: LibraryFormCategories,
    Progress: LibraryFormProgress,
});

export type {
    LibraryFormProps,
    LibraryFormInfoProps,
    LibraryFormDetailsProps,
    LibraryFormCategoriesProps,
    LibraryFormProgressProps,
};
