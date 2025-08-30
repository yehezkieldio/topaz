"use client";

import { create } from "zustand";

interface LibraryCreateSheetStore {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useLibraryCreateSheet = create<LibraryCreateSheetStore>((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));
