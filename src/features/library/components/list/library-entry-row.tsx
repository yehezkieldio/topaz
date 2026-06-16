"use client";

import { EditIcon, EyeIcon, FileTextIcon, LinkIcon, TrashIcon } from "lucide-react";
import { memo, type ReactNode, useMemo } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import { LibraryItemRating } from "#/features/library/components/item/library-item-rating";
import {
    getLibraryItemValues,
    type LibraryItem,
    type LibraryItemValues,
} from "#/features/library/hooks/use-library-item";
import { cn } from "#/lib/utils";
import { libraryEntryStatusLabels, sourceLabels } from "#/server/db/schema";

const MAX_VISIBLE_TERMS = 4;
const MAX_PROGRESS_PERCENTAGE = 100;

type LibraryEntryRowProps = {
    item: LibraryItem;
    isAdministratorUser: boolean;
    onView: (item: LibraryItem) => void;
    onEdit: (item: LibraryItem) => void;
    onDelete: (item: LibraryItem) => void;
};

type LibraryEntryRowViewModel = {
    author: string;
    chapterLabel: string;
    description: string | null;
    sourceLabel: string;
    statusLabel: string;
    title: string;
    visibleTerms: NonNullable<LibraryItem["taxonomyTerms"]>;
    remainingTermCount: number;
    values: LibraryItemValues;
};

function createLibraryEntryRowViewModel(item: LibraryItem): LibraryEntryRowViewModel {
    const values = getLibraryItemValues(item);
    const taxonomyTerms = item.taxonomyTerms ?? [];
    const visibleTerms = taxonomyTerms.slice(0, MAX_VISIBLE_TERMS);
    const remainingTermCount = Math.max(0, taxonomyTerms.length - visibleTerms.length);

    return {
        author: item.sourceAuthor?.trim() || "Unknown author",
        chapterLabel: createChapterLabel(values),
        description: values.hasDescription ? item.workDescription?.trim() || null : null,
        sourceLabel: sourceLabels[item.source],
        statusLabel: libraryEntryStatusLabels[item.libraryEntryStatus],
        title: item.workTitle?.trim() || "Untitled work",
        visibleTerms,
        remainingTermCount,
        values,
    };
}

function createChapterLabel(values: LibraryItemValues) {
    if (values.hasValidChapterData) {
        return `${values.currentChapter}/${values.totalChapters} chapters`;
    }

    if (values.hasCurrentChapterOnly) {
        return `Chapter ${values.currentChapter}`;
    }

    return "No progress";
}

function getTermVariant(kind?: string) {
    return kind === "Fandom" ? "outline" : "secondary";
}

export const LibraryEntryRow = memo(function LibraryEntryRow({
    item,
    isAdministratorUser,
    onView,
    onEdit,
    onDelete,
}: LibraryEntryRowProps) {
    const view = useMemo(() => createLibraryEntryRowViewModel(item), [item]);
    const rating = Number(item.rating ?? 0);

    return (
        <article className="group grid h-full min-h-0 grid-cols-1 gap-3 border-border/60 border-b bg-background px-3 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.35fr)_auto] sm:items-center sm:px-4">
            <div className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="min-w-0 truncate font-medium text-foreground text-sm leading-5">
                                {view.title}
                            </h3>
                            {view.values.isNsfw ? (
                                <Badge className="h-5 shrink-0 rounded-sm px-1.5 text-[10px]" variant="destructive">
                                    NSFW
                                </Badge>
                            ) : null}
                        </div>
                        <p className="truncate text-muted-foreground text-xs">{view.author}</p>
                    </div>

                    <Badge className="h-6 shrink-0 rounded-sm px-2 text-[11px]" variant="outline">
                        {view.statusLabel}
                    </Badge>
                </div>

                {view.description ? (
                    <p className="line-clamp-2 text-muted-foreground text-xs leading-5 sm:line-clamp-1">
                        {view.description}
                    </p>
                ) : null}

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {view.visibleTerms.map((term) => (
                        <Badge
                            className="max-w-32 truncate rounded-sm px-1.5 text-[10px]"
                            key={term.publicId}
                            title={term.name || "Unknown term"}
                            variant={getTermVariant(term.kind)}
                        >
                            {term.name || "Unknown term"}
                        </Badge>
                    ))}
                    {view.remainingTermCount > 0 ? (
                        <Badge className="rounded-sm px-1.5 text-[10px]" variant="secondary">
                            +{view.remainingTermCount}
                        </Badge>
                    ) : null}
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-1">
                <MetadataPill icon={<FileTextIcon className="size-3" />} label={view.chapterLabel} />
                <MetadataPill icon={<LinkIcon className="size-3" />} label={view.sourceLabel} />
                <div className="col-span-2 space-y-1 sm:col-span-1">
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span className="truncate">{view.values.wordCount} words</span>
                        {view.values.lastUpdated ? <span className="shrink-0">{view.values.lastUpdated}</span> : null}
                    </div>
                    <Progress
                        aria-label={`Reading progress for ${view.title}`}
                        className="h-1 bg-muted [&_[data-slot=progress-indicator]]:bg-foreground"
                        value={Math.min(view.values.progressPercentage, MAX_PROGRESS_PERCENTAGE)}
                    />
                </div>
                {rating > 0 ? (
                    <div className="col-span-2 sm:col-span-1">
                        <LibraryItemRating aria-label={`Rating ${rating.toFixed(1)}`} readOnly value={rating} />
                    </div>
                ) : null}
            </div>

            <div className="flex items-center justify-end gap-1">
                <Button
                    aria-label={`View ${view.title}`}
                    className="size-8 p-0"
                    onClick={() => onView(item)}
                    size="sm"
                    variant="ghost"
                >
                    <EyeIcon className="size-4" />
                </Button>
                {isAdministratorUser ? (
                    <>
                        <Button
                            aria-label={`Edit ${view.title}`}
                            className="size-8 p-0"
                            onClick={() => onEdit(item)}
                            size="sm"
                            variant="ghost"
                        >
                            <EditIcon className="size-4" />
                        </Button>
                        <Button
                            aria-label={`Delete ${view.title}`}
                            className={cn("size-8 p-0 text-muted-foreground hover:text-destructive")}
                            onClick={() => onDelete(item)}
                            size="sm"
                            variant="ghost"
                        >
                            <TrashIcon className="size-4" />
                        </Button>
                    </>
                ) : null}
            </div>
        </article>
    );
});

function MetadataPill({ icon, label }: { icon: ReactNode; label: string }) {
    return (
        <div className="flex min-w-0 items-center gap-1.5 rounded-sm border border-border/60 px-2 py-1 text-muted-foreground">
            {icon}
            <span className="truncate">{label}</span>
        </div>
    );
}
