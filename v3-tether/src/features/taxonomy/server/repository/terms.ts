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
 * Keeps taxonomy_term_fts (src/server/db/search-index.ts) in step with a
 * single term's name, delete-then-insert rather than UPDATE -- the simplest
 * approach that's correct regardless of the running SQLite build's FTS5
 * UPDATE-on-virtual-table support. Called from the same write path as the
 * row mutation itself (07_backend/03_search_and_filtering.md's "explicit,
 * not a trigger" rule), though not yet inside the same transaction/oplog
 * append -- that lands with 08_sync/00_oplog_and_clock.md's write pipeline.
 */
export const indexTermFts = async (
  tx: Tx,
  termId: string,
  name: string
): Promise<void> => {
  await tx.run(
    sql`delete from taxonomy_term_fts where rowid = (select rowid from taxonomy_term where id = ${termId})`
  );
  await tx.run(
    sql`insert into taxonomy_term_fts(rowid, name) select rowid, ${name} from taxonomy_term where id = ${termId}`
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
  const rows = await tx
    .update(taxonomyTerm)
    .set({ name: trimmed, normalizedName, slug, version })
    .where(eq(taxonomyTerm.id, termId))
    .returning({
      id: taxonomyTerm.publicId,
      label: taxonomyTerm.name,
      version: taxonomyTerm.version,
    });
  await indexTermFts(tx, termId, trimmed);
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
