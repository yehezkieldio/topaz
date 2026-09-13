import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mdxComponents } from "@/features/site/components/mdx-component-map";
import {
  ArticleHeader,
  MdxBody,
} from "@/features/site/components/site-mdx-content";
import { SiteContentMeta } from "@/features/site/components/site-primitives";
import { getNote, getNotes } from "@/features/site/server/notes";

interface NotePageProps {
  params: Promise<{ slug: string }>;
}

export const generateStaticParams = () => {
  const notes = getNotes();

  // Cache Components requires generateStaticParams to return at least one
  // param -- fall back to a placeholder that always 404s via notFound()
  // below when there are no notes yet, per Next.js's documented pattern.
  return notes.length > 0
    ? notes.map((note) => ({ slug: note.slug }))
    : [{ slug: "__placeholder__" }];
};

export const generateMetadata = async ({
  params,
}: NotePageProps): Promise<Metadata> => {
  const { slug } = await params;
  const note = getNote(slug);

  if (!note) {
    return { title: "Note" };
  }

  return { description: note.description, title: note.title };
};

const NotePage = async ({ params }: NotePageProps) => {
  const { slug } = await params;
  const note = getNote(slug);

  if (!note) {
    notFound();
  }

  const Body = note.body;

  return (
    <article className="space-y-9">
      <ArticleHeader
        description={note.description}
        meta={
          note.date ? <SiteContentMeta>{note.date}</SiteContentMeta> : undefined
        }
        tags={note.tags}
        title={note.title}
      />

      <MdxBody>
        <Body components={mdxComponents} />
      </MdxBody>
    </article>
  );
};

export default NotePage;
