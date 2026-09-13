import { Label } from "@/components/ui/label";
import { recordSourceObservationAction } from "@/features/catalog/server/observation-actions";
import { ProgressInput } from "@/features/library/components/progress-input";
import { RatingStars } from "@/features/library/components/rating-stars";
import { RecordObservationPanel } from "@/features/library/components/record-observation-panel";
import { StatusSelect } from "@/features/library/components/status-select";
import {
  updateProgressAction,
  updateRatingAction,
  updateStatusAction,
} from "@/features/library/server/actions";
import type { WorkEditDetail } from "@/features/library/server/update-work-action";

/** The reading-progress + source-observation block in edit-work-form.tsx. */
export const WorkProgressSection = ({ detail }: { detail: WorkEditDetail }) => (
  <div className="flex flex-col gap-4 rounded-md border p-3">
    <p className="text-sm font-medium">Progress</p>

    <div>
      <p className="text-muted-foreground mb-2 text-xs">Your progress</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <StatusSelect
            libraryEntryPublicId={detail.libraryEntryPublicId}
            status={detail.status}
            updateStatusAction={updateStatusAction}
            version={detail.libraryEntryVersion}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Rating</Label>
          <RatingStars
            libraryEntryPublicId={detail.libraryEntryPublicId}
            rating={detail.rating}
            updateRatingAction={updateRatingAction}
            version={detail.readingStateVersion ?? 0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Current chapter</Label>
          <ProgressInput
            currentChapter={detail.currentChapter}
            libraryEntryPublicId={detail.libraryEntryPublicId}
            updateProgressAction={updateProgressAction}
            version={detail.readingStateVersion ?? 0}
          />
        </div>
      </div>
    </div>

    {detail.workSourcePublicId && (
      <div className="border-t pt-4">
        <RecordObservationPanel
          initialChapterCount={detail.latestChapterCount}
          initialPublicationStatus={detail.latestPublicationStatus}
          initialWordCount={detail.latestWordCount}
          recordAction={recordSourceObservationAction}
          workSourcePublicId={detail.workSourcePublicId}
        />
      </div>
    )}
  </div>
);
