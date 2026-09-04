const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;

const WHITESPACE_RUN_PATTERN = /\s+/gu;

const isControlChar = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return code <= 0x1f || code === 0x7f;
};

/**
 * Strips control characters, collapses whitespace, and caps length -- the
 * one place this happens, applied identically wherever free-text search is
 * accepted. Returns null for anything shorter than the minimum useful
 * search length so callers can skip hitting the database entirely.
 */
export const sanitizeSearchText = (
  raw: string | null | undefined
): string | null => {
  if (!raw) {
    return null;
  }

  const withoutControlChars = [...raw]
    .filter((char) => !isControlChar(char))
    .join("");

  const cleaned = withoutControlChars
    .replaceAll(WHITESPACE_RUN_PATTERN, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  return cleaned.length >= MIN_SEARCH_LENGTH ? cleaned : null;
};
