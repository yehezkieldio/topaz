import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatFieldErrors } from "./field-error";

/** Shared by work-form.tsx (create) and edit-work-form.tsx (edit). */
export const TextField = ({
  errors,
  id,
  label,
  onBlur,
  onChange,
  value,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  errors?: unknown[];
}) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      className="rounded-md"
      id={id}
      name={id}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
    {formatFieldErrors(errors).map((message, index) => (
      <p className="text-destructive text-xs" key={`${index}-${message}`}>
        {message}
      </p>
    ))}
  </div>
);
