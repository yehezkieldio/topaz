export const libraryEntryTag = (publicId: string) =>
  `library-entry:${publicId}`;
export const workTag = (publicId: string) => `work:${publicId}`;
export const readingStateTag = (libraryEntryPublicId: string) =>
  `reading-state:${libraryEntryPublicId}`;
