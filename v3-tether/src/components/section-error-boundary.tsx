"use client";

import { catchError } from "next/error";
import type { ErrorInfo } from "next/error";

// SectionErrorBoundary is always rendered with only `children` (see its
// call sites), which catchError's fallback signature omits -- so the
// fallback itself receives no custom props. No index signature here (unlike
// Record<string, never>) so it doesn't conflict with the `children?` prop
// catchError's return type intersects in for callers.
type SectionErrorBoundaryProps = Record<never, never>;

const ErrorFallback = (
  _props: SectionErrorBoundaryProps,
  { retry }: ErrorInfo
) => (
  <div className="border-destructive/30 rounded-lg border p-4 text-sm">
    <p className="text-muted-foreground">
      Something went wrong loading this section.
    </p>
    <button
      className="mt-2 underline underline-offset-2"
      onClick={() => retry()}
      type="button"
    >
      Try again
    </button>
  </div>
);

export const SectionErrorBoundary = catchError(ErrorFallback);
