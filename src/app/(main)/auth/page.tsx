import { Suspense } from "react";
import { AuthActionForm } from "#/components/auth-action-form";
import { AuthUserGate } from "#/components/auth-user-gate";
import { Icons } from "#/components/icons";
import { Button } from "#/components/ui/button";
import { AuthShell } from "#/server/auth/components/auth-shell";

export default function Authentication() {
    return (
        <AuthShell>
            <header className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background/50 shadow-sm backdrop-blur">
                    <Icons.discord className="h-5 w-5 text-white" />
                </div>
                <h1 className="font-medium text-xl tracking-tight">Authentication</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">Administrator access only.</p>
            </header>

            <div className="pt-2">
                <Suspense
                    fallback={
                        <Button className="w-full" disabled variant="outline">
                            Loading...
                        </Button>
                    }
                >
                    <AuthUserGate>
                        {(isAdministratorUser) => <AuthActionForm isAdministratorUser={isAdministratorUser} />}
                    </AuthUserGate>
                </Suspense>
            </div>
        </AuthShell>
    );
}
