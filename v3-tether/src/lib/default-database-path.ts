import os from "node:os";
import path from "node:path";

/**
 * Platform-conventional per-user data directory for this app, used as
 * DATABASE_PATH's fallback (src/lib/env.ts) when the admin hasn't set one
 * explicitly. Each device is its own independent replica
 * (00_context/00_project_summary.md), so this only needs to be a sane
 * default location on that one device, not anything shared or configurable
 * beyond the DATABASE_PATH override that already exists.
 *
 * Linux/BSD: $XDG_DATA_HOME, falling back to ~/.local/share (XDG Base
 * Directory spec). macOS: ~/Library/Application Support, that platform's
 * own convention, not XDG. Windows: %LOCALAPPDATA%, falling back to
 * ~/AppData/Local for the rare case it's unset.
 */
const resolveDataDir = (): string => {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "topaz");
  }

  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    return path.join(base, "topaz");
  }

  const base = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
  return path.join(base, "topaz");
};

export const defaultDatabasePath = path.join(resolveDataDir(), "topaz.db");
