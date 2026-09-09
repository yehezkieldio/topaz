import { SiteSectionNav } from "@/features/site/components/site-section-nav";

const navLinks = [
  { active: "exact" as const, href: "/", label: "about" },
  { href: "/projects", label: "projects" },
  { href: "/writing", label: "writing" },
  { href: "/library", label: "library" },
];

export const SiteNav = () => (
  <SiteSectionNav ariaLabel="Primary navigation" links={navLinks} />
);
