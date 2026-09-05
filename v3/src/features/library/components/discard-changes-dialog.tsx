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

/**
 * Shared by create-work-sheet.tsx and edit-work-sheet.tsx -- both pair this
 * with useCloseGuard's pendingClose/cancelClose/confirmClose.
 */
export const DiscardChangesDialog = ({
  onCancel,
  onConfirm,
  open,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <AlertDialog open={open}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
        <AlertDialogDescription>
          Closing now will lose what you&apos;ve entered in this form.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
