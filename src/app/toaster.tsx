"use client";

import dynamic from "next/dynamic";

export const Toaster = dynamic(() => import("#/components/ui/sonner").then((mod) => ({ default: mod.Toaster })), {
    ssr: false,
});
