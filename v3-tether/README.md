# Topaz Tether

Topaz is local-first. See `topaz-v3-tether-specs/00_context/00_project_summary.md` for the full description. There is no shared server and no hosted database. Each device runs its own copy of this app against its own local SQLite file. When you want to use it, you start the app. It does not run as an always-on service.

The database driver is `@libsql/client`, not `bun:sqlite`. See `docs/BUN_SQLITE_NEXT_BUILD.md` for the reason. The command `bun run build` (through `next-bun-compile` and `next.config.ts`) produces one self-contained Bun executable per device. This binary is what you ship, not a Vercel deployment.

## Getting started

```bash
bun install
bun run db:push   # creates the SQLite file and all tables
bun run dev       # starts the app at http://localhost:3000
```

If you want to pair two or more of your own devices so they sync, follow `docs/GETTING_STARTED_SYNC.md`.

## Analytics log tables: storage and retention

Three append-only log tables back the statistics ladder in `src/features/stats`: `reading_event`, `work_source_observation`, and `audit_log`. If a value changes, each table writes one new row. A refresh or an edit that finds no difference writes zero rows. See `topaz-v3-tether-specs/07_backend/04_audit_logging.md` for the design rationale.

To check the current size, run this query against the local SQLite file:

```sql
select page_count * page_size as size_bytes from pragma_page_count(), pragma_page_size();
select name, sum("pgsize") as size_bytes
from dbstat
where name in ('reading_event', 'work_source_observation', 'audit_log')
group by name
order by size_bytes desc;
```

You can safely prune `work_source_observation` because it can rebuild from the current `work_source` row plus future refreshes. Never prune `reading_event`, because it holds user history that you cannot replace. Never prune `audit_log`, because it holds edit history. To prune old observations, run:

```bash
bun run prune-observations
```

This command deletes `work_source_observation` rows older than 2 years. It only deletes rows once the table grows past a 10 MB threshold. Below that threshold, it logs a message and exits with status 0. The command never runs on a schedule and has no background worker. It does not run `VACUUM` on its own. Run `VACUUM;` manually afterward to reclaim space.

Callers in `src/server/db/audit.ts` must keep `audit_log.before` and `audit_log.after` limited to an allow list of columns. A caller must pass only the specific changed columns, never a full-row dump and never `raw_metadata`. This keeps rows small under the local resource budget described in `topaz-v3-tether-specs/07_backend/02_connections_and_scaling_limits.md`.

To export data for notebook or ML exploration, run:

```bash
bun run export-stats
```

This command writes `tmp/stats-export.json`. The file holds one row per work: ids, counts, status, rating, event counts, days active, and taxonomy slugs. See `src/features/stats/server/export.ts` for the exact column list. This export stays local. The app never exposes it as a Route Handler.
