/**
 * Levenshtein distance-based text similarity (0.0 ~ 1.0).
 */
export function textSimilarity(a: string, b: string): number {
  return similarityFromNormalized(normalize(a), normalize(b));
}

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,!?;:'"()\[\]{}<>`~@#$%^&*_+=\\/|…“”‘’«»「」『』【】〈〉《》]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
}

function similarityFromNormalized(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function buildOcrCandidates(text: string): string[] {
  const trimmed = text.replace(/\r/g, '').trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = new Set<string>([trimmed]);
  if (lines.length > 0) {
    candidates.add(lines.join(' '));
    for (const line of lines) candidates.add(line);

    const maxWindow = Math.min(lines.length, 4);
    for (let windowSize = 2; windowSize <= maxWindow; windowSize++) {
      for (let start = 0; start <= lines.length - windowSize; start++) {
        candidates.add(lines.slice(start, start + windowSize).join(' '));
      }
    }
  }

  return [...candidates];
}

export function findBestOcrMatch(recognizedText: string, originalText: string): { similarity: number; matchedText: string } {
  const candidates = buildOcrCandidates(recognizedText);
  if (candidates.length === 0) return { similarity: 0, matchedText: '' };

  const normalizedOriginal = normalize(originalText);
  const compactOriginal = removeWhitespace(normalizedOriginal);

  let bestMatch = { similarity: 0, matchedText: candidates[0] };
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    const directSimilarity = similarityFromNormalized(normalizedCandidate, normalizedOriginal);
    const compactSimilarity = similarityFromNormalized(removeWhitespace(normalizedCandidate), compactOriginal);
    const similarity = Math.max(directSimilarity, compactSimilarity);

    if (similarity > bestMatch.similarity) {
      bestMatch = { similarity, matchedText: candidate };
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Char-by-char match status for typing highlight.
 * Returns array of booleans: true = correct at that position.
 */
export function charMatchStatus(
  typed: string,
  original: string
): boolean[] {
  return typed.split('').map((ch, i) => ch === original[i]);
}
