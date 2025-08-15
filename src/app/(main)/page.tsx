import Link from "next/link";
import { AuthorLink } from "#/app/(main)/author-link";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { env } from "#/env";

export default function Home() {
    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]" />
            </div>
            <div className="relative mx-auto max-w-8xl px-4 py-20 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-row gap-2 font-mono">
                        <Badge className="text-foreground/90 text-sm" variant="outline">
                            Topaz
                        </Badge>
                        <Badge className="text-foreground/90 text-sm" variant="outline">
                            v{env.NEXT_PUBLIC_VERSION}
                        </Badge>
                    </div>
                    <h1 className="mt-4 font-serif text-3xl text-foreground tracking-tight lg:text-4xl">
                        My curated collection of stories and worlds
                    </h1>
                    <p className="mt-6 max-w-3xl text-muted-foreground text-sm leading-7 lg:text-base">
                        This is a personal platform for tracking and exploring my favorite fanfiction, webnovels, and
                        online fiction. It serves as a digital library, letting me manage my reading list and revisit
                        beloved narratives.
                    </p>
                    <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7 lg:text-base">
                        Curated, maintained, and enjoyed by <AuthorLink />.
                    </p>
                    <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7 lg:text-base">
                        While this space is built for me, it is open for anyone to explore and enjoy!
                    </p>
                    <div className="mt-8 flex items-center gap-3">
                        <Link href="/library">
                            <Button className="text-foreground/80" variant="outline">
                                Explore My Library
                            </Button>
                        </Link>
                        <Link href="https://github.com/yehezkieldio/topaz" rel="noopener noreferrer" target="_blank">
                            <Button className="font-medium" variant="ghost">
                                Available on GitHub
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
