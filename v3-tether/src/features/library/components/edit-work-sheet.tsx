"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { EditWorkForm } from "@/features/library/forms/work-form/edit-work-form";
import { deleteLibraryEntryAction } from "@/features/library/server/actions";
import { getWorkEditDetailAction } from "@/features/library/server/update-work-action";
import type { WorkEditDetail } from "@/features/library/server/update-work-action";
import { useCloseGuard } from "@/hooks/use-close-guard";

export const EditWorkSheet = ({
  libraryEntryPublicId,
  sourcePlatforms,
  trigger,
  workPublicId,
}: {
  workPublicId: string;
  libraryEntryPublicId: string;
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
  trigger: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [detail, setDetail] = useState<WorkEditDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refetches the list's own query cache in place rather than
  // router.refresh(): a full RSC refresh re-suspends LibraryResults (its
  // "use cache" data was just invalidated by the mutation actions below),
  // which unmounts/remounts this whole card tree -- if that lands while the
  // sheet is still mid-close-animation, the sheet visibly flashes back in
  // before disappearing. A query invalidation just patches the row data in
  // place once it resolves, with no remount.
  const refreshLibraryList = () => {
    void queryClient.invalidateQueries({ queryKey: ["library"] });
  };

  const { cancelClose, confirmClose, pendingClose, requestClose } =
    useCloseGuard(open, isDirty, () => {
      setOpen(false);
      // Reading-progress edits inside the sheet (status/rating/chapter) save
      // through their own actions, not this sheet's submit -- refresh on
      // every close so the card behind it reflects them even when the admin
      // never touched the main "Save changes" button.
      refreshLibraryList();
    });

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const result = await getWorkEditDetailAction(
          workPublicId,
          libraryEntryPublicId
        );
        if (!cancelled) {
          setDetail(result);
        }
      } catch {
        // WorkCard only mounts this trigger for admins, but session state can
        // still lapse (e.g. role revoked, session expired) between render and
        // this fetch -- requireAdmin() rejecting here is a real, if rare, case.
        if (!cancelled) {
          setLoadError(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, workPublicId, libraryEntryPublicId]);

  const handleSuccess = () => {
    setIsDirty(false);
    setOpen(false);
    refreshLibraryList();
  };

  const handleDelete = () => {
    if (!detail) {
      return;
    }
    setDeleteError(null);
    startTransition(async () => {
      setIsDeleting(true);
      const result = await deleteLibraryEntryAction(
        detail.libraryEntryPublicId,
        detail.libraryEntryVersion
      );
      setIsDeleting(false);

      if (result.status === "success") {
        setIsDirty(false);
        setOpen(false);
        refreshLibraryList();
        return;
      }
      if (
        result.status === "version-conflict" ||
        result.status === "not-found"
      ) {
        setDeleteError(
          "This work changed elsewhere since you opened it -- close and reopen the sheet to try again."
        );
        return;
      }
      setDeleteError("Couldn't remove this work from your library.");
    });
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle>Edit work</SheetTitle>
                <SheetDescription>
                  Update this story&apos;s details, source, and tags.
                </SheetDescription>
              </div>
              {detail && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      aria-label="Remove from library"
                      className="text-destructive hover:text-destructive size-8 shrink-0 p-0"
                      disabled={isDeleting}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove this work from your library?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your reading progress and rating for it will no longer
                        be shown, and this removal will sync to your other
                        devices.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </SheetHeader>
          <div className="px-4 pb-6">
            {deleteError && (
              <p className="text-destructive mb-4 text-sm">{deleteError}</p>
            )}
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
      <DiscardChangesDialog
        onCancel={cancelClose}
        onConfirm={confirmClose}
        open={pendingClose}
      />
    </>
  );
};
