/**
 * One-shot import of the legacy "Reading Tracker.xlsx" Google Sheet export
 * into the real schema. Run via:
 *
 *   bun run import:reading-tracker -- "Reading Tracker.xlsx"
 *   bun run import:reading-tracker -- "Reading Tracker.xlsx" --dry-run
 *
 * Idempotent by design: a row is skipped whenever a work_source already
 * exists for its (source platform, normalized URL) pair -- the same pair
 * create-work-action.ts's own uniqueness relies on -- so rerunning after a
 * partial import (or after the sheet gains new rows) never duplicates work.
 *
 * Deliberately does NOT touch fichub or any other network metadata source:
 * word counts come straight from the sheet, chapter counts (the fic's
 * *total*, as opposed to the reader's current chapter) are left null since
 * the sheet never recorded them, and author/description are left null too
 * (the sheet has no author column at all). Backfill those later, per-work,
 * via the app's own "fetch metadata" action if wanted.
 */
import { parseArgs } from "node:util";

import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";

config({ path: ".env.local" });

type LibraryStatus =
  | "not_started"
  | "reading"
  | "paused"
  | "completed"
  | "completed_as_axed";

type PublicationStatus = "in_progress" | "completed" | "abandoned";

const STATUS_MAP: Record<string, LibraryStatus> = {
  Axed: "completed_as_axed",
  Completed: "completed",
  "Not Started": "not_started",
  Paused: "paused",
  Reading: "reading",
};

const PUBLICATION_STATUS_BY_LIBRARY_STATUS: Record<
  LibraryStatus,
  PublicationStatus
> = {
  completed: "completed",
  completed_as_axed: "abandoned",
  not_started: "in_progress",
  paused: "in_progress",
  reading: "in_progress",
};

interface PlatformSeed {
  slug: string;
  name: string;
  baseUrl: string;
}

// FF/AO3/SB/SH/WN are already seeded (src/server/db/seed.ts) -- only
// QuestionableQuesting is genuinely new to this app, since the sheet is the
// first place it shows up.
const PLATFORM_BY_CODE: Record<string, PlatformSeed> = {
  AO3: { baseUrl: "https://archiveofourown.org", name: "Archive of Our Own", slug: "ao3" },
  FF: { baseUrl: "https://www.fanfiction.net", name: "FanFiction.Net", slug: "ffn" },
  QQ: {
    baseUrl: "https://forum.questionablequesting.com",
    name: "QuestionableQuesting",
    slug: "qq",
  },
  SB: { baseUrl: "https://www.spacebattles.com", name: "SpaceBattles", slug: "spacebattles" },
  SH: { baseUrl: "https://www.scribblehub.com", name: "ScribbleHub", slug: "scribblehub" },
  WN: { baseUrl: "https://www.webnovel.com", name: "WebNovel", slug: "webnovel" },
};

const LEADING_ARTICLE_PATTERN = /^(?:a|an|the)\s+/iu;
const deriveSortTitle = (title: string): string =>
  title.trim().replace(LEADING_ARTICLE_PATTERN, "").toLowerCase();

const normalizeUrl = (value: string) => value.trim().toLowerCase();
const normalizeName = (value: string) => value.trim().toLowerCase();
const slugify = (value: string) =>
  normalizeName(value)
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/**
 * Splits a sheet "Fandom" cell into individual fandom names. A plain
 * `split(",")` would butcher "Warhammer 40,000" into two terms -- this only
 * splits on a comma that is *not* immediately followed by digits (i.e. not
 * a thousands separator), so "Warhammer 40,000, Mass Effect" still becomes
 * ["Warhammer 40,000", "Mass Effect"].
 */
const splitFandoms = (raw: string): string[] =>
  raw
    .split(/,\s*(?=\D|$)/u)
    .map((s) => s.trim())
    .filter(Boolean);

const parseWordCount = (raw: string | null): number | null => {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw.replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

const parseChapter = (raw: string | null): number | null => {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

const resolveLibraryStatus = (
  statusRaw: string | null,
  currentChapter: number | null
): LibraryStatus => {
  const mapped = statusRaw ? STATUS_MAP[statusRaw.trim()] : undefined;
  if (mapped) {
    return mapped;
  }
  // The sheet has exactly one row with a blank Status but real progress --
  // treat "has a chapter but no status" as still being read, and true blanks
  // (no chapter either) as not yet started.
  return currentChapter !== null ? "reading" : "not_started";
};

interface SheetRow {
  id: string;
  title: string;
  currentChapter: number | null;
  statusRaw: string | null;
  link: string;
  platformCode: string | null;
  wordCount: number | null;
  fandoms: string[];
}

const readSheetRows = (filePath: string): SheetRow[] => {
  const workbook = XLSX.readFile(filePath);
  const tracker = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets.Tracker,
    { defval: null, header: 1, raw: false }
  );
  const details = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets.Details,
    { defval: null, header: 1, raw: false }
  );

  const detailById = new Map<string, unknown[]>();
  for (const row of details.slice(1)) {
    const id = row[0] as string | null;
    if (id) {
      detailById.set(id, row);
    }
  }

  const rows: SheetRow[] = [];
  for (const row of tracker.slice(1)) {
    const [id, title, currentChapterRaw, , statusRaw, link] = row as (
      | string
      | null
    )[];
    if (!(id && title && link)) {
      continue;
    }

    const detail = detailById.get(id);
    const platformCode = (detail?.[2] as string | null) ?? null;
    const wordCount = parseWordCount((detail?.[3] as string | null) ?? null);
    const fandomRaw = (detail?.[4] as string | null) ?? null;

    rows.push({
      currentChapter: parseChapter(currentChapterRaw),
      fandoms: fandomRaw ? splitFandoms(fandomRaw) : [],
      id,
      link: link.trim(),
      platformCode,
      statusRaw,
      title: title.trim(),
      wordCount,
    });
  }
  return rows;
};

const main = async () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { default: false, type: "boolean" },
      user: { type: "string" },
    },
  });

  const filePath = positionals[0] ?? "Reading Tracker.xlsx";
  const dryRun = values["dry-run"] ?? false;

  const { closeDbConnection, db } = await import("@/server/db/client");
  const { rebuildEffectiveTaxonomyForWork } = await import(
    "@/features/taxonomy/server/repository/effective-taxonomy"
  );
  const {
    libraryEntry,
    readingState,
    sourcePlatform,
    taxonomyKind,
    taxonomyTerm,
    user,
    work,
    workSource,
    workTaxonomyAssignment,
  } = await import("@/server/db/schema");

  // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
  const log = console.log;

  const rows = readSheetRows(filePath);
  log(`Read ${rows.length} candidate rows from "${filePath}".`);

  let adminUser: { id: string; email: string };
  if (values.user) {
    const found = await db.query.user.findFirst({
      where: eq(user.email, values.user),
    });
    if (!found) {
      throw new Error(`No user found with email "${values.user}".`);
    }
    adminUser = found;
  } else {
    const admins = await db
      .select({ email: user.email, id: user.id })
      .from(user)
      .where(eq(user.role, "admin"));
    if (admins.length === 0) {
      throw new Error(
        "No admin user found -- pass --user <email> to target a specific account."
      );
    }
    if (admins.length > 1) {
      throw new Error(
        `Multiple admin users found (${admins.map((a) => a.email).join(", ")}) -- pass --user <email> to pick one.`
      );
    }
    adminUser = admins[0];
  }
  log(`Importing library entries for ${adminUser.email} (${adminUser.id}).`);

  const [fandomKind] = await db
    .select({ id: taxonomyKind.id })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, "fandom"))
    .limit(1);
  if (!fandomKind) {
    throw new Error(
      'Taxonomy kind "fandom" not found -- run `bun run db:seed` first.'
    );
  }

  // Caches so re-running (or a single run over 700+ rows) never issues a
  // find-or-create round trip twice for the same platform/fandom.
  const platformIdByCode = new Map<string, string>();
  const termIdByNormalizedName = new Map<string, string>();

  const existingSources = await db
    .select({
      normalizedUrl: workSource.normalizedUrl,
      sourcePlatformId: workSource.sourcePlatformId,
    })
    .from(workSource);
  const existingSourceKeys = new Set(
    existingSources.map((r) => `${r.sourcePlatformId}:${r.normalizedUrl}`)
  );

  const findOrCreatePlatformId = async (code: string): Promise<string> => {
    const cached = platformIdByCode.get(code);
    if (cached) {
      return cached;
    }

    const seed = PLATFORM_BY_CODE[code];
    if (!seed) {
      throw new Error(`Unknown platform code "${code}".`);
    }

    const [existing] = await db
      .select({ id: sourcePlatform.id })
      .from(sourcePlatform)
      .where(eq(sourcePlatform.slug, seed.slug))
      .limit(1);
    if (existing) {
      platformIdByCode.set(code, existing.id);
      return existing.id;
    }

    if (dryRun) {
      // No row to reference yet -- stable placeholder id for this run only.
      const placeholder = `dry-run:${seed.slug}`;
      platformIdByCode.set(code, placeholder);
      log(`  [dry-run] would create source platform "${seed.name}".`);
      return placeholder;
    }

    const [created] = await db
      .insert(sourcePlatform)
      .values(seed)
      .onConflictDoUpdate({
        set: { name: seed.name },
        target: sourcePlatform.slug,
      })
      .returning({ id: sourcePlatform.id });
    if (!created) {
      throw new Error(`Failed to create source platform "${seed.name}".`);
    }
    log(`  Created source platform "${seed.name}".`);
    platformIdByCode.set(code, created.id);
    return created.id;
  };

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  // Runs against whatever executor (`db`, or a `tx` from an in-flight
  // transaction) it's given -- the pool is `max: 1`, so calling `db.*` from
  // *inside* a `db.transaction()` callback would deadlock (the transaction
  // holds the only connection while this waits for one to free up).
  const findOrCreateFandomTermId = async (
    executor: Tx | typeof db,
    name: string
  ): Promise<string> => {
    const normalized = normalizeName(name);
    const cached = termIdByNormalizedName.get(normalized);
    if (cached) {
      return cached;
    }

    const [existing] = await executor
      .select({ id: taxonomyTerm.id })
      .from(taxonomyTerm)
      .where(
        sql`${taxonomyTerm.taxonomyKindId} = ${fandomKind.id} and ${taxonomyTerm.normalizedName} = ${normalized}`
      )
      .limit(1);
    if (existing) {
      termIdByNormalizedName.set(normalized, existing.id);
      return existing.id;
    }

    const [created] = await executor
      .insert(taxonomyTerm)
      .values({
        name,
        normalizedName: normalized,
        slug: slugify(name),
        taxonomyKindId: fandomKind.id,
      })
      .onConflictDoNothing({
        target: [taxonomyTerm.taxonomyKindId, taxonomyTerm.slug],
      })
      .returning({ id: taxonomyTerm.id });

    if (created) {
      termIdByNormalizedName.set(normalized, created.id);
      return created.id;
    }

    // Lost a slug race against an earlier row in this same run -- re-select.
    const [reselected] = await executor
      .select({ id: taxonomyTerm.id })
      .from(taxonomyTerm)
      .where(
        sql`${taxonomyTerm.taxonomyKindId} = ${fandomKind.id} and ${taxonomyTerm.slug} = ${slugify(name)}`
      )
      .limit(1);
    if (!reselected) {
      throw new Error(`Failed to create or find fandom term "${name}".`);
    }
    termIdByNormalizedName.set(normalized, reselected.id);
    return reselected.id;
  };

  let imported = 0;
  let skippedExisting = 0;
  let skippedUnknownPlatform = 0;
  const statusCounts = new Map<LibraryStatus, number>();
  const errors: { row: SheetRow; error: unknown }[] = [];

  const PROGRESS_INTERVAL = 25;
  let processed = 0;
  const startedAt = Date.now();

  for (const row of rows) {
    processed += 1;
    if (processed % PROGRESS_INTERVAL === 0 || processed === rows.length) {
      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      log(
        `  [${processed}/${rows.length}] ${elapsedSeconds}s elapsed -- ` +
          `imported ${imported}, skipped ${skippedExisting + skippedUnknownPlatform}, errors ${errors.length}`
      );
    }

    if (!row.platformCode || !PLATFORM_BY_CODE[row.platformCode]) {
      skippedUnknownPlatform += 1;
      log(
        `  Skipping "${row.title}" (row ${row.id}): unrecognized platform code "${row.platformCode}".`
      );
      continue;
    }

    try {
      const platformId = await findOrCreatePlatformId(row.platformCode);
      const normalizedUrl = normalizeUrl(row.link);
      const sourceKey = `${platformId}:${normalizedUrl}`;

      if (existingSourceKeys.has(sourceKey)) {
        skippedExisting += 1;
        continue;
      }

      const libraryStatus = resolveLibraryStatus(
        row.statusRaw,
        row.currentChapter
      );
      const publicationStatus =
        PUBLICATION_STATUS_BY_LIBRARY_STATUS[libraryStatus];

      if (dryRun) {
        imported += 1;
        statusCounts.set(libraryStatus, (statusCounts.get(libraryStatus) ?? 0) + 1);
        continue;
      }

      await db.transaction(async (tx) => {
        const [createdWork] = await tx
          .insert(work)
          .values({
            publicationStatus,
            sortTitle: deriveSortTitle(row.title),
            title: row.title,
          })
          .returning({ id: work.id });
        if (!createdWork) {
          throw new Error("Failed to create work.");
        }

        await tx.insert(workSource).values({
          normalizedUrl,
          sourcePlatformId: platformId,
          url: row.link,
          wordCount: row.wordCount,
          workId: createdWork.id,
        });

        if (row.fandoms.length > 0) {
          const termIds: string[] = [];
          for (const name of row.fandoms) {
            termIds.push(await findOrCreateFandomTermId(tx, name));
          }
          await tx.insert(workTaxonomyAssignment).values(
            [...new Set(termIds)].map((taxonomyTermId) => ({
              taxonomyTermId,
              workId: createdWork.id,
            }))
          );
          await rebuildEffectiveTaxonomyForWork(tx, createdWork.id);
        }

        const [createdEntry] = await tx
          .insert(libraryEntry)
          .values({
            status: libraryStatus,
            userId: adminUser.id,
            workId: createdWork.id,
          })
          .returning({ id: libraryEntry.id });
        if (!createdEntry) {
          throw new Error("Failed to create library entry.");
        }

        if (row.currentChapter !== null) {
          await tx.insert(readingState).values({
            currentChapter: row.currentChapter,
            libraryEntryId: createdEntry.id,
            version: 1,
          });
        }
      });

      existingSourceKeys.add(sourceKey);
      imported += 1;
      statusCounts.set(libraryStatus, (statusCounts.get(libraryStatus) ?? 0) + 1);
    } catch (error) {
      errors.push({ error, row });
    }
  }

  log("");
  log(`${dryRun ? "[dry-run] " : ""}Done.`);
  log(`  Imported:                  ${imported}`);
  log(`  Skipped (already imported): ${skippedExisting}`);
  log(`  Skipped (unknown platform): ${skippedUnknownPlatform}`);
  log(`  Errors:                     ${errors.length}`);
  for (const [status, count] of statusCounts) {
    log(`    ${status}: ${count}`);
  }
  if (errors.length > 0) {
    log("");
    log("Rows that failed:");
    for (const { row, error } of errors) {
      log(`  - [${row.id}] ${row.title}: ${String(error)}`);
    }
  }

  await closeDbConnection();
};

await main();
