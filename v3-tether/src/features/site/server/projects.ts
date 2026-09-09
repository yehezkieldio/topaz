import { projects as projectDocs } from "fumadocs-mdx:collections/server";

const MDX_EXTENSION_REGEX = /\.mdx?$/u;
const NON_WORD_REGEX = /\s+/gu;

const projectSlug = (path: string) => path.replace(MDX_EXTENSION_REGEX, "");

const normalizeTag = (tag: string) =>
  tag.trim().toLowerCase().replace(NON_WORD_REGEX, "-");

const projectLinks = (project: (typeof projectDocs)[number]) => {
  const links: {
    href: string;
    kind: "external" | "github" | "gitlab";
    label: string;
  }[] = [];

  if (project.github) {
    links.push({ href: project.github, kind: "github", label: "GitHub" });
  }

  if (project.gitlab) {
    links.push({ href: project.gitlab, kind: "gitlab", label: "GitLab" });
  }

  if (project.website) {
    links.push({ href: project.website, kind: "external", label: "site" });
  }

  for (const link of project.external) {
    links.push({ ...link, kind: "external" });
  }

  return links;
};

const withProjectRuntimeFields = (project: (typeof projectDocs)[number]) => ({
  ...project,
  hasNote: project.note,
  links: projectLinks(project),
  projectSortDate: project.projectSortDate ?? project.projectStartedAt,
  slug: projectSlug(project.info.path),
  tags: project.tags.map(normalizeTag),
});

type Project = ReturnType<typeof withProjectRuntimeFields>;

const sortProjects = (a: Project, b: Project) =>
  b.projectSortDate.localeCompare(a.projectSortDate) ||
  a.title.localeCompare(b.title);

const projects = projectDocs
  .flatMap((project) =>
    project.hidden ? [] : [withProjectRuntimeFields(project)]
  )
  .toSorted(sortProjects);

const projectsBySlug = new Map(
  projects.flatMap((project) =>
    project.hasNote ? [[project.slug, project]] : []
  )
);

export const getProjects = () => projects;

export const getProject = (slug: string) => projectsBySlug.get(slug);
