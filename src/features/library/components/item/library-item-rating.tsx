import { SparkleIcon } from "lucide-react";
import { memo } from "react";

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
    const clampedValue = Math.max(0, Math.min(5, value));

    return (
        <div aria-label={ariaLabel} className="flex items-center gap-1" role="radiogroup">
            {[1, 2, 3, 4, 5].map((star) => {
                const fillPercentage = Math.max(0, Math.min(100, (clampedValue - (star - 1)) * 100));

                return (
                    <button
                        aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                        className={`transition-colors ${readOnly ? "cursor-default" : "hover:text-foreground"}`}
                        disabled={readOnly}
                        key={star}
                        onClick={() => !readOnly && onChange?.(star)}
                        onKeyDown={(e) => {
                            if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                                onChange?.(star);
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
                            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercentage}%` }}>
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
    );
});
