import type { SQL } from "drizzle-orm";

export type FilterSpec<TInput> = {
  [K in keyof TInput]?: (value: NonNullable<TInput[K]>) => SQL | undefined;
};

/**
 * Composes a feature's declarative FilterSpec into a flat condition list --
 * one entry per filter, added by adding a map entry rather than another
 * branch in a hand-rolled `if` chain.
 */
export const buildConditions = <TInput extends object>(
  input: TInput,
  spec: FilterSpec<TInput>
): SQL[] => {
  const conditions: SQL[] = [];

  // SAFETY: `spec` is typed as `FilterSpec<TInput>`, a mapped type over
  // `keyof TInput`, so every own-enumerable key Object.keys sees on it is
  // necessarily a member of `keyof TInput`, not an arbitrary string.
  for (const key of Object.keys(spec) as (keyof TInput)[]) {
    const value = input[key];
    if (value === undefined || value === null) {
      continue;
    }
    // SAFETY: the guard above already excluded `undefined`/`null`, so
    // `value` here is exactly `NonNullable<TInput[typeof key]>`.
    const condition = spec[key]?.(value as NonNullable<TInput[typeof key]>);
    if (condition) {
      conditions.push(condition);
    }
  }

  return conditions;
};
