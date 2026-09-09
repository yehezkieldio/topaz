import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { mdxComponents } from "@/features/site/components/mdx-component-map";
import {
  ArticleHeader,
  MdxBody,
} from "@/features/site/components/site-mdx-content";
import { SiteContentTags } from "@/features/site/components/site-primitives";
import { getProject, getProjects } from "@/features/site/server/projects";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

type Project = NonNullable<ReturnType<typeof getProject>>;

export const generateStaticParams = () => {
  const withNotes = getProjects().flatMap((project) =>
    project.hasNote ? [{ slug: project.slug }] : []
  );

  // Cache Components requires generateStaticParams to return at least one
  // param -- fall back to a placeholder that always 404s via notFound()
  // below when no project currently has a case study, per Next.js's
  // documented pattern.
  return withNotes.length > 0 ? withNotes : [{ slug: "__placeholder__" }];
};

export const generateMetadata = async ({
  params,
}: ProjectPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) {
    return { title: "Project" };
  }

  return { description: project.description, title: project.title };
};

const ProjectLinks = ({ links }: { links: Project["links"] }) => {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 font-mono text-xs">
      {links.map((link) => (
        <a
          className="motion-link text-muted-foreground/80 hover:text-foreground inline-flex items-center gap-1.5"
          href={link.href}
          key={`${link.kind}:${link.href}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.label}
          <ExternalLinkIcon
            aria-hidden="true"
            className="size-3"
            strokeWidth={1.75}
          />
        </a>
      ))}
    </div>
  );
};

const ProjectPage = async ({ params }: ProjectPageProps) => {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) {
    notFound();
  }

  const Body = project.body;

  return (
    <article className="space-y-9">
      <Link
        className="motion-link text-muted-foreground/75 mb-6 inline-flex items-center gap-2 font-mono text-xs"
        href="/projects"
        prefetch={false}
      >
        <ArrowLeftIcon
          aria-hidden="true"
          className="size-3.5"
          strokeWidth={1.75}
        />
        projects
      </Link>

      <ArticleHeader
        description={project.description}
        tags={project.tags}
        title={project.title}
      >
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SiteContentTags tags={project.tags} />
          <ProjectLinks links={project.links} />
        </div>
      </ArticleHeader>

      <MdxBody>
        <Body components={mdxComponents} />
      </MdxBody>
    </article>
  );
};

export default ProjectPage;
