import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/loadTsModule.mjs';

const {
  charMatchStatus,
  findBestOcrMatch,
  textSimilarity,
} = loadTsModule('../../utils/similarity.ts');

test('textSimilarity normalizes case, punctuation, and spacing', () => {
  assert.equal(textSimilarity('  Hello, WORLD!  ', 'hello world'), 1);
});

test('textSimilarity returns zero when one side is empty after normalization', () => {
  assert.equal(textSimilarity('', 'daily glow'), 0);
});

test('charMatchStatus reports exact per-character matches', () => {
  assert.deepEqual(Array.from(charMatchStatus('glow', 'grow')), [true, false, true, true]);
});

test('findBestOcrMatch chooses the best contiguous OCR line window', () => {
  const recognizedText = [
    'camera header',
    'Stay hungry',
    'Stay foolish',
    'page footer',
  ].join('\n');

  const result = findBestOcrMatch(recognizedText, 'Stay hungry Stay foolish');

  assert.equal(result.matchedText, 'Stay hungry Stay foolish');
  assert.equal(result.similarity, 1);
});

test('findBestOcrMatch tolerates OCR line breaks for Japanese text', () => {
  const result = findBestOcrMatch('今日\nも\n前へ', '今日も前へ');

  assert.equal(result.matchedText, '今日\nも\n前へ');
  assert.equal(result.similarity, 1);
});
