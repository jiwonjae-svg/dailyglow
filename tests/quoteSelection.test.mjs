import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/loadTsModule.mjs';

const {
  buildRecencyAwarePool,
  pickTopWeightedQuote,
  scoreQuoteCategories,
  selectQuoteItems,
} = loadTsModule('../../utils/quoteSelection.ts');

const quotes = [
  { id: 'q1', categories: { growth: 0.2, work: 0.1 } },
  { id: 'q2', categories: { growth: 0.8, work: 0.1 } },
  { id: 'q3', categories: { calm: 0.9 } },
  { id: 'q4', categories: { work: 0.7 } },
];

test('scoreQuoteCategories sums selected category weights', () => {
  assert.equal(scoreQuoteCategories({ growth: 0.5, work: 0.25 }, ['growth', 'work']), 0.75);
  assert.equal(scoreQuoteCategories({ calm: 1 }, ['growth']), 0);
});

test('pickTopWeightedQuote prefers the highest weighted candidate', () => {
  const picked = pickTopWeightedQuote(quotes, ['growth'], () => 0);

  assert.equal(picked.id, 'q2');
});

test('buildRecencyAwarePool excludes recent quotes when enough candidates remain', () => {
  const result = buildRecencyAwarePool(quotes, ['q1'], 2);

  assert.deepEqual(result.pool.map((quote) => quote.id), ['q2', 'q3', 'q4']);
  assert.deepEqual(result.recentIds, ['q1']);
});

test('buildRecencyAwarePool resets recent ids when the available pool is too small', () => {
  const result = buildRecencyAwarePool(quotes, ['q1', 'q2', 'q3'], 2);

  assert.deepEqual(result.pool.map((quote) => quote.id), ['q1', 'q2', 'q3', 'q4']);
  assert.deepEqual(result.recentIds, []);
});

test('selectQuoteItems updates the recency buffer and respects its limit', () => {
  const result = selectQuoteItems({
    quotes,
    recentIds: ['old'],
    selectedCategories: ['growth'],
    count: 2,
    candidateCount: 4,
    recentLimit: 2,
    random: () => 0,
  });

  assert.equal(result.items.length, 2);
  assert.deepEqual(result.nextRecentIds, result.items.map((quote) => quote.id));
});
