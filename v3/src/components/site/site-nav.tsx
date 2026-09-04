import { SectionNav } from "@/components/site/section-nav";

const navLinks = [
  { active: "exact" as const, href: "/", label: "about" },
  { href: "/projects", label: "projects" },
  { href: "/writing", label: "writing" },
  { href: "/library", label: "library" },
];

export const SiteNav = () => (
  <SectionNav ariaLabel="Primary navigation" links={navLinks} />
);
