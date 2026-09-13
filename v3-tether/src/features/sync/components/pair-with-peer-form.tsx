"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type PairedPeer,
  pairWithPeerAction,
} from "@/features/sync/server/actions";

type FormResult =
  | { kind: "success"; peer: PairedPeer }
  | { kind: "error"; message: string }
  | null;

/**
 * Pairing is one-directional per action (08_sync/01_transport_and_pairing.md)
 * -- this records trust in whatever code was captured here; the admin runs
 * the equivalent form on the *other* device (pasting this device's own
 * code, shown in PairingCodeCard) to complete the other direction.
 */
export const PairWithPeerForm = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<FormResult>(null);

  const handleSubmit = (formData: FormData) => {
    const code = String(formData.get("code") ?? "").trim();
    setResult(null);

    startTransition(async () => {
      const outcome = await pairWithPeerAction(code);
      if (outcome.status === "success") {
        setResult({ kind: "success", peer: outcome.data });
        router.refresh();
      } else if (outcome.status === "validation-error") {
        setResult({
          kind: "error",
          message: outcome.fieldErrors.code?.[0] ?? "That code isn't valid.",
        });
      } else {
        setResult({ kind: "error", message: "Pairing failed." });
      }
    });
  };

  return (
    <section className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div>
        <h2 className="text-sm font-medium">Pair with a device</h2>
        <p className="text-muted-foreground text-sm">
          Paste the pairing code shown on the other device.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="code">Pairing code</Label>
          <Textarea
            className="min-h-20 font-mono text-xs"
            id="code"
            name="code"
            placeholder="eyJ2IjoxLCJkZXZpY2VJZCI6..."
            required
          />
        </div>

        {result?.kind === "error" && (
          <p className="text-destructive text-sm">{result.message}</p>
        )}
        {result?.kind === "success" && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Paired with {result.peer.tailnetHostname}:{result.peer.port} --
            confirm fingerprint <span className="font-mono">
              {result.peer.fingerprint}
            </span>{" "}
            matches what that device shows.
          </p>
        )}

        <Button disabled={isPending} type="submit">
          Pair
        </Button>
      </form>
    </section>
  );
};
