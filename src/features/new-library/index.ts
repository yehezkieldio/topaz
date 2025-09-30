/**
 * Main entry point for the new-library feature.
 * Exports all public APIs and components.
 */

export { LibraryContainer } from "./components/container/library-container";
export { LibraryDeleteDialog } from "./components/dialogs/delete-dialog";
export { LibraryItem } from "./components/item/library-item";
// Components - Building Blocks
export { LibraryList } from "./components/list/library-list";
// Components - Main Entry
export { LibraryPage } from "./components/pages/library-page";
// Components - Sheets & Dialogs
export { LibraryCreateSheet } from "./components/sheets/create-sheet";
export { LibraryEditSheet } from "./components/sheets/edit-sheet";
export { LibraryViewSheet } from "./components/sheets/view-sheet";
export { LibrarySearchInput } from "./components/ui/search-input";
export { EmptyState, ErrorState, LoadingSpinner } from "./components/ui/states";
export type { StoryFormInput } from "./core/schemas";
// Core
export type {
    ComputedStoryValues,
    LibraryFilters,
    LibraryStory,
    ProgressSortBy,
    ProgressStatus,
    SortOrder,
    StoryActions,
} from "./core/types";
export { useCreateStory, useDeleteStory, useUpdateStory } from "./data-access/use-library-mutations";
// Data Access
export { useLibraryQuery } from "./data-access/use-library-query";
export { useLibraryStats } from "./data-access/use-library-stats";
export { useDebounce } from "./hooks/use-debounce";
// Hooks
export { useStoryValues } from "./hooks/use-story-values";
export { useVirtualizedList } from "./hooks/use-virtualized-list";
export {
    useCreateSheetOpen,
    useDeleteDialogOpen,
    useDeleteStory as useDeleteStoryFromStore,
    useDialogStore,
    useEditSheetOpen,
    useFilterSheetOpen,
    useSelectedStory,
    useSheetStore,
    useViewSheetOpen,
} from "./state/ui-store";
// State Management
export { useLibraryFilters, useSearchQuery } from "./state/use-filter-state";
