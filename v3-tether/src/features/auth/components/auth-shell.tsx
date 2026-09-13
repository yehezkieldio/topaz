import Link from "next/link";
import type { ReactNode } from "react";

import { DecorativeGridBackground } from "@/components/decorative-grid-background";

export const AuthShell = ({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "destructive";
}) => (
  <div className="bg-background relative flex min-h-dvh items-center justify-center overflow-hidden">
    <DecorativeGridBackground />

    <div className="relative z-10 w-full max-w-sm px-4">
      <div
        className={`bg-card/40 rounded-md border p-8 backdrop-blur-md ${
          tone === "destructive" ? "border-destructive/30" : "border-border/60"
        }`}
      >
        <div className="space-y-6 text-center">
          {children}

          <Link
            className="border-border/60 bg-background/40 text-foreground/90 hover:bg-background/60 inline-flex items-center justify-center rounded-md border px-4 py-2 text-xs font-medium backdrop-blur transition"
            href="/library"
            prefetch={false}
          >
            Return to library
          </Link>
        </div>
      </div>
    </div>
  </div>
);
