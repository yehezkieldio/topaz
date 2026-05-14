import { ShieldAlertIcon } from "lucide-react";
import { AuthShell } from "#/server/auth/components/auth-shell";

export default function UnauthorizedPage() {
    return (
        <AuthShell tone="destructive">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background/50 text-destructive shadow-sm backdrop-blur">
                <ShieldAlertIcon className="h-5 w-5" />
            </div>
            <div className="space-y-3">
                <h1 className="font-medium text-xl tracking-tight">Access Denied</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">You are not authorized to authenticate.</p>
            </div>

            <div className="space-y-2 pt-2">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-destructive text-sm">
                    Unauthorized
                </div>
            </div>
        </AuthShell>
    );
}
