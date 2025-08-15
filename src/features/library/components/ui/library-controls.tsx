"use client";

import dynamic from "next/dynamic";
import { LibraryFilterSheet } from "#/features/library/components/sheets/library-filter-sheet";
import { LibrarySearchInput } from "#/features/library/components/ui/library-search-input";

const LibraryCreate = dynamic(
    () =>
        import("#/features/library/components/sheets/library-create-sheet").then((mod) => ({
            default: mod.LibraryCreateSheet,
        })),
    {
        ssr: false,
        loading: () => <></>,
    },
);

interface LibraryControlsProps {
    isAdministratorUser?: boolean;
}

export function LibraryControls({ isAdministratorUser = false }: LibraryControlsProps) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <LibrarySearchInput />
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                {isAdministratorUser ? <LibraryCreate /> : <div aria-hidden style={{ width: 0, height: 0 }} />}
                <LibraryFilterSheet />
            </div>
        </div>
    );
}
