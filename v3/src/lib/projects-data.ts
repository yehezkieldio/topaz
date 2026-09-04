export interface ProjectLink {
  href: string;
  kind: "external" | "github" | "gitlab";
  label: string;
}

export interface ProjectListItem {
  description: string;
  links: ProjectLink[];
  slug: string;
  tags: string[];
  title: string;
  year: string;
}

/**
 * Static placeholder set -- the portfolio's projects page is driven by a
 * fumadocs-mdx content collection; porting that whole content pipeline was
 * out of scope here. Swap this for real entries or wire up MDX later.
 */
export const projects: ProjectListItem[] = [
  {
    description:
      "A single-user, self-hosted tracker for fanfiction, webnovels, and online fiction.",
    links: [
      {
        href: "https://github.com/yehezkieldio/topaz",
        kind: "github",
        label: "GitHub",
      },
    ],
    slug: "topaz",
    tags: ["next.js", "postgres", "drizzle"],
    title: "Topaz",
    year: "2026",
  },
];

export const getProjects = () => projects;
