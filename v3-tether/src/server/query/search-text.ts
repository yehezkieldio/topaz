const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;

/**
 * FTS5's trigram tokenizer can't form a full trigram from fewer than 3
 * characters (07_backend/03_search_and_filtering.md). A sanitized query at
 * or above this length uses the FTS5 MATCH path; anything shorter (but still
 * >= MIN_SEARCH_LENGTH) falls back to a plain LIKE scan instead of being
 * rejected outright.
 */
export const FTS_MATCH_MIN_LENGTH = 3;

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

/**
 * Wraps a sanitized term as an FTS5 phrase query. Unquoted, FTS5's default
 * query syntax ANDs the query's trigrams as independent tokens -- true
 * substring semantics (matching pg_trgm's `%` behavior as closely as an FTS5
 * MATCH can) require quoting so the tokenizer's trigram sequence is matched
 * as one contiguous phrase, not just "all of these trigrams appear somewhere
 * in the row." A literal `"` in the term is doubled, FTS5's own escape for
 * a quote inside a quoted phrase.
 */
export const toFtsPhraseQuery = (term: string): string =>
  `"${term.replaceAll('"', '""')}"`;

const LIKE_WILDCARD_PATTERN = /[\\%_]/g;

/**
 * Escapes SQLite LIKE's wildcard characters (`%`, `_`) and its own escape
 * character (`\`) so a literal search term used in a LIKE fallback (short
 * queries below FTS_MATCH_MIN_LENGTH) can't have a stray `%`/`_` change what
 * the pattern actually matches. Pair with `LIKE ... ESCAPE '\'` at the call
 * site.
 */
export const escapeLikeWildcards = (term: string): string =>
  term.replaceAll(LIKE_WILDCARD_PATTERN, (char) => `\\${char}`);
