import { Suspense } from "react";

import { DiscordIcon } from "@/components/icons/discord-icon";
import { Button } from "@/components/ui/button";
import { AuthActionForm } from "@/features/auth/components/auth-action-form";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { getIsAdmin } from "@/server/auth/get-is-admin";

export const metadata = {
  description: "Administrator authentication for Topaz.",
  title: "Authentication | Topaz",
};

/**
 * getIsAdmin() reads headers() (a request-time API) -- under Cache
 * Components, that has to happen inside a Suspense boundary or the route
 * can't be prerendered at all (see blocking-prerender-runtime).
 */
const AuthGate = async () => {
  const isAdmin = await getIsAdmin();
  return <AuthActionForm isAdmin={isAdmin} />;
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
        <AuthGate />
      </Suspense>
    </div>
  </AuthShell>
);

export default AuthPage;
