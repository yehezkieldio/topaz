import "server-only";
import { eq, sql } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { taxonomyKind, taxonomyTerm } from "@/server/db/schema";
import { appendOplogEntry } from "@/server/sync/oplog";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0] | typeof dbClient;

const normalize = (value: string) => value.trim().toLowerCase();

const slugify = (value: string) =>
  normalize(value)
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/**
 * Indexes a term into taxonomy_term_fts (src/server/db/search-index.ts) for
 * the first time -- call this once, right after the row itself is
 * inserted, never as part of a rename. See removeTermFromFts's doc for why
 * insert and delete can't share one delete-then-insert helper here the way
 * a naive "upsert" would suggest.
 */
export const insertTermFts = async (
  tx: Tx,
  termId: string,
  name: string
): Promise<void> => {
  await tx.run(
    sql`insert into taxonomy_term_fts(rowid, name) select rowid, ${name} from taxonomy_term where id = ${termId}`
  );
};

/**
 * Removes a term's existing entry from taxonomy_term_fts -- call this
 * BEFORE updating taxonomy_term's row, never after, and never for a row
 * that hasn't been indexed yet (a fresh insert; use insertTermFts instead).
 *
 * Both orderings matter and were verified empirically (not assumed)
 * against Bun's bundled SQLite (3.51.2): an FTS5 external-content table's
 * DELETE reads the content table's *current* row to know which trigrams to
 * remove. If the content row was already updated to its new value before
 * this runs, FTS5 computes trigrams for the wrong string and throws
 * `SQLITE_CORRUPT_VTAB` ("database disk image is malformed") -- a
 * misleading error for what's actually an ordering bug, not real
 * corruption. The same error occurs deleting a rowid that was never
 * inserted into the index at all, which is why this is never called for a
 * brand-new row.
 */
export const removeTermFromFts = async (
  tx: Tx,
  termId: string
): Promise<void> => {
  await tx.run(
    sql`delete from taxonomy_term_fts where rowid = (select rowid from taxonomy_term where id = ${termId})`
  );
};

export interface TermRow {
  id: string;
  publicId: string;
  version: number;
}

export const findTermByPublicId = async (
  tx: Tx,
  publicId: string
): Promise<TermRow | undefined> => {
  const [row] = await tx
    .select({
      id: taxonomyTerm.id,
      publicId: taxonomyTerm.publicId,
      version: taxonomyTerm.version,
    })
    .from(taxonomyTerm)
    .where(eq(taxonomyTerm.publicId, publicId))
    .limit(1);
  return row;
};

export const findKindBySlug = async (tx: Tx, slug: string) => {
  const [row] = await tx
    .select({ id: taxonomyKind.id })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, slug))
    .limit(1);
  return row;
};

export const renameTerm = async (
  tx: Tx,
  termId: string,
  currentVersion: number,
  name: string
) => {
  const trimmed = name.trim();
  const normalizedName = normalize(trimmed);
  const slug = slugify(trimmed);
  const version = currentVersion + 1;

  // Must run before the update below, not after -- see removeTermFromFts's
  // doc.
  await removeTermFromFts(tx, termId);

  const rows = await tx
    .update(taxonomyTerm)
    .set({ name: trimmed, normalizedName, slug, version })
    .where(eq(taxonomyTerm.id, termId))
    .returning({
      id: taxonomyTerm.publicId,
      label: taxonomyTerm.name,
      version: taxonomyTerm.version,
    });
  await insertTermFts(tx, termId, trimmed);
  await appendOplogEntry(tx, {
    columnDiffs: { name: trimmed, normalizedName, slug, version },
    rowId: termId,
    tableName: "taxonomy_term",
  });
  return rows;
};

export const changeTermKind = async (
  tx: Tx,
  termId: string,
  currentVersion: number,
  taxonomyKindId: string
) =>
  await tx
    .update(taxonomyTerm)
    .set({ taxonomyKindId, version: currentVersion + 1 })
    .where(eq(taxonomyTerm.id, termId))
    .returning({ id: taxonomyTerm.publicId, version: taxonomyTerm.version });
