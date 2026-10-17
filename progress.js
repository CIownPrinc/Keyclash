import { seedFromText, mapOf } from './game.js';

export const RANKS = [
  { name: 'Recruit', xp: 0, icon: '🪖' },
  { name: 'Scout', xp: 300, icon: '🧭' },
  { name: 'Soldier', xp: 800, icon: '🗡️' },
  { name: 'Sergeant', xp: 1600, icon: '🎖️' },
  { name: 'Captain', xp: 3000, icon: '⚓' },
  { name: 'Major', xp: 5000, icon: '🛡️' },
  { name: 'Colonel', xp: 8000, icon: '🦅' },
  { name: 'General', xp: 12_000, icon: '⭐' },
  { name: 'Warlord', xp: 18_000, icon: '👑' }
];

const DAILY_EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

export const DEFAULT_PREFS = Object.freeze({
  sound: true, level: 'steady', name: 'Player 1', xp: 0, played: 0, wins: 0,
  bestWpm: 0, bestChain: 0, streak: 0, lastDaily: null, daily: null, seen: Object.freeze([])
});

export function rankFor(xp) {
  const index = RANKS.findLastIndex(r => xp >= r.xp);
  const rank = RANKS[index], next = RANKS[index + 1];
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { ...rank, index, next, progress };
}

export function xpForMatch({ points, won, tied, bestChain, wpm }) {
  return Math.round(points * 4 + (won ? 120 : tied ? 70 : 40) + bestChain * 6 + wpm);
}

export function wordsPerMinute(chars, ms) {
  return ms > 0 ? Math.round(chars / 5 / (ms / 60_000)) : 0;
}

export function accuracy(chars, typos) {
  return chars + typos === 0 ? 100 : Math.round(chars / (chars + typos) * 100);
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dailyInfo(date = new Date()) {
  const key = localDateKey(date);
  const number = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - DAILY_EPOCH) / DAY) + 1;
  return { key, number, seed: seedFromText(`keyclash-daily-${key}`) };
}

function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
}

// Only the first daily battle of each day counts toward the streak; replays are practice.
export function recordDaily(prefs, key, result) {
  if (prefs.lastDaily === key) return prefs;
  const streak = prefs.lastDaily === previousDay(key) ? prefs.streak + 1 : 1;
  return { ...prefs, streak, lastDaily: key, daily: { key, ...result } };
}

export function liveStreak(prefs, key) {
  return prefs.lastDaily === key || prefs.lastDaily === previousDay(key) ? prefs.streak : 0;
}

export function mapEmoji(game, player) {
  const map = mapOf(game);
  const at = new Map(map.cells.map((c, id) => [`${c.col},${c.row}`, id]));
  return map.rows.map((row, r) => [...row].map((_, c) => {
    const id = at.get(`${c},${r}`);
    if (id === undefined) return '🌊';
    const owner = game.tiles[id].owner;
    return owner === player ? '🟦' : owner === -1 ? '⬜' : '🟧';
  }).join('')).join('\n');
}

export function shareText({ number, outcome, mine, theirs, wpm, bestChain, grid }) {
  return `KEYCLASH Daily #${number} ⚔️\n${outcome} ${mine}–${theirs} · ${wpm} WPM · 🔥${bestChain}\n${grid}`;
}
