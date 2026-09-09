import { LibraryFiltersClient } from "@/features/library/components/library-filters-client";
import { getSourcePlatforms } from "@/features/library/server/source-platforms-query";

export const LibraryFilters = async () => {
  const sourcePlatforms = await getSourcePlatforms();

  return (
    <LibraryFiltersClient
      sourcePlatforms={sourcePlatforms.map((platform) => ({
        id: platform.id,
        label: platform.name,
      }))}
    />
  );
};
