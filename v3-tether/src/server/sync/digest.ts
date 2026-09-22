import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import type { db as dbClient } from "@/server/db/client";
import { db } from "@/server/db/client";
import {
  libraryEntry,
  readingState,
  taxonomyTerm,
  work,
  workSource,
} from "@/server/db/schema";
import { syncIntegrityCheck } from "@/server/db/schema/sync";

import { getDeviceIdentity } from "./device-identity";
import { signPayload } from "./protocol";

/**
 * The same closed five-table set apply.ts's per-table switch knows about
 * (08_sync/03_data_integrity_and_reconciliation.md) -- a digest is only
 * meaningful for a table both sides actually sync, and this list is what
 * keeps the digest side from silently drifting out of step with apply.ts's
 * own list if a table is ever added to one but not the other.
 */
export const SYNCED_TABLES = [
  "library_entry",
  "reading_state",
  "taxonomy_term",
  "work",
  "work_source",
] as const;
export type SyncedTableName = (typeof SYNCED_TABLES)[number];
const syncedTableNameSchema = z.enum(SYNCED_TABLES);

/**
 * Fixed number of id-hash buckets every table's rows are split into for
 * digest purposes (08_sync/03_data_integrity_and_reconciliation.md's Part 1
 * gives a flat per-table digest; this partitions it further so Part 2's
 * repair can narrow a mismatch to the rows that actually diverged instead
 * of always re-pulling the whole table). 64 is a starting point sized for
 * a personal-library row count (a few thousand rows), not a constant with
 * any other significance -- each bucket then holds roughly rowCount/64
 * rows, bounding how much a repair has to re-pull per mismatch found.
 */
export const BUCKET_COUNT = 64;

/**
 * Assigns a row to a bucket from its id alone, never its content --
 * bucket membership has to be identical on both devices for the same row
 * regardless of whether their copies of that row currently agree, or the
 * bucket-level comparison below breaks. A separate hash from
 * hashRowLanes's content hash, deliberately: hashing on id only means a
 * row's bucket never moves just because the row was edited.
 */
export const bucketForRowId = (rowId: string): number => {
  const digestBytes = createHash("sha256").update(rowId).digest();
  return digestBytes.readUInt32BE(0) % BUCKET_COUNT;
};

export interface BucketDigest {
  bucket: number;
  rowCount: number;
  digest: string;
}

export interface TableDigest {
  table: SyncedTableName;
  rowCount: number;
  digest: string;
  // Only buckets that actually hold at least one row on this side --
  // sparse, not a fixed 64-length array, so an empty table's digest stays
  // a tiny payload rather than 64 zeroed entries.
  buckets: BucketDigest[];
}

interface DigestRowInput {
  id: string;
  version: number | null;
  updatedAtMs: number;
}

/**
 * Per-row hash over (table, id, version, updated_at) only -- not the full
 * row -- since version/updated_at already change whenever any column does
 * (spec's Part 1), so hashing the full row buys nothing but more bytes to
 * hash. SHA-256 gives 32 bytes; read as two 32-bit unsigned lanes (not one
 * 64-bit BigInt read) so the combine step below can stay on plain JS
 * numbers -- see combineRows for why that matters here.
 */
const hashRowLanes = (
  tableName: SyncedTableName,
  row: DigestRowInput
): [number, number] => {
  const canonical = `${tableName}|${row.id}|${row.version ?? ""}|${row.updatedAtMs}`;
  const digestBytes = createHash("sha256").update(canonical).digest();
  return [digestBytes.readUInt32BE(0), digestBytes.readUInt32BE(4)];
};

// Largest prime below 2^32 -- modulus for the order-independent combine
// below. The spec (Part 1) names "XOR, or sum mod a large prime" as
// equivalent order-independent choices; sum-mod-prime is the one picked
// here (not XOR) so the combine can run on plain `number` lanes without
// BigInt -- this codebase's tsconfig target (ES2017) rejects BigInt
// literals, and this repo's lint config flags bitwise operators outright,
// so XOR would need either a literal-syntax workaround or a rule
// suppression for no actual benefit over the spec's own alternative.
const DIGEST_MODULUS = 4_294_967_291;

const laneDigest = (hi: number, lo: number): string =>
  `${hi.toString(16).padStart(8, "0")}${lo.toString(16).padStart(8, "0")}`;

/**
 * Sum-mod-prime-combines every row's two hash lanes into one table-level
 * digest, independently per lane -- order-independent (spec's Part 1:
 * two devices won't necessarily iterate rows in the same order, so the
 * digest must not depend on scan order to still catch a real mismatch),
 * and cheap since every intermediate sum stays well under
 * Number.MAX_SAFE_INTEGER (each lane is < 2^32, the modulus keeps the
 * running total < 2^32 too, so one addition per row never risks precision
 * loss). Rendered as two zero-padded hex lanes concatenated, giving ~64
 * bits of digest space like a single 64-bit hash would.
 *
 * Rows are first grouped into BUCKET_COUNT id-hash buckets (bucketForRowId)
 * and combined per bucket, then the bucket sums are combined again the same
 * way into the table-level digest -- modular addition is associative, so
 * this produces the exact same table-level digest a flat combine over every
 * row would, while also exposing each bucket's own digest for a repair step
 * to diff against a peer's buckets and find which rows actually diverged
 * without re-pulling the whole table.
 */
const combineRows = (
  tableName: SyncedTableName,
  rows: DigestRowInput[]
): TableDigest => {
  const rowsByBucket = new Map<number, DigestRowInput[]>();
  for (const row of rows) {
    const bucket = bucketForRowId(row.id);
    const bucketRows = rowsByBucket.get(bucket);
    if (bucketRows) {
      bucketRows.push(row);
    } else {
      rowsByBucket.set(bucket, [row]);
    }
  }

  const buckets: BucketDigest[] = [];
  let tableHi = 0;
  let tableLo = 0;

  for (const bucket of [...rowsByBucket.keys()].toSorted((a, b) => a - b)) {
    // SAFETY: bucket comes from rowsByBucket.keys() itself, so get() here
    // always hits.
    const bucketRows = rowsByBucket.get(bucket) as DigestRowInput[];
    let hi = 0;
    let lo = 0;
    for (const row of bucketRows) {
      const [rowHi, rowLo] = hashRowLanes(tableName, row);
      hi = (hi + rowHi) % DIGEST_MODULUS;
      lo = (lo + rowLo) % DIGEST_MODULUS;
    }
    buckets.push({
      bucket,
      digest: laneDigest(hi, lo),
      rowCount: bucketRows.length,
    });
    tableHi = (tableHi + hi) % DIGEST_MODULUS;
    tableLo = (tableLo + lo) % DIGEST_MODULUS;
  }

  return {
    buckets,
    digest: laneDigest(tableHi, tableLo),
    rowCount: rows.length,
    table: tableName,
  };
};

/**
 * Reads only the columns a digest needs (id, version, updated_at) rather
 * than full rows -- this is still a whole-table scan (the spec is explicit
 * that a digest check is strictly heavier than a normal oplog pull), but it
 * is not the full-row pull Part 2's reconciliation step does; that
 * distinction is the whole point of keeping detection cheap relative to
 * repair.
 */
const digestLibraryEntry = async (): Promise<TableDigest> => {
  const rows = await db
    .select({
      id: libraryEntry.id,
      updatedAt: libraryEntry.updatedAt,
      version: libraryEntry.version,
    })
    .from(libraryEntry);
  return combineRows(
    "library_entry",
    rows.map((row) => ({
      id: row.id,
      updatedAtMs: row.updatedAt.getTime(),
      version: row.version,
    }))
  );
};

const digestReadingState = async (): Promise<TableDigest> => {
  const rows = await db
    .select({
      libraryEntryId: readingState.libraryEntryId,
      updatedAt: readingState.updatedAt,
      version: readingState.version,
    })
    .from(readingState);
  return combineRows(
    "reading_state",
    rows.map((row) => ({
      id: row.libraryEntryId,
      updatedAtMs: row.updatedAt.getTime(),
      version: row.version,
    }))
  );
};

const digestTaxonomyTerm = async (): Promise<TableDigest> => {
  const rows = await db
    .select({
      id: taxonomyTerm.id,
      updatedAt: taxonomyTerm.updatedAt,
      version: taxonomyTerm.version,
    })
    .from(taxonomyTerm);
  return combineRows(
    "taxonomy_term",
    rows.map((row) => ({
      id: row.id,
      updatedAtMs: row.updatedAt.getTime(),
      version: row.version,
    }))
  );
};

const digestWork = async (): Promise<TableDigest> => {
  const rows = await db
    .select({ id: work.id, updatedAt: work.updatedAt, version: work.version })
    .from(work);
  return combineRows(
    "work",
    rows.map((row) => ({
      id: row.id,
      updatedAtMs: row.updatedAt.getTime(),
      version: row.version,
    }))
  );
};

/**
 * work_source now carries a real `version` column (schema/catalog.ts,
 * added alongside deleteWorkSourceAction), same as every other synced
 * table -- this used to hash on `updated_at` alone since no version column
 * existed yet, but that workaround is gone now that one does.
 */
const digestWorkSource = async (): Promise<TableDigest> => {
  const rows = await db
    .select({
      id: workSource.id,
      updatedAt: workSource.updatedAt,
      version: workSource.version,
    })
    .from(workSource);
  return combineRows(
    "work_source",
    rows.map((row) => ({
      id: row.id,
      updatedAtMs: row.updatedAt.getTime(),
      version: row.version,
    }))
  );
};

/**
 * This device's current digest for every synced table -- what the new
 * /api/sync/digest endpoint returns for itself, and what a sync round
 * compares against a peer's own response from the same endpoint.
 */
export const computeAllTableDigests = async (): Promise<TableDigest[]> =>
  await Promise.all([
    digestLibraryEntry(),
    digestReadingState(),
    digestTaxonomyTerm(),
    digestWork(),
    digestWorkSource(),
  ]);

const DIGEST_FNS_BY_TABLE: Record<SyncedTableName, () => Promise<TableDigest>> =
  {
    library_entry: digestLibraryEntry,
    reading_state: digestReadingState,
    taxonomy_term: digestTaxonomyTerm,
    work: digestWork,
    work_source: digestWorkSource,
  };

/**
 * One table's fresh digest, computed the same way computeAllTableDigests
 * does for all five -- used by repair.ts to find a mismatched table's
 * divergent buckets without paying for the other four tables' digests too,
 * when only one table is actually being repaired.
 */
export const computeTableDigest = async (
  tableName: SyncedTableName
): Promise<TableDigest> => await DIGEST_FNS_BY_TABLE[tableName]();

const bucketDigestSchema = z.object({
  bucket: z.number(),
  digest: z.string(),
  rowCount: z.number(),
});

const digestResponseSchema = z.object({
  digests: z.array(
    z.object({
      buckets: z.array(bucketDigestSchema),
      digest: z.string(),
      rowCount: z.number(),
      table: syncedTableNameSchema,
    })
  ),
});

/**
 * Which bucket indices disagree between two TableDigests for the same
 * table -- present on only one side, or present on both with a different
 * digest/rowCount, both count. This is what turns a table-level "these
 * mismatch" (Part 1) into "these specific rows are the ones worth pulling"
 * (Part 2's repair.ts): a bucket missing entirely from `local` and
 * present on `remote` still needs to be flagged, since that's exactly the
 * "a row exists on the peer but never made it here" case the spec calls
 * out as the common repair scenario.
 */
export const diffMismatchedBuckets = (
  local: TableDigest,
  remote: TableDigest
): number[] => {
  const localByBucket = new Map(
    local.buckets.map((entry) => [entry.bucket, entry])
  );
  const remoteByBucket = new Map(
    remote.buckets.map((entry) => [entry.bucket, entry])
  );
  const allBuckets = new Set([
    ...localByBucket.keys(),
    ...remoteByBucket.keys(),
  ]);

  const mismatched: number[] = [];
  for (const bucket of allBuckets) {
    const localEntry = localByBucket.get(bucket);
    const remoteEntry = remoteByBucket.get(bucket);
    const isMismatch =
      !localEntry ||
      !remoteEntry ||
      localEntry.digest !== remoteEntry.digest ||
      localEntry.rowCount !== remoteEntry.rowCount;
    if (isMismatch) {
      mismatched.push(bucket);
    }
  }
  return mismatched.toSorted((a, b) => a - b);
};

const FETCH_TIMEOUT_MS = 10_000;

export interface DigestPeer {
  tailnetHostname: string;
  port: number;
}

/**
 * Signed request against a peer's /api/sync/digest, mirroring
 * client.ts's pullFromPeer (same signing, same plain-http-over-Tailscale
 * reasoning, same "peer unreachable throws, caller decides" contract) --
 * kept in this module rather than client.ts since digest exchange is a
 * separate concern from the oplog pull that file's named after.
 */
export const fetchPeerDigests = async (
  database: typeof dbClient,
  peer: DigestPeer
): Promise<TableDigest[]> => {
  const identity = await getDeviceIdentity(database);
  const requestBody = { deviceId: identity.deviceId };
  const signature = await signPayload(identity.privateKey, requestBody);

  const response = await fetch(
    `http://${peer.tailnetHostname}:${peer.port}/api/sync/digest`,
    {
      body: JSON.stringify({ ...requestBody, signature }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Digest fetch from ${peer.tailnetHostname} failed: HTTP ${response.status}`
    );
  }

  const parsed = digestResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      `Digest fetch from ${peer.tailnetHostname} returned a malformed response.`
    );
  }

  return parsed.data.digests;
};

export interface IntegrityCheckPeer extends DigestPeer {
  deviceId: string;
}

export interface RepairOutcomeSummary {
  table: SyncedTableName;
  rowsRepaired: number;
  converged: boolean;
}

export interface IntegrityCheckResult {
  deviceId: string;
  mismatchedTables: SyncedTableName[];
  checkedAt: Date;
  lastRepairAt: Date | null;
  lastRepairResult: RepairOutcomeSummary[] | null;
}

/**
 * Compares this device's freshly-recomputed digests against one peer's
 * (fetched fresh too, never cached) and records the result in
 * sync_integrity_check for the sync UI to read. A mismatch names the
 * table(s) that disagree, nothing more granular -- identifying the actual
 * divergent row is Part 2's reconciliation work, not this phase's.
 * Deliberately does not throw on a mismatch: a mismatch is a normal,
 * expected outcome this function reports, not a failure of the check
 * itself. Only a genuinely unreachable peer or malformed response
 * propagates as a thrown error, same as fetchPeerDigests/pullFromPeer.
 */
export const checkIntegrityWithPeer = async (
  database: typeof dbClient,
  peer: IntegrityCheckPeer
): Promise<IntegrityCheckResult> => {
  const [localDigests, remoteDigests] = await Promise.all([
    computeAllTableDigests(),
    fetchPeerDigests(database, peer),
  ]);

  const remoteByTable = new Map(
    remoteDigests.map((entry) => [entry.table, entry])
  );

  const mismatchedTables = localDigests
    .filter((local) => {
      const remote = remoteByTable.get(local.table);
      return (
        !remote ||
        remote.digest !== local.digest ||
        remote.rowCount !== local.rowCount
      );
    })
    .map((local) => local.table);

  const checkedAt = new Date();

  // .returning() (not a bare insert) so this can hand back
  // lastRepairAt/lastRepairResult too -- this upsert's `set` never touches
  // those columns, so a prior repair's outcome (repair.ts) survives a plain
  // check untouched, and the caller doesn't need a second query to see it.
  const [row] = await database
    .insert(syncIntegrityCheck)
    .values({ checkedAt, deviceId: peer.deviceId, mismatchedTables })
    .onConflictDoUpdate({
      set: { checkedAt, mismatchedTables },
      target: syncIntegrityCheck.deviceId,
    })
    .returning({
      lastRepairAt: syncIntegrityCheck.lastRepairAt,
      lastRepairResult: syncIntegrityCheck.lastRepairResult,
    });

  return {
    checkedAt,
    deviceId: peer.deviceId,
    lastRepairAt: row?.lastRepairAt ?? null,
    // SAFETY: this column is only ever written by repairMismatchedTablesWithPeer
    // (repair.ts), which always writes exactly this shape -- unlike
    // mismatchedTables below, this isn't re-parsed with Zod here since
    // checkIntegrityWithPeer itself never writes to this column, only
    // reads back whatever repair.ts already validated-by-construction.
    lastRepairResult: (row?.lastRepairResult ?? null) as
      | RepairOutcomeSummary[]
      | null,
    mismatchedTables,
  };
};

/**
 * The sync UI's read path for "which peer, which table, when last checked"
 * (spec's Part 1 surfacing requirement) -- one row per peer that has ever
 * had a check run against it, empty `mismatchedTables` meaning the last
 * check found no drift.
 */
export const getLatestIntegrityChecks = async (
  database: typeof dbClient
): Promise<IntegrityCheckResult[]> => {
  const rows = await database
    .select({
      checkedAt: syncIntegrityCheck.checkedAt,
      deviceId: syncIntegrityCheck.deviceId,
      lastRepairAt: syncIntegrityCheck.lastRepairAt,
      lastRepairResult: syncIntegrityCheck.lastRepairResult,
      mismatchedTables: syncIntegrityCheck.mismatchedTables,
    })
    .from(syncIntegrityCheck);

  return rows.map((row) => ({
    checkedAt: row.checkedAt,
    deviceId: row.deviceId,
    lastRepairAt: row.lastRepairAt,
    // Validated, not cast, same reasoning as mismatchedTables below -- this
    // device wrote the row itself (repair.ts), but re-parsing on read means
    // a future schema change to SYNCED_TABLES can't silently produce a
    // value that doesn't match SyncedTableName.
    lastRepairResult: row.lastRepairResult
      ? z
          .array(
            z.object({
              converged: z.boolean(),
              rowsRepaired: z.number(),
              table: syncedTableNameSchema,
            })
          )
          .parse(row.lastRepairResult)
      : null,
    // Validated, not cast: this device wrote the row itself
    // (checkIntegrityWithPeer), but re-parsing on read rather than trusting
    // the stored JSON blob's shape means a future schema change to
    // SYNCED_TABLES can't silently produce a value that doesn't match
    // SyncedTableName.
    mismatchedTables: z
      .array(syncedTableNameSchema)
      .parse(row.mismatchedTables),
  }));
};
