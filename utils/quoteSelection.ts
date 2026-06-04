export interface WeightedQuoteCandidate {
  id: string;
  categories?: Record<string, number>;
}

export interface QuoteSelectionOptions<T extends WeightedQuoteCandidate> {
  quotes: readonly T[];
  recentIds: readonly string[];
  selectedCategories: readonly string[];
  count: number;
  candidateCount: number;
  recentLimit: number;
  random?: () => number;
}

export interface QuoteSelectionResult<T extends WeightedQuoteCandidate> {
  items: T[];
  nextRecentIds: string[];
}

export function scoreQuoteCategories(
  categories: Record<string, number> | undefined,
  selectedCategories: readonly string[],
): number {
  if (selectedCategories.length === 0) return 0;
  return selectedCategories.reduce((sum, category) => sum + (categories?.[category] ?? 0), 0);
}

export function shuffleQuotes<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function pickTopWeightedQuote<T extends WeightedQuoteCandidate>(
  candidates: readonly T[],
  selectedCategories: readonly string[],
  random: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null;

  let maxScore = -Infinity;
  let maxIndices: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const score = scoreQuoteCategories(candidates[i].categories, selectedCategories);
    if (score > maxScore) {
      maxScore = score;
      maxIndices = [i];
    } else if (score === maxScore) {
      maxIndices.push(i);
    }
  }

  const index = maxIndices[Math.floor(random() * maxIndices.length)];
  return candidates[index] ?? null;
}

export function buildRecencyAwarePool<T extends WeightedQuoteCandidate>(
  quotes: readonly T[],
  recentIds: readonly string[],
  candidateCount: number,
): { pool: T[]; recentIds: string[] } {
  const recentSet = new Set(recentIds);
  const pool = quotes.filter((quote) => !recentSet.has(quote.id));

  if (pool.length < candidateCount) {
    return { pool: [...quotes], recentIds: [] };
  }

  return { pool, recentIds: [...recentIds] };
}

export function selectQuoteItems<T extends WeightedQuoteCandidate>(
  options: QuoteSelectionOptions<T>,
): QuoteSelectionResult<T> {
  const {
    quotes,
    recentIds,
    selectedCategories,
    count,
    candidateCount,
    recentLimit,
    random = Math.random,
  } = options;

  const { pool, recentIds: activeRecentIds } = buildRecencyAwarePool(quotes, recentIds, candidateCount);
  const shuffled = shuffleQuotes(pool, random);
  const selected: T[] = [];
  const nextRecentIds = [...activeRecentIds];

  for (let i = 0; i < count; i++) {
    const excludeSet = new Set(nextRecentIds);
    let candidates = shuffled.filter((quote) => !excludeSet.has(quote.id)).slice(0, candidateCount);

    if (candidates.length === 0) {
      candidates = shuffled.slice(0, Math.min(candidateCount, shuffled.length));
    }

    const chosen = pickTopWeightedQuote(candidates, selectedCategories, random);
    if (!chosen) break;

    selected.push(chosen);
    nextRecentIds.push(chosen.id);

    if (nextRecentIds.length > recentLimit) {
      nextRecentIds.shift();
    }
  }

  return { items: selected, nextRecentIds };
}
