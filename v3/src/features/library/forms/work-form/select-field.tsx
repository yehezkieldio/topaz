import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatFieldErrors } from "./field-error";

interface SelectFieldOption {
  value: string;
  label: string;
}

/**
 * Shared by work-form.tsx (create) and edit-work-form.tsx (edit) -- the two
 * forms bind this to different TanStack Form fields, so it takes plain
 * value/onValueChange rather than a form/field instance.
 */
export const SelectField = ({
  errors,
  id,
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  errors?: unknown[];
}) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={id}>{label}</Label>
    <input name={id} type="hidden" value={value} />
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger className="w-full rounded-md" id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {formatFieldErrors(errors).map((message, index) => (
      <p className="text-destructive text-xs" key={`${index}-${message}`}>
        {message}
      </p>
    ))}
  </div>
);
