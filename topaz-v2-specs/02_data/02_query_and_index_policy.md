# Query and Index Policy

## First Implementation

Use normal indexed joins for library listing:

```text
library_entry
-> reading_state
-> work
-> work_source primary
-> work_contributor
-> contributor
-> work_taxonomy_assignment
-> taxonomy_term
-> work_taxonomy_effective
```

Do not add `library_entry_index` initially.

## Search

Preserve the current useful search posture:

```text
full-text search
ILIKE fallback
trigram similarity where available
keyset pagination
```

Search should include:

```text
work title
work description/summary
source title
source author text
contributor names
taxonomy labels
reading notes
```

## Filters

Initial filters:

```text
status
source platform
direct taxonomy term
effective taxonomy term
rating range
favorite
word count range
chapter count range
is_nsfw
has notes
```

## Sorting

Initial sorts:

```text
title
rating
updated_at
added_at
last_read_at
word_count
chapter_count
progress_percent
```

## When to Add `library_entry_index`

Only add a denormalized index table after:

```text
real query is slow
query plan shows joins/search are the cause
indexes cannot fix it cleanly
the exact indexed projection is known
```

