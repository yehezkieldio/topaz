"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type * as React from "react";

import { cn } from "#/lib/utils";

const MAX_PROGRESS_PERCENTAGE = 100;

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
    return (
        <ProgressPrimitive.Root
            className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
            data-slot="progress"
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                style={{ transform: `translateX(-${MAX_PROGRESS_PERCENTAGE - (value || 0)}%)` }}
            />
        </ProgressPrimitive.Root>
    );
}

export { Progress };
