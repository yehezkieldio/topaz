"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  confirmDiscoveredPairAction,
  discoverTailnetPeersAction,
  fetchPeerIdentityAction,
} from "@/features/sync/server/actions";
import type {
  DiscoveredPairResult,
  PeerIdentityPreview,
} from "@/features/sync/server/actions";
import type { DiscoveredPeer } from "@/server/sync/discovery";
import type { PairingPayload } from "@/server/sync/pairing";

type ReachablePeer = DiscoveredPeer & {
  identity: PairingPayload;
  fingerprint: string;
};

type RowState =
  | { kind: "confirming"; hostname: string; preview: PeerIdentityPreview }
  | { kind: "error"; hostname: string; message: string }
  | { kind: "success"; hostname: string; result: DiscoveredPairResult };

const isReachable = (peer: DiscoveredPeer): peer is ReachablePeer =>
  peer.reachable &&
  peer.identity !== undefined &&
  peer.fingerprint !== undefined;

/**
 * The discovery half of pairing (08_sync/01_transport_and_pairing.md's
 * manual code exchange, now optional): lists tailnet devices with Topaz
 * reachable on this device's own SYNC_PORT, turning pairing into "pick one,
 * confirm its fingerprint" instead of copying a code by hand. Kept
 * alongside PairWithPeerForm's manual textarea, not replacing it -- a peer
 * on a different port, or without the `tailscale` CLI reachable from here,
 * still needs the paste flow.
 */
export const DiscoveredPeers = () => {
  const router = useRouter();
  const [isLoading, startLoading] = useTransition();
  const [isConfirming, startConfirming] = useTransition();
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [scanned, setScanned] = useState(false);
  const [rowState, setRowState] = useState<RowState | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the scan is
  // stable for this component's lifetime; re-running it on every render
  // would re-shell the tailscale CLI on every unrelated re-render.
  useEffect(() => {
    startLoading(async () => {
      setPeers(await discoverTailnetPeersAction());
      setScanned(true);
    });
  }, []);

  const startConfirm = (hostname: string, port: number) => {
    setRowState(null);
    startConfirming(async () => {
      const outcome = await fetchPeerIdentityAction(hostname, port);
      if (outcome.status === "success") {
        setRowState({ hostname, kind: "confirming", preview: outcome.data });
      } else {
        setRowState({
          hostname,
          kind: "error",
          message:
            outcome.status === "validation-error"
              ? (outcome.fieldErrors.hostname?.[0] ??
                "Couldn't reach that device.")
              : "Couldn't reach that device.",
        });
      }
    });
  };

  const confirmPair = (hostname: string, payload: PairingPayload) => {
    startConfirming(async () => {
      const outcome = await confirmDiscoveredPairAction(payload);
      if (outcome.status === "success") {
        setRowState({ hostname, kind: "success", result: outcome.data });
        router.refresh();
      } else {
        setRowState({ hostname, kind: "error", message: "Pairing failed." });
      }
    });
  };

  if (isLoading && !scanned) {
    return <Skeleton className="h-16 w-full rounded-md" />;
  }

  const reachable = peers.filter(isReachable);

  if (scanned && reachable.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No other Topaz devices found on this tailnet. Pair with a code below
        instead.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {reachable.map((peer) => {
        const state = rowState?.hostname === peer.hostname ? rowState : null;

        return (
          <li
            className="border-border/50 rounded-md border p-3"
            key={peer.hostname}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-mono text-sm">{peer.hostname}</p>
              {state?.kind !== "confirming" && state?.kind !== "success" && (
                <Button
                  disabled={isConfirming}
                  onClick={() =>
                    startConfirm(peer.hostname, peer.identity.port)
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Connect
                </Button>
              )}
            </div>

            {state?.kind === "confirming" && (
              <div className="mt-2 space-y-2">
                <p className="text-muted-foreground text-xs">
                  Confirm fingerprint{" "}
                  <span className="font-mono">{state.preview.fingerprint}</span>{" "}
                  matches what that device shows.
                </p>
                <Button
                  disabled={isConfirming}
                  onClick={() =>
                    confirmPair(peer.hostname, state.preview.payload)
                  }
                  size="sm"
                  type="button"
                >
                  Confirm and pair
                </Button>
              </div>
            )}

            {state?.kind === "error" && (
              <p className="text-destructive mt-2 text-xs">{state.message}</p>
            )}

            {state?.kind === "success" && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                Paired
                {state.result.reciprocalConfirmed
                  ? "."
                  : ", but couldn't confirm the peer trusts us back automatically -- pair from the other device too if sync doesn't work."}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
};
