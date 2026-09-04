import type { ReactNode } from "react";

import { SectionNav } from "@/components/site/section-nav";

const writingLinks = [
  { active: "exact" as const, href: "/writing", label: "writing" },
  { href: "/writing/notes", label: "notes" },
];

const WritingLayout = ({ children }: { children: ReactNode }) => (
  <>
    <SectionNav
      ariaLabel="Writing navigation"
      className="mb-9 gap-x-4 font-mono text-xs"
      links={writingLinks}
    />
    {children}
  </>
);

export default WritingLayout;
