import type { Metadata } from "next";

import { PageHeader, PageSection } from "@/components/site/content-primitives";
import { ProjectList } from "@/components/site/project-list";
import { getProjects } from "@/lib/projects-data";

export const metadata: Metadata = {
  description: "Projects by Yehezkiel Dio Sinolungan.",
  title: "Projects",
};

const ProjectsPage = () => (
  <PageSection>
    <PageHeader title="Projects" withRule />
    <ProjectList projects={getProjects()} />
  </PageSection>
);

export default ProjectsPage;
