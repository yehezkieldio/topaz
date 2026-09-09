import { z } from "zod";

const messageErrorSchema = z.object({ message: z.string() });
const stringErrorSchema = z.string();

/**
 * TanStack Form's `field.state.meta.errors` holds `unknown` values -- with a
 * Zod Standard Schema validator these are `StandardSchemaV1Issue` objects
 * (`{ message, path, ... }`), not strings. Rendering one with `String(error)`
 * produces the literal text "[object Object]".
 */
export const formatFieldErrors = (
  errors: readonly unknown[] | undefined
): string[] => {
  if (!errors) {
    return [];
  }
  return errors.map((error) => {
    const asString = stringErrorSchema.safeParse(error);
    if (asString.success) {
      return asString.data;
    }
    const asIssue = messageErrorSchema.safeParse(error);
    if (asIssue.success) {
      return asIssue.data.message;
    }
    return String(error);
  });
};
