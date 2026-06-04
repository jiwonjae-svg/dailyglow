import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors } from '../constants/theme';
import { clientQuotes } from '../data/quotes';
import type { CrawledQuote } from '../data/quotes';
import { useUserStore } from '../stores/useUserStore';
import type { Quote } from '../stores/useQuoteStore';
import { fetchServerQuotesFromFirestore } from './firebaseConfig';
import i18n from '../i18n';
import { selectQuoteItems } from '../utils/quoteSelection';

const CACHE_KEY = '@dailyglow_quotes_cache';
const RECENT_IDS_KEY = '@dailyglow_recent_quote_ids';
const SERVER_QUOTES_CACHE_KEY = '@dailyglow_server_quotes_cache';
const SERVER_QUOTES_UPDATED_KEY = '@dailyglow_server_quotes_updated';
/** Cache TTL for server quotes: 7 days */
const SERVER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 5;
const CANDIDATE_COUNT = 10;
const RECENT_EXCLUDE = 20;

/**
 * Returns the server quote pool.
 * - Online: loads from Firestore and caches in AsyncStorage (TTL: 7 days)
 * - Offline / failure: returns stale cache, or empty array if none exists
 */
async function getServerQuotes(): Promise<CrawledQuote[]> {
  try {
    const updatedRaw = await AsyncStorage.getItem(SERVER_QUOTES_UPDATED_KEY);
    const updatedAt = updatedRaw ? parseInt(updatedRaw, 10) : 0;
    const cacheIsValid = Date.now() - updatedAt < SERVER_CACHE_TTL;

    if (cacheIsValid) {
      const cachedRaw = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
      if (cachedRaw) {
        const parsed: CrawledQuote[] = JSON.parse(cachedRaw);
        if (parsed.length > 0) return parsed;
      }
    }

    // Attempt to load from Firestore
    const fresh = await fetchServerQuotesFromFirestore();
    if (fresh.length > 0) {
      await AsyncStorage.setItem(SERVER_QUOTES_CACHE_KEY, JSON.stringify(fresh));
      await AsyncStorage.setItem(SERVER_QUOTES_UPDATED_KEY, String(Date.now()));
      return fresh;
    }

    // Offline or empty response — fall back to stale cache if available
    const staleCached = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
    if (staleCached) return JSON.parse(staleCached) as CrawledQuote[];
  } catch {
    /* silent */
  }
  return [];
}

function makeQuote(
  item: { id: string; quote: string; author: string; source: string; categories?: Record<string, number>; translations?: Record<string, string> },
  lang: string,
): Quote | null {
  if (!item?.id || !item?.quote) return null;
  const text = item.translations?.[lang] ?? item.quote;
  if (!text) return null;
  // Derive the top-weighted semantic category; fall back to source only when no categories exist.
  const topCategory = item.categories && Object.keys(item.categories).length > 0
    ? Object.entries(item.categories).sort((a, b) => b[1] - a[1])[0][0]
    : item.source;
  return {
    id: item.id,
    text,
    author: item.author,
    source: item.source,
    category: topCategory,
    createdAt: Date.now(),
    gradientIndex: Math.floor(Math.random() * LightColors.cardGradients.length),
  };
}

async function getRecentIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRecentIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* silent */
  }
}

async function selectQuotes(count: number): Promise<Quote[]> {
  const lang = i18n.language;
  const selectedCats = useUserStore.getState().selectedCategories ?? [];

  // Load server quotes (Firestore when online, cache or empty array when offline)
  const serverQuotes = await getServerQuotes();
  const allQuotes: CrawledQuote[] = [...clientQuotes, ...serverQuotes];

  const selection = selectQuoteItems({
    quotes: allQuotes,
    recentIds: await getRecentIds(),
    selectedCategories: selectedCats,
    count,
    candidateCount: CANDIDATE_COUNT,
    recentLimit: RECENT_EXCLUDE,
  });

  await saveRecentIds(selection.nextRecentIds);
  return selection.items
    .map((item) => makeQuote(item, lang))
    .filter((quote): quote is Quote => quote !== null);
}

/** Module-level flag prevents concurrent batch fetches (guards against rapid scrolling). */
let isFetchingBatch = false;

export async function fetchQuoteBatch(): Promise<Quote[]> {
  if (isFetchingBatch) return [];
  isFetchingBatch = true;
  try {
    const quotes = await selectQuotes(BATCH_SIZE);
    await cacheQuotes(quotes);
    return quotes;
  } finally {
    isFetchingBatch = false;
  }
}

async function cacheQuotes(quotes: Quote[]): Promise<void> {
  try {
    const existing = await getCachedQuotes();
    const merged = [...existing, ...quotes].slice(-50);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch {
    /* silent */
  }
}

export async function getCachedQuotes(): Promise<Quote[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* silent */
  }
  return [];
}

export async function clearQuoteCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(RECENT_IDS_KEY);
  } catch {
    /* silent */
  }
}

/** Clears the server quotes cache, forcing a fresh Firestore load on next call. */
export async function clearServerQuotesCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SERVER_QUOTES_CACHE_KEY);
    await AsyncStorage.removeItem(SERVER_QUOTES_UPDATED_KEY);
  } catch {
    /* silent */
  }
}

export async function getInitialQuotes(): Promise<Quote[]> {
  const cached = await getCachedQuotes();
  if (cached.length >= BATCH_SIZE) {
    return cached.slice(-BATCH_SIZE);
  }
  return selectQuotes(BATCH_SIZE);
}

/**
 * Returns all quotes (client + cached server) in the current language.
 * Used for full-corpus search so author/text lookup works across the entire dataset.
 * Does NOT trigger a Firestore fetch — only uses the on-device cache.
 */
export async function getAllQuotesForSearch(): Promise<Quote[]> {
  const lang = i18n.language;
  let serverQuotes: CrawledQuote[] = [];
  try {
    const raw = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
    if (raw) serverQuotes = JSON.parse(raw) as CrawledQuote[];
  } catch { /* silent */ }
  return [...clientQuotes, ...serverQuotes]
    .map((q) => makeQuote(q, lang))
    .filter((q): q is Quote => q !== null);
}

/**
 * Look up a single quote by ID from the full source pool (client + cached server).
 * Used by the widget deep-link handler when the quote isn't in the current session store.
 */
export async function findQuoteById(id: string): Promise<Quote | null> {
  const lang = i18n.language;
  const match = clientQuotes.find((q) => q.id === id);
  if (match) return makeQuote(match, lang);
  // Check cached server quotes
  try {
    const raw = await AsyncStorage.getItem(SERVER_QUOTES_CACHE_KEY);
    if (raw) {
      const serverQuotes: CrawledQuote[] = JSON.parse(raw);
      const srv = serverQuotes.find((q) => q.id === id);
      if (srv) return makeQuote(srv, lang);
    }
  } catch { /* silent */ }
  return null;
}
