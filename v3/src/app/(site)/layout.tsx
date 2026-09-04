import { PageTransition } from "@/components/site/page-transition";
import { SiteBackground } from "@/components/site/site-background";
import { SiteNav } from "@/components/site/site-nav";

const SiteLayout = ({ children }: LayoutProps<"/">) => (
  <main className="site-page-surface bg-background text-foreground relative min-h-dvh overflow-hidden">
    <SiteBackground />
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-7 sm:px-6 sm:py-20">
      <header className="mb-10 flex flex-wrap justify-end gap-x-5 gap-y-3 text-sm leading-none sm:mb-16">
        <SiteNav />
      </header>

      <PageTransition>{children}</PageTransition>
    </div>
  </main>
);

export default SiteLayout;
