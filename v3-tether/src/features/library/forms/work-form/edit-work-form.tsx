"use client";

import {
  initialFormState,
  mergeForm,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useEffect } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TermMultiselect } from "@/features/taxonomy/components/term-multiselect";
import { createTaxonomyCreatable } from "@/features/taxonomy/creatable";
import {
  listHotTaxonomyTermsAction,
  searchTaxonomyTermsAction,
} from "@/features/taxonomy/server/actions";

import type { WorkEditDetail } from "../../server/update-work-action";
import { updateWorkAction } from "../../server/update-work-action";
import { detectSourcePlatform } from "./detect-source-platform";
import { formatFieldErrors } from "./field-error";
import { SelectField } from "./select-field";
import { workFormOpts, workFormSchema } from "./shared-code";
import {
  cleanSingleLinePaste,
  insertTextAtSelection,
} from "./source-url-utils";
import { TextField } from "./text-field";
import { WorkProgressSection } from "./work-progress-section";

const taxonomyCreatable = createTaxonomyCreatable();

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

// `errorMap.onServer` is typed `unknown` (useForm here has no `onServer`
// validator of its own -- the shape only comes from mergeForm-ing in the
// server action's `ServerValidateError` state at runtime), so parse it with
// zod at this render boundary rather than assuming a shape with `typeof`.
const serverErrorSchema = z.string().min(1);

export const EditWorkForm = ({
  detail,
  onDirtyChange,
  onSuccess,
  sourcePlatforms,
}: {
  detail: WorkEditDetail;
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
  onSuccess: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}) => {
  const boundAction = updateWorkAction.bind(
    null,
    detail.workPublicId,
    detail.version
  );

  const [actionState, dispatchAction, isActionPending] = useActionState(
    boundAction,
    initialFormState
  );

  const form = useForm({
    ...workFormOpts,
    defaultValues: {
      authorName: detail.authorName,
      contentRating: detail.contentRating,
      description: detail.description ?? "",
      isNsfw: detail.isNsfw,
      publicationStatus: detail.publicationStatus,
      sourcePlatformId: detail.sourcePlatformId,
      sourceUrl: detail.sourceUrl,
      taxonomyTermIds: detail.taxonomyTermIds,
      title: detail.title,
    },
    listeners: {
      onChange: ({ formApi }) => onDirtyChange(formApi.state.isDirty),
    },
    transform: useTransform(
      (baseForm) =>
        actionState === initialFormState
          ? baseForm
          : mergeForm(baseForm, actionState ?? {}),
      [actionState]
    ),
    validators: {
      onChange: workFormSchema,
    },
  });

  useEffect(() => {
    if (
      actionState &&
      "status" in actionState &&
      actionState.status === "success"
    ) {
      onSuccess();
    }
  }, [actionState, onSuccess]);

  const conflictVersion =
    actionState &&
    "status" in actionState &&
    actionState.status === "version-conflict"
      ? actionState.currentVersion
      : null;

  const handleSourceUrlBlur = (url: string) => {
    const trimmed = url.trim();
    if (trimmed !== url) {
      form.setFieldValue("sourceUrl", trimmed);
    }
    if (form.getFieldValue("sourcePlatformId")) {
      return;
    }
    const detected = detectSourcePlatform(trimmed, sourcePlatforms);
    if (detected) {
      form.setFieldValue("sourcePlatformId", detected);
    }
  };

  return (
    <form
      action={dispatchAction}
      className="flex flex-col gap-4"
      onSubmit={() => form.handleSubmit()}
    >
      {conflictVersion !== null && (
        <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
          This work changed elsewhere since you opened it -- reopen the sheet to
          see the latest values before saving again.
        </p>
      )}

      <form.Subscribe selector={(state) => state.errorMap.onServer}>
        {(serverError) => {
          const parsed = serverErrorSchema.safeParse(serverError);
          return parsed.success ? (
            <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
              {parsed.data}
            </p>
          ) : null;
        }}
      </form.Subscribe>

      <WorkProgressSection detail={detail} />

      <form.Field name="title">
        {(field) => (
          <TextField
            errors={field.state.meta.errors}
            id={field.name}
            label="Title"
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Description</Label>
            <Textarea
              className="rounded-md"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Work description or summary..."
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="contentRating">
          {(field) => (
            <SelectField
              id={field.name}
              label="Content rating"
              onValueChange={(value) =>
                // SAFETY: options above are built from CONTENT_RATINGS
                // itself, so onValueChange can only fire with one of those.
                field.handleChange(value as (typeof CONTENT_RATINGS)[number])
              }
              options={CONTENT_RATINGS.map((rating) => ({
                label: formatOption(rating),
                value: rating,
              }))}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="publicationStatus">
          {(field) => (
            <SelectField
              id={field.name}
              label="Publication status"
              onValueChange={(value) =>
                // SAFETY: options above are built from PUBLICATION_STATUSES
                // itself, so onValueChange can only fire with one of those.
                field.handleChange(
                  value as (typeof PUBLICATION_STATUSES)[number]
                )
              }
              options={PUBLICATION_STATUSES.map((status) => ({
                label: formatOption(status),
                value: status,
              }))}
              value={field.state.value}
            />
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
          <TextField
            errors={field.state.meta.errors}
            id={field.name}
            label="Author"
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="sourcePlatformId">
          {(field) => (
            <SelectField
              errors={field.state.meta.errors}
              id={field.name}
              label="Source platform"
              onValueChange={field.handleChange}
              options={sourcePlatforms.map((platform) => ({
                label: platform.name,
                value: platform.id,
              }))}
              placeholder="Select..."
              value={field.state.value}
            />
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
                onBlur={(event) => {
                  field.handleBlur();
                  handleSourceUrlBlur(event.target.value);
                }}
                onChange={(event) => field.handleChange(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  const pasted = cleanSingleLinePaste(
                    event.clipboardData.getData("text")
                  );
                  const next = insertTextAtSelection(
                    event.currentTarget,
                    pasted
                  );
                  field.handleChange(next);
                  handleSourceUrlBlur(next);
                }}
                value={field.state.value}
              />
              {formatFieldErrors(field.state.meta.errors).map(
                (message, index) => (
                  <p
                    className="text-destructive text-xs"
                    key={`${index}-${message}`}
                  >
                    {message}
                  </p>
                )
              )}
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
              creatable={taxonomyCreatable}
              initialSelected={detail.taxonomyTermOptions}
              loadHotTerms={listHotTaxonomyTermsAction}
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
            {isSubmitting || isActionPending ? "Saving..." : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
