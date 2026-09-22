import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createWorkAction } from "@/features/library/server/create-work-action";
import { deleteWorkAction } from "@/features/library/server/update-work-action";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { libraryEntry, sourcePlatform, work } from "@/server/db/schema";
import { oplog } from "@/server/db/schema/sync";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../test/db-helpers";
// Registers the next/headers mock as a side effect -- must be imported
// before any module that transitively imports next/headers (requireAdmin).
import { headersRef } from "../../../test/mock-next-runtime";
import { applyRemoteOplogRow } from "./apply";
import { getDeviceIdentity } from "./device-identity";
import type { OplogEntry } from "./oplog";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../../drizzle");

/**
 * A second, fully independent SQLite file standing in for a peer device --
 * built from the same checked-in migrations this device's own topaz.db is
 * built from, not a schema copy -- so this test exercises the exact same
 * upsert/tombstone logic (apply.ts) a real second device would run when
 * pulling from this one, minus only the HTTP transport itself (verified
 * separately, see docs/BUN_SQLITE_NEXT_BUILD.md).
 */
const createPeerDevice = async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "topaz-tombstone-test-"));
  const filePath = path.join(dir, "peer.db");
  const client = createClient({ url: `file:${filePath}` });

  for (const fileName of [
    "0000_broad_anthem.sql",
    "0001_conscious_gateway.sql",
    "0002_sour_ultron.sql",
    "0003_wonderful_peter_parker.sql",
    "0004_thankful_paper_doll.sql",
    "0005_perpetual_fixer.sql",
  ]) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf-8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        // DDL statements must apply in file order -- a later statement can
        // depend on a table an earlier one in the same file just created.
        // biome-ignore lint/performance/noAwaitInLoops: ordering across statements is required, not incidental
        await client.execute(trimmed);
      }
    }
  }

  return {
    close: () => {
      client.close();
      rmSync(dir, { force: true, recursive: true });
    },
    db: drizzle(client, { casing: "snake_case", schema }),
  };
};

const allOplogRows = async (): Promise<OplogEntry[]> =>
  await db
    .select({
      columnDiffs: oplog.columnDiffs,
      deviceId: oplog.deviceId,
      hlcTimestamp: oplog.hlcTimestamp,
      rowId: oplog.rowId,
      seq: oplog.seq,
      tableName: oplog.tableName,
      tombstone: oplog.tombstone,
    })
    .from(oplog)
    .orderBy(asc(oplog.hlcTimestamp));

/**
 * Applies every oplog row currently on device A to the given peer, in HLC
 * order -- what one full sync round eventually converges to (round.ts),
 * minus the batching and HTTP transport, both already verified separately
 * (docs/BUN_SQLITE_NEXT_BUILD.md).
 */
type PeerDb = Awaited<ReturnType<typeof createPeerDevice>>["db"];

const relayRowsTo = async (
  peerDb: PeerDb,
  rows: OplogEntry[]
): Promise<void> => {
  for (const row of rows) {
    // Rows must apply in HLC order against one SQLite connection, same
    // discipline as round.ts's own apply loop.
    // biome-ignore lint/performance/noAwaitInLoops: ordering across rows is required, not incidental
    await applyRemoteOplogRow(peerDb, row);
  }
};

const relayAllTo = async (peerDb: PeerDb): Promise<void> => {
  const rows = await allOplogRows();
  await relayRowsTo(peerDb, rows);
};

const buildFormData = (sourcePlatformId: string) => {
  const formData = new FormData();
  formData.set("title", "Tombstone Fixture Work");
  formData.set("authorName", "Fixture Author");
  formData.set("contentRating", "general");
  formData.set("publicationStatus", "in_progress");
  formData.set("description", "");
  formData.set("sourceUrl", "https://archiveofourown.org/works/tombstone");
  formData.set("sourcePlatformId", sourcePlatformId);
  formData.set("taxonomyTermIds", "[]");
  return formData;
};

/**
 * Creates a work through the real Server Action, not a raw insert -- unlike
 * test/fixtures.ts's createWorkFixture, this also writes the work_fts index
 * row deleteWorkAction's removeWorkFromFts expects to already exist.
 * Deleting a rowid FTS5 never indexed corrupts the shadow index
 * (docs/BUN_SQLITE_NEXT_BUILD.md's FTS5 findings), so a fixture that skips
 * indexing is unsafe for any test that goes on to delete the row.
 */
const createFixtureWork = async () => {
  const [platform] = await db
    .select({ id: sourcePlatform.publicId })
    .from(sourcePlatform)
    .limit(1);
  if (!platform) {
    throw new Error("Fixture setup: no seeded source platform.");
  }

  const result = await createWorkAction(undefined, buildFormData(platform.id));
  if (!(result && "workPublicId" in result)) {
    throw new Error("Fixture setup: createWorkAction did not succeed.");
  }

  const [workRow] = await db
    .select({ id: work.id, publicId: work.publicId, version: work.version })
    .from(work)
    .where(eq(work.publicId, result.workPublicId))
    .limit(1);
  if (!workRow) {
    throw new Error("Fixture setup: work row not found after create.");
  }

  const [entryRow] = await db
    .select({ id: libraryEntry.id })
    .from(libraryEntry)
    .where(eq(libraryEntry.workId, workRow.id))
    .limit(1);
  if (!entryRow) {
    throw new Error("Fixture setup: no library entry created for work.");
  }

  return {
    entryId: entryRow.id,
    workId: workRow.id,
    workPublicId: workRow.publicId,
    workVersion: workRow.version,
  };
};

let peer: Awaited<ReturnType<typeof createPeerDevice>>;

beforeEach(async () => {
  await truncateAppData();
  peer = await createPeerDevice();
  // Establishes this test process's device identity outside of any
  // transaction, same as a real device already does the first time someone
  // opens /sync (app/api/sync/identity/route.ts) -- oplog.ts's own
  // first-establish path runs this from inside the mutation's transaction,
  // which self-deadlocks if identity was never established beforehand. That
  // is a pre-existing gap unrelated to tombstone sync, so it is sidestepped
  // here rather than fixed in this pass.
  await getDeviceIdentity(db);
});

afterEach(() => {
  peer.close();
});

describe("delete/tombstone sync: two-device convergence", () => {
  it("propagates deleteWorkAction's soft-delete to a peer that already synced the create", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    // A real peer only ever shares this admin's rows if it already went
    // through account bootstrap (server/sync/account-bootstrap.ts): pairing
    // copies the single admin user row verbatim, id included, so every
    // paired device shares one user.id and library_entry.user_id's FK
    // resolves on every device -- not a fresh, independently-generated
    // admin account.
    await peer.db.insert(schema.user).values(admin);

    const fixture = await createFixtureWork();
    await relayAllTo(peer.db);

    const [peerWorkAfterCreate] = await peer.db
      .select({ deleted: work.deleted })
      .from(work)
      .where(eq(work.id, fixture.workId))
      .limit(1);
    expect(peerWorkAfterCreate?.deleted).toBe(false);

    const result = await deleteWorkAction(
      fixture.workPublicId,
      fixture.workVersion
    );
    expect(result.status).toBe("success");

    const oplogRowsAfterDelete = await allOplogRows();
    const tombstoneRows = oplogRowsAfterDelete.filter((row) => row.tombstone);
    expect(tombstoneRows.map((row) => row.tableName)).toEqual(
      expect.arrayContaining(["work", "library_entry"])
    );

    await relayAllTo(peer.db);

    const [peerWork] = await peer.db
      .select({ deleted: work.deleted })
      .from(work)
      .where(eq(work.id, fixture.workId))
      .limit(1);
    const [peerEntry] = await peer.db
      .select({ deleted: libraryEntry.deleted })
      .from(libraryEntry)
      .where(eq(libraryEntry.id, fixture.entryId))
      .limit(1);

    expect(peerWork?.deleted).toBe(true);
    expect(peerEntry?.deleted).toBe(true);
  });

  it("is a correct no-op when the peer never synced the create in the first place", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const fixture = await createFixtureWork();

    await deleteWorkAction(fixture.workPublicId, fixture.workVersion);

    // Only the tombstone rows reach this peer -- it deliberately skipped
    // the earlier create sync, so applyTombstoneToTable's own doc applies:
    // a soft-delete on a row this device never had is a correct no-op, not
    // an error, since an INSERT here would hit the exact partial-column
    // problem upsertRow's doc describes.
    const allRows = await allOplogRows();
    const tombstoneRows = allRows.filter((row) => row.tombstone);
    await expect(relayRowsTo(peer.db, tombstoneRows)).resolves.toBeUndefined();

    const [peerWork] = await peer.db
      .select({ id: work.id })
      .from(work)
      .where(eq(work.id, fixture.workId))
      .limit(1);
    expect(peerWork).toBeUndefined();
  });
});
