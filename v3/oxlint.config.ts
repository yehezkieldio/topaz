import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  ignorePatterns: [...(core.ignorePatterns ?? []), "drizzle/**"],
  overrides: [
    {
      // The full-schema barrel is required so a single `schema` object can be
      // handed to drizzle()'s relational query API (server/db/client.ts).
      files: ["src/server/db/schema/index.ts"],
      rules: {
        "oxc/no-barrel-file": "off",
      },
    },
    {
      // @tanstack/react-virtual's virtualizer intentionally returns fresh
      // function references (measureElement, getVirtualItems) each render --
      // this is the documented, unavoidable React Compiler interaction noted
      // in 02_stack/05_advanced_react_patterns.md, not a bug to work around.
      files: ["src/features/library/components/library-list-virtualized.tsx"],
      rules: {
        "react/incompatible-library": "off",
      },
    },
    {
      // Vendored shadcn/ui primitives (`bunx shadcn add ...`), left in the
      // upstream `function X()` shape so a future `shadcn add --overwrite`
      // stays a clean diff -- these are never hand-authored against this
      // project's arrow-function convention.
      files: ["src/components/ui/**"],
      rules: {
        "eslint/func-style": "off",
        "eslint/no-use-before-define": "off",
        "eslint/sort-keys": "off",
        "import/consistent-type-specifier-style": "off",
        "react/function-component-definition": "off",
      },
    },
  ],
});
