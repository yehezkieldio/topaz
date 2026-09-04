import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ContentTags, PageHeader } from "@/components/site/content-primitives";
import { cn } from "@/lib/utils";

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
  <PageHeader description={description} meta={meta} title={title} withRule>
    {children ?? <ContentTags tags={tags} />}
  </PageHeader>
);

export const MdxBody = ({ children }: { children: ReactNode }) => (
  <div
    className="project-note project-row-enter min-w-0 overflow-hidden [&>*+*]:mt-4 [&>ol]:mt-2.5 [&>p+ol]:mt-1.5 [&>p+ul]:mt-1.5 [&>ul]:mt-2.5"
    style={{ animationDelay: "110ms" }}
  >
    {children}
  </div>
);

const MdxH1 = ({ children, ...props }: ComponentPropsWithoutRef<"h1">) => (
  <h1
    className="text-2xl leading-tight font-semibold text-balance not-first:mt-10"
    {...props}
  >
    {children}
  </h1>
);

const MdxH2 = ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => (
  <h2
    className="text-xl leading-tight font-semibold text-balance not-first:mt-10"
    {...props}
  >
    {children}
  </h2>
);

const MdxH3 = ({ children, ...props }: ComponentPropsWithoutRef<"h3">) => (
  <h3
    className="text-base leading-tight font-medium text-balance not-first:mt-8"
    {...props}
  >
    {children}
  </h3>
);

const MdxH4 = ({ children, ...props }: ComponentPropsWithoutRef<"h4">) => (
  <h4
    className="text-sm leading-tight font-medium text-balance not-first:mt-7"
    {...props}
  >
    {children}
  </h4>
);

const MdxH5 = ({ children, ...props }: ComponentPropsWithoutRef<"h5">) => (
  <h5
    className="text-muted-foreground font-mono text-xs font-normal uppercase not-first:mt-7"
    {...props}
  >
    {children}
  </h5>
);

const MdxH6 = ({ children, ...props }: ComponentPropsWithoutRef<"h6">) => (
  <h6
    className="text-muted-foreground/70 font-mono text-[11px] font-normal uppercase not-first:mt-6"
    {...props}
  >
    {children}
  </h6>
);

const MdxParagraph = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"p">) => (
  <p
    className="text-muted-foreground/90 max-w-[70ch] text-[13.5px] leading-[1.62] tracking-normal text-pretty wrap-anywhere sm:text-sm sm:leading-7"
    {...props}
  >
    {children}
  </p>
);

const MdxLink = ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
  <a
    className="motion-link text-foreground decoration-border underline"
    {...props}
  >
    {children}
  </a>
);

const MdxStrong = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"strong">) => (
  <strong className="text-foreground font-medium" {...props}>
    {children}
  </strong>
);

const MdxUnorderedList = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"ul">) => (
  <ul
    className="text-muted-foreground/90 marker:text-muted-foreground/55 max-w-[70ch] list-disc space-y-1.5 pl-4 text-[13.5px] leading-[1.62] tracking-normal text-pretty sm:text-sm sm:leading-7"
    {...props}
  >
    {children}
  </ul>
);

const MdxOrderedList = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"ol">) => (
  <ol
    className="text-muted-foreground/90 marker:text-muted-foreground/55 max-w-[70ch] list-decimal space-y-1.5 pl-4 text-[13.5px] leading-[1.62] tracking-normal text-pretty marker:font-mono marker:text-[11px] sm:text-sm sm:leading-7"
    {...props}
  >
    {children}
  </ol>
);

const MdxListItem = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"li">) => (
  <li
    className="[&>ol]:mt-2 [&>ol]:space-y-1.5 [&>ul]:mt-2 [&>ul]:space-y-1.5 [&>ul]:pl-4"
    {...props}
  >
    {children}
  </li>
);

const MdxBlockquote = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"blockquote">) => (
  <blockquote
    className="border-border/55 text-muted-foreground/85 max-w-[80ch] border-l pl-4 text-[11.5px] leading-5 tracking-normal sm:text-xs sm:leading-6 [&_p]:max-w-none [&_p]:text-[11.5px] [&_p]:leading-5 [&_p]:text-inherit sm:[&_p]:text-xs sm:[&_p]:leading-6"
    {...props}
  >
    {children}
  </blockquote>
);

const MdxCode = ({ children, ...props }: ComponentPropsWithoutRef<"code">) => {
  const { className, ...rest } = props;

  return (
    <code
      className={cn(
        "font-mono",
        className
          ? "text-[0.92em]"
          : "text-foreground text-[0.85em] wrap-break-word"
      )}
      {...rest}
    >
      {children}
    </code>
  );
};

const MdxPre = ({ children, ...props }: ComponentPropsWithoutRef<"pre">) => {
  const { className, style, ...rest } = props;

  return (
    <div className="border-border/80 bg-foreground/2.5 max-w-full overflow-hidden border">
      <pre
        className={cn(
          "max-w-full overflow-x-auto p-3.5 font-mono text-[11.5px] leading-5 tracking-normal tab-2 sm:p-5 sm:text-xs sm:leading-6 [&_code]:grid [&_code]:min-w-max [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:break-normal [&_code]:text-inherit",
          className
        )}
        style={style}
        {...rest}
      >
        {children}
      </pre>
    </div>
  );
};

const MdxDivider = (props: ComponentPropsWithoutRef<"hr">) => (
  <div className="max-w-[70ch] py-4 sm:py-4">
    <hr className="bg-border/80 h-px border-0" {...props} />
  </div>
);

const MdxTable = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"table">) => (
  <div className="border-border/70 max-w-full overflow-x-auto border">
    <table
      className="w-full min-w-136 border-collapse text-left text-sm sm:min-w-0"
      {...props}
    >
      {children}
    </table>
  </div>
);

const MdxTableHead = (props: ComponentPropsWithoutRef<"thead">) => (
  <thead className="border-border/70 border-b" {...props} />
);

const MdxTableBody = (props: ComponentPropsWithoutRef<"tbody">) => (
  <tbody {...props} />
);

const MdxTableHeadCell = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"th">) => (
  <th
    className="text-muted-foreground p-2.5 font-mono text-[11px] font-normal tracking-wide uppercase sm:p-3"
    {...props}
  >
    {children}
  </th>
);

const MdxTableCell = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"td">) => (
  <td
    className="border-border/40 text-muted-foreground/90 border-t p-2.5 text-[12.5px] sm:p-3 sm:text-sm"
    {...props}
  >
    {children}
  </td>
);

export const mdxComponents = {
  a: MdxLink,
  blockquote: MdxBlockquote,
  code: MdxCode,
  h1: MdxH1,
  h2: MdxH2,
  h3: MdxH3,
  h4: MdxH4,
  h5: MdxH5,
  h6: MdxH6,
  hr: MdxDivider,
  li: MdxListItem,
  ol: MdxOrderedList,
  p: MdxParagraph,
  pre: MdxPre,
  strong: MdxStrong,
  table: MdxTable,
  tbody: MdxTableBody,
  td: MdxTableCell,
  th: MdxTableHeadCell,
  thead: MdxTableHead,
  ul: MdxUnorderedList,
};
