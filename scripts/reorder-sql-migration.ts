import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const commitRegex = /^\s*COMMIT\s*;/im;
const commitBreakpointRegex = /COMMIT\s*;\s*--> statement-breakpoint/i;
const commitReplaceRegex = /(COMMIT\s*;)/i;

const extensionBlocks = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm; --> statement-breakpoint",
    "CREATE EXTENSION IF NOT EXISTS citext; --> statement-breakpoint",
].join("\n");

const hasPgTrgmExtRe = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_trgm;?\s*--> statement-breakpoint/i;
const hasCitextExtRe = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+citext;?\s*--> statement-breakpoint/i;
const leadingWhitespaceRegex = /^\s*/;

function hasExtensionBlocks(sql: string): boolean {
    return hasPgTrgmExtRe.test(sql) && hasCitextExtRe.test(sql);
}

async function reorderSqlMigration(inputFilePath: string, outputFilePath: string): Promise<void> {
    let content: string;

    try {
        content = await readFile(inputFilePath, "utf-8");
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            console.log(`Error: The file '${inputFilePath}' was not found.`);
            return;
        }
        console.log(`An error occurred while reading the file: ${error}`);
        return;
    }

    if (!hasExtensionBlocks(content)) {
        const leadingWhitespaceMatch = content.match(leadingWhitespaceRegex);
        const leading = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";
        const rest = content.slice(leading.length);
        content = `${leading}${extensionBlocks}\n${rest}`;
    }

    const parts = content.split("--> statement-breakpoint");

    const concurrentIndexes: string[] = [];
    const otherStatements: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const statementContent = parts[i];
        const fullStatementBlock = statementContent + (i < parts.length - 1 ? "--> statement-breakpoint\n" : "");
        const trimmedStatementForCheck = statementContent.trim().toUpperCase();

        if (
            trimmedStatementForCheck.startsWith("CREATE INDEX CONCURRENTLY") ||
            trimmedStatementForCheck.startsWith("CREATE UNIQUE INDEX CONCURRENTLY")
        ) {
            concurrentIndexes.push(fullStatementBlock.trim());
        } else if (statementContent.trim() !== "") {
            otherStatements.push(fullStatementBlock);
        }
    }

    if (concurrentIndexes.length === 0) {
        try {
            await writeFile(outputFilePath, content, "utf-8");
        } catch (error) {
            console.log(`An error occurred while writing the file: ${error}`);
        }
        return;
    }

    const normalizedOtherStatements = otherStatements.map((s) => s.trim()).filter(Boolean);
    const normalizedConcurrentIndexes = concurrentIndexes.map((s) => s.trim()).filter(Boolean);

    let modifiedContent = normalizedOtherStatements.join("\n").trim();

    let commitBlock = "";
    if (commitRegex.test(modifiedContent)) {
        if (!commitBreakpointRegex.test(modifiedContent)) {
            modifiedContent = modifiedContent.replace(commitReplaceRegex, "$1\n--> statement-breakpoint");
        }
        commitBlock = "";
    } else {
        commitBlock = "\nCOMMIT;\n--> statement-breakpoint";
    }

    const finalIndexes = normalizedConcurrentIndexes.join("\n");

    const additionalIndexes = [
        `CREATE INDEX "idx_library_mv_search" ON "library_mv" USING GIN ("search_vector"); --> statement-breakpoint`,
        `CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_progress_pid" ON "library_mv"("progress_public_id"); --> statement-breakpoint`,
        `CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_progress_pid" ON "library_mv"("user_public_id", "progress_public_id"); --> statement-breakpoint`,
        `CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_story_unique" ON "library_mv"("user_public_id", "story_public_id"); --> statement-breakpoint`,
        `CREATE UNIQUE INDEX CONCURRENTLY "idx_library_mv_progress_public_id" ON "library_mv"("progress_public_id"); --> statement-breakpoint`,
    ].join("\n");

    let finalContent = modifiedContent;
    if (commitBlock.length > 0) {
        finalContent = `${finalContent}\n${commitBlock}`;
    }
    if (finalIndexes) {
        finalContent = `${finalContent}\n${finalIndexes}`;
    }
    if (additionalIndexes) {
        finalContent = `${finalContent}\n${additionalIndexes}`;
    }

    finalContent = `${finalContent.trimEnd()}\n`;

    try {
        await writeFile(outputFilePath, finalContent, "utf-8");
    } catch (error) {
        console.log(`An error occurred while writing the file: ${error}`);
    }
}

async function main(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const drizzleDir = join(__dirname, "..", "drizzle");
    console.log(`Discovered drizzle directory: ${drizzleDir}`);

    try {
        const files = await readdir(drizzleDir);

        const migrationFile = files.find((fname) => fname.startsWith("0000") && fname.endsWith(".sql"));

        if (!migrationFile) {
            console.log("No SQL file starting with '0000' found in drizzle directory.");
            return;
        }

        console.log(`Found migration file: ${migrationFile}`);

        const inputSqlFile = join(drizzleDir, migrationFile);
        await reorderSqlMigration(inputSqlFile, inputSqlFile);
    } catch (error) {
        console.error(`Error processing migration files: ${error}`);
        throw error;
    }
}

main()
    .then(() => {
        console.log("Reordering SQL migration completed successfully.");
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
