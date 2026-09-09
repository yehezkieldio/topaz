import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";

import {
  SiteContentList,
  SiteContentRow,
  SiteContentTags,
  SiteContentTitleLink,
  SiteEmptyLine,
} from "@/features/site/components/site-primitives";
import type { getProjects } from "@/features/site/server/projects";

type ProjectListItem = ReturnType<typeof getProjects>[number];
type ProjectLink = ProjectListItem["links"][number];

const getProjectLinkLabel = (link: ProjectLink) => {
  if (link.kind === "github") {
    return "GitHub";
  }

  if (link.kind === "gitlab") {
    return "GitLab";
  }

  return link.label === "site" ? "Website" : link.label;
};

const ProjectTitle = ({ project }: { project: ProjectListItem }) => {
  if (project.hasNote) {
    return (
      <SiteContentTitleLink href={`/projects/${project.slug}`}>
        {project.title}
      </SiteContentTitleLink>
    );
  }

  const href = project.links[0]?.href;

  if (!href) {
    return project.title;
  }

  return (
    <SiteContentTitleLink href={href} isExternal>
      {project.title}
    </SiteContentTitleLink>
  );
};

const ProjectActionLink = ({ link }: { link: ProjectLink }) => (
  <a
    className="motion-link group text-foreground/82 hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors duration-200 ease-(--ease-ui)"
    href={link.href}
    rel="noopener noreferrer"
    target="_blank"
  >
    <span>{getProjectLinkLabel(link)}</span>
    <ExternalLinkIcon
      aria-hidden="true"
      className="text-muted-foreground/70 group-hover:text-foreground/90 size-3 transition-colors duration-200 ease-(--ease-ui)"
    />
  </a>
);

const ProjectRow = ({
  project,
  revealIndex,
  withRule,
}: {
  project: ProjectListItem;
  revealIndex: number;
  withRule: boolean;
}) => (
  <SiteContentRow delayIndex={revealIndex} withRule={withRule} withSpacing>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 sm:gap-y-1">
      <h2 className="min-w-0 text-[13px] leading-tight font-medium tracking-normal sm:text-sm sm:leading-tight">
        <ProjectTitle project={project} />
      </h2>
      <p className="text-muted-foreground/70 shrink-0 font-mono text-[11px] leading-none tracking-normal sm:text-xs">
        {project.year}
      </p>
    </div>

    <p className="text-muted-foreground max-w-xl text-[13.5px] leading-[1.55] tracking-normal sm:text-sm sm:leading-6">
      {project.description ?? ""}
    </p>

    <div className="flex items-center justify-between gap-3 pt-1 sm:gap-4">
      <div className="min-w-0 flex-1 overflow-hidden">
        <SiteContentTags tags={project.tags} />
      </div>
      <p className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-[11px] leading-5 tracking-normal sm:text-xs">
        {project.hasNote ? (
          <Link
            className="motion-link group text-foreground/82 hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors duration-200 ease-(--ease-ui)"
            href={`/projects/${project.slug}`}
            prefetch={false}
          >
            <FileTextIcon
              aria-hidden="true"
              className="text-muted-foreground/80 size-3.5"
            />
            <span>Case Study</span>
            <ExternalLinkIcon
              aria-hidden="true"
              className="text-muted-foreground/70 group-hover:text-foreground/90 size-3 transition-colors duration-200 ease-(--ease-ui)"
            />
          </Link>
        ) : null}
        {project.links.map((link) => (
          <ProjectActionLink key={`${link.kind}:${link.href}`} link={link} />
        ))}
      </p>
    </div>
  </SiteContentRow>
);

export const SiteProjectList = ({
  projects,
}: {
  projects: ProjectListItem[];
}) => (
  <SiteContentList
    empty={<SiteEmptyLine>No projects yet.</SiteEmptyLine>}
    isEmpty={projects.length === 0}
  >
    {projects.map((project, index) => (
      <ProjectRow
        key={project.slug}
        project={project}
        revealIndex={index}
        withRule={index < projects.length - 1}
      />
    ))}
  </SiteContentList>
);
