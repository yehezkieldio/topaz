"use client";

import { startTransition, useActionState, useOptimistic } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { libraryStatusValues } from "@/features/library/search-params";
import type { MutationResult } from "@/server/query/mutation-result";

type LibraryStatus = (typeof libraryStatusValues)[number];

interface StatusState {
  status: LibraryStatus;
  version: number;
}

const formatStatusLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

export const StatusSelect = ({
  libraryEntryPublicId,
  status,
  updateStatusAction,
  version,
}: {
  libraryEntryPublicId: string;
  status: LibraryStatus;
  version: number;
  updateStatusAction: (
    libraryEntryPublicId: string,
    expectedVersion: number,
    status: LibraryStatus
  ) => Promise<MutationResult<StatusState>>;
}) => {
  const [state, dispatch, isPending] = useActionState<
    MutationResult<StatusState> | null,
    LibraryStatus
  >(async (previous, nextStatus) => {
    const currentVersion =
      previous?.status === "success" ? previous.data.version : version;
    return await updateStatusAction(
      libraryEntryPublicId,
      currentVersion,
      nextStatus
    );
  }, null);

  const committedStatus =
    state?.status === "success" ? state.data.status : status;
  const [optimisticStatus, setOptimisticStatus] =
    useOptimistic(committedStatus);

  const handleChange = (nextStatus: LibraryStatus) => {
    startTransition(() => {
      setOptimisticStatus(nextStatus);
      dispatch(nextStatus);
    });
  };

  return (
    <Select
      disabled={isPending}
      onValueChange={(value) => handleChange(value as LibraryStatus)}
      value={optimisticStatus}
    >
      <SelectTrigger aria-label="Reading status" className="w-full rounded-md">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {libraryStatusValues.map((value) => (
          <SelectItem key={value} value={value}>
            {formatStatusLabel(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
