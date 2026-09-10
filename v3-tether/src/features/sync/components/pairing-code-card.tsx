import Image from "next/image";

import { CopyCodeButton } from "@/features/sync/components/copy-code-button";
import {
  generatePairingCodeAction,
  generatePairingQrCodeAction,
} from "@/features/sync/server/actions";

/**
 * This device's own pairing code, generated fresh on every render -- never
 * cached, since it's cheap to compute and there's nothing gained by
 * persisting it (08_sync/01_transport_and_pairing.md: generating a code
 * never touches known_peer, only pairing *with* one does).
 */
export const PairingCodeCard = async () => {
  const [{ code, deviceId, fingerprint }, qrDataUrl] = await Promise.all([
    generatePairingCodeAction(),
    generatePairingQrCodeAction(),
  ]);

  return (
    <section className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div>
        <h2 className="text-sm font-medium">This device's pairing code</h2>
        <p className="text-muted-foreground text-sm">
          Scan or copy this on the <em>other</em> device, then pair with its
          code here too -- pairing only works once both directions are done.
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <Image
          alt="Pairing code QR"
          className="border-border/60 shrink-0 rounded-md border bg-white p-2"
          height={160}
          src={qrDataUrl}
          unoptimized
          width={160}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Fingerprint</p>
            <p className="font-mono text-sm">{fingerprint}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Device ID</p>
            <p className="font-mono text-xs break-all">{deviceId}</p>
          </div>
          <CopyCodeButton code={code} />
        </div>
      </div>
    </section>
  );
};
