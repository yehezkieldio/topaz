import { db } from "./client";
import { sourcePlatform } from "./schema/catalog";
import { taxonomyKind } from "./schema/taxonomy";

/**
 * `id` is given explicitly here (the slug, prefixed to stay readable and
 * collision-free against any future non-reference-table id) instead of
 * left to idColumns()'s crypto.randomUUID() default. This is a seeded
 * reference table run independently on every device
 * (08_sync/00_oplog_and_clock.md's local-first model, not a shared
 * database) -- a random id would make two devices' "custom" taxonomy kind
 * two different rows with two different ids, and a taxonomy_term created
 * on one device referencing its own random id would fail its foreign key
 * the moment it synced to a device whose "custom" kind has a different id
 * (found running an actual two-device sync test -- see
 * docs/BUN_SQLITE_NEXT_BUILD.md). A deterministic id derived from the slug
 * makes every device's seed produce the identical row by construction,
 * with no need to sync this table through the oplog at all.
 */
const TAXONOMY_KINDS = [
  { id: "taxonomy-kind:fandom", name: "Fandom", slug: "fandom" },
  { id: "taxonomy-kind:character", name: "Character", slug: "character" },
  {
    id: "taxonomy-kind:relationship",
    name: "Relationship",
    slug: "relationship",
  },
  { id: "taxonomy-kind:genre", name: "Genre", slug: "genre" },
  { id: "taxonomy-kind:trope", name: "Trope", slug: "trope" },
  { id: "taxonomy-kind:warning", name: "Warning", slug: "warning" },
  {
    id: "taxonomy-kind:source_category",
    name: "Source Category",
    slug: "source_category",
  },
  { id: "taxonomy-kind:format", name: "Format", slug: "format" },
  { id: "taxonomy-kind:tone", name: "Tone", slug: "tone" },
  { id: "taxonomy-kind:custom", name: "Custom", slug: "custom" },
] as const;

const SOURCE_PLATFORMS = [
  {
    baseUrl: "https://archiveofourown.org",
    id: "source-platform:ao3",
    name: "Archive of Our Own",
    slug: "ao3",
  },
  {
    baseUrl: "https://www.fanfiction.net",
    id: "source-platform:ffn",
    name: "FanFiction.Net",
    slug: "ffn",
  },
  {
    baseUrl: "https://www.wattpad.com",
    id: "source-platform:wattpad",
    name: "Wattpad",
    slug: "wattpad",
  },
  {
    baseUrl: "https://www.spacebattles.com",
    id: "source-platform:spacebattles",
    name: "SpaceBattles",
    slug: "spacebattles",
  },
  {
    baseUrl: "https://www.royalroad.com",
    id: "source-platform:royalroad",
    name: "RoyalRoad",
    slug: "royalroad",
  },
  {
    baseUrl: "https://www.webnovel.com",
    id: "source-platform:webnovel",
    name: "WebNovel",
    slug: "webnovel",
  },
  {
    baseUrl: "https://www.scribblehub.com",
    id: "source-platform:scribblehub",
    name: "ScribbleHub",
    slug: "scribblehub",
  },
  {
    baseUrl: "https://novelbin.com",
    id: "source-platform:novelbin",
    name: "NovelBin",
    slug: "novelbin",
  },
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
