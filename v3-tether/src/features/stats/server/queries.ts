import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";

import { statsTag } from "./cache-tags";

const MS_PER_DAY = 86_400_000;

/**
 * L2: reading velocity + lifecycle stats derived from reading_event pairs.
 * One row per library entry that has reached "started"; completion/drop are
 * left null until the corresponding event exists. Single SQL, no app-side
 * joins across rows (v3-tether/plan-work.md Slice D).
 *
 * created_at is stored as integer epoch milliseconds
 * (03_data/00_schema_contract.md's timestamp -> SQLite translation), so a
 * day-difference is plain integer subtraction divided by MS_PER_DAY -- no
 * extract(epoch from ...) needed the way the Postgres version required.
 */
export interface ReadingVelocityRow {
  libraryEntryId: string;
  startedAt: Date;
  completedAt: Date | null;
  daysToComplete: number | null;
}

const fetchReadingVelocity = async (): Promise<ReadingVelocityRow[]> => {
  "use cache";
  cacheTag(statsTag);
  cacheLife("hours");

  const rows = await db.all<{
    library_entry_id: string;
    started_at: number;
    completed_at: number | null;
    days_to_complete: number | null;
  }>(sql`
    select
      library_entry_id,
      min(created_at) filter (where event_type = 'started') as started_at,
      min(created_at) filter (where event_type = 'completed') as completed_at,
      cast(
        min(created_at) filter (where event_type = 'completed')
        - min(created_at) filter (where event_type = 'started')
      as real) / ${MS_PER_DAY} as days_to_complete
    from reading_event
    group by library_entry_id
    having min(created_at) filter (where event_type = 'started') is not null
  `);

  return rows.map((row) => ({
    completedAt: row.completed_at === null ? null : new Date(row.completed_at),
    daysToComplete: row.days_to_complete,
    libraryEntryId: row.library_entry_id,
    startedAt: new Date(row.started_at),
  }));
};

export const getReadingVelocity = cache(fetchReadingVelocity);

export interface LifecycleRates {
  totalStarted: number;
  completedCount: number;
  droppedCount: number;
  completionRate: number;
  dropRate: number;
  medianDaysToComplete: number | null;
}

/**
 * The middle value of a sorted numeric array (or the average of the two
 * middle values for an even-length array) -- SQLite has no ordered-set
 * aggregate like Postgres's percentile_cont(), so the median is computed
 * here instead of in SQL. Fine at this app's scale: one row per completed
 * library entry, not a dataset large enough to justify pushing this into
 * the database.
 */
const median = (sortedValues: number[]): number | null => {
  if (sortedValues.length === 0) {
    return null;
  }
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
};

const fetchLifecycleRates = async (): Promise<LifecycleRates> => {
  "use cache";
  cacheTag(statsTag);
  cacheLife("hours");

  const rows = await db.all<{
    started_at: number;
    completed_at: number | null;
    dropped_at: number | null;
  }>(sql`
    with started as (
      select library_entry_id, min(created_at) as started_at
      from reading_event
      where event_type = 'started'
      group by library_entry_id
    ),
    completed as (
      select library_entry_id, min(created_at) as completed_at
      from reading_event
      where event_type = 'completed'
      group by library_entry_id
    ),
    dropped as (
      select library_entry_id, min(created_at) as dropped_at
      from reading_event
      where event_type = 'dropped'
      group by library_entry_id
    )
    select started.started_at, completed.completed_at, dropped.dropped_at
    from started
    left join completed using (library_entry_id)
    left join dropped using (library_entry_id)
  `);

  const totalStarted = rows.length;
  const completedCount = rows.filter((row) => row.completed_at !== null).length;
  const droppedCount = rows.filter((row) => row.dropped_at !== null).length;
  const daysToCompleteValues = rows
    .filter(
      (row): row is typeof row & { completed_at: number } =>
        row.completed_at !== null
    )
    .map((row) => (row.completed_at - row.started_at) / MS_PER_DAY)
    .sort((a, b) => a - b);

  return {
    completedCount,
    completionRate: totalStarted ? completedCount / totalStarted : 0,
    dropRate: totalStarted ? droppedCount / totalStarted : 0,
    droppedCount,
    medianDaysToComplete: median(daysToCompleteValues),
    totalStarted,
  };
};

export const getLifecycleRates = cache(fetchLifecycleRates);

/**
 * How far behind the reader is on each work with at least one observation:
 * latest reported chapter count minus the reader's current chapter.
 */
export interface UpdateLagRow {
  workId: string;
  workTitle: string;
  latestChapterCount: number | null;
  currentChapter: number | null;
  chaptersBehind: number | null;
  latestObservationAt: Date;
}

const fetchUpdateLag = async (): Promise<UpdateLagRow[]> => {
  "use cache";
  cacheTag(statsTag);
  cacheLife("hours");

  const rows = await db.all<{
    work_id: string;
    work_title: string;
    latest_chapter_count: number | null;
    current_chapter: number | null;
    chapters_behind: number | null;
    latest_observation_at: number;
  }>(sql`
    with ranked_observation as (
      select
        work_id, chapter_count, created_at,
        row_number() over (
          partition by work_id order by created_at desc
        ) as rn
      from work_source_observation
    ),
    latest_observation as (
      select work_id, chapter_count, created_at
      from ranked_observation
      where rn = 1
    )
    select
      w.id as work_id,
      w.title as work_title,
      lo.chapter_count as latest_chapter_count,
      rs.current_chapter,
      lo.chapter_count - rs.current_chapter as chapters_behind,
      lo.created_at as latest_observation_at
    from latest_observation lo
    inner join work w on w.id = lo.work_id
    inner join library_entry le on le.work_id = w.id
    left join reading_state rs on rs.library_entry_id = le.id
    where lo.chapter_count is not null
      and (rs.current_chapter is null or lo.chapter_count > rs.current_chapter)
    order by chapters_behind desc nulls last
  `);

  return rows.map((row) => ({
    chaptersBehind: row.chapters_behind,
    currentChapter: row.current_chapter,
    latestChapterCount: row.latest_chapter_count,
    latestObservationAt: new Date(row.latest_observation_at),
    workId: row.work_id,
    workTitle: row.work_title,
  }));
};

export const getUpdateLag = cache(fetchUpdateLag);

/** Average days between consecutive observations, per work_source. */
export interface RefreshCadenceRow {
  workSourceId: string;
  observationCount: number;
  averageIntervalDays: number | null;
}

const fetchRefreshCadence = async (): Promise<RefreshCadenceRow[]> => {
  "use cache";
  cacheTag(statsTag);
  cacheLife("hours");

  const rows = await db.all<{
    work_source_id: string;
    observation_count: number;
    average_interval_days: number | null;
  }>(sql`
    with gaps as (
      select
        work_source_id,
        cast(
          created_at - lag(created_at) over (
            partition by work_source_id order by created_at
          )
        as real) / ${MS_PER_DAY} as gap_days
      from work_source_observation
    )
    select
      work_source_id,
      count(*) as observation_count,
      avg(gap_days) as average_interval_days
    from gaps
    group by work_source_id
  `);

  return rows.map((row) => ({
    averageIntervalDays: row.average_interval_days,
    observationCount: row.observation_count,
    workSourceId: row.work_source_id,
  }));
};

export const getRefreshCadence = cache(fetchRefreshCadence);
