import "server-only";

import { type WorkStatus, workStatusEnum } from "#/server/db/schema/work";

const FETCH_TIMEOUT_MS = 10_000;
const OPENGRAPH_FETCH_BYTE_LIMIT = 500_000;
const FICHUB_EPUB_ENDPOINT = "https://fichub.net/api/v0/epub";

// FanFiction.net (and sibling FictionPress) sit behind Cloudflare's bot-challenge, so a direct
// fetch never reaches the real page — it only ever sees the "Just a moment..." interstitial.
// FicHub fetches these server-side and bypasses that, so it's the only viable source for them.
const FICHUB_ONLY_HOSTNAMES = ["fanfiction.net", "fictionpress.com"];

const CHALLENGE_PAGE_MARKERS = [
    "just a moment",
    "attention required",
    "checking your browser",
    "enable javascript and cookies to continue",
    "verify you are human",
];

const WWW_PREFIX_REGEX = /^www\./;

function isFicHubOnlyHost(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.replace(WWW_PREFIX_REGEX, "").toLowerCase();
        return FICHUB_ONLY_HOSTNAMES.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

function looksLikeChallengePage(html: string): boolean {
    const sample = html.slice(0, 4000).toLowerCase();
    return CHALLENGE_PAGE_MARKERS.some((marker) => sample.includes(marker));
}

export type FetchedWorkMetadata = {
    provider: "fichub" | "opengraph";
    title?: string;
    author?: string;
    description?: string;
    status?: WorkStatus;
    wordCount?: number;
    chapterCount?: number;
};

type FicHubMeta = {
    title?: string;
    author?: string;
    description?: string;
    status?: string;
    words?: number;
    chapters?: number;
};

type FicHubResponse = {
    meta?: FicHubMeta;
} & FicHubMeta;

const HTML_ENTITIES: Record<string, string> = {
    "&#39;": "'",
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
};

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match);
}

function cleanText(text: string | undefined): string | undefined {
    if (!text) {
        return;
    }
    const cleaned = decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

function mapFicHubStatus(status: string | undefined): WorkStatus | undefined {
    if (!status) {
        return;
    }
    const normalized = status.trim().toLowerCase();
    if (normalized.includes("complete")) {
        return "Completed";
    }
    if (normalized.includes("progress") || normalized.includes("ongoing")) {
        return "Ongoing";
    }
    if (normalized.includes("hiatus")) {
        return "Hiatus";
    }
    if (normalized.includes("abandon") || normalized.includes("discontinued")) {
        return "Abandoned";
    }
    return workStatusEnum.safeParse(status).success ? workStatusEnum.parse(status) : undefined;
}

async function fetchFromFicHub(url: string): Promise<FetchedWorkMetadata | null> {
    const endpoint = `${FICHUB_EPUB_ENDPOINT}?q=${encodeURIComponent(url)}`;

    let response: Response;
    try {
        response = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
        return null;
    }

    if (!response.ok) {
        return null;
    }

    let body: FicHubResponse;
    try {
        body = (await response.json()) as FicHubResponse;
    } catch {
        return null;
    }

    const meta = body.meta ?? body;
    const title = cleanText(meta.title);

    if (!title) {
        return null;
    }

    return {
        author: cleanText(meta.author),
        chapterCount: typeof meta.chapters === "number" ? meta.chapters : undefined,
        description: cleanText(meta.description),
        provider: "fichub",
        status: mapFicHubStatus(meta.status),
        title,
        wordCount: typeof meta.words === "number" ? meta.words : undefined,
    };
}

const OG_TITLE_PATTERNS = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
];
const OG_DESCRIPTION_PATTERNS = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
];
const OG_AUTHOR_PATTERNS = [
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
];

function extractMetaContent(html: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
        const match = pattern.exec(html);
        if (match !== null && match[1] !== undefined) {
            return cleanText(match[1]);
        }
    }
}

async function fetchFromOpenGraph(url: string): Promise<FetchedWorkMetadata | null> {
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { "user-agent": "Mozilla/5.0 (compatible; TopazBot/1.0; +https://github.com/)" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch {
        return null;
    }

    if (!(response.ok && response.body)) {
        return null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (receivedBytes < OPENGRAPH_FETCH_BYTE_LIMIT) {
        // biome-ignore lint/performance/noAwaitInLoops: each read depends on the previous chunk from the same stream
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
        receivedBytes += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);

    const html = Buffer.concat(chunks).toString("utf-8");

    if (looksLikeChallengePage(html)) {
        return null;
    }

    const title = extractMetaContent(html, OG_TITLE_PATTERNS);

    if (!title) {
        return null;
    }

    const description = extractMetaContent(html, OG_DESCRIPTION_PATTERNS);
    const author = extractMetaContent(html, OG_AUTHOR_PATTERNS);

    return {
        author,
        description,
        provider: "opengraph",
        title,
    };
}

export async function fetchWorkMetadata(url: string): Promise<FetchedWorkMetadata | null> {
    const fromFicHub = await fetchFromFicHub(url);
    if (fromFicHub) {
        return fromFicHub;
    }

    // A direct fetch of these hosts only ever sees Cloudflare's challenge page, never the story.
    if (isFicHubOnlyHost(url)) {
        return null;
    }

    return await fetchFromOpenGraph(url);
}
