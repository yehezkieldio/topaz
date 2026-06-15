# Project Summary

Topaz is currently a single-user, self-hosted reading tracker for fanfiction, webnovels, and online fiction.

Current traits:

```text
Next.js app router
Bun-first development
PostgreSQL
Drizzle ORM
tRPC
NextAuth Discord admin login
public read-only library and stats
admin-only create/edit/delete flows
```

Current domain shape:

```text
story
  -> progress
  -> taxonomy_term[] through story_taxonomy_term

taxonomy_term
  -> taxonomy_alias[]

library_mv
library_stats_mv
```

The current model is useful but too flat:

```text
- story carries canonical work data and source-specific data in one row
- URL uniqueness is mostly application enforced
- source is a database enum
- author is text
- taxonomy kinds are enum values
- aliases exist but do not form a real label/search model
- direct tags do not infer useful filters
- progress stores current state only
- reading history is missing
- stats cannot answer time-window questions
- materialized views refresh too broadly after mutations
```

V2 exists to fix those problems without turning Topaz into a large metadata platform.

