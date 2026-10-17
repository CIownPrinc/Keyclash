import test from 'node:test';
import assert from 'node:assert/strict';
import { rankFor, xpForMatch, wordsPerMinute, accuracy, dailyInfo, recordDaily, liveStreak, mapEmoji, shareText, DEFAULT_PREFS, RANKS } from './progress.js';
import { planBotMove, BOT_LEVELS } from './bot.js';
import { createGame, actionFor } from './game.js';

test('ranks climb with xp and report progress to the next one', () => {
  assert.equal(rankFor(0).name, 'Recruit');
  assert.equal(rankFor(150).progress, .5);
  assert.equal(rankFor(300).name, 'Scout');
  assert.equal(rankFor(10 ** 9).name, RANKS.at(-1).name);
  assert.equal(rankFor(10 ** 9).progress, 1);
});

test('winning and chaining earn more xp', () => {
  const base = { points: 20, won: false, tied: false, bestChain: 2, wpm: 40 };
  assert.ok(xpForMatch({ ...base, won: true }) > xpForMatch(base));
  assert.ok(xpForMatch({ ...base, bestChain: 9 }) > xpForMatch(base));
});

test('typing stats', () => {
  assert.equal(wordsPerMinute(300, 60_000), 60);
  assert.equal(wordsPerMinute(10, 0), 0);
  assert.equal(accuracy(0, 0), 100);
  assert.equal(accuracy(90, 10), 90);
});

test('the daily battle is numbered and seeded by local date', () => {
  const a = dailyInfo(new Date(2026, 0, 1, 9));
  const b = dailyInfo(new Date(2026, 0, 1, 23));
  assert.equal(a.number, 1);
  assert.equal(a.seed, b.seed);
  assert.notEqual(dailyInfo(new Date(2026, 0, 2)).seed, a.seed);
});

test('daily streaks grow on consecutive days and reset after a gap', () => {
  let prefs = recordDaily(DEFAULT_PREFS, '2026-03-01', { won: true });
  assert.equal(prefs.streak, 1);
  prefs = recordDaily(prefs, '2026-03-02', { won: false });
  assert.equal(prefs.streak, 2);
  assert.equal(recordDaily(prefs, '2026-03-02', { won: true }), prefs);
  assert.equal(liveStreak(prefs, '2026-03-03'), 2);
  assert.equal(liveStreak(prefs, '2026-03-04'), 0);
  assert.equal(recordDaily(prefs, '2026-03-05', { won: true }).streak, 1);
});

test('streaks carry across month boundaries', () => {
  const prefs = recordDaily({ ...DEFAULT_PREFS, streak: 4, lastDaily: '2026-02-28' }, '2026-03-01', {});
  assert.equal(prefs.streak, 5);
});

test('the share card shows the final map and the result', () => {
  const game = createGame({ seed: 3, startAt: 0 });
  const grid = mapEmoji(game, 0);
  assert.equal(grid.split('\n').length, 7);
  assert.ok(grid.includes('🟦') && grid.includes('🟧') && grid.includes('🌊'));
  assert.match(shareText({ number: 12, outcome: 'Victory', mine: 30, theirs: 20, wpm: 55, bestChain: 7, grid }), /Daily #12[\s\S]*30–20 · 55 WPM · 🔥7/);
});

test('the bot only plans legal moves and types longer words more slowly', () => {
  const game = createGame({ seed: 5, startAt: 0 });
  const plan = planBotMove(game, BOT_LEVELS.steady, () => .5, 100);
  assert.notEqual(actionFor(game, plan.target.id, 1, 100), null);
  const quick = planBotMove(game, BOT_LEVELS.fierce, () => .5, 100);
  const slow = planBotMove(game, BOT_LEVELS.chill, () => .5, 100);
  assert.ok(quick.delay < slow.delay);
});
