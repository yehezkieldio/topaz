import type { CreatableOptionPicker } from "@/features/taxonomy/components/option-results-list";
import { createTaxonomyTermAction } from "@/features/taxonomy/server/actions";

const MIN_CREATE_LENGTH = 2;

/**
 * The one shared "create a term" implementation both TermMultiselect and
 * TermCombobox plug in via the generic CreatableOptionPicker contract --
 * written once, not once per call site
 * (topaz-v3-specs/06_library/04_taxonomy_picker.md).
 */
export const createTaxonomyCreatable = (
  kindSlug?: string
): CreatableOptionPicker => ({
  canCreate: (query) => query.trim().length >= MIN_CREATE_LENGTH,
  onCreate: async (query) => {
    const result = await createTaxonomyTermAction(query, kindSlug);
    if (result.status !== "success") {
      throw new Error("Failed to create taxonomy term.");
    }
    return result.data;
  },
});
