import { notes as noteDocs } from "fumadocs-mdx:collections/server";

const MDX_EXTENSION_REGEX = /\.mdx?$/u;
const NON_WORD_REGEX = /\s+/gu;

const noteSlug = (path: string) => path.replace(MDX_EXTENSION_REGEX, "");

const normalizeTag = (tag: string) =>
  tag.trim().toLowerCase().replace(NON_WORD_REGEX, "-");

const withNoteRuntimeFields = (note: (typeof noteDocs)[number]) => ({
  ...note,
  date: note.date ?? "",
  slug: noteSlug(note.info.path),
  tags: note.tags.map(normalizeTag),
});

type Note = ReturnType<typeof withNoteRuntimeFields>;

const sortNotes = (a: Note, b: Note) =>
  b.date.localeCompare(a.date) || a.title.localeCompare(b.title);

const notes = noteDocs.map(withNoteRuntimeFields).toSorted(sortNotes);
const notesBySlug = new Map(notes.map((note) => [note.slug, note]));

export const getNotes = () => notes;

export const getNote = (slug: string) => notesBySlug.get(slug);
