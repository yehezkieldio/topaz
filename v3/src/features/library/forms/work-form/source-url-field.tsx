import { WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The create form's Source URL field, paired with its metadata-fetch button. */
export const SourceUrlField = ({
  errors,
  fetchError,
  id,
  isFetchingMetadata,
  onBlur,
  onChange,
  onFetchMetadata,
  value,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  onFetchMetadata: () => void;
  isFetchingMetadata: boolean;
  fetchError: string | null;
  errors?: unknown[];
}) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={id}>Source URL</Label>
    <div className="flex gap-2">
      <Input
        className="rounded-md"
        id={id}
        name={id}
        onBlur={(event) => onBlur(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <Button
        aria-label="Fetch story info from URL"
        className="shrink-0 rounded-md"
        disabled={isFetchingMetadata || !value}
        onClick={onFetchMetadata}
        size="icon"
        type="button"
        variant="outline"
      >
        <WandSparklesIcon className="size-4" />
      </Button>
    </div>
    {fetchError && <p className="text-destructive text-xs">{fetchError}</p>}
    {errors?.map((error) => (
      <p className="text-destructive text-xs" key={String(error)}>
        {String(error)}
      </p>
    ))}
  </div>
);
