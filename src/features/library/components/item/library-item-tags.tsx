"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";

type LibraryItemTagsProps = {
    showAllFandoms?: boolean;
    showAllTags?: boolean;
};

const MAX_TERMS_TO_SHOW = 10;
const taxonomyKindLabels = {
    Fandom: "Fandom",
    Tag: "Tag",
    Genre: "Genre",
    Character: "Character",
    Relationship: "Relationship",
    Warning: "Warning",
    SourceCategory: "Source category",
    Custom: "Custom",
} as const;

function getTermVariant(kind?: string) {
    return kind === "Fandom" ? "outline" : "secondary";
}

function getTermTitle(kind?: string) {
    if (kind && kind in taxonomyKindLabels) {
        return taxonomyKindLabels[kind as keyof typeof taxonomyKindLabels];
    }
}

function LibraryItemTagsComponent({ showAllFandoms = false, showAllTags = false }: LibraryItemTagsProps) {
    const { item } = useLibraryItemContext();
    const [expandedTerms, setExpandedTerms] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) {
                        setExpandedTerms(false);
                    }
                }
            },
            { root: null, threshold: 0 }
        );

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    const taxonomyTerms = item.taxonomyTerms ?? [];

    if (taxonomyTerms.length === 0) {
        return null;
    }

    const effectiveShowAllTerms = showAllFandoms || showAllTags || expandedTerms;
    const termsToShow = effectiveShowAllTerms ? taxonomyTerms : taxonomyTerms.slice(0, MAX_TERMS_TO_SHOW);

    return (
        <div className="flex flex-wrap gap-1 lg:gap-1.5" ref={containerRef}>
            {termsToShow.map((term) => (
                <Badge
                    className="rounded-md text-xs lg:text-xs"
                    key={term.publicId}
                    title={getTermTitle(term.kind)}
                    variant={getTermVariant(term.kind)}
                >
                    {term.name || "Unknown Term"}
                </Badge>
            ))}
            {!effectiveShowAllTerms && taxonomyTerms.length > MAX_TERMS_TO_SHOW && (
                <Badge
                    aria-expanded={effectiveShowAllTerms}
                    className="cursor-pointer rounded-md text-muted-foreground text-xs lg:text-xs"
                    onClick={() => setExpandedTerms((prev) => !prev)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedTerms((prev) => !prev);
                        }
                    }}
                    tabIndex={0}
                    title={`Show ${taxonomyTerms.length - MAX_TERMS_TO_SHOW} more`}
                    variant="secondary"
                >
                    +{taxonomyTerms.length - MAX_TERMS_TO_SHOW}
                </Badge>
            )}
        </div>
    );
}

export const LibraryItemTags = memo(LibraryItemTagsComponent);
LibraryItemTags.displayName = "LibraryItemTags";

export type { LibraryItemTagsProps };
