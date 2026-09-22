"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generateMobileConnectAction } from "@/features/sync/server/actions";
import type { MobileConnectLink } from "@/features/sync/server/actions";

/**
 * "Connect a phone": a QR code that logs the scanning device straight into
 * an authenticated /library, no URL to type and no password on a phone
 * keyboard. Unlike PairingCodeCard (a real peer's identity, safe to leave
 * on screen indefinitely), this QR *is* a live credential -- generated
 * fresh on mount rather than left to a server-rendered snapshot, consumed
 * on first scan, and expiring on its own shortly after, so there's a
 * "Generate new code" escape hatch for whenever the current one has gone
 * stale (already scanned, or the countdown ran out) rather than requiring
 * a full page refresh.
 */
export const MobileConnectCard = () => {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<MobileConnectLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    startTransition(async () => {
      try {
        setLink(await generateMobileConnectAction());
      } catch {
        setLink(null);
        setError("Couldn't generate a connect code. Try again.");
      }
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: generate is
  // stable in effect over this component's lifetime; re-running it on
  // every render (its identity changes each render) would spam
  // signInMagicLink well past the plugin's own rate limit.
  useEffect(() => {
    generate();
  }, []);

  return (
    <section className="border-border/60 bg-card/40 flex h-full flex-col space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Connect a phone</h3>
        <Button
          disabled={isPending}
          onClick={generate}
          size="sm"
          type="button"
          variant="outline"
        >
          New code
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Scan this with your phone's camera to open Topaz there, already signed
        in. Your phone doesn't get its own copy of the library -- it just talks
        to this device over Tailscale, so this device needs to stay running.
      </p>

      {link && !isPending && (
        <div className="flex items-center gap-4">
          <Image
            alt="Phone connect QR"
            className="border-border/60 shrink-0 rounded-md border bg-white p-2"
            height={112}
            src={link.qrDataUrl}
            unoptimized
            width={112}
          />
          <p className="text-muted-foreground text-xs">
            Expires in {Math.round(link.expiresInSeconds / 60)} minutes, or as
            soon as it's scanned once, whichever comes first.
          </p>
        </div>
      )}

      {isPending && !link && (
        <Skeleton className="size-[112px] shrink-0 rounded-md" />
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </section>
  );
};
