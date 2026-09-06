/**
 * Pasted URLs often carry surrounding whitespace or line breaks (especially
 * from spreadsheets or chat apps). Collapsing them to a single clean line --
 * the same normalization the v2 library form applies -- keeps the paste from
 * failing `sourceUrl` validation on whitespace the user never sees.
 */
export const cleanSingleLinePaste = (text: string): string =>
  text.replaceAll(/\s+/gu, " ").trim();

/**
 * Splices pasted text at the input's cursor/selection and returns the
 * resulting full value, so a paste in the middle of an existing URL doesn't
 * clobber the whole field.
 */
export const insertTextAtSelection = (
  field: HTMLInputElement,
  text: string
): string => {
  const { selectionStart, selectionEnd, value } = field;
  return (
    value.slice(0, selectionStart ?? 0) +
    text +
    value.slice(selectionEnd ?? value.length)
  );
};
