/**
 * Compound form component providing shared context for library story forms.
 * Uses compound component pattern for flexible composition.
 */

import { type ReactNode, createContext, memo, useContext, useMemo } from "react";
import type { Control, FieldValues } from "react-hook-form";

type LibraryFormContextValue = {
    readonly control: Control<FieldValues>;
    readonly isLoading: boolean;
};

const LibraryFormContext = createContext<LibraryFormContextValue | null>(null);

/**
 * Hook to access form context in child components.
 */
export function useLibraryFormContext<T extends FieldValues = FieldValues>() {
    const context = useContext(LibraryFormContext);
    if (!context) {
        throw new Error("useLibraryFormContext must be used within LibraryForm");
    }
    return context as LibraryFormContextValue & { control: Control<T> };
}

type LibraryFormRootProps<T extends FieldValues = FieldValues> = {
    readonly control: Control<T>;
    readonly isLoading?: boolean;
    readonly children: ReactNode;
    readonly className?: string;
};

/**
 * Root form component providing context to all child components.
 */
function LibraryFormRoot<T extends FieldValues = FieldValues>({
    control,
    isLoading = false,
    children,
    className,
}: LibraryFormRootProps<T>) {
    const contextValue = useMemo<LibraryFormContextValue>(
        () => ({
            control: control as Control<FieldValues>,
            isLoading,
        }),
        [control, isLoading],
    );

    return (
        <LibraryFormContext.Provider value={contextValue}>
            <div className={className}>{children}</div>
        </LibraryFormContext.Provider>
    );
}

type LibraryFormSectionProps = {
    readonly title: string;
    readonly children: ReactNode;
};

/**
 * Section component for grouping form fields with a title.
 */
const LibraryFormSection = memo(function LibraryFormSection({ title, children }: LibraryFormSectionProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-medium text-lg">{title}</h3>
            {children}
        </div>
    );
});

/**
 * Info section for story basic information.
 */
const LibraryFormInfo = memo(function LibraryFormInfo({ children }: { readonly children: ReactNode }) {
    return <LibraryFormSection title="Information">{children}</LibraryFormSection>;
});

/**
 * Details section for story metadata.
 */
const LibraryFormDetails = memo(function LibraryFormDetails({ children }: { readonly children: ReactNode }) {
    return <LibraryFormSection title="Details">{children}</LibraryFormSection>;
});

/**
 * Categories section for fandoms and tags.
 */
const LibraryFormCategories = memo(function LibraryFormCategories({ children }: { readonly children: ReactNode }) {
    return <LibraryFormSection title="Categories">{children}</LibraryFormSection>;
});

/**
 * Progress section for reading status and progress.
 */
const LibraryFormProgress = memo(function LibraryFormProgress({ children }: { readonly children: ReactNode }) {
    return <LibraryFormSection title="Reading Progress">{children}</LibraryFormSection>;
});

/**
 * Compound form component with sections for organizing form fields.
 */
export const LibraryForm = Object.assign(LibraryFormRoot, {
    Info: LibraryFormInfo,
    Details: LibraryFormDetails,
    Categories: LibraryFormCategories,
    Progress: LibraryFormProgress,
});
