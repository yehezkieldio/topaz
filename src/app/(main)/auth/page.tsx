import Link from "next/link";
import { Suspense } from "react";
import { AuthActionForm } from "#/components/auth-action-form";
import { AuthUserGate } from "#/components/auth-user-gate";
import { Icons } from "#/components/icons";
import { Button } from "#/components/ui/button";

export default async function Authentication() {
    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]" />
            </div>

            <div className="relative w-full max-w-sm px-4">
                <div className="group relative rounded-sm border border-border/50 bg-card/40 p-8 backdrop-blur-md transition duration-300 will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/5 before:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-br after:from-white/[0.04] after:to-transparent">
                    <div className="relative space-y-6 text-center">
                        <header className="space-y-3 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background/50 shadow-sm backdrop-blur">
                                <Icons.discord className="h-5 w-5 text-white" />
                            </div>
                            <h1 className="font-medium font-serif text-xl tracking-tight">Authentication</h1>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Administrator or owner access only.
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
                                <AuthUserGate>
                                    {(isAdministratorUser) => (
                                        <div className="space-y-4">
                                            <AuthActionForm isAdministratorUser={isAdministratorUser} />
                                        </div>
                                    )}
                                </AuthUserGate>
                            </Suspense>
                        </div>

                        <div>
                            <Link
                                className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/40 px-4 py-2 font-medium text-foreground/90 text-xs shadow-sm backdrop-blur transition hover:bg-background/60"
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
