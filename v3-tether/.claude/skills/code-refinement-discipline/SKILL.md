---
name: code-refinement-discipline
description: Use when running behavior-preserving refactor, de-slop, hard-cut, or code refinement passes; deciding whether a code change is earned; separating structural fixes from style churn; preserving domain complexity; validating package-local gates; and knowing when a coherent coding pass is complete.
---

# Code Refinement Discipline

## Purpose

Use this skill to keep refactor work disciplined at code time. The goal is a calmer, more intentional codebase without weakening behavior, type safety, validation boundaries, ownership boundaries, or domain rules.

This skill is not a license to rewrite. It is a filter for deciding which code changes are earned, how to perform them, and when to stop.

## Start From Evidence

Before editing:

1. Read the repo instructions, focused agent docs, project spec, and nearby source.
2. Inspect callers, routes, schemas, tests, public exports, and ownership boundaries around the target.
3. Check the working tree and do not overwrite unrelated user changes.
4. Identify the behavior that must be preserved before changing shape.
5. Prefer source evidence over general taste.

Use current library documentation only when framework or API behavior is part of the decision. Do not fetch docs for ordinary refactoring judgment.

## What Earns Code Changes

Change code when the current shape creates a real maintenance, correctness, or cognitive cost:

- Multiple implementations of the same domain rule, formatter, parser, mapper, schema, command path, or validation rule.
- Defensive branches for unsupported legacy, draft, speculative, or impossible shapes.
- Broad fallback behavior that hides invalid data, broken configuration, failed authorization, or command failure.
- Files that mix distinct responsibilities such as routing, validation, persistence mapping, presentation, and side effects.
- Weak types, casts, or non-null assertions that bypass known invariants instead of proving them at a boundary.
- Public exports or shared components that obscure ownership and make feature flow harder to trace.
- Render, request, event, queue, polling, or subscription paths that repeat expensive work with a plausible cost model.
- Naming that hides the domain role of a module, component, handler, or state owner.
- Tests that miss a boundary changed by the refactor.

## What Does Not Earn Code Changes

Do not change code merely because it is longer, unfamiliar, locally imperfect, or aesthetically uneven.

Avoid:

- Style-only churn.
- File moves for visual neatness.
- Generic utilities before a second concrete use case exists.
- Clever abstractions that hide a simple domain flow.
- Compatibility shims, adapters, coercion fallbacks, or dual-shape parsing without a supported external contract.
- Speculative memoization, caching, batching, virtualization, parallelism, or dependency additions.
- Collapsing useful domain structure into "simple" code that loses correctness, validation, or readability.

## Refactor Loop

Work in coherent slices:

1. Map the local shape: entry boundary, canonical data shape, state owner, side effects, public surface, and verification gates.
2. Choose one responsibility to improve.
3. Move validation earlier only when it rejects invalid input at the true boundary.
4. Keep one canonical schema and one canonical data shape unless a documented external contract requires more.
5. Preserve framework inference and type flow instead of forcing generic wrappers over route, query, table, or schema APIs.
6. Patch the smallest set of files that completes the responsibility.
7. Run the nearest meaningful checks.
8. Repeat only for related issues in the same ownership area.

Do not stop after the first obvious cleanup if the same boundary still has duplicated rules, unclear ownership, or broken verification. Do stop when remaining issues are unrelated, speculative, or cosmetic.

## Code-Time Discipline

While editing:

- Keep the product behavior in working memory and compare each change against it.
- Name intermediate values for domain meaning, not line count reduction.
- Prefer explicit control flow when it makes invalid states and side effects easier to see.
- Delete pass-through wrappers and vague helpers only after proving they do not encode ownership or policy.
- Split large modules only when the split maps to stable responsibilities.
- Keep related code together when separation would make the flow harder to understand.
- Add comments only for non-obvious constraints, not narration.
- Let type errors, tests, and source evidence guide the next edit.

If a failure appears, fix the root cause. Do not paper over it with fallback behavior, weaker types, looser schemas, optional fields, catch-all errors, or ignored promises.

## Verification

Verification should match risk and package ownership:

- Run package-local format, lint, typecheck, tests, build, or focused test commands when available.
- Broaden checks when touching shared schemas, public exports, authorization, persistence mapping, route contracts, or cross-feature UI.
- For UI changes, verify the rendered result when behavior or layout could regress.
- Report any checks that could not run, and separate unrelated pre-existing failures from failures caused by the refactor.

The final state should have fewer accidental branches, clearer ownership, stronger boundary checks, and no hidden behavior drift.
