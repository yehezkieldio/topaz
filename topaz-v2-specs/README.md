# Topaz V2 Canonical Specification

**Status:** actionable V2 rewrite contract
**Canonical location:** `topaz/topaz-v2-specs`
**Intended reader:** human implementer, AI coding agent, reviewer

Topaz V2 is a hard-cut rewrite of the current single-user, self-hosted fiction tracker. The goal is not to build an enterprise metadata system. The goal is to quickly ship a better personal library that keeps the current app useful while fixing the structural problems that block richer filtering, reading history, and reliable source metadata.

The target product shape:

```text
personal fiction library
+ source-aware works
+ simple contributors
+ library state
+ reading events
+ taxonomy labels
+ taxonomy relations
+ effective inferred tags
```

## Agent Ingestion Order

```text
1. AGENT_INDEX.md
2. 00_context/00_project_summary.md
3. 01_principles/00_design_philosophy.md
4. 01_principles/01_invariants.md
5. 02_data/00_schema_contract.md
6. 02_data/01_table_catalog.md
7. 03_implementation/00_roadmap.md
8. 03_implementation/01_acceptance_criteria.md
9. 04_quality/00_gates.md
10. 10_adr/ADR-0001-hard-cut-v2.md
```

Load topic-specific files after that.

## Directory Map

```text
00_context/        Current project summary and rewrite context
01_principles/     Design principles, invariants, and non-goals
02_data/           V2 schema contract, table catalog, and index policy
03_implementation/ Roadmap, acceptance criteria, and work sequencing
04_quality/        Validation gates for the rewrite
10_adr/            Accepted architecture decisions
```

## Canonical Decisions

```text
- V2 is a hard cut. Do not preserve old story/progress/table compatibility.
- Final code should replace canonical schema files directly.
- Temporary draft folders are allowed during design, but final implementation must not keep schema-v2 beside schema.
- Keep the table target lean: 14 domain tables, excluding existing NextAuth tables.
- Keep taxonomy inference and reading events in the first rewrite. They are core value, not extras.
- Do not add import jobs, external taxonomy refs, participant parsing, dirty queues, or denormalized library indexes until the core flow works.
```

