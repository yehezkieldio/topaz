import { ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_20%,hsl(var(--destructive)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]" />
            </div>
            <div className="relative w-full max-w-sm px-4">
                <div className="group relative rounded-sm border border-border/50 bg-card/40 p-8 backdrop-blur-md transition duration-300 before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/5 before:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-br after:from-white/[0.04] after:to-transparent hover:border-border">
                    <div className="relative space-y-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background/50 text-destructive shadow-sm backdrop-blur">
                            <ShieldAlertIcon className="h-5 w-5" />
                        </div>
                        <div className="space-y-3">
                            <h1 className="font-medium tracking-tight text-xl">Access Denied</h1>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                You are not authorized to authenticate.
                            </p>
                        </div>

                        <div className="pt-2 space-y-2">
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-destructive text-sm">
                                Unauthorized
                            </div>
                        </div>

                        <div>
                            <Link
                                className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/40 px-4 py-2 text-xs font-medium text-foreground/90 shadow-sm backdrop-blur transition hover:bg-background/60"
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
