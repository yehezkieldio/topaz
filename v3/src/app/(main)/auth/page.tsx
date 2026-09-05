import { Suspense } from "react";

import { DiscordIcon } from "@/components/icons/discord-icon";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/features/auth/components/auth-panel";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  description: "Administrator authentication for Topaz.",
  title: "Authentication | Topaz",
};

const AuthPage = () => (
  <AuthShell>
    <header className="space-y-3">
      <div className="border-border/60 bg-background/50 mx-auto flex size-12 items-center justify-center rounded-lg border shadow-sm backdrop-blur">
        <DiscordIcon className="size-5" />
      </div>
      <h1 className="text-xl font-medium tracking-tight">Authentication</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Administrator access only.
      </p>
    </header>

    <div className="pt-2">
      <Suspense
        fallback={
          <Button className="w-full" disabled variant="outline">
            Loading...
          </Button>
        }
      >
        <AuthPanel />
      </Suspense>
    </div>
  </AuthShell>
);

export default AuthPage;
