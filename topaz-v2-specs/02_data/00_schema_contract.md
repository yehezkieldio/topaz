# Schema Contract

## Final V2 Domain Tables

V2 targets 14 domain tables, excluding existing NextAuth tables.

```text
Core
- work
- source_platform
- work_source
- contributor
- work_contributor

Library
- library_entry
- reading_state
- reading_event

Taxonomy
- taxonomy_kind
- taxonomy_term
- taxonomy_label
- taxonomy_relation
- work_taxonomy_assignment
- work_taxonomy_effective
```

## Hard Replacements

```text
story                  -> work + work_source
progress               -> library_entry + reading_state + reading_event
taxonomy_alias         -> taxonomy_label
story_taxonomy_term    -> work_taxonomy_assignment
library_mv             -> normal indexed joins first
library_stats_mv       -> query/event-derived stats first
source enum            -> source_platform table
taxonomy kind enum     -> taxonomy_kind table
```

## Relation Types

Use a TypeScript/Zod enum for initial taxonomy relation types:

```ts
const taxonomyRelationType = z.enum([
    "broader",
    "related",
    "implies",
    "conflicts_with",
    "equivalent_to",
]);
```

Do not add a `taxonomy_relation_type` table in initial V2.

## Effective Taxonomy Rebuild

On direct assignment changes for one work:

```text
1. delete work_taxonomy_effective rows for work
2. insert direct assigned terms with reason = direct
3. follow relation_type in implies, broader, equivalent_to
4. insert inferred rows with reason = relation type
5. bound recursion depth
6. avoid duplicate effective rows
```

This rebuild is synchronous in the mutation path for V2.

