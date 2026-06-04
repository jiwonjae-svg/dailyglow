import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/loadTsModule.mjs';

const { useQuoteStore } = loadTsModule('../../stores/useQuoteStore.ts');

function resetQuoteStore() {
  useQuoteStore.setState({
    quotes: [],
    currentIndex: 0,
    isLoading: true,
    isGenerating: false,
    pendingDeepLinkQuoteId: null,
  });
}

const firstQuote = {
  id: 'q1',
  text: 'Stay hungry',
  author: 'Test Author',
  createdAt: 1,
  gradientIndex: 0,
};

const secondQuote = {
  id: 'q2',
  text: 'Stay foolish',
  author: 'Test Author',
  createdAt: 2,
  gradientIndex: 1,
};

test('useQuoteStore sets and appends quote batches', () => {
  resetQuoteStore();

  useQuoteStore.getState().setQuotes([firstQuote]);
  useQuoteStore.getState().appendQuotes([secondQuote]);

  const state = useQuoteStore.getState();
  assert.equal(state.quotes.length, 2);
  assert.deepEqual(state.quotes.map((quote) => quote.id), ['q1', 'q2']);
});

test('useQuoteStore clears quote list and resets index', () => {
  resetQuoteStore();

  useQuoteStore.getState().setQuotes([firstQuote, secondQuote]);
  useQuoteStore.getState().setCurrentIndex(1);
  useQuoteStore.getState().clearQuotes();

  const state = useQuoteStore.getState();
  assert.equal(state.quotes.length, 0);
  assert.equal(state.currentIndex, 0);
});

test('useQuoteStore tracks loading, generating, and pending deep link state', () => {
  resetQuoteStore();

  useQuoteStore.getState().setIsLoading(false);
  useQuoteStore.getState().setIsGenerating(true);
  useQuoteStore.getState().setPendingDeepLinkQuoteId('q2');

  const state = useQuoteStore.getState();
  assert.equal(state.isLoading, false);
  assert.equal(state.isGenerating, true);
  assert.equal(state.pendingDeepLinkQuoteId, 'q2');
});
