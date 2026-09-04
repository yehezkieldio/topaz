"use client";

import {
  initialFormState,
  mergeForm,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWorkAction } from "@/features/library/server/create-work-action";
import { TermMultiselect } from "@/features/taxonomy/components/term-multiselect";
import {
  createTaxonomyTermAction,
  searchTaxonomyTermsAction,
} from "@/features/taxonomy/server/actions";

import { workFormOpts, workFormSchema } from "./shared-code";

const CONTENT_RATINGS = [
  "not_rated",
  "general",
  "teen",
  "mature",
  "explicit",
] as const;
const PUBLICATION_STATUSES = [
  "in_progress",
  "completed",
  "hiatus",
  "abandoned",
] as const;

const formatOption = (value: string) => value.replaceAll("_", " ");

export const WorkForm = ({
  onDirtyChange,
  onSuccess,
  sourcePlatforms,
}: {
  sourcePlatforms: { id: string; name: string }[];
  onSuccess: (workPublicId: string) => void;
  onDirtyChange: (isDirty: boolean) => void;
}) => {
  const [actionState, dispatchAction, isActionPending] = useActionState(
    createWorkAction,
    initialFormState
  );

  const form = useForm({
    ...workFormOpts,
    listeners: {
      onChange: ({ formApi }) => onDirtyChange(formApi.state.isDirty),
    },
    // initialFormState has `values: undefined` as an *own* property, and
    // mergeForm's deep-merge overwrites any key present on the source object
    // regardless of whether its value is undefined -- merging it in on the
    // very first render (before any real submission) wipes out every
    // defaultValue the form was just initialized with. Skip the merge until
    // there's an actual server response to reconcile.
    transform: useTransform(
      (baseForm) =>
        actionState === initialFormState
          ? baseForm
          : mergeForm(baseForm, actionState ?? {}),
      [actionState]
    ),
    // Re-validates on every change so canSubmit recovers after a failed
    // submission -- without this, a server-merged error from one bad
    // submission would keep the button disabled even once the user fixes
    // the underlying values, since nothing else re-evaluates validity.
    validators: {
      onChange: workFormSchema,
    },
  });

  useEffect(() => {
    if (actionState && "workPublicId" in actionState) {
      onSuccess(actionState.workPublicId as string);
    }
  }, [actionState, onSuccess]);

  return (
    <form
      action={dispatchAction as never}
      className="flex flex-col gap-4"
      onSubmit={() => form.handleSubmit()}
    >
      <form.Field name="title">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Title</Label>
            <Input
              className="rounded-md"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors.map((error) => (
              <p className="text-destructive text-xs" key={String(error)}>
                {String(error)}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="sortTitle">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Sort title</Label>
            <Input
              className="rounded-md"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors.map((error) => (
              <p className="text-destructive text-xs" key={String(error)}>
                {String(error)}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="contentRating">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Content rating</Label>
              <input
                name={field.name}
                type="hidden"
                value={field.state.value}
              />
              <Select
                onValueChange={(value) =>
                  field.handleChange(value as (typeof CONTENT_RATINGS)[number])
                }
                value={field.state.value}
              >
                <SelectTrigger className="w-full rounded-md" id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_RATINGS.map((rating) => (
                    <SelectItem key={rating} value={rating}>
                      {formatOption(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="publicationStatus">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Publication status</Label>
              <input
                name={field.name}
                type="hidden"
                value={field.state.value}
              />
              <Select
                onValueChange={(value) =>
                  field.handleChange(
                    value as (typeof PUBLICATION_STATUSES)[number]
                  )
                }
                value={field.state.value}
              >
                <SelectTrigger className="w-full rounded-md" id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatOption(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="isNsfw">
        {(field) => (
          <label
            className="flex items-center gap-2 text-sm"
            htmlFor={field.name}
          >
            <Checkbox
              checked={field.state.value}
              id={field.name}
              name={field.name}
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            NSFW
          </label>
        )}
      </form.Field>

      <form.Field name="authorName">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Author</Label>
            <Input
              className="rounded-md"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors.map((error) => (
              <p className="text-destructive text-xs" key={String(error)}>
                {String(error)}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="sourcePlatformId">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Source platform</Label>
              <input
                name={field.name}
                type="hidden"
                value={field.state.value}
              />
              <Select
                onValueChange={field.handleChange}
                value={field.state.value}
              >
                <SelectTrigger className="w-full rounded-md" id={field.name}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {sourcePlatforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="sourceUrl">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Source URL</Label>
              <Input
                className="rounded-md"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="taxonomyTermIds">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label>Tags</Label>
            <input
              name={field.name}
              type="hidden"
              value={JSON.stringify(field.state.value)}
            />
            <TermMultiselect
              createTerm={async (name) => {
                const result = await createTaxonomyTermAction(name);
                return result.status === "success" ? result.data : null;
              }}
              onSelectionChange={(selected) =>
                field.handleChange(selected.map((option) => option.id))
              }
              search={searchTaxonomyTermsAction}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            className="mt-2 rounded-md"
            disabled={!canSubmit || isSubmitting || isActionPending}
            type="submit"
          >
            {isSubmitting || isActionPending ? "Creating..." : "Create work"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
