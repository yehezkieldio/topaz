export const DecorativeGridBackground = () => (
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      WebkitMaskImage: "radial-gradient(circle at center, black, transparent)",
      maskImage: "radial-gradient(circle at center, black, transparent)",
    }}
  >
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[40px_40px] opacity-[0.15]" />
  </div>
);
