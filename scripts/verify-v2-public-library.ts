import postgres from "postgres";

const baseUrl = process.env.TOPAZ_VERIFY_BASE_URL ?? "http://localhost:3000";
const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;
const fixtureUrl = "https://archiveofourown.org/works/topaz-v2-fixture";

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required");
}

const sql = postgres(databaseUrl);

const [fixture] = await sql`
    SELECT w.public_id AS work_public_id,
        le.public_id AS library_entry_public_id,
        direct.public_id AS direct_term_public_id,
        effective.public_id AS effective_term_public_id
    FROM topaz_work w
    INNER JOIN topaz_work_source ws ON ws.work_id = w.id
    INNER JOIN topaz_library_entry le ON le.work_id = w.id
    INNER JOIN topaz_work_taxonomy_assignment wta ON wta.work_id = w.id
    INNER JOIN topaz_taxonomy_term direct ON direct.id = wta.term_id
    INNER JOIN topaz_work_taxonomy_effective wte ON wte.work_id = w.id
    INNER JOIN topaz_taxonomy_term effective ON effective.id = wte.term_id
    WHERE ws.normalized_url = ${fixtureUrl}
        AND direct.normalized_name = 'found family'
        AND effective.normalized_name = 'character study'
    LIMIT 1
`;

if (!fixture) {
    throw new Error("V2 fixture work with direct/effective taxonomy was not found");
}

async function expectPageOk(path: string) {
    const response = await fetch(`${baseUrl}${path}`, { method: "GET" });
    if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
    }
}

async function libraryAll(input: Record<string, unknown>) {
    const url = new URL(`${baseUrl}/api/trpc/library.all`);
    url.searchParams.set("input", JSON.stringify({ json: input }));
    const response = await fetch(url, { method: "GET" });
    const body = (await response.json()) as {
        error?: unknown;
        result?: { data?: { json?: { data?: Array<{ storyPublicId: string }> } } };
    };

    if (!response.ok || body.error) {
        throw new Error(`library.all failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    }

    return body.result?.data?.json?.data ?? [];
}

async function expectFixture(input: Record<string, unknown>, label: string) {
    const rows = await libraryAll({ limit: 10, sortBy: "updatedAt", sortOrder: "desc", ...input });
    if (!rows.some((row) => row.storyPublicId === fixture.work_public_id)) {
        throw new Error(`${label} did not return the fixture work`);
    }
}

try {
    await expectPageOk("/");
    await expectPageOk("/library");
    await expectFixture({}, "browse");
    await expectFixture({ search: "Practical Map" }, "title search");
    await expectFixture({ search: "Ianthe" }, "contributor search");
    await expectFixture({ search: "Found family" }, "taxonomy search");
    await expectFixture({ search: "Fixture note" }, "notes search");
    await expectFixture({ status: ["Reading"] }, "status filter");
    await expectFixture({ source: ["ArchiveOfOurOwn"] }, "source filter");
    await expectFixture({ minRating: 4, maxRating: 5 }, "rating filter");
    await expectFixture({ favorite: false }, "favorite filter");
    await expectFixture({ isNsfw: false }, "NSFW filter");
    await expectFixture({ hasNotes: true }, "notes filter");
    await expectFixture({ directTaxonomyTermIds: [fixture.direct_term_public_id] }, "direct taxonomy filter");
    await expectFixture({ effectiveTaxonomyTermIds: [fixture.effective_term_public_id] }, "effective taxonomy filter");

    console.log(
        JSON.stringify(
            {
                browse: true,
                directTaxonomyFilter: true,
                effectiveTaxonomyFilter: true,
                homePage: true,
                libraryPage: true,
                notesSearch: true,
                sourceFilter: true,
                statusFilter: true,
                titleSearch: true,
            },
            null,
            2
        )
    );
} finally {
    await sql.end();
}
