import type { Metadata } from "next";

import {
  ContentList,
  ContentMeta,
  ContentRow,
  ContentTags,
  ContentTitleLink,
  EmptyLine,
  PageHeader,
  PageSection,
} from "@/components/site/content-primitives";
import { getNotes } from "@/lib/notes";

export const metadata: Metadata = {
  description:
    "References, quick notes, and snippets by Yehezkiel Dio Sinolungan.",
  title: "Notes",
};

const NotesPage = () => {
  const notes = getNotes();

  return (
    <PageSection>
      <PageHeader
        description="References, quick notes, and snippets."
        title="Notes"
      />

      <div className="pt-5 sm:pt-6">
        <ContentList
          className="pt-5 sm:pt-7"
          empty={
            <EmptyLine>
              Notes will show up here once they are added, eventually.
            </EmptyLine>
          }
          isEmpty={notes.length === 0}
          withTopRule
        >
          {notes.map((note, index) => (
            <ContentRow
              delayIndex={index}
              key={note.slug}
              withRule={index < notes.length - 1}
              withSpacing
            >
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h2 className="min-w-0 text-[13px] leading-tight font-medium tracking-normal sm:text-sm sm:leading-tight">
                  <ContentTitleLink href={`/writing/notes/${note.slug}`}>
                    {note.title}
                  </ContentTitleLink>
                </h2>
                {note.date ? <ContentMeta>{note.date}</ContentMeta> : null}
              </div>

              {note.description ? (
                <p className="text-muted-foreground max-w-xl text-[13.5px] leading-[1.55] tracking-normal sm:text-sm sm:leading-6">
                  {note.description}
                </p>
              ) : null}

              <ContentTags tags={note.tags} />
            </ContentRow>
          ))}
        </ContentList>
      </div>
    </PageSection>
  );
};

export default NotesPage;
