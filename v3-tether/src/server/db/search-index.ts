import type { Database } from "bun:sqlite";

interface FtsIndexDefinition {
  readonly virtualTableName: string;
  readonly contentTable: string;
  readonly columns: readonly string[];
}

/**
 * One FTS5 external-content virtual table per searchable surface
 * (07_backend/03_search_and_filtering.md), replacing the pg_trgm GIN indexes
 * the Postgres-era schema declared on these same columns. "External content"
 * means the virtual table stores only the trigram index, not a duplicate
 * copy of the text -- it's joined back to the real row via `rowid`.
 */
export const FTS_INDEXES: readonly FtsIndexDefinition[] = [
  {
    columns: ["title", "description", "summary"],
    contentTable: "work",
    virtualTableName: "work_fts",
  },
  {
    columns: ["name"],
    contentTable: "taxonomy_term",
    virtualTableName: "taxonomy_term_fts",
  },
  {
    columns: ["name"],
    contentTable: "contributor",
    virtualTableName: "contributor_fts",
  },
  {
    columns: ["url"],
    contentTable: "work_source",
    virtualTableName: "work_source_fts",
  },
] as const;

const createFtsTableSql = ({
  virtualTableName,
  contentTable,
  columns,
}: FtsIndexDefinition): string => `
  create virtual table if not exists ${virtualTableName} using fts5(
    ${columns.join(", ")},
    content='${contentTable}',
    content_rowid='rowid',
    tokenize='trigram case_sensitive 0'
  );
`;

/**
 * Creates every FTS5 virtual table above, idempotently. Called once at
 * startup alongside client.ts's pragma setup. These aren't expressible
 * through Drizzle's sqliteTable() -- there's no virtual-table builder in
 * sqlite-core -- so they're plain DDL run directly against the handle
 * rather than part of the typed schema/drizzle-kit's migration diffing.
 *
 * External-content FTS5 tables don't require their content table to exist
 * yet at creation time (the reference is resolved lazily, at query/rebuild
 * time), so this is safe to run before migrations have created `work`,
 * `taxonomy_term`, `contributor`, or `work_source`.
 *
 * Left empty here on purpose: keeping each table's FTS index in sync with
 * its content table is an explicit application-level write (in the same
 * transaction as the row write and the oplog append, 08_sync/00_oplog_and_clock.md)
 * done by each feature's mutation actions, not a SQLite trigger -- see the
 * rationale in 07_backend/03_search_and_filtering.md.
 *
 * Whoever wires up FTS indexing for work/contributor/work_source (taxonomy_term
 * is the only one done so far, in features/taxonomy/server/repository/terms.ts):
 * an external-content FTS5 table's DELETE reads the content table's *current*
 * row to compute which trigrams to remove. Deleting a row's FTS entry AFTER
 * the content table has already been updated to its new value (or deleting a
 * rowid that was never indexed at all) throws `SQLITE_CORRUPT_VTAB`
 * ("database disk image is malformed") -- verified empirically against Bun's
 * bundled SQLite (3.51.2), not a hypothetical. The correct order on an
 * update is: delete the FTS entry first, then update the content row, then
 * insert the FTS entry with the new value -- never delete-then-insert after
 * the content row already changed, and never call delete at all for a
 * brand-new row (insert only). See removeTermFromFts/insertTermFts in
 * terms.ts for the reference implementation.
 */
export const ensureSearchIndexes = (sqlite: Database): void => {
  for (const index of FTS_INDEXES) {
    sqlite.exec(createFtsTableSql(index));
  }
};
