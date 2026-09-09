/**
 * L3 heuristics: pure functions over already-fetched rows, no DB access.
 * Kept separate from queries.ts so they stay unit-testable without a
 * database (v3/plan-work.md Slice D).
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const daysBetween = (later: Date, earlier: Date): number =>
  (later.getTime() - earlier.getTime()) / MS_PER_DAY;

export interface StaleDetectorInput {
  /** Most recent work_source_observation.created_at for this work, if any. */
  latestObservationAt: Date | null;
  /** Most recent reading_event.created_at for this library entry, if any. */
  lastProgressAt: Date | null;
  now: Date;
  staleAfterDays: number;
}

/**
 * True when the source has grown since the reader last made progress, and
 * that gap has stood for at least `staleAfterDays`.
 */
export const isStale = (input: StaleDetectorInput): boolean => {
  if (!input.latestObservationAt) {
    return false;
  }

  const sourceGrewAfterProgress =
    !input.lastProgressAt || input.latestObservationAt > input.lastProgressAt;

  if (!sourceGrewAfterProgress) {
    return false;
  }

  const referencePoint = input.lastProgressAt ?? input.latestObservationAt;
  return daysBetween(input.now, referencePoint) >= input.staleAfterDays;
};

export interface BacklogScoreInput {
  favorite: boolean;
  rating: number | null;
  daysSinceUpdate: number;
  /** Freshness fully decays after this many days. */
  freshnessHorizonDays: number;
}

/**
 * 0-100 score: favorite weight (0/1) x normalized rating (0-1, defaults to
 * a neutral 0.5 when unrated) x freshness (1 = updated today, 0 = at or past
 * the horizon). Deliberately simple -- a heuristic, not a model.
 */
export const backlogScore = (input: BacklogScoreInput): number => {
  const favoriteWeight = input.favorite ? 1 : 0.5;
  const ratingWeight = input.rating === null ? 0.5 : input.rating / 10;
  const freshness = Math.max(
    0,
    1 - input.daysSinceUpdate / input.freshnessHorizonDays
  );

  return Math.round(favoriteWeight * ratingWeight * freshness * 100);
};

export interface GenreAffinityRow {
  taxonomyTermSlug: string;
  rating: number | null;
  completed: boolean;
}

export interface GenreAffinity {
  taxonomyTermSlug: string;
  averageRating: number;
  completionRate: number;
  sampleSize: number;
}

/**
 * Average rating x completion rate per taxonomy term, across whatever rows
 * the caller passes in (one row per work-term pair the reader has read).
 */
export const genreAffinity = (rows: GenreAffinityRow[]): GenreAffinity[] => {
  const bySlug = new Map<string, GenreAffinityRow[]>();
  for (const row of rows) {
    const existing = bySlug.get(row.taxonomyTermSlug) ?? [];
    existing.push(row);
    bySlug.set(row.taxonomyTermSlug, existing);
  }

  return [...bySlug.entries()]
    .map(([taxonomyTermSlug, group]) => {
      const rated = group.filter((row) => row.rating !== null);
      const averageRating = rated.length
        ? rated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / rated.length
        : 0;
      const completionRate =
        group.filter((row) => row.completed).length / group.length;

      return {
        averageRating,
        completionRate,
        sampleSize: group.length,
        taxonomyTermSlug,
      };
    })
    .toSorted((a, b) => b.averageRating - a.averageRating);
};

export interface DropRiskInput {
  status: string;
  daysSinceLastEvent: number;
  rating: number | null;
}

const DROP_RISK_INACTIVITY_DAYS = 30;
const DROP_RISK_LOW_RATING = 4;

/** Paused, silent for 30+ days, and rated 4 or lower out of 10 (or never rated). */
export const isDropRisk = (input: DropRiskInput): boolean =>
  input.status === "paused" &&
  input.daysSinceLastEvent >= DROP_RISK_INACTIVITY_DAYS &&
  (input.rating === null || input.rating <= DROP_RISK_LOW_RATING);
