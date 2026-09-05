import "server-only";
import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";

/**
 * L4: one row per work, narrow and notebook-ready. Column list is
 * deliberately fixed and documented here for future simple->advanced models
 * (logistic regression on completion, embeddings on taxonomy slugs, etc --
 * out of scope for this slice, see v3/plan-work.md Slice D).
 */
export interface MlExportRow {
  workPublicId: string;
  libraryEntryPublicId: string;
  status: string;
  favorite: boolean;
  rating: number | null;
  currentChapter: number | null;
  latestChapterCount: number | null;
  eventCount: number;
  daysActive: number | null;
  taxonomySlugs: string[];
}

export const getMlExport = async (): Promise<MlExportRow[]> => {
  const rows = await db.execute<{
    work_public_id: string;
    library_entry_public_id: string;
    status: string;
    favorite: boolean;
    rating: number | null;
    current_chapter: number | null;
    latest_chapter_count: number | null;
    event_count: string;
    days_active: string | null;
    taxonomy_slugs: string[] | null;
  }>(sql`
    with latest_observation as (
      select distinct on (work_id) work_id, chapter_count
      from work_source_observation
      order by work_id, created_at desc
    ),
    event_stats as (
      select
        library_entry_id,
        count(*) as event_count,
        extract(epoch from (max(created_at) - min(created_at))) / 86400 as days_active
      from reading_event
      group by library_entry_id
    ),
    taxonomy as (
      select
        wte.work_id,
        array_agg(distinct tt.slug) as slugs
      from work_taxonomy_effective wte
      inner join taxonomy_term tt on tt.id = wte.taxonomy_term_id
      group by wte.work_id
    )
    select
      w.public_id as work_public_id,
      le.public_id as library_entry_public_id,
      le.status,
      le.favorite,
      rs.rating,
      rs.current_chapter,
      lo.chapter_count as latest_chapter_count,
      coalesce(es.event_count, 0) as event_count,
      es.days_active,
      coalesce(t.slugs, '{}') as taxonomy_slugs
    from library_entry le
    inner join work w on w.id = le.work_id
    left join reading_state rs on rs.library_entry_id = le.id
    left join latest_observation lo on lo.work_id = w.id
    left join event_stats es on es.library_entry_id = le.id
    left join taxonomy t on t.work_id = w.id
    order by w.sort_title
  `);

  return rows.map((row) => ({
    currentChapter: row.current_chapter,
    daysActive: row.days_active === null ? null : Number(row.days_active),
    eventCount: Number(row.event_count),
    favorite: row.favorite,
    latestChapterCount: row.latest_chapter_count,
    libraryEntryPublicId: row.library_entry_public_id,
    rating: row.rating,
    status: row.status,
    taxonomySlugs: row.taxonomy_slugs ?? [],
    workPublicId: row.work_public_id,
  }));
};
