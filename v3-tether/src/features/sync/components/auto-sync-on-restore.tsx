"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { triggerSyncRoundAction } from "@/features/sync/server/actions";

type Status = "idle" | "syncing" | "done" | "error";

/**
 * Fires exactly once, right after bootstrapAccountFromPeerAction's magic
 * link lands this freshly-restored device on /sync?justRestored=1 --
 * nothing else pulls app data automatically (triggerSyncRoundAction's own
 * comment: no app-open/close hook exists yet), so without this the "paste
 * a code, get the account *and* the library" experience would silently
 * stop at "account."
 */
export const AutoSyncOnRestore = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (ran.current || searchParams.get("justRestored") !== "1") {
      return;
    }
    ran.current = true;
    setStatus("syncing");
    router.replace("/sync");

    const run = async () => {
      try {
        await triggerSyncRoundAction();
        setStatus("done");
      } catch {
        setStatus("error");
      }
    };
    run();
  }, [searchParams, router]);

  if (status === "idle") {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {status === "syncing" && "Pulling your library from that device..."}
      {status === "done" && "Your library is up to date."}
      {status === "error" &&
        'Account restored, but the first sync failed -- use "Sync now" below.'}
    </p>
  );
};
