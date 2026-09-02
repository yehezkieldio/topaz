"use client";

import { TagsIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "#/components/ui/button";
import { LibraryFilterSheet } from "#/features/library/components/sheets/library-filter-sheet";
import { LibrarySearchInput } from "#/features/library/components/ui/library-search-input";

const LibraryCreate = dynamic(
    () =>
        import("#/features/library/components/sheets/library-create-sheet").then((mod) => ({
            default: mod.LibraryCreateSheet,
        })),
    {
        loading: () => <></>,
        ssr: false,
    }
);

type LibraryControlsProps = {
    isAdministratorUser?: boolean;
};

export function LibraryControls({ isAdministratorUser = false }: LibraryControlsProps) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <LibrarySearchInput />
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                {isAdministratorUser ? (
                    <>
                        <Button asChild size="icon" title="Manage taxonomy" variant="outline">
                            <Link aria-label="Manage taxonomy" href="/library/taxonomy">
                                <TagsIcon className="size-4" />
                            </Link>
                        </Button>
                        <LibraryCreate />
                    </>
                ) : (
                    <div aria-hidden style={{ height: 0, width: 0 }} />
                )}
                <LibraryFilterSheet />
            </div>
        </div>
    );
}
