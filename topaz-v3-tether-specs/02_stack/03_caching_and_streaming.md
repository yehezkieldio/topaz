# Caching and Streaming

## Cache Components Model

```text
"use cache"           - marks a function/component cacheable across requests.
                        File-level usage requires every export in the file to be async.
"use cache: private"   - escape hatch to read cookies()/session data inside an
                        otherwise-cacheable function; scoped per-user, not shared
                        across all visitors. Use for any admin-only cached read.
"use cache: remote"    - remote cache backing; can nest inside remote or plain
                        "use cache", but cannot wrap or be wrapped by "private" --
                        mixed private/remote nesting throws.
cacheTag(tag)          - tags the cache entry, called inside the cached boundary.
cacheLife({ stale, revalidate, expire })
                       - sets the staleness profile inline for that boundary.
```

Plain `"use cache"` cannot access `cookies()`/`headers()` -- that constraint is exactly why `"use cache: private"` exists. Public library reads (work listings, taxonomy browsing) use plain `"use cache"`. Admin-only reads that need the session (e.g. "show my drafts") use `"use cache: private"`.

## Tag Scheme

Every tag is entity-scoped -- there is no broad, shared tag invalidated on every mutation:

```text
work:{workId}
work-source:{workId}
contributor:{contributorId}
library-entry:{libraryEntryId}
reading-state:{libraryEntryId}
taxonomy-term:{termId}
taxonomy-effective:{workId}
library-stats                      (aggregate, see below -- kept broad deliberately)
```

A mutation revalidates only the tags it actually touched. Toggling favorite on one work revalidates `library-entry:{id}` and, if stats are affected, `library-stats` -- it does not revalidate every taxonomy tag in the system.

## revalidateTag Calls

Always pass an explicit profile. Calling `revalidateTag(tag)` with no second argument is deprecated behavior (forces an immediate blocking revalidation on the next request). Use:

```text
revalidateTag(`library-entry:${id}`, "max")
```

`"max"` marks the tag stale for stale-while-revalidate rather than forcing a blocking miss -- the request that triggered the mutation still gets a fast response; the next reader gets fresh data without anyone blocking on it.

`revalidateTag` is only callable from Server Actions/Route Handlers, never from a Client Component.

## Static Shell / Streamed Holes

Cache Components force this discipline structurally: any component reading `searchParams`, `cookies()`, or `headers()` directly must be inside a Suspense boundary, or the build fails/warns depending on config. Practical layout for the library route:

```text
Static shell (prerendered):
  root layout, nav, LibraryFilters shell, LibrarySearch input shell

Streamed holes (each its own Suspense):
  LibraryResults (reads searchParams)
  library-stats widget (reads aggregate cache, own boundary so a slow stats query
    never blocks the results list from streaming)
  any per-user "my recently read" widget (reads session via "use cache: private")
```

Multiple independent holes on the same page stream in parallel, not sequentially -- do not nest them inside a single shared Suspense boundary unless they are genuinely dependent.

## Cheap, Non-Blocking Stats Aggregation

Stats (total works, total read, hours estimate, favorite count, status breakdown) must not sit in the critical path of the library page or block its static shell. Design:

```text
- Stats are their own "use cache" boundary with cacheTag("library-stats") and a
  longer cacheLife (stats don't need to be second-fresh).
- Stats render in their own Suspense boundary, separate from LibraryResults, so a
  slow aggregate query never delays the list the user actually came to see.
- Compute via a single SQL aggregate query (COUNT/SUM/CASE over library_entry +
  reading_state), not N+1 application-level loops over fetched rows.
- Revalidate library-stats only from the specific mutations that can change it
  (status change, favorite toggle, work delete) -- not from every write in the app.
- If/when this page is embedded on the personal-website homepage (per the V3 goal
  of integrating Topaz into the site), the stats widget is the one place "use cache: 
  private" is unnecessary -- these are the admin's own public stats, fine to cache
  publicly with plain "use cache".
```

## Streaming Shell for the Homepage Embed

Since Topaz mounts at `/library` inside the personal website and the homepage also shows library stats, that stats read is one of the shared `cache()`/`"use cache"` functions in `features/library/queries.ts`, called identically from both the homepage widget and the `/library` page's own stats hole -- not duplicated, and not routed through a different access pattern in either place.
