import { SparkleIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { TooltipPopover } from "#/components/ui/tooltip-popover";

const MIN_RATING = 0;
const MAX_RATING = 5;
const STAR_COUNT = 5;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;

type LibraryItemRatingProps = {
    value: number; // 0-5, supports decimals
    onChange?: (value: number) => void;
    readOnly?: boolean;
    "aria-label"?: string;
};

export const LibraryItemRating = memo(function LibraryItemRating({
    value,
    onChange,
    readOnly = false,
    "aria-label": ariaLabel = "Rating",
}: LibraryItemRatingProps) {
    const clampedValue = Math.max(MIN_RATING, Math.min(MAX_RATING, value));
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTooltipToggle = useCallback(() => {
        setIsTooltipOpen((prev) => !prev);
    }, []);

    const handleStarClick = useCallback(
        (star: number) => {
            if (!readOnly) {
                onChange?.(star);
            }
            // Toggle tooltip on mobile for any star interaction
            handleTooltipToggle();
        },
        [onChange, readOnly, handleTooltipToggle],
    );

    // Close tooltip when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsTooltipOpen(false);
            }
        };

        if (isTooltipOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isTooltipOpen]);

    return (
        <div
            aria-label={ariaLabel}
            className="flex items-center gap-1"
            onTouchStart={(e) => {
                if (e.target === e.currentTarget) {
                    handleTooltipToggle();
                }
            }}
            ref={containerRef}
            role="radiogroup"
        >
            <TooltipPopover
                content={clampedValue.toFixed(1)}
                isOpen={isTooltipOpen}
                onOpenChangeAction={setIsTooltipOpen}
                side="top"
                sideOffset={4}
            >
                <div className="flex items-center gap-1">
                    {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => {
                        const fillPercentage = Math.max(
                            MIN_PERCENTAGE,
                            Math.min(MAX_PERCENTAGE, (clampedValue - (star - 1)) * MAX_PERCENTAGE),
                        );

                        return (
                            <button
                                aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                                className={`transition-colors ${readOnly ? "cursor-default" : "hover:text-foreground"}`}
                                disabled={readOnly}
                                key={star}
                                onClick={() => {
                                    handleStarClick(star);
                                }}
                                onKeyDown={(e) => {
                                    if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                                        handleStarClick(star);
                                    }
                                }}
                                tabIndex={readOnly ? -1 : 0}
                                type="button"
                            >
                                <div className="relative">
                                    <SparkleIcon
                                        className="size-3 text-muted-foreground lg:size-4"
                                        fill="none"
                                        strokeWidth={2}
                                    />
                                    <div
                                        className="absolute inset-0 overflow-hidden"
                                        style={{ width: `${fillPercentage}%` }}
                                    >
                                        <SparkleIcon
                                            className="size-3 text-foreground lg:size-4"
                                            fill="currentColor"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </TooltipPopover>
        </div>
    );
});
