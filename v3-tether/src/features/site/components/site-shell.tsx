import type { ReactNode } from "react";

import { SiteBackground } from "@/features/site/components/site-background";
import { SiteNav } from "@/features/site/components/site-nav";
import { SitePageTransition } from "@/features/site/components/site-page-transition";

export const SiteShell = ({ children }: { children: ReactNode }) => (
  <main className="site-page-surface bg-background text-foreground relative min-h-dvh overflow-hidden">
    <SiteBackground />
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-7 sm:px-6 sm:py-20">
      <header className="mb-10 flex flex-wrap justify-end gap-x-5 gap-y-3 text-sm leading-none sm:mb-16">
        <SiteNav />
      </header>

      <SitePageTransition>{children}</SitePageTransition>
    </div>
  </main>
);
