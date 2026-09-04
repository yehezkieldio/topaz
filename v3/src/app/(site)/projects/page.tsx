import type { Metadata } from "next";

import { PageHeader, PageSection } from "@/components/site/content-primitives";
import { ProjectList } from "@/components/site/project-list";
import { getProjects } from "@/lib/projects";

export const metadata: Metadata = {
  description: "Projects by Yehezkiel Dio Sinolungan.",
  title: "Projects",
};

const ProjectsPage = () => (
  <PageSection>
    <PageHeader
      description="A collection of my personal and professional projects."
      title="Projects"
    />
    <ProjectList projects={getProjects()} />
  </PageSection>
);

export default ProjectsPage;
