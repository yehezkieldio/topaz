"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
      <DiscardChangesDialog
        onCancel={cancelClose}
        onConfirm={confirmClose}
        open={pendingClose}
      />
    </>
  );
};
