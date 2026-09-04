import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

export const { docs: projects, meta: projectsMeta } = defineDocs({
  dir: "content/projects",
  docs: {
    schema: pageSchema.extend({
      external: z
        .array(z.object({ href: z.url(), label: z.string().min(1) }))
        .default([]),
      github: z.url().optional(),
      gitlab: z.url().optional(),
      hidden: z.boolean().default(false),
      note: z.boolean().default(true),
      projectSortDate: z.iso.date().optional(),
      projectStartedAt: z.iso.date(),
      tags: z.array(z.string()).default([]),
      website: z.url().optional(),
      year: z.string(),
    }),
  },
});

export const { docs: notes, meta: notesMeta } = defineDocs({
  dir: "content/notes",
  docs: {
    schema: pageSchema.extend({
      date: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      defaultColor: false,
      defaultLanguage: "plaintext",
      engine: "js",
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    },
  },
});
