/**
 * Manual CLI for exercising pairing and sync end to end against this
 * device's real local SQLite file (.env.local, not a test DB) -- there is
 * no pairing/sync UI yet (08_sync/01_transport_and_pairing.md's Server
 * Actions only), so this is the only way to generate a pairing code,
 * record a peer's code, list/remove peers, or trigger a sync round today.
 *
 * Requires an admin account to already exist -- sign up through the
 * running app once first (`bun dev`, then the sign-up page); this script
 * mints a short-lived session for whichever account is already the admin,
 * the same way scripts/verify-*.ts do for the test database.
 *
 * Run via:
 *   bun run sync generate           this device's pairing code + fingerprint
 *   bun run sync pair <code>        record trust in a peer's pairing code
 *   bun run sync peers              list every paired peer
 *   bun run sync unpair <deviceId>  remove a paired peer
 *   bun run sync round              one sync attempt against every peer
 */
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

import { headersRef } from "./lib/next-runtime-mock";

const SESSION_TTL_MS = 1000 * 60 * 10;

const main = async () => {
  const [command, arg] = process.argv.slice(2);

  const { closeDbConnection, db } = await import("@/server/db/client");
  const { session: sessionTable, user: userTable } = await import(
    "@/server/db/schema/auth"
  );

  const [admin] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.role, "admin"))
    .limit(1);

  if (!admin) {
    console.error(
      "No admin account exists yet -- sign up through the running app " +
        "first (bun dev, then the sign-up page)."
    );
    process.exitCode = 1;
    return;
  }

  const token = createId();
  await db.insert(sessionTable).values({
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    id: createId(),
    token,
    userId: admin.id,
  });
  headersRef.current = new Headers({ authorization: `Bearer ${token}` });

  switch (command) {
    case "generate": {
      const { generatePairingCodeAction } = await import(
        "@/features/sync/server/actions"
      );
      const result = await generatePairingCodeAction();
      console.log(`Device ID:   ${result.deviceId}`);
      console.log(`Fingerprint: ${result.fingerprint}`);
      console.log("\nPairing code -- copy this to the other device:\n");
      console.log(result.code);
      break;
    }
    case "pair": {
      if (!arg) {
        console.error("Usage: bun run sync pair <code>");
        process.exitCode = 1;
        break;
      }
      const { pairWithPeerAction } = await import(
        "@/features/sync/server/actions"
      );
      const result = await pairWithPeerAction(arg);
      if (result.status === "success") {
        console.log(
          `Paired with ${result.data.tailnetHostname}:${result.data.port} ` +
            `(fingerprint ${result.data.fingerprint}).`
        );
        console.log(
          "Confirm this fingerprint matches what 'generate' printed on that device."
        );
      } else {
        console.error("Pairing failed:", JSON.stringify(result));
        process.exitCode = 1;
      }
      break;
    }
    case "peers": {
      const { listPairedPeersAction } = await import(
        "@/features/sync/server/actions"
      );
      const peers = await listPairedPeersAction();
      if (peers.length === 0) {
        console.log("No paired peers.");
        break;
      }
      for (const peer of peers) {
        console.log(
          `${peer.deviceId}  ${peer.tailnetHostname}:${peer.port}  ` +
            `fingerprint ${peer.fingerprint}  paired ${peer.pairedAt.toISOString()}`
        );
      }
      break;
    }
    case "unpair": {
      if (!arg) {
        console.error("Usage: bun run sync unpair <deviceId>");
        process.exitCode = 1;
        break;
      }
      const { unpairPeerAction } = await import(
        "@/features/sync/server/actions"
      );
      const result = await unpairPeerAction(arg);
      console.log(
        result.status === "success" ? `Removed ${arg}.` : "Not found."
      );
      break;
    }
    case "round": {
      const { syncWithAllKnownPeers } = await import("@/server/sync/round");
      const outcomes = await syncWithAllKnownPeers(db);
      if (outcomes.length === 0) {
        console.log("No paired peers to sync with.");
        break;
      }
      for (const outcome of outcomes) {
        const suffix = outcome.error ? ` -- ${outcome.error}` : "";
        console.log(
          `${outcome.deviceId}: ${outcome.status}, ${outcome.rowsApplied} row(s) applied${suffix}`
        );
      }
      break;
    }
    default:
      console.error(
        "Usage: bun run sync <generate|pair <code>|peers|unpair <deviceId>|round>"
      );
      process.exitCode = 1;
  }

  closeDbConnection();
};

await main();
