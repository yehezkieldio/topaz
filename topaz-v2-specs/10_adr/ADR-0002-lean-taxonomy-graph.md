# ADR-0002: Lean Taxonomy Graph

## Status

Accepted.

## Decision

Topaz V2 keeps taxonomy relations and effective inferred terms, but rejects the larger metadata-graph tables for the first implementation.

Accepted now:

```text
taxonomy_kind
taxonomy_term
taxonomy_label
taxonomy_relation
work_taxonomy_assignment
work_taxonomy_effective
```

Deferred:

```text
taxonomy_relation_type
taxonomy_external_ref
taxonomy_term_participant
taxonomy_usage_index
taxonomy_term_merge audit table
```

## Rationale

The useful feature is semantic filtering:

```text
direct: Harry Potter/Hermione Granger
effective: Harry Potter
effective: Hermione Granger
effective: relationship
```

That requires relations and effective terms. It does not require external source-tag mapping, participant parsing, or relation-type metadata tables.

