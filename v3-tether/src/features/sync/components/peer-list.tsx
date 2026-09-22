import { ReconcileButton } from "@/features/sync/components/reconcile-button";
import { UnpairButton } from "@/features/sync/components/unpair-button";
import { listPairedPeersAction } from "@/features/sync/server/actions";
import type { PairedPeer } from "@/features/sync/server/actions";

const formatPairedAt = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const PeerRow = ({ peer }: { peer: PairedPeer }) => (
  <li className="border-border/50 flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
    <div className="min-w-0 space-y-0.5">
      <p className="truncate text-sm font-medium">
        {peer.tailnetHostname}:{peer.port}
      </p>
      <p className="text-muted-foreground font-mono text-xs">
        {peer.fingerprint} -- paired {formatPairedAt(peer.pairedAt)}
      </p>
    </div>
    <div className="flex shrink-0 items-start gap-2">
      <ReconcileButton deviceId={peer.deviceId} />
      <UnpairButton deviceId={peer.deviceId} />
    </div>
  </li>
);

export const PeerList = async () => {
  const peers = await listPairedPeersAction();

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {peers.length === 0
          ? "No devices paired yet."
          : `${peers.length} device${peers.length === 1 ? "" : "s"} trusted for sync.`}
      </p>

      {peers.length > 0 && (
        <ul>
          {peers.map((peer) => (
            <PeerRow key={peer.deviceId} peer={peer} />
          ))}
        </ul>
      )}
    </div>
  );
};
