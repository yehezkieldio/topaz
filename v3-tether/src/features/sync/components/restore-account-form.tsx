"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bootstrapAccountFromPeerAction } from "@/features/sync/server/actions";

/**
 * The fresh-device counterpart to PairWithPeerForm -- shown instead of the
 * full sync panel when this device has no account yet (sync-panel.tsx).
 * One pairing code both establishes peer trust and restores the admin
 * identity from that peer (bootstrapAccountFromPeerAction), so a full page
 * navigation to the returned magic-link URL is what actually signs this
 * device in -- not a client-side router push, since the verify endpoint
 * sets a real session cookie on that response.
 */
export const RestoreAccountForm = () => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    const code = String(formData.get("code") ?? "").trim();
    setError(null);

    startTransition(async () => {
      const outcome = await bootstrapAccountFromPeerAction(code);
      if (outcome.status === "success") {
        window.location.assign(outcome.data.verifyUrl);
        return;
      }
      if (outcome.status === "validation-error") {
        setError(outcome.fieldErrors.code?.[0] ?? "That code isn't valid.");
        return;
      }
      setError("Couldn't restore the account from that device.");
    });
  };

  return (
    <section className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div>
        <h2 className="text-sm font-medium">Restore from another device</h2>
        <p className="text-muted-foreground text-sm">
          Paste the pairing code shown on your other Topaz device to sign in as
          the same account and pull its library -- no sign-up needed.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="restore-code">Pairing code</Label>
          <Textarea
            className="min-h-20 font-mono text-xs"
            id="restore-code"
            name="code"
            placeholder="eyJ2IjoxLCJkZXZpY2VJZCI6..."
            required
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button disabled={isPending} type="submit">
          Restore account
        </Button>
      </form>
    </section>
  );
};
