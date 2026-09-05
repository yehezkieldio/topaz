import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";

import { statsTag } from "./cache-tags";

/**
 * L2: reading velocity + lifecycle stats derived from reading_event pairs.
 * One row per library entry that has reached "started"; completion/drop are
 * left null until the corresponding event exists. Single SQL, no app-side
 * joins across rows (v3/plan-work.md Slice D).
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

  const rows = await db.execute<{
    library_entry_id: string;
    started_at: Date;
    completed_at: Date | null;
    days_to_complete: string | null;
  }>(sql`
    select
      library_entry_id,
      min(created_at) filter (where event_type = 'started') as started_at,
      min(created_at) filter (where event_type = 'completed') as completed_at,
      extract(
        epoch from (
          min(created_at) filter (where event_type = 'completed')
          - min(created_at) filter (where event_type = 'started')
        )
      ) / 86400 as days_to_complete
    from reading_event
    group by library_entry_id
    having min(created_at) filter (where event_type = 'started') is not null
  `);

  return rows.map((row) => ({
    completedAt: row.completed_at,
    daysToComplete:
      row.days_to_complete === null ? null : Number(row.days_to_complete),
    libraryEntryId: row.library_entry_id,
    startedAt: row.started_at,
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

const fetchLifecycleRates = async (): Promise<LifecycleRates> => {
  "use cache";
  cacheTag(statsTag);
  cacheLife("hours");

  const [row] = await db.execute<{
    total_started: string;
    completed_count: string;
    dropped_count: string;
    median_days_to_complete: string | null;
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
    select
      count(*) as total_started,
      count(completed.library_entry_id) as completed_count,
      count(dropped.library_entry_id) as dropped_count,
      percentile_cont(0.5) within group (
        order by extract(epoch from (completed.completed_at - started.started_at)) / 86400
      ) as median_days_to_complete
    from started
    left join completed using (library_entry_id)
    left join dropped using (library_entry_id)
  `);

  const totalStarted = Number(row?.total_started ?? 0);
  const completedCount = Number(row?.completed_count ?? 0);
  const droppedCount = Number(row?.dropped_count ?? 0);

  return {
    completedCount,
    completionRate: totalStarted ? completedCount / totalStarted : 0,
    dropRate: totalStarted ? droppedCount / totalStarted : 0,
    droppedCount,
    medianDaysToComplete:
      row?.median_days_to_complete === null ||
      row?.median_days_to_complete === undefined
        ? null
        : Number(row.median_days_to_complete),
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

  const rows = await db.execute<{
    work_id: string;
    work_title: string;
    latest_chapter_count: number | null;
    current_chapter: number | null;
    chapters_behind: number | null;
    latest_observation_at: Date;
  }>(sql`
    with latest_observation as (
      select distinct on (work_id)
        work_id, chapter_count, created_at
      from work_source_observation
      order by work_id, created_at desc
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
    latestObservationAt: row.latest_observation_at,
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

  const rows = await db.execute<{
    work_source_id: string;
    observation_count: string;
    average_interval_days: string | null;
  }>(sql`
    with gaps as (
      select
        work_source_id,
        extract(epoch from (
          created_at - lag(created_at) over (
            partition by work_source_id order by created_at
          )
        )) / 86400 as gap_days
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
    averageIntervalDays:
      row.average_interval_days === null
        ? null
        : Number(row.average_interval_days),
    observationCount: Number(row.observation_count),
    workSourceId: row.work_source_id,
  }));
};

export const getRefreshCadence = cache(fetchRefreshCadence);
