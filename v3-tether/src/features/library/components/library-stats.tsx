import { getLibraryStats } from "@/features/library/server/stats-query";

const estimateWordCount = (words: number) => {
  if (words >= 1_000_000) {
    return `${(words / 1_000_000).toFixed(1)}M`;
  }
  if (words >= 1000) {
    return `${(words / 1000).toFixed(0)}K`;
  }
  return `${words}`;
};

export const LibraryStats = async () => {
  const stats = await getLibraryStats();

  return (
    <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-7 lg:text-base">
      <span className="text-foreground font-mono">{stats.workCount}</span> works
      from{" "}
      <span className="text-foreground font-mono">
        {stats.taxonomyTermCount}
      </span>{" "}
      taxonomy terms, with nearly{" "}
      <span className="text-foreground font-mono">
        ~{estimateWordCount(stats.totalWordsRead)}
      </span>{" "}
      words told across{" "}
      <span className="text-foreground font-mono">
        {stats.totalChaptersRead.toLocaleString()}
      </span>{" "}
      chapters.
    </p>
  );
};

export const LibraryStatsSkeleton = () => (
  <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-7 lg:text-base">
    <span className="bg-muted inline-block h-4 w-64 animate-pulse rounded" />
  </p>
);
