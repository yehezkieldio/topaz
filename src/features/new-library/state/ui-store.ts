/**
 * Zustand store for managing library UI state.
 * Uses selectors to prevent unnecessary re-renders.
 */

"use client";

import { create } from "zustand";
import type { LibraryStory } from "../core/types";

// ============================================================================
// Sheet State
// ============================================================================

interface SheetState {
    readonly isCreateSheetOpen: boolean;
    readonly isEditSheetOpen: boolean;
    readonly isViewSheetOpen: boolean;
    readonly isFilterSheetOpen: boolean;
    readonly selectedStory: LibraryStory | null;
}

interface SheetActions {
    readonly openCreateSheet: () => void;
    readonly closeCreateSheet: () => void;
    readonly openEditSheet: (story: LibraryStory) => void;
    readonly closeEditSheet: () => void;
    readonly openViewSheet: (story: LibraryStory) => void;
    readonly closeViewSheet: () => void;
    readonly openFilterSheet: () => void;
    readonly closeFilterSheet: () => void;
}

type SheetStore = SheetState & SheetActions;

export const useSheetStore = create<SheetStore>((set) => ({
    // State
    isCreateSheetOpen: false,
    isEditSheetOpen: false,
    isViewSheetOpen: false,
    isFilterSheetOpen: false,
    selectedStory: null,

    // Actions
    openCreateSheet: () => set({ isCreateSheetOpen: true }),
    closeCreateSheet: () => set({ isCreateSheetOpen: false }),
    openEditSheet: (story) => set({ isEditSheetOpen: true, selectedStory: story }),
    closeEditSheet: () => set({ isEditSheetOpen: false, selectedStory: null }),
    openViewSheet: (story) => set({ isViewSheetOpen: true, selectedStory: story }),
    closeViewSheet: () => set({ isViewSheetOpen: false, selectedStory: null }),
    openFilterSheet: () => set({ isFilterSheetOpen: true }),
    closeFilterSheet: () => set({ isFilterSheetOpen: false }),
}));

// Selectors for optimal re-render prevention
export const useCreateSheetOpen = () => useSheetStore((state) => state.isCreateSheetOpen);
export const useEditSheetOpen = () => useSheetStore((state) => state.isEditSheetOpen);
export const useViewSheetOpen = () => useSheetStore((state) => state.isViewSheetOpen);
export const useFilterSheetOpen = () => useSheetStore((state) => state.isFilterSheetOpen);
export const useSelectedStory = () => useSheetStore((state) => state.selectedStory);

// ============================================================================
// Dialog State
// ============================================================================

interface DialogState {
    readonly isDeleteDialogOpen: boolean;
    readonly deleteStory: LibraryStory | null;
}

interface DialogActions {
    readonly openDeleteDialog: (story: LibraryStory) => void;
    readonly closeDeleteDialog: () => void;
}

type DialogStore = DialogState & DialogActions;

export const useDialogStore = create<DialogStore>((set) => ({
    // State
    isDeleteDialogOpen: false,
    deleteStory: null,

    // Actions
    openDeleteDialog: (story) => set({ isDeleteDialogOpen: true, deleteStory: story }),
    closeDeleteDialog: () => set({ isDeleteDialogOpen: false, deleteStory: null }),
}));

// Selectors
export const useDeleteDialogOpen = () => useDialogStore((state) => state.isDeleteDialogOpen);
export const useDeleteStory = () => useDialogStore((state) => state.deleteStory);
