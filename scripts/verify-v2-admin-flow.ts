import { encode } from "@auth/core/jwt";
import postgres from "postgres";
import { z } from "zod/v4";

const baseUrl = process.env.TOPAZ_VERIFY_BASE_URL ?? "http://localhost:3000";
const authSecret = process.env.AUTH_SECRET;
const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;
const fixtureEmail = process.env.TOPAZ_VERIFY_EMAIL ?? "topaz-v2-fixture@example.local";

if (!authSecret) {
    throw new Error("AUTH_SECRET is required for Auth.js JWT verification");
}

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required");
}

const sql = postgres(databaseUrl);

const trpcResponseSchema = z.object({
    error: z.unknown().optional(),
    result: z
        .object({
            data: z
                .object({
                    json: z.unknown().optional(),
                })
                .optional(),
        })
        .optional(),
});
const taxonomyTermResultSchema = z.object({
    kind: z.string(),
    name: z.string(),
    publicId: z.string(),
});
const taxonomyRelationResultSchema = z.object({
    relationType: z.string(),
});
const createWorkResultSchema = z.object({
    libraryEntry: z.object({
        id: z.string(),
        publicId: z.string(),
    }),
    work: z.object({
        id: z.string(),
        publicId: z.string(),
    }),
});
const libraryListResultSchema = z.object({
    data: z.array(z.object({ workPublicId: z.string() })).optional(),
});

const [user] = await sql`
    SELECT id, email, name
    FROM topaz_user
    WHERE email = ${fixtureEmail}
    LIMIT 1
`;

if (!user) {
    throw new Error(`Verification user is missing: ${fixtureEmail}`);
}

const token = await encode({
    secret: authSecret,
    salt: "authjs.session-token",
    token: {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
    },
});

async function trpcMutation(path: string, input: Record<string, unknown>) {
    const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: `authjs.session-token=${token}`,
        },
        body: JSON.stringify({ json: input }),
    });
    const text = await response.text();
    const body = trpcResponseSchema.parse(JSON.parse(text));

    if (!response.ok || body.error) {
        throw new Error(`${path} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    }

    return body.result?.data?.json;
}

async function trpcQuery(path: string, input: Record<string, unknown>) {
    const url = new URL(`${baseUrl}/api/trpc/${path}`);
    url.searchParams.set("input", JSON.stringify({ json: input }));
    const response = await fetch(url, {
        method: "GET",
        headers: {
            cookie: `authjs.session-token=${token}`,
        },
    });
    const text = await response.text();
    const body = trpcResponseSchema.parse(JSON.parse(text));

    if (!response.ok || body.error) {
        throw new Error(`${path} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    }

    return body.result?.data?.json;
}

let createdWorkPublicId: string | null = null;
let directTermPublicId: string | null = null;
let inferredTermPublicId: string | null = null;

try {
    const suffix = Date.now();
    const direct = taxonomyTermResultSchema.parse(
        await trpcMutation("taxonomy.createForMultiselect", {
            kind: "trope",
            name: `HTTP Direct ${suffix}`,
        })
    );
    directTermPublicId = direct.publicId;
    const inferred = taxonomyTermResultSchema.parse(
        await trpcMutation("taxonomy.createForMultiselect", {
            kind: "genre",
            name: `HTTP Inferred ${suffix}`,
        })
    );
    inferredTermPublicId = inferred.publicId;
    const relation = taxonomyRelationResultSchema.parse(
        await trpcMutation("taxonomy.createRelation", {
            fromTermPublicId: direct.publicId,
            relationType: "implies",
            toTermPublicId: inferred.publicId,
        })
    );

    const created = createWorkResultSchema.parse(
        await trpcMutation("work.createWithLibraryEntry", {
            title: `V2 HTTP Admin Flow ${suffix}`,
            author: "Mara Solenne",
            url: `https://example.com/topaz-v2-admin-flow-${suffix}`,
            source: "Other",
            description: "Authenticated tRPC admin flow verification item.",
            chapter_count: 8,
            word_count: 24_680,
            is_nsfw: false,
            status: "Ongoing",
            libraryEntryStatus: "Reading",
            current_chapter: 2,
            rating: "3.5",
            notes: "Created through authenticated tRPC verification.",
            taxonomyTermIds: [direct.publicId],
        })
    );
    createdWorkPublicId = created.work.publicId;

    const [versions] = await sql`
        SELECT w.version AS work_version, le.version AS entry_version
        FROM topaz_work w
        INNER JOIN topaz_library_entry le ON le.work_id = w.id
        WHERE w.public_id = ${created.work.publicId}
            AND le.public_id = ${created.libraryEntry.publicId}
    `;
    if (!versions) {
        throw new Error("Created work versions were not found");
    }

    await trpcMutation("work.updateWithLibraryEntry", {
        workPublicId: created.work.publicId,
        libraryEntryPublicId: created.libraryEntry.publicId,
        workVersion: versions.work_version,
        libraryEntryVersion: versions.entry_version,
        title: `V2 HTTP Admin Flow Updated ${suffix}`,
        author: "Mara Solenne",
        url: `https://example.com/topaz-v2-admin-flow-${suffix}`,
        source: "Other",
        description: "Updated through authenticated tRPC verification.",
        chapter_count: 9,
        word_count: 26_001,
        is_nsfw: false,
        status: "Ongoing",
        libraryEntryStatus: "Completed",
        current_chapter: 9,
        rating: "4.0",
        notes: "Updated note through authenticated tRPC verification.",
        taxonomyTermIds: [direct.publicId],
    });

    const filtered = libraryListResultSchema.parse(
        await trpcQuery("library.all", {
            limit: 10,
            search: "",
            sortBy: "updatedAt",
            sortOrder: "desc",
            effectiveTaxonomyTermIds: [inferred.publicId],
        })
    );
    const filteredByInferred = Boolean(filtered.data?.some((item) => item.workPublicId === created.work.publicId));
    if (!filteredByInferred) {
        throw new Error("Effective taxonomy filter did not find the updated work");
    }

    const [eventCount] = await sql`
        SELECT count(*)::int AS count
        FROM topaz_reading_event
        WHERE library_entry_id = ${created.libraryEntry.id}
    `;
    if (!eventCount || eventCount.count < 2) {
        throw new Error(`Expected at least 2 reading events, got ${eventCount?.count ?? "none"}`);
    }

    await trpcMutation("work.delete", { publicId: created.work.publicId });
    createdWorkPublicId = null;

    const [remaining] = await sql`
        SELECT count(*)::int AS count
        FROM topaz_work
        WHERE public_id = ${created.work.publicId}
    `;
    if (remaining?.count !== 0) {
        throw new Error("Deleted work still exists");
    }

    console.log(
        JSON.stringify(
            {
                createdWork: created.work.publicId,
                deleted: true,
                directTerm: direct.name,
                filteredByInferred,
                inferredTerm: inferred.name,
                readingEventsBeforeDelete: eventCount.count,
                relation: relation.relationType,
            },
            null,
            2
        )
    );
} finally {
    if (createdWorkPublicId) {
        await sql`DELETE FROM topaz_work WHERE public_id = ${createdWorkPublicId}`;
    }
    if (directTermPublicId || inferredTermPublicId) {
        await sql`
            DELETE FROM topaz_taxonomy_term
            WHERE public_id IN ${sql([directTermPublicId, inferredTermPublicId].filter(Boolean))}
        `;
    }
    await sql.end();
}
