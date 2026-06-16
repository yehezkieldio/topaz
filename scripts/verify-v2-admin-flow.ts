import { encode } from "@auth/core/jwt";
import postgres from "postgres";

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
    const body = JSON.parse(text) as {
        error?: unknown;
        result?: { data?: { json?: unknown } };
    };

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
    const body = JSON.parse(text) as {
        error?: unknown;
        result?: { data?: { json?: unknown } };
    };

    if (!response.ok || body.error) {
        throw new Error(`${path} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    }

    return body.result?.data?.json;
}

type TaxonomyTermResult = {
    kind: string;
    name: string;
    publicId: string;
};

type TaxonomyRelationResult = {
    relationType: string;
};

type CreateWorkResult = {
    libraryEntry: {
        id: string;
        publicId: string;
    };
    work: {
        id: string;
        publicId: string;
    };
};

type LibraryListResult = {
    data?: Array<{ storyPublicId: string }>;
};

let createdWorkPublicId: string | null = null;
let directTermPublicId: string | null = null;
let inferredTermPublicId: string | null = null;

try {
    const suffix = Date.now();
    const direct = (await trpcMutation("taxonomy.createForMultiselect", {
        kind: "trope",
        name: `HTTP Direct ${suffix}`,
    })) as TaxonomyTermResult;
    directTermPublicId = direct.publicId;
    const inferred = (await trpcMutation("taxonomy.createForMultiselect", {
        kind: "genre",
        name: `HTTP Inferred ${suffix}`,
    })) as TaxonomyTermResult;
    inferredTermPublicId = inferred.publicId;
    const relation = (await trpcMutation("taxonomy.createRelation", {
        fromTermPublicId: direct.publicId,
        relationType: "implies",
        toTermPublicId: inferred.publicId,
    })) as TaxonomyRelationResult;

    const created = (await trpcMutation("work.createWithLibraryEntry", {
        title: `V2 HTTP Admin Flow ${suffix}`,
        author: "Mara Solenne",
        url: `https://example.com/topaz-v2-admin-flow-${suffix}`,
        source: "Other",
        description: "Authenticated tRPC admin flow verification item.",
        chapter_count: 8,
        word_count: 24_680,
        is_nsfw: false,
        status: "Ongoing",
        progressStatus: "Reading",
        current_chapter: 2,
        rating: "3.5",
        notes: "Created through authenticated tRPC verification.",
        taxonomyTermIds: [direct.publicId],
    })) as CreateWorkResult;
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
        storyPublicId: created.work.publicId,
        progressPublicId: created.libraryEntry.publicId,
        storyVersion: versions.work_version,
        progressVersion: versions.entry_version,
        title: `V2 HTTP Admin Flow Updated ${suffix}`,
        author: "Mara Solenne",
        url: `https://example.com/topaz-v2-admin-flow-${suffix}`,
        source: "Other",
        description: "Updated through authenticated tRPC verification.",
        chapter_count: 9,
        word_count: 26_001,
        is_nsfw: false,
        status: "Ongoing",
        progressStatus: "Completed",
        current_chapter: 9,
        rating: "4.0",
        notes: "Updated note through authenticated tRPC verification.",
        taxonomyTermIds: [direct.publicId],
    });

    const filtered = (await trpcQuery("library.all", {
        limit: 10,
        search: "",
        sortBy: "updatedAt",
        sortOrder: "desc",
        effectiveTaxonomyTermIds: [inferred.publicId],
    })) as LibraryListResult;
    const filteredByInferred = Boolean(filtered.data?.some((item) => item.storyPublicId === created.work.publicId));
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
