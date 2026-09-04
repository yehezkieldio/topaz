# ADR-0004: TanStack Form

## Status

Accepted.

## Decision

Forms use `@tanstack/react-form`, with `@tanstack/react-form-nextjs` for Server Action integration.

## Context

The data layer is Server Action-first (ADR-0002). TanStack Form has a documented, first-class integration path for this via `createServerValidate`/`mergeForm`/`useTransform` combined with React 19's `useActionState`, letting server-validated state reconcile cleanly back into client form state. It accepts a Zod (Standard Schema) validator directly with no adapter package, at both form and field level, matching the Zod v4 + drizzle-zod validation already used for the data layer.

## Consequences

```text
- @tanstack/react-form-nextjs is a required, separate dependency from
  @tanstack/react-form core -- Server Action interop does not ship in the base package.
- Form field/dirty state stays colocated to the form component (state colocation,
  see 01_principles/00_design_philosophy.md), never lifted into Zustand.
- The multi-entity create/edit work form (work + source + contributor +
  library_entry + taxonomy) is the primary proving ground for this pattern.
```
