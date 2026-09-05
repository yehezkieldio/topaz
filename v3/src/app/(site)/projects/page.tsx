import type { Metadata } from "next";

import {
  SiteHeader,
  SiteSection,
} from "@/features/site/components/site-primitives";
import { SiteProjectList } from "@/features/site/components/site-project-list";
import { getProjects } from "@/features/site/server/projects";

export const metadata: Metadata = {
  description: "Projects by Yehezkiel Dio Sinolungan.",
  title: "Projects",
};

const ProjectsPage = () => (
  <SiteSection>
    <SiteHeader
      description="A collection of my personal and professional projects."
      title="Projects"
    />
    <SiteProjectList projects={getProjects()} />
  </SiteSection>
);

export default ProjectsPage;
