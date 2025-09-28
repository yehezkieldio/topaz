import Link from "next/link";
import { Suspense } from "react";
import { AuthActionForm } from "#/app/(main)/auth/auth-action-form";
import { AuthUserGate } from "#/components/auth-user-gate";
import { Icons } from "#/components/icons";
import { Skeleton } from "#/components/ui/skeleton";

function renderAuthContent(isAdministratorUser: boolean) {
    return (
        <div className="space-y-4">
            <AuthActionForm isAdministratorUser={isAdministratorUser} />
        </div>
    );
}

export default async function Authentication() {
    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_20%,hsl(var(--destructive)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]" />
            </div>
            <div className="relative w-full max-w-sm px-4">
                <div className="group relative rounded-sm border border-border bg-card p-8">
                    <div className="relative space-y-6 text-center">
                        <header className="space-y-3 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
                                <Icons.discord className="h-5 w-5 text-white" />
                            </div>
                            <h1 className="font-display font-medium text-xl tracking-tight">Authentication</h1>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Administrator or owner access only.
                            </p>
                        </header>

                        <div className="pt-2">
                            <Suspense fallback={<Skeleton className="h-9 w-full rounded-md" />}>
                                <AuthUserGate>{renderAuthContent}</AuthUserGate>
                            </Suspense>
                        </div>

                        <div>
                            <Link
                                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground/90 text-xs shadow-sm transition hover:bg-accent/20"
                                href="/"
                            >
                                ← Return Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
