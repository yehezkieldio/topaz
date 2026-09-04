/**
 * The shared shape every optimistic-concurrency mutation returns. A version
 * conflict is a distinct, recoverable state -- never folded into a generic
 * error string -- so the UI can tell "you're out of date" apart from
 * "that input was invalid" (06_library/06_mutation_lifecycle_and_transitions.md).
 */
export type MutationResult<T> =
  | { status: "success"; data: T }
  | { status: "validation-error"; fieldErrors: Record<string, string[]> }
  | { status: "version-conflict"; currentVersion: number }
  | { status: "not-found" };
