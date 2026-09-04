import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { CreateWorkTrigger } from "@/features/library/components/create-work-trigger";
import { LibraryControlsSkeleton } from "@/features/library/components/library-controls-skeleton";
import { LibraryFilters } from "@/features/library/components/library-filters";
import {
  LibraryResults,
  LibraryResultsSkeleton,
} from "@/features/library/components/library-results";
import { LibrarySearch } from "@/features/library/components/library-search";
import { LibraryShell } from "@/features/library/components/library-shell";
import { LibraryQueryProvider } from "@/features/library/providers/library-query-provider";

const LibraryPage = ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => (
  <LibraryQueryProvider>
    <LibraryShell>
      <div className="border-border/50 bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 shrink-0 border-b backdrop-blur">
        <div className="mx-auto w-full max-w-5xl p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Suspense fallback={<LibraryControlsSkeleton />}>
              <LibrarySearch />
              <LibraryFilters />
            </Suspense>
            <Suspense fallback={null}>
              <CreateWorkTrigger />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl p-4">
        <SectionErrorBoundary>
          <Suspense fallback={<LibraryResultsSkeleton />}>
            <LibraryResults searchParams={searchParams} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </LibraryShell>
  </LibraryQueryProvider>
);

export default LibraryPage;
