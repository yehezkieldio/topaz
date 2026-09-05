"use client";

import { MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TermCombobox } from "@/features/taxonomy/components/term-combobox";
import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import {
  addRelationAction,
  addTermLabelAction,
  changeTermKindAction,
  deleteRelationAction,
  deleteTermLabelAction,
  getTermVersionAction,
  listTaxonomyKindsAction,
  listTermLabelsAction,
  listTermRelationsAction,
  mergeTermsAction,
  renameTermAction,
  listHotTaxonomyTermsAction,
  searchTaxonomyTermsAction,
  setPrimaryTermLabelAction,
} from "@/features/taxonomy/server/actions";
import type {
  LabelMutationResult,
  RelationRow,
  TaxonomyKindOption,
} from "@/features/taxonomy/server/actions";
import type { MutationResult } from "@/server/query/mutation-result";

const RELATION_TYPES = [
  "broader",
  "related",
  "implies",
  "conflicts_with",
  "equivalent_to",
] as const;

const EditTermPopover = ({
  onClose,
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
  onClose: () => void;
}) => {
  const [name, setName] = useState(termLabel);
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const value = await getTermVersionAction(termId);
      if (!cancelled) {
        setVersion(value);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  const [state, dispatch, isPending] = useActionState(
    async () =>
      version === null ? null : await renameTermAction(termId, version, name),
    null
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(() => {
      dispatch();
    });
  };

  useEffect(() => {
    if (state?.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Edit term</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
          <Input
            aria-label="Term name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          {state?.status === "validation-error" && (
            <p className="text-destructive text-xs">
              {state.fieldErrors.name?.[0]}
            </p>
          )}
          {state?.status === "version-conflict" && (
            <p className="text-destructive text-xs">
              This term changed elsewhere -- reopen to see the latest value.
            </p>
          )}
          <Button
            disabled={isPending || version === null}
            size="sm"
            type="submit"
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RelationsPopover = ({
  onClose,
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
  onClose: () => void;
}) => {
  const [relations, setRelations] = useState<RelationRow[] | null>(null);
  const [relationType, setRelationType] =
    useState<(typeof RELATION_TYPES)[number]>("related");

  const refresh = async () => {
    const rows = await listTermRelationsAction(termId);
    setRelations(rows);
  };

  const [deleteState, dispatchDelete, isDeletePending] = useActionState<
    MutationResult<{ id: string }> | null,
    string
  >(async (_previous, relationId) => {
    const result = await deleteRelationAction(relationId);
    if (result.status === "success") {
      await refresh();
    }
    return result;
  }, null);

  const [addState, dispatchAdd, isAddPending] = useActionState<
    MutationResult<{ id: string }> | null,
    OptionPickerOption
  >(async (_previous, option) => {
    const result = await addRelationAction(termId, option.id, relationType);
    if (result.status === "success") {
      await refresh();
    }
    return result;
  }, null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const rows = await listTermRelationsAction(termId);
      if (!cancelled) {
        setRelations(rows);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Relations for {termLabel}</DialogTitle>
        </DialogHeader>
        <ul className="mb-3 flex flex-col gap-1">
          {(relations ?? []).map((relation) => (
            <li
              className="flex items-center justify-between gap-2 text-xs"
              key={relation.id}
            >
              <span>
                {relation.relationType} &rarr;{" "}
                {relation.toTermId === termId
                  ? relation.fromTermId
                  : relation.toTermId}
              </span>
              <Button
                className="size-5 p-0"
                disabled={isDeletePending}
                onClick={() => {
                  startTransition(() => {
                    dispatchDelete(relation.id);
                  });
                }}
                size="sm"
                variant="ghost"
              >
                <TrashIcon className="size-3" />
              </Button>
            </li>
          ))}
          {relations?.length === 0 && (
            <li className="text-muted-foreground text-xs">No relations yet.</li>
          )}
        </ul>
        {(deleteState?.status === "not-found" ||
          addState?.status === "not-found") && (
          <p className="text-destructive mb-2 text-xs">
            That relation no longer exists -- refresh and try again.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Select
            onValueChange={(value) =>
              setRelationType(value as (typeof RELATION_TYPES)[number])
            }
            value={relationType}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TermCombobox
            exclude={termId}
            loadHotTerms={listHotTaxonomyTermsAction}
            onSelect={(option: OptionPickerOption) => {
              if (isAddPending) {
                return;
              }
              startTransition(() => {
                dispatchAdd(option);
              });
            }}
            placeholder="Related term..."
            search={searchTaxonomyTermsAction}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LabelsPopover = ({
  onClose,
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
  onClose: () => void;
}) => {
  const [labels, setLabels] = useState<LabelMutationResult[] | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const refresh = async () => {
    const rows = await listTermLabelsAction(termId);
    setLabels(rows);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const rows = await listTermLabelsAction(termId);
      if (!cancelled) {
        setLabels(rows);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  const [addState, dispatchAdd, isAddPending] = useActionState<
    MutationResult<LabelMutationResult> | null,
    string
  >(async (_previous, label) => {
    const result = await addTermLabelAction(termId, label);
    if (result.status === "success") {
      setNewLabel("");
      await refresh();
    }
    return result;
  }, null);

  const [deleteState, dispatchDelete, isDeletePending] = useActionState<
    MutationResult<{ id: string }> | null,
    string
  >(async (_previous, labelId) => {
    const result = await deleteTermLabelAction(labelId);
    if (result.status === "success") {
      await refresh();
    }
    return result;
  }, null);

  const [, dispatchSetPrimary, isSetPrimaryPending] = useActionState<
    MutationResult<LabelMutationResult> | null,
    string
  >(async (_previous, labelId) => {
    const result = await setPrimaryTermLabelAction(termId, labelId);
    if (result.status === "success") {
      await refresh();
    }
    return result;
  }, null);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Labels for {termLabel}</DialogTitle>
        </DialogHeader>
        <ul className="mb-3 flex flex-col gap-1">
          {(labels ?? []).map((label) => (
            <li
              className="flex items-center justify-between gap-2 text-xs"
              key={label.id}
            >
              <span className={label.isPrimary ? "font-medium" : undefined}>
                {label.label}
                {label.isPrimary && (
                  <span className="text-muted-foreground ml-1">(primary)</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {!label.isPrimary && (
                  <Button
                    className="h-5 px-1.5 text-[10px]"
                    disabled={isSetPrimaryPending}
                    onClick={() => {
                      startTransition(() => {
                        dispatchSetPrimary(label.id);
                      });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Set primary
                  </Button>
                )}
                <Button
                  className="size-5 p-0"
                  disabled={isDeletePending}
                  onClick={() => {
                    startTransition(() => {
                      dispatchDelete(label.id);
                    });
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            </li>
          ))}
          {labels?.length === 0 && (
            <li className="text-muted-foreground text-xs">No labels yet.</li>
          )}
        </ul>
        {addState?.status === "validation-error" && (
          <p className="text-destructive mb-2 text-xs">
            {addState.fieldErrors.label?.[0]}
          </p>
        )}
        {deleteState?.status === "not-found" && (
          <p className="text-destructive mb-2 text-xs">
            That label no longer exists -- refresh and try again.
          </p>
        )}
        <div className="flex gap-2">
          <Input
            className="text-sm"
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Add an alias..."
            value={newLabel}
          />
          <Button
            disabled={isAddPending || newLabel.trim().length === 0}
            onClick={() => {
              startTransition(() => {
                dispatchAdd(newLabel);
              });
            }}
            size="sm"
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ChangeKindPopover = ({
  onClose,
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
  onClose: () => void;
}) => {
  const [kinds, setKinds] = useState<TaxonomyKindOption[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [kindOptions, currentVersion] = await Promise.all([
        listTaxonomyKindsAction(),
        getTermVersionAction(termId),
      ]);
      if (!cancelled) {
        setKinds(kindOptions);
        setVersion(currentVersion);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  const [state, dispatch, isPending] = useActionState(
    async () =>
      version === null || selectedSlug === ""
        ? null
        : await changeTermKindAction(termId, version, selectedSlug),
    null
  );

  useEffect(() => {
    if (state?.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Change kind for {termLabel}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Select onValueChange={setSelectedSlug} value={selectedSlug}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a kind..." />
            </SelectTrigger>
            <SelectContent>
              {(kinds ?? []).map((kind) => (
                <SelectItem key={kind.slug} value={kind.slug}>
                  {kind.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.status === "validation-error" && (
            <p className="text-destructive text-xs">
              {state.fieldErrors.kind?.[0]}
            </p>
          )}
          {state?.status === "version-conflict" && (
            <p className="text-destructive text-xs">
              This term changed elsewhere -- reopen to see the latest value.
            </p>
          )}
          <Button
            disabled={isPending || version === null || selectedSlug === ""}
            onClick={() => {
              startTransition(() => {
                dispatch();
              });
            }}
            size="sm"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MergeDialog = ({
  onClose,
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
  onClose: () => void;
}) => {
  const [target, setTarget] = useState<OptionPickerOption | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [mergeState, dispatchMerge, isMergePending] = useActionState<
    MutationResult<{ winningTermId: string }> | null,
    string
  >(async (_previous, winningTermId) => {
    const result = await mergeTermsAction(winningTermId, termId);
    if (result.status === "success") {
      onClose();
    }
    return result;
  }, null);

  return (
    <>
      <Dialog onOpenChange={(open) => !open && onClose()} open={!confirming}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Merge &ldquo;{termLabel}&rdquo; into...</DialogTitle>
          </DialogHeader>
          <TermCombobox
            exclude={termId}
            loadHotTerms={listHotTaxonomyTermsAction}
            onSelect={(option) => {
              setTarget(option);
              setConfirming(true);
            }}
            placeholder="Target term..."
            search={searchTaxonomyTermsAction}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => !open && onClose()}
        open={confirming}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge terms?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{termLabel}&rdquo; will be merged into &ldquo;
              {target?.label}&rdquo;. Every work tagged with &ldquo;
              {termLabel}&rdquo; will be retagged, and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mergeState?.status === "not-found" && (
            <p className="text-destructive text-xs">
              One of these terms no longer exists -- close and try again.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMergePending || !target}
              onClick={(event) => {
                if (!target) {
                  return;
                }
                event.preventDefault();
                startTransition(() => {
                  dispatchMerge(target.id);
                });
              }}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/**
 * The one shared chip context menu -- rendered identically everywhere a
 * taxonomy term chip appears (06_library/05_taxonomy_in_sheets.md), backed
 * directly by the taxonomy Server Actions. Each panel is its own popover
 * rather than a route, so no chip surface needs to navigate away.
 */
export const TermChipMenu = ({
  termId,
  termLabel,
}: {
  termId: string;
  termLabel: string;
}) => {
  const [openPanel, setOpenPanel] = useState<
    "none" | "edit" | "relations" | "merge" | "labels" | "kind"
  >("none");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${termLabel} options`}
            className="size-5 p-0"
            size="sm"
            variant="ghost"
          >
            <MoreHorizontalIcon className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setOpenPanel("edit")}>
            Edit term
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenPanel("relations")}>
            Manage relations
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenPanel("labels")}>
            Manage labels
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenPanel("kind")}>
            Change kind
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenPanel("merge")}>
            Merge into...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {openPanel === "edit" && (
        <EditTermPopover
          onClose={() => setOpenPanel("none")}
          termId={termId}
          termLabel={termLabel}
        />
      )}
      {openPanel === "relations" && (
        <RelationsPopover
          onClose={() => setOpenPanel("none")}
          termId={termId}
          termLabel={termLabel}
        />
      )}
      {openPanel === "labels" && (
        <LabelsPopover
          onClose={() => setOpenPanel("none")}
          termId={termId}
          termLabel={termLabel}
        />
      )}
      {openPanel === "kind" && (
        <ChangeKindPopover
          onClose={() => setOpenPanel("none")}
          termId={termId}
          termLabel={termLabel}
        />
      )}
      {openPanel === "merge" && (
        <MergeDialog
          onClose={() => setOpenPanel("none")}
          termId={termId}
          termLabel={termLabel}
        />
      )}
    </>
  );
};
