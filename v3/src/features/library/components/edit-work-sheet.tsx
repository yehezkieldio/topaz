"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EditWorkForm } from "@/features/library/forms/work-form/edit-work-form";
import { getWorkEditDetailAction } from "@/features/library/server/update-work-action";
import type { WorkEditDetail } from "@/features/library/server/update-work-action";
import { useCloseGuard } from "@/hooks/use-close-guard";

export const EditWorkSheet = ({
  sourcePlatforms,
  trigger,
  workPublicId,
}: {
  workPublicId: string;
  sourcePlatforms: { id: string; name: string }[];
  trigger: React.ReactNode;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [detail, setDetail] = useState<WorkEditDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  const { cancelClose, confirmClose, pendingClose, requestClose } =
    useCloseGuard(open, isDirty, () => setOpen(false));

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const result = await getWorkEditDetailAction(workPublicId);
        if (!cancelled) {
          setDetail(result);
        }
      } catch {
        // requireAdmin() rejects for non-admin viewers -- the trigger button
        // is shown to everyone (same convention as Favorite/Status/Rating on
        // this card), so a forbidden fetch here is expected, not exceptional.
        if (!cancelled) {
          setLoadError(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, workPublicId]);

  const handleSuccess = () => {
    setIsDirty(false);
    setOpen(false);
    router.refresh();
  };

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
        <SheetTrigger asChild>{trigger}</SheetTrigger>
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
            <SheetTitle>Edit work</SheetTitle>
            <SheetDescription>
              Update this story&apos;s details, source, and tags.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {loadError && (
              <p className="text-destructive text-sm">
                Couldn&apos;t load this work for editing -- you may not have
                permission, or it may have been removed.
              </p>
            )}
            {!loadError &&
              (detail ? (
                <EditWorkForm
                  detail={detail}
                  onDirtyChange={setIsDirty}
                  onSuccess={handleSuccess}
                  sourcePlatforms={sourcePlatforms}
                />
              ) : (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ))}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={pendingClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing now will lose what you&apos;ve entered in this form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelClose}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
