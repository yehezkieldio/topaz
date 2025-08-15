"use client";

import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "#/components/ui/sheet";
import { LibraryCreateForm } from "#/features/library/components/forms/library-create-form";

export function LibraryCreateSheet() {
    const [open, setOpen] = useState(false);

    return (
        <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
                <Button className="w-full rounded-md text-foreground hover:text-foreground sm:w-auto" variant="outline">
                    Create New Library Entry
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-full p-0 sm:w-xl" side="right">
                <LibraryCreateForm onClose={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}
