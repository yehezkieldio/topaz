# Table Catalog

## Core

### `work`

Canonical creative work.

Required columns:

```text
id
public_id
title
sort_title
description
summary
publication_status
content_rating
is_nsfw
version
created_at
updated_at
```

Notes:

```text
- Do not store source URL here.
- Do not store source enum here.
- Keep content_rating/is_nsfw as practical filters, even though richer warning/rating taxonomy can grow later.
```

### `source_platform`

Known fiction platforms and custom sources.

Required columns:

```text
id
public_id
key
name
base_url
is_active
created_at
updated_at
```

Constraints:

```text
unique key
```

### `work_source`

Source listing/URL for a work.

Required columns:

```text
id
public_id
work_id
source_platform_id
url
normalized_url
external_id
title_on_source
author_on_source
chapter_count
word_count
source_status
first_published_at
last_updated_at
last_checked_at
raw_metadata
is_primary
created_at
updated_at
```

Constraints:

```text
unique (source_platform_id, normalized_url)
unique (source_platform_id, external_id) where external_id is not null
index work_id
index source_platform_id
```

### `contributor`

Simple author/contributor record.

Required columns:

```text
id
public_id
name
sort_name
platform_handles
notes
created_at
updated_at
```

Notes:

```text
- platform_handles is JSONB for now.
- Do not add contributor_identity in initial V2.
```

### `work_contributor`

Many-to-many link between work and contributor.

Required columns:

```text
work_id
contributor_id
role
display_order
created_at
```

Constraints:

```text
primary key (work_id, contributor_id, role)
index contributor_id
```

## Library

### `library_entry`

User relationship to a work.

Required columns:

```text
id
public_id
user_id
work_id
status
favorite
priority
private
added_at
archived_at
version
created_at
updated_at
```

Constraints:

```text
unique (user_id, work_id)
index user_id
index work_id
index (user_id, status)
index (user_id, updated_at)
```

### `reading_state`

Current reading state for one library entry.

Required columns:

```text
id
public_id
library_entry_id
current_chapter
current_percent
rating
notes
started_at
finished_at
last_read_at
reread_count
version
created_at
updated_at
```

Constraints:

```text
unique library_entry_id
check rating is null or rating between 0 and 5
check current_percent is null or current_percent between 0 and 100
```

### `reading_event`

Append-only reading history.

Required columns:

```text
id
public_id
library_entry_id
event_type
from_status
to_status
from_chapter
to_chapter
from_rating
to_rating
event_at
note
metadata
created_at
```

Initial event types:

```text
added
started
progressed
paused
resumed
completed
dropped
rating_changed
note_changed
reread_started
reread_completed
```

Indexes:

```text
library_entry_id
event_at
(library_entry_id, event_at)
```

## Taxonomy

### `taxonomy_kind`

Table-driven taxonomy facets.

Required columns:

```text
id
public_id
key
name
description
is_assignable
allows_relations
sort_order
created_at
updated_at
```

Seed rows:

```text
fandom
character
relationship
genre
trope
warning
source_category
format
tone
custom
```

### `taxonomy_term`

Canonical taxonomy concept.

Required columns:

```text
id
public_id
kind_id
slug
name
normalized_name
description
disambiguation
status
merged_into_id
version
created_at
updated_at
```

Constraints:

```text
unique (kind_id, slug)
unique (kind_id, normalized_name) where status = 'active'
index kind_id
index merged_into_id
```

### `taxonomy_label`

Search/display labels for taxonomy terms.

Required columns:

```text
id
public_id
term_id
label
normalized_label
label_type
is_primary
is_searchable
created_at
updated_at
```

Constraints:

```text
unique (term_id, normalized_label)
unique (term_id) where is_primary = true
index normalized_label
index term_id
```

### `taxonomy_relation`

Graph edge between taxonomy terms.

Required columns:

```text
id
public_id
from_term_id
to_term_id
relation_type
created_at
updated_at
```

Constraints:

```text
unique (from_term_id, to_term_id, relation_type)
check from_term_id <> to_term_id
index from_term_id
index to_term_id
```

### `work_taxonomy_assignment`

Direct taxonomy assignment to a work.

Required columns:

```text
id
public_id
work_id
term_id
assignment_source
confidence
note
created_at
updated_at
```

Constraints:

```text
unique (work_id, term_id, assignment_source)
index work_id
index term_id
```

### `work_taxonomy_effective`

Direct and inferred taxonomy terms for query/filtering.

Required columns:

```text
work_id
term_id
reason
via_term_id
depth
created_at
```

Constraints:

```text
primary key (work_id, term_id, reason, via_term_id)
index work_id
index term_id
index (work_id, term_id)
```

