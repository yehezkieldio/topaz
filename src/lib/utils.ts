import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import z from "zod/v4";

export const DEBOUNCE_DELAY_MS = 300;
export const WORD_COUNT_THRESHOLD = 1000;
export const MIN_RATING = 0;
export const MAX_RATING = 5;

export const sortByEnum = z.enum(["createdAt", "updatedAt"]);
export type SortBy = z.infer<typeof sortByEnum>;

export const sortOrderEnum = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof sortOrderEnum>;

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | null) {
    if (!(date && date instanceof Date && Number.isFinite(date.getTime()))) return null;

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

export function estimateWordCount(value?: number | null): string {
    if (value == null || !Number.isFinite(value)) return "0";
    const sign = value < 0 ? "-" : "";
    const n = Math.abs(value);

    if (n < WORD_COUNT_THRESHOLD) return `${sign}${Math.round(n).toString()}`;

    const units = [
        { v: 1e18, s: "E" },
        { v: 1e15, s: "P" },
        { v: 1e12, s: "T" },
        { v: 1e9, s: "B" },
        { v: 1e6, s: "M" },
        { v: 1e3, s: "K" },
    ];

    for (const { v, s } of units) {
        if (n >= v) {
            const scaled = n / v;
            const rounded = scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
            const str = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
            return `${sign}${str}${s}`;
        }
    }

    return `${sign}${Math.round(n).toString()}`;
}

export function formatRating(value: number): string {
    if (typeof value !== "number" || Number.isNaN(value) || value < MIN_RATING || value > MAX_RATING) {
        throw new Error("Invalid rating value");
    }
    return value.toFixed(1);
}
