import { UnpairButton } from "@/features/sync/components/unpair-button";
import {
  type PairedPeer,
  listPairedPeersAction,
} from "@/features/sync/server/actions";

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
    <UnpairButton deviceId={peer.deviceId} />
  </li>
);

export const PeerList = async () => {
  const peers = await listPairedPeersAction();

  return (
    <section className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div>
        <h2 className="text-sm font-medium">Paired devices</h2>
        <p className="text-muted-foreground text-sm">
          {peers.length === 0
            ? "No devices paired yet."
            : `${peers.length} device${peers.length === 1 ? "" : "s"} trusted for sync.`}
        </p>
      </div>

      {peers.length > 0 && (
        <ul>
          {peers.map((peer) => (
            <PeerRow key={peer.deviceId} peer={peer} />
          ))}
        </ul>
      )}
    </section>
  );
};
