import Link from "next/link";

import { getFeaturedWorks } from "@/features/library/server/stats-query";

export const FeaturedWorks = async () => {
  const works = await getFeaturedWorks();

  if (works.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex max-w-3xl flex-col gap-1.5">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        Featured
      </p>
      <ul className="flex flex-col gap-1">
        {works.map((featuredWork) => (
          <li key={featuredWork.libraryEntryPublicId}>
            <Link
              className="motion-link text-sm"
              href={`/library?q=${encodeURIComponent(featuredWork.title)}`}
            >
              {featuredWork.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const FeaturedWorksSkeleton = () => (
  <div className="mt-4 flex max-w-3xl flex-col gap-2">
    <span className="bg-muted inline-block h-3 w-16 animate-pulse rounded" />
    <span className="bg-muted inline-block h-4 w-48 animate-pulse rounded" />
  </div>
);
