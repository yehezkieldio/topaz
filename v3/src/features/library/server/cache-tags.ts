export const libraryEntryTag = (publicId: string) =>
  `library-entry:${publicId}`;
export const workTag = (publicId: string) => `work:${publicId}`;
export const readingStateTag = (libraryEntryPublicId: string) =>
  `reading-state:${libraryEntryPublicId}`;
export const libraryStatsTag = "library-stats";
export const libraryListTag = "library-list";
