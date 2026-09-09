"use client";

import {
  initialFormState,
  mergeForm,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useEffect, useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWorkMetadataAction } from "@/features/catalog/server/fetch-metadata-action";
import { createWorkAction } from "@/features/library/server/create-work-action";
import { TermMultiselect } from "@/features/taxonomy/components/term-multiselect";
import { createTaxonomyCreatable } from "@/features/taxonomy/creatable";
import {
  listHotTaxonomyTermsAction,
  searchTaxonomyTermsAction,
} from "@/features/taxonomy/server/actions";

import { detectSourcePlatform } from "./detect-source-platform";
import { NewWorkTotalsSection } from "./new-work-totals-section";
import { SelectField } from "./select-field";
import { workFormOpts, workFormSchema } from "./shared-code";
import { SourceUrlField } from "./source-url-field";
import { TextField } from "./text-field";

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

export const WorkForm = ({
  onDirtyChange,
  onSuccess,
  sourcePlatforms,
}: {
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
  onSuccess: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}) => {
  const [actionState, dispatchAction, isActionPending] = useActionState(
    createWorkAction,
    initialFormState
  );

  const [chapterCount, setChapterCount] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [currentChapter, setCurrentChapter] = useState("");
  const [isFetchingMetadata, startMetadataFetch] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      onSuccess();
    }
  }, [actionState, onSuccess]);

  const handleFetchMetadata = () => {
    const url = form.getFieldValue("sourceUrl");
    if (!url) {
      return;
    }
    setFetchError(null);
    startMetadataFetch(async () => {
      const metadata = await fetchWorkMetadataAction(url);
      if (!metadata) {
        setFetchError("Couldn't find story info for that URL.");
        return;
      }
      // Never overwrites something already typed in -- a fetch is a
      // convenience for empty fields, not a way to clobber manual entry.
      if (metadata.title && !form.getFieldValue("title")) {
        form.setFieldValue("title", metadata.title);
      }
      if (metadata.author && !form.getFieldValue("authorName")) {
        form.setFieldValue("authorName", metadata.author);
      }
      if (metadata.description && !form.getFieldValue("description")) {
        form.setFieldValue("description", metadata.description);
      }
      if (metadata.chapterCount !== null && !chapterCount) {
        setChapterCount(String(metadata.chapterCount));
      }
      if (metadata.wordCount !== null && !wordCount) {
        setWordCount(String(metadata.wordCount));
      }
    });
  };

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
            <SourceUrlField
              errors={field.state.meta.errors}
              fetchError={fetchError}
              id={field.name}
              isFetchingMetadata={isFetchingMetadata}
              onBlur={(url) => {
                field.handleBlur();
                handleSourceUrlBlur(url);
              }}
              onChange={field.handleChange}
              onFetchMetadata={handleFetchMetadata}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <NewWorkTotalsSection
        chapterCount={chapterCount}
        currentChapter={currentChapter}
        onChapterCountChange={setChapterCount}
        onCurrentChapterChange={setCurrentChapter}
        onWordCountChange={setWordCount}
        wordCount={wordCount}
      />

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
            {isSubmitting || isActionPending ? "Creating..." : "Create work"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
