"use client";

import {
  initialFormState,
  mergeForm,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { WandSparklesIcon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

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
import { workFormOpts, workFormSchema } from "./shared-code";

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

export const WorkForm = ({
  onDirtyChange,
  onSuccess,
  sourcePlatforms,
}: {
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
  onSuccess: (workPublicId: string) => void;
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
      onSuccess(actionState.workPublicId as string);
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
    if (form.getFieldValue("sourcePlatformId")) {
      return;
    }
    const detected = detectSourcePlatform(url, sourcePlatforms);
    if (detected) {
      form.setFieldValue("sourcePlatformId", detected);
    }
  };

  return (
    <form
      action={dispatchAction as never}
      className="flex flex-col gap-4"
      onSubmit={() => form.handleSubmit()}
    >
      <form.Subscribe selector={(state) => state.errorMap.onServer}>
        {(serverError) =>
          typeof serverError === "string" && serverError ? (
            <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
              {serverError}
            </p>
          ) : null
        }
      </form.Subscribe>

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
              <div className="flex gap-2">
                <Input
                  className="rounded-md"
                  id={field.name}
                  name={field.name}
                  onBlur={(event) => {
                    field.handleBlur();
                    handleSourceUrlBlur(event.target.value);
                  }}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <Button
                  aria-label="Fetch story info from URL"
                  className="shrink-0 rounded-md"
                  disabled={isFetchingMetadata || !field.state.value}
                  onClick={handleFetchMetadata}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <WandSparklesIcon className="size-4" />
                </Button>
              </div>
              {fetchError && (
                <p className="text-destructive text-xs">{fetchError}</p>
              )}
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Progress &amp; totals</p>
          <p className="text-muted-foreground text-xs">
            Optional -- fill these in now to skip editing the entry afterward.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentChapter">Current chapter</Label>
            <Input
              className="no-spinner rounded-md"
              id="currentChapter"
              inputMode="numeric"
              name="currentChapter"
              onChange={(event) => setCurrentChapter(event.target.value)}
              type="number"
              value={currentChapter}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chapterCount">Chapters</Label>
            <Input
              className="no-spinner rounded-md"
              id="chapterCount"
              inputMode="numeric"
              name="chapterCount"
              onChange={(event) => setChapterCount(event.target.value)}
              type="number"
              value={chapterCount}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wordCount">Words</Label>
            <Input
              className="no-spinner rounded-md"
              id="wordCount"
              inputMode="numeric"
              name="wordCount"
              onChange={(event) => setWordCount(event.target.value)}
              type="number"
              value={wordCount}
            />
          </div>
        </div>
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
