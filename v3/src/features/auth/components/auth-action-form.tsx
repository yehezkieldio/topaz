"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { DiscordIcon } from "@/components/icons/discord-icon";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const AuthActionForm = ({ isAdmin }: { isAdmin: boolean }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (isAdmin) {
    return (
      <Button
        className="w-full"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await authClient.signOut();
            router.push("/library");
            router.refresh();
          });
        }}
        type="button"
        variant="secondary"
      >
        Sign out
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await authClient.signIn.social({
            callbackURL: "/library",
            provider: "discord",
          });
        });
      }}
      type="button"
    >
      <DiscordIcon className="text-background size-4" />
      Continue with Discord
    </Button>
  );
};
