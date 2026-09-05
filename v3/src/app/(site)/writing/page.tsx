import type { Metadata } from "next";

import {
  SiteContentList,
  SiteContentMeta,
  SiteContentRow,
  SiteContentTags,
  SiteContentTitleLink,
  SiteHeader,
  SiteSection,
} from "@/features/site/components/site-primitives";
import { getMediumPosts } from "@/features/site/server/medium";

export const metadata: Metadata = {
  description: "Writing by Yehezkiel Dio Sinolungan, mirrored from Medium.",
  title: "Writing",
};

const MEDIUM_PROFILE_URL = "https://medium.com/@yehezkieldio";

const WritingPage = async () => {
  const posts = await getMediumPosts();

  return (
    <SiteSection>
      <SiteHeader
        description={
          <>
            Pulled from my{" "}
            <a
              className="motion-link motion-title-link underline"
              href={MEDIUM_PROFILE_URL}
            >
              Medium
            </a>{" "}
            account.
          </>
        }
        title="Writing"
      />

      <div className="pt-5 sm:pt-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Medium posts could not be loaded right now.
          </p>
        ) : (
          <SiteContentList
            className="space-y-9 pt-10 sm:space-y-10 sm:pt-12"
            withTopRule
          >
            {posts.map((post, index) => (
              <SiteContentRow
                delayIndex={index}
                key={post.link}
                withRule={false}
              >
                <div className="flex flex-col items-start justify-between gap-x-4 gap-y-1 sm:flex-row sm:items-baseline">
                  <SiteContentMeta className="pb-1 sm:pb-0">
                    {post.publishedLabel}
                  </SiteContentMeta>
                  <h2 className="min-w-0 text-[12.5px] leading-tight font-medium tracking-normal sm:order-first sm:text-sm sm:leading-tight">
                    <SiteContentTitleLink href={post.link} isExternal>
                      {post.title}
                    </SiteContentTitleLink>
                  </h2>
                </div>
                <p className="text-muted-foreground text-[13px] leading-[1.55] tracking-normal sm:text-sm sm:leading-6">
                  {post.excerpt}
                </p>
                <SiteContentTags limit={4} tags={post.categories} />
              </SiteContentRow>
            ))}
          </SiteContentList>
        )}
      </div>
    </SiteSection>
  );
};

export default WritingPage;
