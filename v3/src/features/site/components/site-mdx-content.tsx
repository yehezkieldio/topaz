import type { ReactNode } from "react";

import {
  SiteContentTags,
  SiteHeader,
} from "@/features/site/components/site-primitives";

const EMPTY_TAGS: string[] = [];

export const ArticleHeader = ({
  children,
  description,
  meta,
  tags = EMPTY_TAGS,
  title,
}: {
  children?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tags?: string[];
  title: string;
}) => (
  <SiteHeader description={description} meta={meta} title={title} withRule>
    {children ?? <SiteContentTags tags={tags} />}
  </SiteHeader>
);

export const MdxBody = ({ children }: { children: ReactNode }) => (
  <div
    className="project-note project-row-enter min-w-0 overflow-hidden [&>*+*]:mt-4 [&>ol]:mt-2.5 [&>p+ol]:mt-1.5 [&>p+ul]:mt-1.5 [&>ul]:mt-2.5"
    style={{ animationDelay: "110ms" }}
  >
    {children}
  </div>
);
