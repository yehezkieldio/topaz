import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";
import { SYNCED_TABLES } from "@/server/sync/digest";
import {
  fetchTablePage,
  PULL_TABLE_BATCH_SIZE,
} from "@/server/sync/full-table";
import { verifySignature } from "@/server/sync/protocol";

/**
 * Part 2's full-table pull (08_sync/03_data_integrity_and_reconciliation.md):
 * returns one page of this device's current row state for one synced table,
 * for a peer that's already found a digest mismatch via /api/sync/digest and
 * needs the actual rows to reconcile against. Copies /api/sync/digest's exact
 * verification shape -- same signed-body pattern, same "unknown peer and bad
 * signature get an identical rejection" discipline.
 *
 * Unlike /api/sync and /api/sync/digest, this is paginated (cursor is the
 * last row id seen, null for the first page) since a full table -- unlike a
 * bounded oplog batch or a five-value digest -- can be arbitrarily large
 * (spec: "a library with several thousand entries must not require one
 * unbounded response").
 */
const pullTableRequestSchema = z.object({
  cursor: z.string().nullable(),
  deviceId: z.string().min(1),
  signature: z.string().min(1),
  table: z.enum(SYNCED_TABLES),
});

export const POST = async (request: NextRequest) => {
  const parsed = pullTableRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Malformed pull-table request." },
      { status: 400 }
    );
  }
  const { cursor, deviceId, signature, table } = parsed.data;

  const [peer] = await db
    .select({ publicKey: knownPeer.publicKey })
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  const isVerified =
    peer &&
    (await verifySignature(
      peer.publicKey,
      { cursor, deviceId, table },
      signature
    ));

  if (!isVerified) {
    return NextResponse.json({ error: "Not a paired peer." }, { status: 403 });
  }

  const { rows, nextCursor } = await fetchTablePage(
    table,
    cursor,
    PULL_TABLE_BATCH_SIZE
  );

  return NextResponse.json({ nextCursor, rows });
};
