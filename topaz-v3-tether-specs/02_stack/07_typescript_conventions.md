# TypeScript Conventions

A short set of type-level conventions worth codifying explicitly, because each addresses a real, easy-to-miss correctness gap rather than a style preference.

## `Omit` Is Not Distributive Over Unions -- Never Use It on One

Built-in `Omit<T, K>` applied to a discriminated union collapses every member into one merged type, destroying the discriminant and silently breaking narrowing. This is a real, load-bearing risk for Topaz specifically because the Server Action mutation-result type *is* a discriminated union (`02_stack/02_data_and_mutation_flow.md`'s `success | validation-error | version-conflict` shape, extended by `06_library/06_mutation_lifecycle_and_transitions.md`'s `MutationResult<T>`):

```typescript
// server/query/types.ts
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
```

Rule: `Omit` is never applied directly to a type known or suspected to be a union with a discriminant field (`status`, `kind`, `type`). Use `DistributiveOmit` instead, every time -- including for any narrower variant derived from `MutationResult<T>`, and for any taxonomy entity that's itself discriminated by `kind`.

## `assertNever` at Every Discriminant Switch

Every place UI code branches on a Server Action result's `status` or a taxonomy/domain entity's discriminant field ends with an exhaustiveness check, so adding a new variant to the union is a compile error at every unhandled call site instead of a silent runtime gap:

```typescript
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}

switch (result.status) {
  case "success": return handleSuccess(result.data);
  case "validation-error": return handleValidationError(result.fieldErrors);
  case "version-conflict": return handleConflict(result.latest);
  default: return assertNever(result);
}
```

This matters more than it looks like it should for a small personal app: the whole point of the `MutationResult` discriminated-union design (`06_library/06_mutation_lifecycle_and_transitions.md`) is that version conflicts get handled differently from validation errors -- without `assertNever` enforcement, a future variant (e.g. a `"not-found"` status) can be added to the type and silently fall through every existing `switch` that doesn't have a matching case, producing exactly the kind of bug the discriminated-union design exists to prevent.

## Internal Errors Are Translated at the Action Boundary, Never Leaked Raw

A Server Action's `catch` block never re-throws or forwards a raw Postgres/Drizzle error into a `validation-error` or `version-conflict` payload. Internal failures are caught, logged server-side, and translated into a distinct, generic result variant (or a thrown error that Next.js's own error boundary handles per `02_stack/01_rsc_component_architecture.md`'s `catchError` pattern) -- the client-facing discriminated union describes user-actionable states, not database internals.

## Derive Field-Error Shapes From the Same Source as Validation

`MutationResult`'s `fieldErrors` shape is derived from the Zod schema it validates against via a mapped type, not hand-typed separately:

```typescript
type FieldErrors<TSchema extends z.ZodType> = {
  [K in keyof z.infer<TSchema>]?: string[];
};
```

This is the same "derive, don't duplicate" discipline already applied to Drizzle's `relations()`-derived types and `drizzle-zod`'s schema generation -- one source of truth per shape, propagated via the type system rather than kept in sync by hand across the Zod schema, the Server Action's return type, and the form component that renders the errors.

## Casts and Type Predicates Are a Trust Boundary, Not a Convenience

An `as` assertion or a custom type-predicate function (`function isWork(x: unknown): x is Work`) is only ever written at a genuine trust boundary -- converting a Drizzle query result into a domain entity type, narrowing an `unknown` from an external API response -- and every one carries a one-line comment explaining why the assertion is actually sound at that point, not just convenient. A type predicate that returns `true` without actually checking every field it claims to narrow is worse than no predicate at all, because it makes an unsound cast look verified. This is a review-time discipline, not tooling to add -- but `@typescript-eslint/no-explicit-any` and treating a bare `as` outside `server/db/` and `server/query/` type-boundary files as a review flag are both reasonable to enforce in `05_quality/00_gates.md`.

## No Multi-Repo Type-Sync Tooling

Topaz is a single-package repository with no service boundary -- there is no cross-repo type drift problem to solve, and no tooling (shared type-package publishing, cross-repo CI validation) should be introduced to solve one. If Topaz ever splits into multiple deployable units, this convention gets revisited then, not preemptively.
