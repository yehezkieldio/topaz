"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";
import { useEffect, useState } from "react";

import { cn } from "#/lib/utils";

type TooltipPopoverProps = {
    children: React.ReactNode;
    content: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    align?: "start" | "center" | "end";
    className?: string;
    contentClassName?: string;
    forceMobile?: boolean;
    forceDesktop?: boolean;
    isOpen?: boolean;
    onOpenChangeAction?: (open: boolean) => void;
};

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
            const isSmallScreen = window.innerWidth < 768; // md breakpoint
            const isMobileUserAgent = MOBILE_REGEX.test(navigator.userAgent);

            setIsMobile(hasTouchScreen && (isSmallScreen || isMobileUserAgent));
        };

        checkIsMobile();
        window.addEventListener("resize", checkIsMobile);

        return () => window.removeEventListener("resize", checkIsMobile);
    }, []);

    return isMobile;
}

export function TooltipPopover({
    children,
    content,
    side = "top",
    sideOffset = 4,
    align = "center",
    className,
    contentClassName,
    forceMobile = false,
    forceDesktop = false,
    isOpen,
    onOpenChangeAction,
}: TooltipPopoverProps) {
    const isMobile = useIsMobile();
    const shouldUsePopover = forceMobile || (!forceDesktop && isMobile);

    const contentClasses = cn(
        "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=open]:animate-in",
        contentClassName,
    );

    if (shouldUsePopover) {
        return (
            <PopoverPrimitive.Root onOpenChange={onOpenChangeAction} open={isOpen}>
                <PopoverPrimitive.Trigger asChild className={className}>
                    {children}
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                        align={align}
                        className={contentClasses}
                        side={side}
                        sideOffset={sideOffset}
                    >
                        {content}
                        <PopoverPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
                    </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
        );
    }

    return (
        <TooltipPrimitive.Provider delayDuration={0}>
            <TooltipPrimitive.Root onOpenChange={onOpenChangeAction} open={isOpen}>
                <TooltipPrimitive.Trigger asChild className={className}>
                    {children}
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content className={contentClasses} side={side} sideOffset={sideOffset}>
                        {content}
                        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
