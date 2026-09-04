import { CreateWorkSheet } from "@/features/library/components/create-work-sheet";
import { getSourcePlatforms } from "@/features/library/server/source-platforms-query";

export const CreateWorkTrigger = async () => {
  const sourcePlatforms = await getSourcePlatforms();
  return <CreateWorkSheet sourcePlatforms={sourcePlatforms} />;
};
