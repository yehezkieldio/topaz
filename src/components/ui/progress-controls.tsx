"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "#/components/ui/button";

type ProgressControlsProps = {
    currentChapter: number;
    totalChapters?: number;
    onIncrement: () => void;
    onDecrement: () => void;
    disabled?: boolean;
    size?: "sm" | "default" | "lg";
    showProgress?: boolean;
};

export function ProgressControls({
    currentChapter,
    totalChapters = 0,
    onIncrement,
    onDecrement,
    disabled = false,
    size = "sm",
    showProgress = true,
}: ProgressControlsProps) {
    const progressPercentage = totalChapters > 0 ? Math.round((currentChapter / totalChapters) * 100) : 0;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <Button
                    disabled={disabled || currentChapter <= 0}
                    onClick={onDecrement}
                    size={size}
                    type="button"
                    variant="outline"
                >
                    <MinusIcon className="size-4" />
                </Button>
                <div className="flex-1 text-center">
                    <span className="font-medium text-lg tabular-nums">{currentChapter}</span>
                    {totalChapters > 0 && <span className="text-muted-foreground text-sm">/{totalChapters}</span>}
                </div>
                <Button
                    disabled={disabled || (totalChapters > 0 && currentChapter >= totalChapters)}
                    onClick={onIncrement}
                    size={size}
                    type="button"
                    variant="outline"
                >
                    <PlusIcon className="size-4" />
                </Button>
            </div>
            {showProgress && totalChapters > 0 && (
                <div>
                    <div className="mb-1 text-muted-foreground text-xs">Progress: {progressPercentage}%</div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
                            style={{
                                width: `${Math.min(progressPercentage, 100)}%`,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
