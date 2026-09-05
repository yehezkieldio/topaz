import { db } from "./client";
import { sourcePlatform } from "./schema/catalog";
import { taxonomyKind } from "./schema/taxonomy";

const TAXONOMY_KINDS = [
  { name: "Fandom", slug: "fandom" },
  { name: "Character", slug: "character" },
  { name: "Relationship", slug: "relationship" },
  { name: "Genre", slug: "genre" },
  { name: "Trope", slug: "trope" },
  { name: "Warning", slug: "warning" },
  { name: "Source Category", slug: "source_category" },
  { name: "Format", slug: "format" },
  { name: "Tone", slug: "tone" },
  { name: "Custom", slug: "custom" },
] as const;

const SOURCE_PLATFORMS = [
  {
    baseUrl: "https://archiveofourown.org",
    name: "Archive of Our Own",
    slug: "ao3",
  },
  {
    baseUrl: "https://www.fanfiction.net",
    name: "FanFiction.Net",
    slug: "ffn",
  },
  { baseUrl: "https://www.wattpad.com", name: "Wattpad", slug: "wattpad" },
  {
    baseUrl: "https://www.spacebattles.com",
    name: "SpaceBattles",
    slug: "spacebattles",
  },
  {
    baseUrl: "https://www.royalroad.com",
    name: "RoyalRoad",
    slug: "royalroad",
  },
  { baseUrl: "https://www.webnovel.com", name: "WebNovel", slug: "webnovel" },
  {
    baseUrl: "https://www.scribblehub.com",
    name: "ScribbleHub",
    slug: "scribblehub",
  },
  { baseUrl: "https://novelbin.com", name: "NovelBin", slug: "novelbin" },
] as const;

await db
  .insert(taxonomyKind)
  .values([...TAXONOMY_KINDS])
  .onConflictDoNothing();
await db
  .insert(sourcePlatform)
  .values([...SOURCE_PLATFORMS])
  .onConflictDoNothing();

console.log(
  `Seeded ${TAXONOMY_KINDS.length} taxonomy kinds and ${SOURCE_PLATFORMS.length} source platforms.`
);

process.exit(0);
