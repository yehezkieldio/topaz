/**
 * Fills in SYNC_TAILNET_HOSTNAME/SYNC_PORT in .env from the local
 * `tailscale` CLI, once, so a fresh checkout on a Tailscale-connected
 * machine can `bun dev`/`bun start` with no manual .env authoring for
 * these two keys (they're the only ones Tailscale can actually answer --
 * BETTER_AUTH_SECRET/DATABASE_PATH stay manual). Runs as `predev`/
 * `prestart` (package.json) -- before Next boots, since src/lib/env.ts
 * parses process.env eagerly at import time and can't lazily fill a
 * missing var itself.
 *
 * Never overwrites a value already present in .env, and never blocks
 * startup: if `tailscale` isn't installed, isn't logged in, or its JSON
 * can't be parsed, this prints one warning and exits 0 so the existing
 * manual-.env flow still works (dev machines without Tailscale, CI, etc).
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ENV_FILE = ".env";
const DEFAULT_PORT = "3000";

interface TailscaleStatus {
  Self?: { DNSName?: string };
}

const readEnvFile = (): string =>
  existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8") : "";

const hasKey = (contents: string, key: string): boolean =>
  new RegExp(`^${key}=`, "mu").test(contents);

const detectTailnetHostname = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"]);
    // SAFETY: `tailscale status --json`'s documented output always has this
    // shape; a malformed/unexpected reply is caught by the surrounding
    // try/catch and treated the same as "tailscale unavailable."
    const status = JSON.parse(stdout) as TailscaleStatus;
    const dnsName = status.Self?.DNSName;
    return dnsName ? dnsName.replace(/\.$/u, "") : null;
  } catch {
    return null;
  }
};

const main = async () => {
  const contents = readEnvFile();
  const missingHostname = !hasKey(contents, "SYNC_TAILNET_HOSTNAME");
  const missingPort = !hasKey(contents, "SYNC_PORT");

  if (!(missingHostname || missingPort)) {
    return;
  }

  const additions: string[] = [];

  if (missingHostname) {
    const hostname = await detectTailnetHostname();
    if (hostname) {
      additions.push(`SYNC_TAILNET_HOSTNAME="${hostname}"`);
    } else {
      console.warn(
        "sync-env-setup: couldn't detect this device's Tailscale hostname " +
          "(is `tailscale` installed and logged in?) -- set " +
          "SYNC_TAILNET_HOSTNAME in .env manually."
      );
    }
  }

  if (missingPort) {
    additions.push(`SYNC_PORT="${process.env.PORT ?? DEFAULT_PORT}"`);
  }

  if (additions.length === 0) {
    return;
  }

  const separator = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";
  writeFileSync(ENV_FILE, `${contents}${separator}${additions.join("\n")}\n`);
  console.log(`sync-env-setup: wrote ${additions.length} value(s) to .env.`);
};

await main();
