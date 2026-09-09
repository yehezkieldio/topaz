import { DecorativeGridBackground } from "@/components/decorative-grid-background";

/**
 * Purely decorative, data-independent layout: renders synchronously so it
 * commits as part of the static shell instead of waiting on any data read.
 */
export const LibraryShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background relative min-h-dvh overflow-hidden">
    <DecorativeGridBackground />
    <div className="relative z-10">{children}</div>
  </div>
);
