# Packaging and Lifecycle: "Opened on Demand"

## No Daemon

Topaz is not a background service on any device. The admin starts the compiled binary (`02_stack/00_stack_contract.md`'s `next-bun-compile` output) when they want to use the library; it serves the local UI on `localhost` and the sync endpoint on the Tailscale interface for as long as the process runs, and there is nothing left resident once it exits.

```text
- On startup: attempt one sync round against every known_peer, non-blocking
  for the UI (the library is usable immediately; sync happens in the
  background and the UI reflects newly-arrived rows once applied, the same
  way any other server-state update would surface via cache revalidation).
- While running: optionally re-attempt sync on an interval (e.g. every few
  minutes) if the admin leaves the app open for a long session, so two
  devices that both happen to be up don't have to wait for a restart to see
  each other's changes -- but this is a convenience, not a correctness
  requirement, since store-and-forward already guarantees eventual
  consistency across restarts.
- On graceful shutdown: attempt one final sync round, then checkpoint the
  SQLite WAL file cleanly (07_backend/02_connections_and_scaling_limits.md)
  before the process exits.
- A peer that isn't reachable during any of the above is not an error state --
  it's the expected common case for a device that's asleep, offline, or just
  not open right now. The sync round simply skips that peer this time.
```

## Why Not an Always-On Daemon

An always-running background sync daemon was considered and rejected: it would mean every device permanently holds open a listening process, a SQLite file handle, and whatever memory the app's runtime costs -- paid continuously for a personal app that's actually used in short, occasional sessions. "Opened on demand" pays that cost only while the admin is actually using the library, which is both the cheaper default and the one that matches how this app is actually used (per `00_context/00_project_summary.md`: "run or opened on demand").
