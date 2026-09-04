"use client";

import { catchError } from "next/error";
import type { ErrorInfo } from "next/error";

const ErrorFallback = (_props: unknown, { retry }: ErrorInfo) => (
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
