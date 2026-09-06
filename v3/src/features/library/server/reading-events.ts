import type { readingEventTypeEnum } from "@/server/db/schema/library";

type LibraryEntryStatus =
  | "not_started"
  | "reading"
  | "paused"
  | "completed"
  | "dropped"
  | "plan_to_read"
  | "dropped_as_abandoned"
  | "completed_as_axed";

export type ReadingEventType = (typeof readingEventTypeEnum.enumValues)[number];

export interface ReadingSnapshot {
  status?: LibraryEntryStatus;
  favorite?: boolean;
  rating?: number | null;
  currentChapter?: number | null;
}

interface FavoriteInput {
  kind: "favorite";
  from: ReadingSnapshot;
  to: ReadingSnapshot;
}

interface StatusInput {
  kind: "status";
  from: ReadingSnapshot;
  to: ReadingSnapshot;
  /** True if this library entry has already reached "reading" before. */
  hasStartedBefore: boolean;
}

interface RatingInput {
  kind: "rating";
  from: ReadingSnapshot;
  to: ReadingSnapshot;
}

interface ProgressInput {
  kind: "progress";
  from: ReadingSnapshot;
  to: ReadingSnapshot;
}

export type ReadingEventInput =
  | FavoriteInput
  | StatusInput
  | RatingInput
  | ProgressInput;

export interface ReadingEventPlan {
  eventType: ReadingEventType;
  fromSnapshot: ReadingSnapshot;
  toSnapshot: ReadingSnapshot;
}

const snapshotsEqual = (a: ReadingSnapshot, b: ReadingSnapshot): boolean =>
  a.status === b.status &&
  a.favorite === b.favorite &&
  a.rating === b.rating &&
  a.currentChapter === b.currentChapter;

const statusEventType = (
  to: LibraryEntryStatus | undefined,
  hasStartedBefore: boolean
): ReadingEventType => {
  if (to === "reading" && !hasStartedBefore) {
    return "started";
  }
  if (to === "completed" || to === "completed_as_axed") {
    return "completed";
  }
  if (to === "dropped" || to === "dropped_as_abandoned") {
    return "dropped";
  }
  return "status_changed";
};

/**
 * Pure mapper from a mutation's before/after values to a reading_event row
 * plan. Returns null when nothing actually changed -- callers must skip the
 * insert in that case (insert-only-on-change).
 */
export const toReadingEvent = (
  input: ReadingEventInput
): ReadingEventPlan | null => {
  if (snapshotsEqual(input.from, input.to)) {
    return null;
  }

  let eventType: ReadingEventType;
  if (input.kind === "favorite" || input.kind === "progress") {
    eventType = "progressed";
  } else if (input.kind === "rating") {
    eventType = "rating_changed";
  } else {
    eventType = statusEventType(input.to.status, input.hasStartedBefore);
  }

  return {
    eventType,
    fromSnapshot: input.from,
    toSnapshot: input.to,
  };
};
