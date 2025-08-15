import * as React from "react";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";

type LibraryItemContextValue = {
    item: LibraryItem;
    onView?: (item: LibraryItem) => void;
    onEdit?: (item: LibraryItem) => void;
    onDelete?: (item: LibraryItem) => void;
};

const LibraryItemContext = React.createContext<LibraryItemContextValue | null>(null);

export function useLibraryItemContext() {
    const context = React.useContext(LibraryItemContext);
    if (!context) {
        throw new Error("useLibraryItemContext must be used within a LibraryItemProvider");
    }
    return context;
}

type LibraryItemProviderProps = {
    children: React.ReactNode;
    value: LibraryItemContextValue;
};

export function LibraryItemProvider({ children, value }: LibraryItemProviderProps) {
    const contextValue = React.useMemo(() => value, [value]);

    return <LibraryItemContext.Provider value={contextValue}>{children}</LibraryItemContext.Provider>;
}

export type { LibraryItemContextValue };
