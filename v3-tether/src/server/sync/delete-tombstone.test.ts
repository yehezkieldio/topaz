import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteWorkAction } from "@/features/library/server/update-work-action";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { libraryEntry, work } from "@/server/db/schema";
import { oplog } from "@/server/db/schema/sync";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../test/db-helpers";
import { createWorkFixture } from "../../../test/fixtures";
// Registers the next/headers mock as a side effect -- must be imported
// before any module that transitively imports next/headers (requireAdmin).
import { headersRef } from "../../../test/mock-next-runtime";
import { applyRemoteOplogRow } from "./apply";
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
    const sql = readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8");
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
      rmSync(dir, { recursive: true, force: true });
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

let peer: Awaited<ReturnType<typeof createPeerDevice>>;

beforeEach(async () => {
  await truncateAppData();
  peer = await createPeerDevice();
});

afterEach(() => {
  peer.close();
});

describe("delete/tombstone sync: two-device convergence", () => {
  it("propagates deleteWorkAction's soft-delete to a peer that already has the row", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { entry, work: createdWork } = await createWorkFixture(admin.id);

    // Device A creates the row directly (createWorkFixture is a raw insert,
    // not the real action, so seed the peer with an equivalent row instead
    // of relaying oplog rows that don't exist for this fixture path).
    await peer.db.insert(work).values(createdWork);
    await peer.db.insert(libraryEntry).values(entry);

    const [workPublicRow] = await db
      .select({ publicId: work.publicId, version: work.version })
      .from(work)
      .where(eq(work.id, createdWork.id))
      .limit(1);
    if (!workPublicRow) {
      throw new Error("Fixture setup: work row not found after insert.");
    }

    const result = await deleteWorkAction(
      workPublicRow.publicId,
      workPublicRow.version
    );
    expect(result.status).toBe("success");

    const rows = await allOplogRows();
    const tombstoneRows = rows.filter((row) => row.tombstone);
    expect(tombstoneRows.length).toBeGreaterThanOrEqual(2);
    expect(tombstoneRows.map((row) => row.tableName)).toEqual(
      expect.arrayContaining(["work", "library_entry"])
    );

    for (const row of tombstoneRows) {
      await applyRemoteOplogRow(peer.db, row);
    }

    const [peerWork] = await peer.db
      .select({ deleted: work.deleted })
      .from(work)
      .where(eq(work.id, createdWork.id))
      .limit(1);
    const [peerEntry] = await peer.db
      .select({ deleted: libraryEntry.deleted })
      .from(libraryEntry)
      .where(eq(libraryEntry.id, entry.id))
      .limit(1);

    expect(peerWork?.deleted).toBe(true);
    expect(peerEntry?.deleted).toBe(true);
  });

  it("is a correct no-op when the peer never had the row in the first place", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { entry, work: createdWork } = await createWorkFixture(admin.id);

    const [workPublicRow] = await db
      .select({ publicId: work.publicId, version: work.version })
      .from(work)
      .where(eq(work.id, createdWork.id))
      .limit(1);
    if (!workPublicRow) {
      throw new Error("Fixture setup: work row not found after insert.");
    }

    await deleteWorkAction(workPublicRow.publicId, workPublicRow.version);

    const tombstoneRows = (await allOplogRows()).filter(
      (row) => row.tombstone
    );

    const applyAll = async () => {
      for (const row of tombstoneRows) {
        // Same connection as every other write in this test -- applying
        // concurrently risks SQLITE_BUSY on the peer's single-writer file.
        // biome-ignore lint/performance/noAwaitInLoops: rows must apply one at a time against one SQLite connection
        await applyRemoteOplogRow(peer.db, row);
      }
    };

    await expect(applyAll()).resolves.not.toThrow();

    const [peerWork] = await peer.db
      .select({ id: work.id })
      .from(work)
      .where(eq(work.id, createdWork.id))
      .limit(1);
    expect(peerWork).toBeUndefined();
    expect(entry.id).toBeTruthy();
  });
});
