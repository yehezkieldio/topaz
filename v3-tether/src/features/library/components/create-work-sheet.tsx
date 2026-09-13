"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DiscardChangesDialog } from "@/features/library/components/discard-changes-dialog";
import { WorkForm } from "@/features/library/forms/work-form/work-form";
import { useCloseGuard } from "@/hooks/use-close-guard";
import { authClient } from "@/lib/auth-client";

export const CreateWorkSheet = ({
  sourcePlatforms,
}: {
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
}) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { cancelClose, confirmClose, pendingClose, requestClose } =
    useCloseGuard(open, isDirty, () => setOpen(false));

  const handleSuccess = () => {
    setIsDirty(false);
    setOpen(false);
    router.refresh();
  };

  // Hidden for non-admins as a UX nicety only -- createWorkAction enforces
  // requireAdmin() itself regardless of whether this button is visible.
  if (session?.user.role !== "admin") {
    return null;
  }

  return (
    <>
      <Sheet
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
          } else {
            requestClose();
          }
        }}
        open={open}
      >
        <SheetTrigger asChild>
          <Button
            className="text-foreground hover:text-foreground rounded-md"
            variant="outline"
          >
            Create Work
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-full max-w-full overflow-y-auto p-0 sm:max-w-xl"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            requestClose();
          }}
          side="right"
        >
          <SheetHeader>
            <SheetTitle>Create work</SheetTitle>
            <SheetDescription>
              Add a story to the library, its source, and its tags.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <WorkForm
              onDirtyChange={setIsDirty}
              onSuccess={handleSuccess}
              sourcePlatforms={sourcePlatforms}
            />
          </div>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog
        onCancel={cancelClose}
        onConfirm={confirmClose}
        open={pendingClose}
      />
    </>
  );
};
