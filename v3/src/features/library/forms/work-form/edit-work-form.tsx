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
import { recordSourceObservationAction } from "@/features/catalog/server/observation-actions";
import { RecordObservationPanel } from "@/features/library/components/record-observation-panel";
import { TermMultiselect } from "@/features/taxonomy/components/term-multiselect";
import { createTaxonomyCreatable } from "@/features/taxonomy/creatable";
import {
  listHotTaxonomyTermsAction,
  searchTaxonomyTermsAction,
} from "@/features/taxonomy/server/actions";

import type { WorkEditDetail } from "../../server/update-work-action";
import { updateWorkAction } from "../../server/update-work-action";
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

export const EditWorkForm = ({
  detail,
  onDirtyChange,
  onSuccess,
  sourcePlatforms,
}: {
  detail: WorkEditDetail;
  sourcePlatforms: { id: string; name: string }[];
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
      isNsfw: detail.isNsfw,
      publicationStatus: detail.publicationStatus,
      sortTitle: detail.sortTitle,
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

  return (
    <form
      action={dispatchAction as never}
      className="flex flex-col gap-4"
      onSubmit={() => form.handleSubmit()}
    >
      {conflictVersion !== null && (
        <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
          This work changed elsewhere since you opened it -- reopen the sheet to
          see the latest values before saving again.
        </p>
      )}

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

      {detail.workSourcePublicId && (
        <RecordObservationPanel
          initialChapterCount={detail.latestChapterCount}
          initialPublicationStatus={detail.latestPublicationStatus}
          initialWordCount={detail.latestWordCount}
          recordAction={recordSourceObservationAction}
          workSourcePublicId={detail.workSourcePublicId}
        />
      )}

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
