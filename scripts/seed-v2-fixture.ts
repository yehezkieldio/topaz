import { and, eq, inArray } from "drizzle-orm";
import { libraryEntries, readingEvents, readingStates } from "#/server/db/schema/library-entry";
import {
    taxonomyKinds,
    taxonomyLabels,
    taxonomyRelations,
    taxonomyTerms,
    workTaxonomyAssignments,
    workTaxonomyEffective,
} from "#/server/db/schema/taxonomy";
import { users } from "#/server/db/schema/user";
import { contributors, sourcePlatforms, workContributors, workSources, works } from "#/server/db/schema/work";
import { scriptDb, scriptSql } from "./script-db";
import { seedV2ReferenceDataForScripts } from "./seed-v2-reference-data.shared";

const fixtureEmail = "topaz-v2-fixture@example.local";
const fixtureUrl = "https://archiveofourown.org/works/topaz-v2-fixture";
const trailingSlashRegex = /\/+$/;
const normalizedFixtureUrl = normalizeUrl(fixtureUrl);

await seedV2ReferenceDataForScripts();

const [existingUser] = await scriptDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, fixtureEmail))
    .limit(1);
const [user] = existingUser
    ? [existingUser]
    : await scriptDb
          .insert(users)
          .values({
              email: fixtureEmail,
              name: "Topaz V2 Fixture",
          })
          .returning({ id: users.id });

if (!user) {
    throw new Error("Failed to create fixture user");
}

const directTerm = await upsertTaxonomyTerm({ kind: "trope", name: "Found family" });
const inferredTerm = await upsertTaxonomyTerm({ kind: "genre", name: "Character study" });

await scriptDb
    .insert(taxonomyRelations)
    .values({
        fromTermId: directTerm.id,
        toTermId: inferredTerm.id,
        relation_type: "implies",
    })
    .onConflictDoNothing({
        target: [taxonomyRelations.fromTermId, taxonomyRelations.toTermId, taxonomyRelations.relation_type],
    });

const [existingSource] = await scriptDb
    .select({ workId: workSources.workId })
    .from(workSources)
    .innerJoin(sourcePlatforms, eq(sourcePlatforms.id, workSources.sourcePlatformId))
    .where(and(eq(sourcePlatforms.key, "ao3"), eq(workSources.normalized_url, normalizedFixtureUrl)))
    .limit(1);

const workId = existingSource?.workId ?? (await createFixtureWork(user.id));

await scriptDb
    .insert(workTaxonomyAssignments)
    .values({ workId, termId: directTerm.id })
    .onConflictDoNothing({ target: [workTaxonomyAssignments.workId, workTaxonomyAssignments.termId] });

await rebuildFixtureEffectiveTaxonomy(workId);

await scriptSql.end();

console.log(`Seeded V2 fixture library item for ${fixtureEmail}.`);

async function createFixtureWork(userId: string): Promise<string> {
    return await scriptDb.transaction(async (tx) => {
        const [platform] = await tx
            .select({ id: sourcePlatforms.id })
            .from(sourcePlatforms)
            .where(eq(sourcePlatforms.key, "ao3"));
        if (!platform) {
            throw new Error("Missing ao3 source platform seed");
        }

        const [work] = await tx
            .insert(works)
            .values({
                title: "A Practical Map of Starlight",
                sort_title: "a practical map of starlight",
                description:
                    "A compact V2 fixture work for validating library browsing, taxonomy inference, and reading state.",
                summary:
                    "A compact V2 fixture work for validating library browsing, taxonomy inference, and reading state.",
                publication_status: "ongoing",
                content_rating: "general",
                is_nsfw: false,
            })
            .returning({ id: works.id });
        if (!work) {
            throw new Error("Failed to create fixture work");
        }

        const [contributor] = await tx
            .insert(contributors)
            .values({
                name: "Ianthe Vale",
                sort_name: "ianthe vale",
            })
            .returning({ id: contributors.id });
        if (!contributor) {
            throw new Error("Failed to create fixture contributor");
        }

        await tx.insert(workContributors).values({
            workId: work.id,
            contributorId: contributor.id,
            role: "author",
            display_order: 0,
        });

        await tx.insert(workSources).values({
            workId: work.id,
            sourcePlatformId: platform.id,
            url: fixtureUrl,
            normalized_url: normalizedFixtureUrl,
            title_on_source: "A Practical Map of Starlight",
            author_on_source: "Ianthe Vale",
            chapter_count: 12,
            word_count: 48_700,
            source_status: "ongoing",
            is_primary: true,
        });

        const [libraryEntry] = await tx
            .insert(libraryEntries)
            .values({
                userId,
                workId: work.id,
                status: "Reading",
            })
            .returning({ id: libraryEntries.id });
        if (!libraryEntry) {
            throw new Error("Failed to create fixture library entry");
        }

        await tx.insert(readingStates).values({
            libraryEntryId: libraryEntry.id,
            current_chapter: 4,
            rating: 4.2,
            notes: "Fixture note for V2 search and notes filtering.",
            last_read_at: new Date(),
        });

        await tx.insert(readingEvents).values({
            libraryEntryId: libraryEntry.id,
            event_type: "added",
            to_status: "Reading",
            to_chapter: 4,
            to_rating: 4.2,
            note: "Fixture item created.",
        });

        return work.id;
    });
}

async function upsertTaxonomyTerm(input: { kind: string; name: string }) {
    const normalizedName = normalizeText(input.name);
    const [kind] = await scriptDb
        .select({ id: taxonomyKinds.id })
        .from(taxonomyKinds)
        .where(eq(taxonomyKinds.key, input.kind))
        .limit(1);

    if (!kind) {
        throw new Error(`Missing taxonomy kind seed: ${input.kind}`);
    }

    const [existing] = await scriptDb
        .select({ id: taxonomyTerms.id, publicId: taxonomyTerms.publicId })
        .from(taxonomyTerms)
        .where(and(eq(taxonomyTerms.kindId, kind.id), eq(taxonomyTerms.normalized_name, normalizedName)))
        .limit(1);

    if (existing) {
        return existing;
    }

    const [term] = await scriptDb
        .insert(taxonomyTerms)
        .values({
            kindId: kind.id,
            name: input.name,
            normalized_name: normalizedName,
            slug: slugify(input.name),
            status: "active",
        })
        .returning({ id: taxonomyTerms.id, publicId: taxonomyTerms.publicId });

    if (!term) {
        throw new Error(`Failed to create taxonomy term: ${input.name}`);
    }

    await scriptDb.insert(taxonomyLabels).values({
        termId: term.id,
        label: input.name,
        normalized_label: normalizedName,
        label_type: "primary",
        is_primary: true,
    });

    return term;
}

async function rebuildFixtureEffectiveTaxonomy(workId: string) {
    await scriptDb.delete(workTaxonomyEffective).where(eq(workTaxonomyEffective.workId, workId));

    const directAssignments = await scriptDb
        .select({ termId: workTaxonomyAssignments.termId })
        .from(workTaxonomyAssignments)
        .where(eq(workTaxonomyAssignments.workId, workId));

    if (directAssignments.length === 0) {
        return;
    }

    await scriptDb
        .insert(workTaxonomyEffective)
        .values(
            directAssignments.map((assignment) => ({
                workId,
                termId: assignment.termId,
                sourceTermId: assignment.termId,
                reason: "direct",
                depth: 0,
            }))
        )
        .onConflictDoNothing({ target: [workTaxonomyEffective.workId, workTaxonomyEffective.termId] });

    const directTermIds = directAssignments.map((assignment) => assignment.termId);
    const inferredRelations = await scriptDb
        .select({
            sourceTermId: taxonomyRelations.fromTermId,
            termId: taxonomyRelations.toTermId,
            reason: taxonomyRelations.relation_type,
        })
        .from(taxonomyRelations)
        .where(
            and(
                inArray(taxonomyRelations.fromTermId, directTermIds),
                inArray(taxonomyRelations.relation_type, ["implies", "broader", "equivalent_to"])
            )
        );

    if (inferredRelations.length === 0) {
        return;
    }

    await scriptDb
        .insert(workTaxonomyEffective)
        .values(
            inferredRelations.map((relation) => ({
                workId,
                termId: relation.termId,
                sourceTermId: relation.sourceTermId,
                reason: relation.reason,
                depth: 1,
            }))
        )
        .onConflictDoNothing({ target: [workTaxonomyEffective.workId, workTaxonomyEffective.termId] });
}

function normalizeText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(value: string) {
    return value.trim().replace(trailingSlashRegex, "").toLowerCase();
}

function slugify(value: string) {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/['"]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 255) || "term"
    );
}
