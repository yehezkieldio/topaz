# Invariants

## Domain

```text
- A work is the canonical creative work.
- A source URL/listing is not the work.
- A library entry is the user's relationship to a work.
- Reading state is current state.
- Reading events are history.
- Taxonomy terms are canonical concepts.
- Taxonomy labels are strings used to find or display a term.
- Direct taxonomy assignments are not the same as effective inferred tags.
```

## Data

```text
- Every domain table keeps internal UUID id and public_id.
- PostgreSQL constraints enforce URL uniqueness.
- Foreign-key columns get indexes.
- Timestamps use timestamptz semantics through Drizzle timestamp with timezone.
- Evolving business values use text plus Zod/check constraints or lookup tables, not Postgres enums.
- JSONB is allowed only for optional source metadata or contributor handles, not core relations.
```

## Implementation

```text
- No compatibility layer for old story/progress shape.
- No schema-v2 folder in final code.
- No dirty queue in initial implementation.
- No import system in initial implementation.
- No external taxonomy reference table in initial implementation.
- No structured relationship participant parser in initial implementation.
- No denormalized library search index in initial implementation.
```

