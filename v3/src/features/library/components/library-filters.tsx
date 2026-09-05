import { LibraryFiltersClient } from "@/features/library/components/library-filters-client";
import { getSourcePlatforms } from "@/features/library/server/source-platforms-query";
import { getFilterableTaxonomyTerms } from "@/features/library/server/taxonomy-filter-query";

export const LibraryFilters = async () => {
  const [sourcePlatforms, taxonomyTerms] = await Promise.all([
    getSourcePlatforms(),
    getFilterableTaxonomyTerms(),
  ]);

  return (
    <LibraryFiltersClient
      sourcePlatforms={sourcePlatforms.map((platform) => ({
        id: platform.id,
        label: platform.name,
      }))}
      taxonomyTerms={taxonomyTerms}
    />
  );
};
