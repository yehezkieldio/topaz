import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { env } from "@/lib/env";
import { computeKeyFingerprint } from "@/server/sync/pairing";
import type { PairingPayload } from "@/server/sync/pairing";

const execFileAsync = promisify(execFile);

const IDENTITY_PROBE_TIMEOUT_MS = 1500;

interface TailscalePeer {
  DNSName?: string;
  Online?: boolean;
}

interface TailscaleStatus {
  Peer?: Record<string, TailscalePeer>;
}

/**
 * Every other device Tailscale currently sees on this tailnet -- shells the
 * local `tailscaled` daemon via the CLI, same local trust boundary
 * /api/sync itself already relies on (no API token, no cloud call).
 * Hostnames only; whether Topaz is actually reachable there is a separate
 * question (fetchPeerIdentity below), since Tailscale has no idea what's
 * running on top of it.
 */
export const listTailnetPeerHostnames = async (): Promise<string[]> => {
  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"]);
    // SAFETY: `tailscale status --json`'s documented output always has this
    // shape; a malformed/unexpected reply is caught by the surrounding
    // try/catch and treated as "no peers found."
    const status = JSON.parse(stdout) as TailscaleStatus;
    return Object.values(status.Peer ?? {})
      .filter(
        (peer): peer is TailscalePeer & { DNSName: string } =>
          Boolean(peer.Online) && Boolean(peer.DNSName)
      )
      .map((peer) => peer.DNSName.replace(/\.$/u, ""));
  } catch {
    return [];
  }
};

/**
 * Asks a candidate device whether Topaz is actually running there, via the
 * unauthenticated /api/sync/identity read (src/app/api/sync/identity/route.ts)
 * -- throws on anything short of a well-formed reply, so callers can treat
 * "unreachable" and "not Topaz" identically.
 */
export const fetchPeerIdentity = async (
  hostname: string,
  port: number
): Promise<PairingPayload> => {
  const response = await fetch(`http://${hostname}:${port}/api/sync/identity`, {
    signal: AbortSignal.timeout(IDENTITY_PROBE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`No response from ${hostname}:${port}.`);
  }
  // SAFETY: /api/sync/identity (src/app/api/sync/identity/route.ts) always
  // returns this exact shape; a peer running a mismatched version would
  // fail the caller's later use of these fields rather than here, which is
  // an acceptable failure mode for a best-effort discovery probe.
  return (await response.json()) as PairingPayload;
};

export interface DiscoveredPeer {
  hostname: string;
  reachable: boolean;
  identity?: PairingPayload;
  fingerprint?: string;
}

const probeIdentity = async (hostname: string): Promise<DiscoveredPeer> => {
  try {
    const identity = await fetchPeerIdentity(hostname, env.SYNC_PORT);
    const fingerprint = await computeKeyFingerprint(identity.publicKeyRaw);
    return { fingerprint, hostname, identity, reachable: true };
  } catch {
    return { hostname, reachable: false };
  }
};

/**
 * Every online tailnet peer, probed in parallel for a running Topaz
 * instance on this device's own SYNC_PORT -- a reasonable default on a
 * personal tailnet; a peer on a different port simply doesn't get
 * discovered and falls back to the manual paste-code flow.
 */
export const discoverTailnetPeers = async (): Promise<DiscoveredPeer[]> => {
  const hostnames = await listTailnetPeerHostnames();
  return await Promise.all(hostnames.map(probeIdentity));
};
