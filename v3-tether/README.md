This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Running It

Topaz is local-first (see `topaz-v3-tether-specs/00_context/00_project_summary.md`): there is no shared server or hosted database. Each device runs its own copy of this app against its own local SQLite file (`bun:sqlite`), started when you want to use it, not as an always-on service. `bun run build` (via `next-bun-compile`, `next.config.ts`) produces a single self-contained Bun executable per device -- that binary is what actually ships, not a Vercel deployment.

## Analytics log tables: storage & retention

Three append-only log tables back the statistics ladder (`src/features/stats`): `reading_event`, `work_source_observation`, and `audit_log`. All three write only when a value actually changes -- a refresh or edit that finds nothing different writes zero rows. See `v3-tether/plan-work.md` §3 for the full design rationale and per-row size math (~64-250 bytes/row, <5 MB/year at personal scale).

**Check current size** (run against the local SQLite file):

```sql
select page_count * page_size as size_bytes from pragma_page_count(), pragma_page_size();
select name, sum("pgsize") as size_bytes
from dbstat
where name in ('reading_event', 'work_source_observation', 'audit_log')
group by name
order by size_bytes desc;
```

**When to prune:** `work_source_observation` is the only log table that's safe to prune -- it's rebuildable from the current `work_source` row plus future refreshes. Never prune `reading_event` (irreplaceable user history) or `audit_log` (edit provenance). Run:

```bash
bun run prune-observations
```

This deletes `work_source_observation` rows older than 2 years, but only runs the delete once the table has grown past a 10 MB threshold (logs and exits 0 otherwise). It never runs on a schedule -- no background worker -- and it never runs `VACUUM` itself; run `VACUUM;` manually afterward to reclaim space (SQLite's `VACUUM` operates on the whole file, not per-table, unlike Postgres's `VACUUM (ANALYZE) table_name`).

**`audit_log.before`/`after` must stay allow-listed.** Callers (`src/server/db/audit.ts`) pass only the specific changed columns, never a full-row dump or `raw_metadata` -- that's what keeps rows small on the local resource budget (`topaz-v3-tether-specs/07_backend/02_connections_and_scaling_limits.md`).

**L4 export** for notebook/ML exploration:

```bash
bun run export-stats
```

Writes `tmp/stats-export.json`, one row per work (ids, counts, status, rating, event counts, days active, taxonomy slugs) -- see `src/features/stats/server/export.ts` for the exact column list. Local-only; never exposed as a Route Handler.
