import type { ComponentType, SVGProps } from "react";

const GithubGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <title>GitHub</title>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.28 5.69.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z" />
  </svg>
);

const LinkedinGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <title>LinkedIn</title>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.25 2.37 4.25 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
);

const XGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <title>X</title>
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.22-6.83-5.97 6.83H1.66l7.73-8.84L1.24 2.25h6.83l4.72 6.24 5.45-6.24Zm-1.16 17.52h1.83L7.02 4.13H5.06l12.02 15.64Z" />
  </svg>
);

export interface PageSocialLink {
  href: string;
  label: string;
}

const getHostname = (href: string) => {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const getSocialIcon = ({
  href,
  label,
}: PageSocialLink): ComponentType<SVGProps<SVGSVGElement>> | null => {
  const normalizedLabel = label.toLowerCase();
  const hostname = getHostname(href);

  if (normalizedLabel === "github" || hostname === "github.com") {
    return GithubGlyph;
  }

  if (
    normalizedLabel === "linkedin" ||
    hostname === "linkedin.com" ||
    hostname === "www.linkedin.com"
  ) {
    return LinkedinGlyph;
  }

  if (
    normalizedLabel === "x" ||
    normalizedLabel === "twitter" ||
    hostname === "x.com" ||
    hostname === "twitter.com"
  ) {
    return XGlyph;
  }

  return null;
};

const socialIconClassName =
  "size-3.5 opacity-80 transition-opacity duration-200 ease-(--ease-ui) group-hover:opacity-100";

const PageSocialIcon = ({ link }: { link: PageSocialLink }) => {
  switch (getSocialIcon(link)) {
    case GithubGlyph: {
      return <GithubGlyph aria-hidden="true" className={socialIconClassName} />;
    }
    case LinkedinGlyph: {
      return (
        <LinkedinGlyph aria-hidden="true" className={socialIconClassName} />
      );
    }
    case XGlyph: {
      return <XGlyph aria-hidden="true" className={socialIconClassName} />;
    }
    default: {
      return null;
    }
  }
};

export const PageSocialContact = ({
  delayIndex = 0,
  email,
  links,
}: {
  delayIndex?: number;
  email: string;
  links: PageSocialLink[];
}) => (
  <section
    className="project-row-enter text-muted-foreground max-w-xl space-y-2 text-[15px] leading-6 tracking-normal sm:space-y-2.5 sm:text-base"
    style={{ animationDelay: `${delayIndex * 85}ms` }}
  >
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span>Find me on</span>
      {links.map((link) => (
        <a
          className="motion-link motion-social-link group text-foreground/88 inline-flex items-center gap-1.5 border-b px-1"
          href={link.href}
          key={link.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          <PageSocialIcon link={link} />
          <span>{link.label}</span>
        </a>
      ))}
    </p>
    <p>
      <span>or mail me at </span>
      <a className="text-muted-foreground font-mono" href={`mailto:${email}`}>
        {email}
      </a>
    </p>
  </section>
);
