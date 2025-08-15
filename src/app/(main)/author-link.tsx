import Link from "next/link";
import { buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/utils";

export function AuthorLink() {
    return (
        <Link
            className={cn(
                buttonVariants({
                    variant: "link",
                }),
                "p-0 text-sm lg:text-base",
            )}
            href="https://github.com/yehezkieldio"
            rel="noopener noreferrer"
            target="_blank"
        >
            @yehezkieldio
        </Link>
    );
}
