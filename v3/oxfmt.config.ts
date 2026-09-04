import { defineConfig } from "oxfmt";
import base from "ultracite/oxfmt";

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "drizzle/**"],
});
