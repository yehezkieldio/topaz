import type { Metadata } from "next";

import {
  SiteContentList,
  SiteContentMeta,
  SiteContentRow,
  SiteContentTags,
  SiteContentTitleLink,
  SiteEmptyLine,
  SiteHeader,
  SiteSection,
} from "@/features/site/components/site-primitives";
import { getNotes } from "@/features/site/server/notes";

export const metadata: Metadata = {
  description:
    "References, quick notes, and snippets by Yehezkiel Dio Sinolungan.",
  title: "Notes",
};

const NotesPage = () => {
  const notes = getNotes();

  return (
    <SiteSection>
      <SiteHeader
        description="References, quick notes, and snippets."
        title="Notes"
      />

      <div className="pt-5 sm:pt-6">
        <SiteContentList
          className="pt-5 sm:pt-7"
          empty={
            <SiteEmptyLine>
              Notes will show up here once they are added, eventually.
            </SiteEmptyLine>
          }
          isEmpty={notes.length === 0}
          withTopRule
        >
          {notes.map((note, index) => (
            <SiteContentRow
              delayIndex={index}
              key={note.slug}
              withRule={index < notes.length - 1}
              withSpacing
            >
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h2 className="min-w-0 text-[13px] leading-tight font-medium tracking-normal sm:text-sm sm:leading-tight">
                  <SiteContentTitleLink href={`/writing/notes/${note.slug}`}>
                    {note.title}
                  </SiteContentTitleLink>
                </h2>
                {note.date ? (
                  <SiteContentMeta>{note.date}</SiteContentMeta>
                ) : null}
              </div>

              {note.description ? (
                <p className="text-muted-foreground max-w-xl text-[13.5px] leading-[1.55] tracking-normal sm:text-sm sm:leading-6">
                  {note.description}
                </p>
              ) : null}

              <SiteContentTags tags={note.tags} />
            </SiteContentRow>
          ))}
        </SiteContentList>
      </div>
    </SiteSection>
  );
};

export default NotesPage;
