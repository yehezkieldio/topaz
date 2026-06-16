import { estimateWordCount } from "#/lib/utils";

export interface LibraryStats {
    averageRating?: number;
    completedCount?: number;
    droppedCount?: number;
    pausedCount?: number;
    readingCount?: number;
    taxonomyTermCount?: number;
    totalChaptersRead?: number;
    totalWordsRead?: number;
    workCount?: number;
}

interface LibraryStatsProps {
    stats: LibraryStats;
}

export function LibraryStats({ stats }: LibraryStatsProps) {
    const { totalChaptersRead = 0, taxonomyTermCount = 0, workCount = 0 } = stats;

    const wordCount = estimateWordCount(Number(stats.totalWordsRead ?? 0));
    const totalChapters = totalChaptersRead.toLocaleString();

    return (
        <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7 lg:text-base">
            <span className="font-mono text-foreground">{workCount}</span> works from{" "}
            <span className="font-mono text-foreground">{taxonomyTermCount}</span> taxonomy terms, with nearly{" "}
            <span className="font-mono text-foreground">~{wordCount}</span> words told across{" "}
            <span className="font-mono text-foreground">{totalChapters}</span> chapters.
        </p>
    );
}
