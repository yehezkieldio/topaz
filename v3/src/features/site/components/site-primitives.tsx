import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const SiteSection = ({ children }: { children: ReactNode }) => (
  <section className="space-y-7 sm:space-y-8">{children}</section>
);

export const SiteHeader = ({
  children,
  description,
  meta,
  title,
  withRule = false,
}: {
  children?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  title: string;
  withRule?: boolean;
}) => (
  <header
    className={cn(
      "project-row-enter space-y-2.5 sm:space-y-3",
      withRule && "border-border border-b pb-7 sm:pb-8"
    )}
  >
    {meta}
    <h1 className="text-[1.35rem] leading-[1.14] font-semibold tracking-normal text-balance sm:text-2xl sm:leading-tight">
      {title}
    </h1>
    {description ? (
      <p className="text-muted-foreground/95 max-w-xl text-[15px] leading-6 tracking-normal sm:text-base sm:leading-7">
        {description}
      </p>
    ) : null}
    {children}
  </header>
);

export const SiteIntro = ({
  delayStart = 1,
  paragraphs,
}: {
  delayStart?: number;
  paragraphs: string[];
}) => (
  <div className="text-muted-foreground/90 max-w-xl space-y-3.5 text-[15px] leading-6 tracking-normal sm:space-y-4 sm:text-base sm:leading-7">
    {paragraphs.map((paragraph, index) => (
      <p
        className="project-row-enter"
        key={paragraph}
        style={{ animationDelay: `${(delayStart + index) * 85}ms` }}
      >
        {paragraph}
      </p>
    ))}
  </div>
);

export const SiteContentList = ({
  children,
  className,
  empty,
  isEmpty = false,
  withTopRule = false,
}: {
  children: ReactNode;
  className?: string;
  empty?: ReactNode;
  isEmpty?: boolean;
  withTopRule?: boolean;
}) => {
  if (isEmpty) {
    return empty ?? null;
  }

  return (
    <div
      className={cn(
        withTopRule && "border-border space-y-7 border-t pt-6",
        className
      )}
    >
      {children}
    </div>
  );
};

export const SiteContentRow = ({
  children,
  delayIndex = 0,
  withRule = true,
  withSpacing = withRule,
}: {
  children: ReactNode;
  delayIndex?: number;
  withRule?: boolean;
  withSpacing?: boolean;
}) => (
  <article
    className={cn(
      "project-row-enter motion-row space-y-2 transition-[transform] duration-200 ease-(--ease-ui)",
      withSpacing && "py-5 sm:py-7",
      withRule && "border-border border-b"
    )}
    style={{ animationDelay: `${delayIndex * 85}ms` }}
  >
    {children}
  </article>
);

export const SiteContentTitleLink = ({
  children,
  href,
  isExternal = false,
}: {
  children: ReactNode;
  href: string;
  isExternal?: boolean;
}) => {
  if (isExternal) {
    return (
      <a
        className="motion-link motion-title-link"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      className="motion-link motion-title-link"
      href={href}
      prefetch={false}
    >
      {children}
    </Link>
  );
};

export const SiteContentMeta = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "text-muted-foreground/70 font-mono text-[11px] leading-none tracking-normal sm:text-xs",
      className
    )}
  >
    {children}
  </p>
);

export const SiteContentTags = ({
  tags,
  limit = 5,
}: {
  tags: string[];
  limit?: number;
}) => {
  if (tags.length === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground/70 font-mono text-[10.5px] leading-4 tracking-normal sm:text-[11px]">
      {tags.slice(0, limit).join(" / ")}
    </p>
  );
};

export const SiteEmptyLine = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground py-8 text-sm">{children}</p>
);
