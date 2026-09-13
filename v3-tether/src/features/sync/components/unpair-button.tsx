"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { unpairPeerAction } from "@/features/sync/server/actions";

export const UnpairButton = ({ deviceId }: { deviceId: string }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await unpairPeerAction(deviceId);
          router.refresh();
        });
      }}
      size="sm"
      type="button"
      variant="destructive"
    >
      Unpair
    </Button>
  );
};
