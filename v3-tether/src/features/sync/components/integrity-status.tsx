import { Badge } from "@/components/ui/badge";
import { RepairPeerButton } from "@/features/sync/components/repair-peer-button";
import {
  getIntegrityStatusAction,
  listPairedPeersAction,
} from "@/features/sync/server/actions";

const formatCheckedAt = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

/**
 * Part 2's "visible result" for the most recent repair against this peer
 * (spec: "with a visible result (what changed, on which device)") --
 * rendered under the mismatch badge, not instead of it, since a table that
 * failed to converge still shows as mismatched above this line.
 */
const RepairSummaryLine = ({
  lastRepairAt,
  lastRepairResult,
}: {
  lastRepairAt: Date | null;
  lastRepairResult:
    | { table: string; rowsRepaired: number; converged: boolean }[]
    | null;
}) => {
  if (!(lastRepairAt && lastRepairResult)) {
    return null;
  }

  const totalRowsRepaired = lastRepairResult.reduce(
    (sum, outcome) => sum + outcome.rowsRepaired,
    0
  );
  const allConverged = lastRepairResult.every((outcome) => outcome.converged);

  return (
    <p className="text-muted-foreground text-xs">
      Last repair {formatCheckedAt(lastRepairAt)}: {totalRowsRepaired} row
      {totalRowsRepaired === 1 ? "" : "s"} repaired
      {allConverged ? "" : " -- did not fully converge"}
    </p>
  );
};

/**
 * Read path for Part 1's "surface a mismatch as a plain warning" (spec:
 * "which table, which peer, when last checked. No automatic action follows
 * from detection alone.") plus Part 2's manual repair trigger and its last
 * result. Joins the peer list with the latest recorded digest comparison
 * for each -- a peer with no row yet just hasn't had a check run against it
 * (no periodic job has fired, and no one has pressed "Check integrity" yet).
 */
export const IntegrityStatus = async () => {
  const [peers, statuses] = await Promise.all([
    listPairedPeersAction(),
    getIntegrityStatusAction(),
  ]);

  if (peers.length === 0) {
    return null;
  }

  const statusByDeviceId = new Map(
    statuses.map((status) => [status.deviceId, status])
  );

  return (
    <ul className="space-y-3">
      {peers.map((peer) => {
        const status = statusByDeviceId.get(peer.deviceId);
        const hasMismatch = (status?.mismatchedTables.length ?? 0) > 0;
        return (
          <li className="space-y-1" key={peer.deviceId}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground truncate">
                {peer.tailnetHostname}:{peer.port}
              </span>
              <div className="flex items-center gap-2">
                {!status && <Badge variant="outline">Not checked yet</Badge>}
                {status && !hasMismatch && (
                  <Badge variant="outline">
                    In sync -- checked {formatCheckedAt(status.checkedAt)}
                  </Badge>
                )}
                {status && hasMismatch && (
                  <Badge variant="destructive">
                    Mismatch: {status.mismatchedTables.join(", ")} -- checked{" "}
                    {formatCheckedAt(status.checkedAt)}
                  </Badge>
                )}
                {hasMismatch && <RepairPeerButton deviceId={peer.deviceId} />}
              </div>
            </div>
            {status && (
              <RepairSummaryLine
                lastRepairAt={status.lastRepairAt}
                lastRepairResult={status.lastRepairResult}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};
