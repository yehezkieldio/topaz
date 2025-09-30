/**
 * Core domain types for the library feature.
 * These types represent the fundamental entities and their relationships.
 */

import type { RouterOutputs } from "#/trpc/react";

// ============================================================================
// Base Types from tRPC
// ============================================================================

export type LibraryStory = RouterOutputs["progress"]["all"]["data"][number];
export type PaginatedLibraryResponse = RouterOutputs["progress"]["all"];

// Stats type - define manually since endpoint doesn't exist yet
export type LibraryStats = {
    total: number;
    byStatus: Record<string, number>;
};

// ============================================================================
// Domain Enums
// ============================================================================

export type StoryStatus = "complete" | "in-progress" | "hiatus" | "abandoned";
export type ProgressStatus = "reading" | "completed" | "on-hold" | "dropped" | "plan-to-read";
export type ProgressSortBy = "title" | "updatedAt" | "createdAt" | "rating";
export type SortOrder = "asc" | "desc";
export type Source = "ao3" | "ffn" | "wattpad" | "royalroad" | "other";

// ============================================================================
// Filter Types
// ============================================================================

export interface LibraryFilters {
    readonly search?: string;
    readonly status?: ProgressStatus | "all";
    readonly sortBy: ProgressSortBy;
    readonly sortOrder: SortOrder;
    readonly source?: Source | "all";
    readonly fandoms?: readonly string[];
    readonly tags?: readonly string[];
}

// ============================================================================
// Computed Story Values
// ============================================================================

export interface ComputedStoryValues {
    readonly totalChapters: number;
    readonly currentChapter: number;
    readonly hasValidChapterData: boolean;
    readonly hasCurrentChapterOnly: boolean;
    readonly progressPercentage: number;
    readonly isComplete: boolean;
    readonly hasWordCount: boolean;
    readonly formattedWordCount: string;
    readonly hasValidUrl: boolean;
    readonly hasNotes: boolean;
    readonly hasDescription: boolean;
    readonly formattedLastUpdated: string | null;
    readonly isNsfw: boolean;
    readonly hasFandomsOrTags: boolean;
    readonly hasReadingProgress: boolean;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface SheetState {
    readonly isOpen: boolean;
    readonly selectedStory: LibraryStory | null;
}

export interface DialogState {
    readonly isOpen: boolean;
    readonly selectedStory: LibraryStory | null;
}

// ============================================================================
// Form Types
// ============================================================================

export interface StoryFormData {
    readonly title: string;
    readonly author?: string;
    readonly url?: string;
    readonly description?: string;
    readonly wordCount?: number;
    readonly chapterCount?: number;
    readonly status?: StoryStatus;
    readonly isNsfw?: boolean;
    readonly source?: Source;
    readonly rating?: number;
    readonly currentChapter?: number;
    readonly progressStatus?: ProgressStatus;
    readonly notes?: string;
    readonly fandoms?: ReadonlyArray<{ publicId: string; name: string }>;
    readonly tags?: ReadonlyArray<{ publicId: string; name: string }>;
}

// ============================================================================
// Action Types
// ============================================================================

export interface StoryActions {
    readonly onView: (story: LibraryStory) => void;
    readonly onEdit: (story: LibraryStory) => void;
    readonly onDelete: (story: LibraryStory) => void;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isValidProgressStatus(value: unknown): value is ProgressStatus {
    return typeof value === "string" && ["reading", "completed", "on-hold", "dropped", "plan-to-read"].includes(value);
}

export function isValidSortBy(value: unknown): value is ProgressSortBy {
    return typeof value === "string" && ["title", "updatedAt", "createdAt", "rating"].includes(value);
}

export function isValidSortOrder(value: unknown): value is SortOrder {
    return value === "asc" || value === "desc";
}

export function isValidSource(value: unknown): value is Source {
    return typeof value === "string" && ["ao3", "ffn", "wattpad", "royalroad", "other"].includes(value);
}
