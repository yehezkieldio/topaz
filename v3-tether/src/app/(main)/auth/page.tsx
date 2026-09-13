import { KeyRound } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/features/auth/components/auth-panel";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  description: "Local sign-in for this device's Topaz library.",
  title: "Authentication | Topaz",
};

const AuthPage = () => (
  <AuthShell>
    <header className="space-y-3">
      <div className="border-border/60 bg-background/50 mx-auto flex size-12 items-center justify-center rounded-lg border shadow-sm backdrop-blur">
        <KeyRound className="size-5" />
      </div>
      <h1 className="text-xl font-medium tracking-tight">Authentication</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        This device's own account, unlocked locally -- no internet required.
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
