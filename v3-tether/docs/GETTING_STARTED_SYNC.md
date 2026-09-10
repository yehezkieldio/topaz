# Setting Up and Testing Topaz Tether Sync

This walks through getting Topaz running on two (or three) of your own devices and pairing them so they sync. Everything here has been verified to actually work — a real `next dev` server, a real signed HTTP request between two independent SQLite files, real convergence — not just typechecked. See `docs/BUN_SQLITE_NEXT_BUILD.md` if you want the full "how we know this works" log.

**What's not done yet**, so you're not surprised:
- No UI for pairing — you run a couple of CLI commands (`bun run sync ...`) instead of clicking through a settings screen.
- Nothing automatically triggers a sync round on app open/close yet — you run `bun run sync round` manually for now.
- Deleting things doesn't sync yet (no delete/tombstone path exists in the app at all currently — only creates and edits do).
- If you seed reference data (taxonomy kinds, source platforms) differently on each device, syncing a taxonomy term across them can fail with a foreign-key error. See "Known limitation" near the end.

None of that blocks trying it out — it just means "type a couple of commands," not "click a button," for now.

## 1. Install Tailscale on every device

Tailscale is what lets your devices reach each other by a stable hostname, wherever they physically are.

1. Go to [tailscale.com/download](https://tailscale.com/download) and install it on each laptop (and phone, if you're setting that up too).
2. Sign in with the same account on every device — they need to be on the same **tailnet**.
3. Once connected, each device gets a stable hostname like `your-laptop.your-tailnet-name.ts.net`. Find yours:
   - CLI: `tailscale status` (shows all devices on your tailnet and their hostnames)
   - Or the Tailscale admin console at [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)

Write down each device's hostname — you'll need it in step 3.

## 2. Get the code and install dependencies (on every device)

```bash
git clone <your-repo-url> topaz
cd topaz
git checkout claude/local-first-p2p-sync-b59s42   # or whatever branch/main it lands on
cd v3-tether
bun install
```

## 3. Configure each device

Create `.env.local` in `v3-tether/` — **the values differ per device**, this isn't one shared file:

```bash
# Where this device's SQLite file lives. Pick any path; it'll be created.
DATABASE_PATH="./topaz.db"

# Generate once per device: `openssl rand -base64 32` (or anything ≥32 chars)
BETTER_AUTH_SECRET="<a-long-random-string>"
BETTER_AUTH_URL="http://localhost:3000"

# This device's own Tailscale hostname and the port you'll run it on.
SYNC_TAILNET_HOSTNAME="this-devices-hostname.your-tailnet.ts.net"
SYNC_PORT="3000"
```

Use the actual hostname from step 1 for `SYNC_TAILNET_HOSTNAME` on each device (each device's own hostname, not another device's).

## 4. Create the database and start the app (on every device)

```bash
bun run db:push    # creates the SQLite file and all tables
bun run dev        # starts the app at http://localhost:3000
```

Leave this running. Open `http://localhost:3000` in a browser and sign up — **the first account created on a device becomes its admin automatically**, and each device only ever allows one account.

Repeat steps 3–4 on your other device(s), each in their own terminal/machine, each with their own `.env.local`.

## 5. Pair the devices

Pairing is a one-time trust exchange, done from the command line via `scripts/sync-cli.ts` (aliased as `bun run sync`). It needs to happen **in both directions** — each device records the other's identity.

On **device A**, with the app already running (from step 4) in another terminal, from the same `v3-tether/` directory:

```bash
bun run sync generate
```

This prints something like:

```
Device ID:   e6514ec0-49fb-4fc2-9edc-e6409257513a
Fingerprint: 5BC6-1FEE

Pairing code -- copy this to the other device:

eyJ2IjoxLCJkZXZpY2VJZCI6...
```

Copy that whole pairing code. On **device B**:

```bash
bun run sync pair "eyJ2IjoxLCJkZXZpY2VJZCI6..."
```

It should print `Paired with <device A's hostname>:3000 (fingerprint 5BC6-1FEE)` — **check that fingerprint matches** what device A printed. That's your confirmation you paired with the right device, not something else on the tailnet.

Now do it **the other way**: `bun run sync generate` on device B, and `bun run sync pair "<code>"` on device A.

Once both directions are done, `bun run sync peers` on either device should list the other one.

## 6. Test it

1. On device A, create something — e.g. add a work to your library, or create a taxonomy term through the UI (or, if the UI for that isn't wired up to something you can reach yet, any admin action that writes through a Server Action works).
2. On device B, run:
   ```bash
   bun run sync round
   ```
   This pulls from every paired peer it can reach and applies what it gets. You should see something like:
   ```
   e6514ec0-...: synced, 1 row(s) applied
   ```
3. Check device B's app (or its database) — the thing you created on A should now be there.
4. Try the reverse: create/edit something on B, run `bun run sync round` from A, confirm it shows up there.
5. Try it with one device's `bun run dev` stopped — the sync round for that peer should report an error (unreachable), not crash, and picks back up fine once you restart it and try again. This is the "devices don't need to be online together" behavior working as intended.

If step 2 shows `0 row(s) applied` when you expected changes, double check you actually ran `bun run sync round` on the device that should be *receiving* the change (the one that didn't create it).

## Known limitation: reference data must match across devices

`bun run db:push` seeds nothing by itself — if your app has a seed script for things like taxonomy categories or source platforms, and you run it independently on each device, each device gets **different random IDs** for those rows. Syncing a taxonomy term (or anything referencing them) across devices will then fail with a foreign-key error, because the ID it points to on the sending device doesn't exist on the receiving one.

Workaround for now: only seed this reference data on **one** device, then let the others pick it up via `bun run sync round` before you create anything that depends on it, rather than running a seed script independently on each device. This is a real gap (documented in `docs/BUN_SQLITE_NEXT_BUILD.md`) that needs a proper fix — giving these tables fixed, deterministic IDs — before this stops being something to work around by hand.

## Troubleshooting

- **"No admin account exists yet"** from `bun run sync ...` — you need to sign up through the running app (`bun dev`, visit the site, sign up) before the CLI commands work; they act as whichever account is that device's admin.
- **Pairing fingerprint doesn't match** what the other device printed — don't proceed. Something's wrong (wrong code copied, or a different device answering on that hostname/port).
- **`bun run sync round` says a peer is unreachable** — check: is that device's `bun dev` actually running? Are both devices connected to Tailscale (`tailscale status`)? Does the `SYNC_PORT` in the peer's `.env.local` match what you paired with (the port is embedded in the pairing code — if you change a device's port after pairing, re-pair)?
- **Port already in use** — another `bun dev` (or anything else) is on that port; change `SYNC_PORT`/pass `-p` to `next dev`, or stop the other process.
