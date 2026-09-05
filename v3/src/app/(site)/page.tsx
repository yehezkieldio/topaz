import Link from "next/link";
import { Suspense } from "react";

import {
  PageHeader,
  PageIntro,
  PageSection,
} from "@/components/site/content-primitives";
import { PageSocialContact } from "@/components/site/social-contact";
import type { PageSocialLink } from "@/components/site/social-contact";
import {
  FeaturedWorks,
  FeaturedWorksSkeleton,
} from "@/features/library/components/featured-works";
import {
  LibraryStats,
  LibraryStatsSkeleton,
} from "@/features/library/components/library-stats";

const heading = {
  description: "Software Engineer",
  title: "Yehezkiel Dio Sinolungan",
};

const intro = [
  "Generalist software engineer, focused on building accessible and high-performance digital systems. I primarily work across the web stack, with an emphasis on reliability, resiliency, and system design.",
  "Alongside client and infrastructure work, I maintain Topaz here -- a personal, self-hosted tracker for the fanfiction, webnovels, and online fiction I read.",
];

const contact = {
  email: "yehezkieldio@proton.me",
  links: [
    { href: "https://github.com/yehezkieldio", label: "GitHub" },
    { href: "https://www.linkedin.com/in/yehezkieldio", label: "LinkedIn" },
    { href: "https://x.com/yehezkieldio", label: "X" },
  ] satisfies PageSocialLink[],
};

const Home = () => (
  <PageSection>
    <PageHeader description={heading.description} title={heading.title} />
    <PageIntro paragraphs={intro} />
    <PageSocialContact
      delayIndex={intro.length + 1}
      email={contact.email}
      links={contact.links}
    />

    <div
      className="project-row-enter border-border space-y-3 border-t pt-6"
      style={{ animationDelay: `${(intro.length + 2) * 85}ms` }}
    >
      <Suspense fallback={<LibraryStatsSkeleton />}>
        <LibraryStats />
      </Suspense>
      <Suspense fallback={<FeaturedWorksSkeleton />}>
        <FeaturedWorks />
      </Suspense>
      <Link
        className="motion-link motion-title-link inline-block text-[15px] font-medium sm:text-base"
        href="/library"
      >
        Explore the library &rarr;
      </Link>
    </div>
  </PageSection>
);

export default Home;
