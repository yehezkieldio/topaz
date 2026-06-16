import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "@auth/core/jwt";
import postgres from "postgres";

const baseUrl = process.env.TOPAZ_VERIFY_BASE_URL ?? "http://localhost:3000";
const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;
const fixtureEmail = process.env.TOPAZ_VERIFY_EMAIL ?? "topaz-v2-fixture@example.local";
const chromeBinary = process.env.CHROME_BIN ?? "google-chrome";
const remoteDebuggingPort = Number(process.env.TOPAZ_VERIFY_CHROME_PORT ?? 9231);
const createdAt = Date.now();
const createTitle = `Browser Admin Flow ${createdAt}`;
const updatedTitle = `Browser Admin Flow Updated ${createdAt}`;
const verificationUrl = `https://example.com/topaz-browser-admin-${createdAt}`;

if (!authSecret) {
    throw new Error("AUTH_SECRET is required for browser admin verification");
}

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required");
}

type CdpResponse<T = unknown> = {
    error?: { message: string };
    id?: number;
    result?: T;
};

type RuntimeEvaluateResult = {
    exceptionDetails?: unknown;
    result: {
        value?: unknown;
    };
};

const browserHelpers = String.raw`
(() => {
    function textOf(element) {
        return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    }

    window.__topazVerify = {
        clickByText(text) {
            const element = [...document.querySelectorAll("button, [role='button'], [role='menuitem']")]
                .find((candidate) => textOf(candidate) === text || textOf(candidate).includes(text));
            if (!element) throw new Error("Clickable text not found: " + text);
            element.click();
        },
        hasCardButton(title, label) {
            const article = [...document.querySelectorAll("article")]
                .find((candidate) => textOf(candidate).includes(title));
            return Boolean(article?.querySelector('button[aria-label="' + label + '"]'));
        },
        async clickDeleteForTitle(title) {
            const article = [...document.querySelectorAll("article")]
                .find((candidate) => textOf(candidate).includes(title));
            if (!article) throw new Error("Article not found for delete: " + title);
            const menuButton = article.querySelector('button[aria-label="More entry actions"]');
            if (!menuButton) throw new Error("Delete menu button not found for: " + title);
            menuButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
            menuButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
            menuButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
            menuButton.click();
            let deleteItem = null;
            for (let attempt = 0; attempt < 20; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                deleteItem = [...document.querySelectorAll("[role='menuitem'], button")]
                    .find((candidate) => textOf(candidate) === "Delete" || textOf(candidate).includes("Delete"));
                if (deleteItem) break;
            }
            if (!deleteItem) throw new Error("Delete menu item not found for: " + title);
            deleteItem.click();
        },
        clickEditForTitle(title) {
            const article = [...document.querySelectorAll("article")]
                .find((candidate) => textOf(candidate).includes(title));
            if (!article) throw new Error("Article not found for edit: " + title);
            const editButton = article.querySelector('button[aria-label="Edit entry"]');
            if (!editButton) throw new Error("Edit button not found for: " + title);
            editButton.click();
        },
        setFieldByLabel(labelText, value) {
            const label = [...document.querySelectorAll("label")]
                .find((candidate) => textOf(candidate).replace("*", "").trim().includes(labelText));
            if (!label) throw new Error("Label not found: " + labelText);
            const id = label.getAttribute("for");
            const labeledElement = id ? document.getElementById(id) : null;
            const field =
                labeledElement instanceof HTMLInputElement || labeledElement instanceof HTMLTextAreaElement
                    ? labeledElement
                    : label.closest("[data-slot='form-item']")?.querySelector("input, textarea");
            if (!field) throw new Error("Field not found for label: " + labelText);
            const prototype =
                field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
            descriptor?.set?.call(field, String(value));
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
        },
    };
})();
`;

const sql = postgres(databaseUrl);
const chromeProfileDir = await mkdtemp(join(tmpdir(), "topaz-chrome-"));
let chromeProcess: ChildProcess | null = null;
let socket: WebSocket | null = null;
let nextMessageId = 0;
const pendingMessages = new Map<number, { reject: (error: Error) => void; resolve: (value: unknown) => void }>();

try {
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

    chromeProcess = spawn(
        chromeBinary,
        [
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            `--remote-debugging-port=${remoteDebuggingPort}`,
            `--user-data-dir=${chromeProfileDir}`,
            "about:blank",
        ],
        { stdio: "ignore" }
    );

    const webSocketDebuggerUrl = await waitForChromeWebSocket();
    socket = await connectWebSocket(webSocketDebuggerUrl);

    await sendCdp("Page.enable");
    await sendCdp("Runtime.enable");
    await sendCdp("Network.enable");
    await sendCdp("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: 900,
        mobile: false,
        width: 1440,
    });
    await sendCdp("Network.setCookie", {
        domain: "localhost",
        httpOnly: true,
        name: "authjs.session-token",
        path: "/",
        sameSite: "Lax",
        url: baseUrl,
        value: token,
    });

    await sendCdp("Page.navigate", { url: `${baseUrl}/library` });
    await waitForPageCondition(`document.body.innerText.includes("Create New Library Entry")`);

    await evaluatePage(`window.__topazVerify.clickByText("Create New Library Entry")`);
    await waitForPageCondition(
        `document.body.innerText.includes("Fill in the details to create a new library entry.")`
    );

    await evaluatePage(`
        window.__topazVerify.setFieldByLabel("Title", ${JSON.stringify(createTitle)});
        window.__topazVerify.setFieldByLabel("Author", "Liora Venn");
        window.__topazVerify.setFieldByLabel("URL", ${JSON.stringify(verificationUrl)});
        window.__topazVerify.setFieldByLabel("Description", "Created by the Chrome browser verification flow.");
        window.__topazVerify.setFieldByLabel("Word Count", "32109");
        window.__topazVerify.setFieldByLabel("Total Chapters", "7");
        window.__topazVerify.setFieldByLabel("Current", "2");
        window.__topazVerify.setFieldByLabel("Rating (0-5)", "3.7");
        window.__topazVerify.setFieldByLabel("Notes", "Browser verification created this entry.");
    `);
    await evaluatePage(`window.__topazVerify.clickByText("Add to Library")`);
    await waitForPageCondition(`document.body.innerText.includes(${JSON.stringify(createTitle)})`, 30_000);
    await waitForPageCondition(
        `window.__topazVerify.hasCardButton(${JSON.stringify(createTitle)}, "Edit entry")`,
        30_000
    );

    const [createdWork] = await sql`
        SELECT w.id AS work_id,
            w.public_id AS work_public_id,
            le.id AS library_entry_id,
            le.public_id AS library_entry_public_id
        FROM topaz_work w
        INNER JOIN topaz_work_source ws ON ws.work_id = w.id
        INNER JOIN topaz_library_entry le ON le.work_id = w.id
        WHERE ws.normalized_url = ${verificationUrl}
        LIMIT 1
    `;

    if (!createdWork) {
        throw new Error("Browser-created work was not found in the database");
    }

    await evaluatePage(`window.__topazVerify.clickEditForTitle(${JSON.stringify(createTitle)})`);
    await waitForPageCondition(`document.body.innerText.includes("Update the details for this library entry.")`);
    await evaluatePage(`
        window.__topazVerify.setFieldByLabel("Title", ${JSON.stringify(updatedTitle)});
        window.__topazVerify.setFieldByLabel("Total Chapters", "8");
        window.__topazVerify.setFieldByLabel("Current", "8");
        window.__topazVerify.setFieldByLabel("Rating (0-5)", "4.4");
        window.__topazVerify.setFieldByLabel("Notes", "Browser verification updated this entry.");
    `);
    await evaluatePage(`window.__topazVerify.clickByText("Update Entry")`);
    await waitForPageCondition(`document.body.innerText.includes(${JSON.stringify(updatedTitle)})`, 30_000);
    await waitForPageCondition(
        `window.__topazVerify.hasCardButton(${JSON.stringify(updatedTitle)}, "More entry actions")`,
        30_000
    );

    const [eventCount] = await sql`
        SELECT count(*)::int AS count
        FROM topaz_reading_event
        WHERE library_entry_id = ${createdWork.library_entry_id}
    `;
    if (!eventCount || eventCount.count < 2) {
        throw new Error(`Expected at least 2 reading events after browser edit, got ${eventCount?.count ?? "none"}`);
    }

    await evaluatePage(`window.__topazVerify.clickDeleteForTitle(${JSON.stringify(updatedTitle)})`);
    await waitForPageCondition(`document.body.innerText.includes("Are you absolutely sure?")`);
    await evaluatePage(`window.__topazVerify.clickByText("Delete Story")`);
    await waitForPageCondition(`!document.body.innerText.includes(${JSON.stringify(updatedTitle)})`, 30_000);

    const [remaining] = await sql`
        SELECT count(*)::int AS count
        FROM topaz_work
        WHERE public_id = ${createdWork.work_public_id}
    `;
    if (remaining?.count !== 0) {
        throw new Error("Browser-deleted work still exists");
    }

    console.log(
        JSON.stringify(
            {
                browserCreated: true,
                browserDeleted: true,
                browserEdited: true,
                createdWork: createdWork.work_public_id,
                readingEventsBeforeDelete: eventCount.count,
                title: updatedTitle,
            },
            null,
            2
        )
    );
} finally {
    await sql`DELETE FROM topaz_work_source WHERE normalized_url = ${verificationUrl}`;
    await sql`DELETE FROM topaz_work WHERE title::text IN ${sql([createTitle, updatedTitle])}`;
    socket?.close();
    chromeProcess?.kill();
    pendingMessages.clear();
    await rm(chromeProfileDir, { force: true, recursive: true });
    await sql.end();
}

async function waitForChromeWebSocket() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
            const pages = (await response.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
            const page = pages.find((item) => item.type === "page");
            if (page?.webSocketDebuggerUrl) {
                return page.webSocketDebuggerUrl;
            }
        } catch {
            // Chrome is still starting.
        }
        await sleep(100);
    }
    throw new Error("Timed out waiting for Chrome remote debugging endpoint");
}

async function connectWebSocket(url: string) {
    const webSocket = new WebSocket(url);
    webSocket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as CdpResponse;
        if (message.id === undefined) {
            return;
        }
        const pending = pendingMessages.get(message.id);
        if (!pending) {
            return;
        }
        pendingMessages.delete(message.id);
        if (message.error) {
            pending.reject(new Error(message.error.message));
        } else {
            pending.resolve(message.result);
        }
    };

    await new Promise<void>((resolve, reject) => {
        webSocket.onopen = () => resolve();
        webSocket.onerror = () => reject(new Error("Failed to connect to Chrome WebSocket"));
    });

    return webSocket;
}

function sendCdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("Chrome WebSocket is not connected"));
    }

    const id = ++nextMessageId;
    const message = { id, method, params };
    const promise = new Promise<T>((resolve, reject) => {
        pendingMessages.set(id, {
            reject,
            resolve: (value) => resolve(value as T),
        });
    });
    socket.send(JSON.stringify(message));
    return promise;
}

async function evaluatePage(expression: string) {
    const result = await sendCdp<RuntimeEvaluateResult>("Runtime.evaluate", {
        awaitPromise: true,
        expression: `${browserHelpers}; ${expression}`,
        returnByValue: true,
    });

    if (result.exceptionDetails) {
        throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    }

    return result.result.value;
}

async function waitForPageCondition(condition: string, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const value = await evaluatePage(`Boolean(document.body && (${condition}))`);
        if (value === true) {
            return;
        }
        await sleep(250);
    }
    const bodyText = await evaluatePage("document.body?.innerText.slice(0, 1000) ?? ''");
    throw new Error(`Timed out waiting for page condition: ${condition}\nBody: ${bodyText}`);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
