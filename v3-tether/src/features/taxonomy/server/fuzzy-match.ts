import "server-only";

/**
 * Character-bigram Dice coefficient -- a typo-tolerant similarity score in
 * [0, 1], unlike FTS5's trigram phrase MATCH (searchTaxonomyTermsByFts in
 * ./actions), which requires one contiguous trigram run and so can never
 * match past a single inserted/deleted/transposed character. Only used as a
 * fallback when the substring-precise FTS/LIKE paths return nothing, so the
 * common case (exact or substring queries) never pays for this.
 */
const bigramCounts = (value: string): Map<string, number> => {
  const lowered = value.toLowerCase();
  const counts = new Map<string, number>();
  for (let i = 0; i < lowered.length - 1; i++) {
    const bigram = lowered.slice(i, i + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  return counts;
};

export const bigramDiceCoefficient = (a: string, b: string): number => {
  const countsA = bigramCounts(a);
  const countsB = bigramCounts(b);

  let totalA = 0;
  for (const n of countsA.values()) {
    totalA += n;
  }
  let totalB = 0;
  for (const n of countsB.values()) {
    totalB += n;
  }
  if (totalA === 0 || totalB === 0) {
    return 0;
  }

  let intersection = 0;
  for (const [bigram, countA] of countsA) {
    const countB = countsB.get(bigram);
    if (countB) {
      intersection += Math.min(countA, countB);
    }
  }

  return (2 * intersection) / (totalA + totalB);
};

/**
 * Below this score a "close match" isn't close enough to be worth surfacing
 * ahead of just letting the admin create a new term -- tuned against a
 * one-typo miss (e.g. "time travle" vs "Time Travel" scores ~0.7) while
 * still rejecting genuinely unrelated short names.
 */
const FUZZY_MATCH_THRESHOLD = 0.35;

export interface FuzzyMatchCandidate<T> {
  item: T;
  name: string;
}

/**
 * Ranks `candidates` by bigram-Dice similarity of `name` to `query`, keeping
 * only scores at or above FUZZY_MATCH_THRESHOLD, best match first. Intended
 * for a bounded candidate set (a personal library's active taxonomy terms,
 * at most a few thousand rows) -- see FTS_MATCH_MIN_LENGTH's comment in
 * server/query/search-text.ts for the same scale assumption.
 */
export const rankFuzzyMatches = <T>(
  query: string,
  candidates: FuzzyMatchCandidate<T>[],
  limit: number
): T[] =>
  candidates
    .map((candidate) => ({
      item: candidate.item,
      score: bigramDiceCoefficient(query, candidate.name),
    }))
    .filter((scored) => scored.score >= FUZZY_MATCH_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((scored) => scored.item);
