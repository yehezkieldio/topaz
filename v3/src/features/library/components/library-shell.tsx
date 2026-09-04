/**
 * Purely decorative, data-independent layout: renders synchronously so it
 * commits as part of the static shell instead of waiting on any data read.
 */
export const LibraryShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background relative min-h-dvh overflow-hidden">
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        WebkitMaskImage:
          "radial-gradient(circle at center, black, transparent)",
        maskImage: "radial-gradient(circle at center, black, transparent)",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[40px_40px] opacity-[0.15]" />
    </div>
    <div className="relative z-10">{children}</div>
  </div>
);
