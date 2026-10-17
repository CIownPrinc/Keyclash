export const DURATION = 60_000;
export const COUNTDOWN = 3_000;
export const PROTECTION = 1_000;
export const MAX_STRENGTH = 3;
export const CHAIN_WINDOW = 3_000;
export const RALLY_CHAIN = 3;
export const BLITZ_CHAIN = 6;
export const BLITZ_SPREAD = 2;
export const STRIKES_PER_AIRDROP = 5;
export const MAX_AIRDROPS = 2;

const BOUNTY_LENGTH = 8_000;
const FIRST_BOUNTY = 8_000;
const BOUNTY_INTERVAL = 12_000;
const BOUNTY_POINTS = 2;
const EVENT_LOG_SIZE = 24;

export const TERRAIN = {
  plains: { points: 1, strength: 1, tier: 'short', label: 'Plains' },
  forest: { points: 2, strength: 1, tier: 'medium', label: 'Forest' },
  mountain: { points: 3, strength: 2, tier: 'long', label: 'Mountain' },
  shrine: { points: 4, strength: 1, tier: 'medium', label: 'Shrine' },
  capital: { points: 2, strength: MAX_STRENGTH, tier: null, label: 'Capital' }
};

// No word may be a prefix of another, across every tier: type-to-target fires on the first exact match.
export const WORDS = {
  short: [
    'ash', 'bay', 'cove', 'dune', 'elm', 'fern', 'glen', 'hawk', 'isle', 'jade', 'kite', 'lake', 'mesa', 'moss',
    'nest', 'oak', 'pine', 'reef', 'sage', 'tide', 'vale', 'wave', 'yard', 'zest', 'bolt', 'crow', 'dawn', 'fox',
    'gale', 'hill', 'iron', 'jest', 'keep', 'lynx', 'mint', 'nook', 'opal', 'pond', 'quay', 'rush', 'sand', 'tusk',
    'urn', 'vine', 'wolf', 'yak', 'zinc', 'arch', 'bear', 'cliff', 'delta', 'ember', 'flint', 'grove', 'haze',
    'ivy', 'joy', 'knot', 'loom', 'marsh', 'north', 'oasis', 'plume', 'quill', 'raven', 'storm', 'thorn', 'umber',
    'vapor', 'whirl'
  ],
  medium: [
    'canyon', 'falcon', 'harbor', 'meteor', 'jungle', 'marble', 'breeze', 'cosmic', 'glider', 'anchor', 'bridge',
    'castle', 'dragon', 'engine', 'forest', 'galaxy', 'helmet', 'island', 'jigsaw', 'knight', 'meadow', 'nectar',
    'orchid', 'parrot', 'quiver', 'rocket', 'shield', 'tunnel', 'violet', 'walrus', 'yonder', 'zephyr', 'beacon',
    'candle', 'summit', 'tundra', 'vortex', 'sprint', 'pirate', 'legend', 'mirror', 'cobalt', 'frozen', 'geyser',
    'hollow', 'ripple', 'temple', 'turtle', 'wizard'
  ],
  long: [
    'lantern', 'volcano', 'glacier', 'thunder', 'crystal', 'compass', 'kingdom', 'citadel', 'fortress', 'mountain',
    'horizon', 'monsoon', 'phoenix', 'treasure', 'sentinel', 'blizzard', 'cyclone', 'emerald', 'gauntlet', 'journey',
    'mammoth', 'obsidian', 'paladin', 'rainbow', 'sapphire', 'tornado', 'unicorn', 'warrior', 'whisper', 'wildfire',
    'zeppelin', 'quantum', 'balloon', 'dolphin', 'eclipse', 'frontier', 'granite'
  ]
};

// Maps are drawn as odd-r offset hex rows. Only the top half and the middle row are written out;
// the bottom half is the point-mirror of the top so both sides always get the same land.
const MAP_SOURCES = [
  { name: 'Twin Isles', rows: ['..ppfmfpp..', '.ppfpppfpp.', 'pfpmpsppfp.', 'pApfmmfpBp.'] },
  { name: 'The Crossing', rows: ['.ppfp.mpfp.', 'pfpppmppfp.', 'ppmf.s.fpp.', 'pAp.mm.pBp.'] },
  { name: 'Highlands', rows: ['..pfmpmfp..', '.pfmfpfmp..', 'ppfpsfpfpp.', 'pAfpmmpfBp.'] }
];
const TERRAIN_CODES = { p: 'plains', f: 'forest', m: 'mountain', s: 'shrine', A: 'capital', B: 'capital' };

function mirrorRow(row, index) {
  const swapped = [...row].map(ch => (ch === 'A' ? 'B' : ch === 'B' ? 'A' : ch));
  return index % 2 === 0 ? swapped.reverse().join('') : swapped.slice(0, -1).reverse().join('') + '.';
}

function buildMap({ name, rows: top }) {
  const rows = [...top, ...top.slice(0, -1).map((row, i) => mirrorRow(row, i)).reverse()];
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') cells.push({ col: c, row: r, terrain: TERRAIN_CODES[ch], capitalOf: ch === 'A' ? 0 : ch === 'B' ? 1 : -1 });
  }));
  const index = new Map(cells.map((cell, id) => [`${cell.col},${cell.row}`, id]));
  const adjacency = cells.map(({ col, row }) => {
    const offsets = row % 2 === 0
      ? [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]]
      : [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
    return offsets.map(([dc, dr]) => index.get(`${col + dc},${row + dr}`)).filter(id => id !== undefined);
  });
  return { name, rows, cols: rows[0].length, cells, adjacency, capitals: [0, 1].map(p => cells.findIndex(c => c.capitalOf === p)) };
}

export const MAPS = MAP_SOURCES.map(buildMap);

// ---------- randomness (seeded so the server, the client, and the daily battle agree) ----------

export function nextRandom(state) {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function seedFromText(text) {
  let hash = 2166136261;
  for (const ch of text) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function pickWord(game, tier) {
  const used = new Set(game.tiles.map(t => t.word));
  const free = WORDS[tier].filter(w => !used.has(w));
  return free[Math.floor(nextRandom(game) * free.length)];
}

// ---------- setup ----------

export function createGame({ seed = Math.floor(Math.random() * 2 ** 32), startAt = Date.now(), map } = {}) {
  const mapIndex = map ?? seed % MAPS.length;
  const game = {
    map: mapIndex,
    seed: seed >>> 0,
    tiles: [],
    startedAt: startAt,
    endsAt: startAt + DURATION,
    finished: false,
    winner: null,
    strikes: [0, 0],
    captures: [0, 0],
    airdrops: [0, 0],
    chain: [{ count: 0, at: 0 }, { count: 0, at: 0 }],
    bestChain: [0, 0],
    bountyId: null,
    bountyUntil: 0,
    nextBountyAt: startAt + FIRST_BOUNTY,
    revision: 0,
    seq: 0,
    events: []
  };
  for (const [id, cell] of MAPS[mapIndex].cells.entries()) {
    const terrain = TERRAIN[cell.terrain];
    const tile = { id, terrain: cell.terrain, owner: cell.capitalOf, strength: terrain.strength, bounty: 0, changedAt: startAt, word: '' };
    game.tiles.push(tile);
    tile.word = terrain.tier ? pickWord(game, terrain.tier) : '';
  }
  return game;
}

// ---------- geometry ----------

export function mapOf(game) { return MAPS[game.map]; }
export function neighbors(game, id) { return mapOf(game).adjacency[id]; }
export function capitalOf(game, player) { return mapOf(game).capitals[player]; }

function cube(cell) {
  const x = cell.col - (cell.row - (cell.row & 1)) / 2;
  return [x, cell.row, -x - cell.row];
}

export function hexDistance(game, a, b) {
  const [ax, ay, az] = cube(mapOf(game).cells[a]), [bx, by, bz] = cube(mapOf(game).cells[b]);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

// ---------- rules ----------

export function isLive(game, now = Date.now()) {
  return !game.finished && now >= game.startedAt && now < game.endsAt;
}

export function isCapital(game, id) { return game.tiles[id]?.terrain === 'capital'; }

export function isProtected(game, id, now = Date.now()) {
  return isCapital(game, id) || (game.tiles[id].owner !== -1 && now - game.tiles[id].changedAt < PROTECTION);
}

export function hasBounty(game, id, now = Date.now()) {
  return game.bountyId === id && now < game.bountyUntil;
}

function touches(game, id, player) {
  return neighbors(game, id).some(n => game.tiles[n].owner === player);
}

export function isFrontline(game, id) {
  const tile = game.tiles[id];
  return tile.owner !== -1 && touches(game, id, 1 - tile.owner);
}

export function isAirdrop(game, id, player) {
  const tile = game.tiles[id];
  if (!tile || tile.owner !== -1 || game.airdrops[player] < 1 || touches(game, id, player)) return false;
  return game.tiles.some(t => t.owner === player && hexDistance(game, t.id, id) === 2);
}

// What typing this hex's word would do for the player right now: 'attack', 'reinforce', or null.
export function actionFor(game, id, player, now = Date.now()) {
  const tile = game.tiles[id];
  if (!tile || !isLive(game, now) || isCapital(game, id)) return null;
  if (tile.owner === player) return isFrontline(game, id) && tile.strength < MAX_STRENGTH ? 'reinforce' : null;
  if (isProtected(game, id, now)) return null;
  return touches(game, id, player) || isAirdrop(game, id, player) ? 'attack' : null;
}

export function targetTiles(game, player, now = Date.now()) {
  return game.tiles.filter(t => actionFor(game, t.id, player, now));
}

export function normalize(answer) {
  return String(answer).trim().toLowerCase();
}

export function matchingTiles(game, player, typed, now = Date.now()) {
  const prefix = normalize(typed);
  if (!prefix) return [];
  return targetTiles(game, player, now).filter(t => t.word.startsWith(prefix));
}

export function chainAt(game, player, now = Date.now()) {
  const { count, at } = game.chain[player];
  return now - at <= CHAIN_WINDOW ? count : 0;
}

export function supplied(game, player) {
  const start = capitalOf(game, player);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const n of neighbors(game, queue.shift())) {
      if (!seen.has(n) && game.tiles[n].owner === player) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

export function score(game) {
  return [0, 1].map(player => {
    const linked = supplied(game, player);
    const owned = game.tiles.filter(t => t.owner === player);
    const points = owned.filter(t => linked.has(t.id)).reduce((sum, t) => sum + TERRAIN[t.terrain].points + t.bounty, 0);
    return { points, tiles: owned.length, cutOff: owned.length - linked.size };
  });
}

// ---------- time ----------

export function advance(game, now = Date.now()) {
  if (!isLive(game, now)) return false;
  let changed = false;
  if (game.bountyId !== null && now >= game.bountyUntil) {
    game.bountyId = null;
    changed = true;
  }
  if (now >= game.nextBountyAt) {
    changed = placeBounty(game, now) || changed;
    game.nextBountyAt = now + BOUNTY_INTERVAL;
  }
  if (changed) game.revision++;
  return changed;
}

// Bounties favour the contested middle: neutral hexes both sides can reach soon.
function placeBounty(game, now) {
  const neutral = game.tiles.filter(t => t.owner === -1);
  if (!neutral.length) return false;
  const nearest = (id, player) => Math.min(...game.tiles.filter(t => t.owner === player).map(t => hexDistance(game, t.id, id)));
  const ranked = neutral.map(t => ({ id: t.id, d0: nearest(t.id, 0), d1: nearest(t.id, 1) }))
    .sort((a, b) => (Math.max(a.d0, a.d1) - Math.max(b.d0, b.d1)) || (Math.abs(a.d0 - a.d1) - Math.abs(b.d0 - b.d1)));
  const pool = ranked.slice(0, Math.min(4, ranked.length));
  game.bountyId = pool[Math.floor(nextRandom(game) * pool.length)].id;
  game.bountyUntil = now + BOUNTY_LENGTH;
  return true;
}

export function finish(game, now = Date.now()) {
  if (game.finished || now < game.endsAt) return false;
  game.finished = true;
  const [a, b] = score(game);
  game.winner = a.points === b.points ? (a.tiles === b.tiles ? -1 : a.tiles > b.tiles ? 0 : 1) : a.points > b.points ? 0 : 1;
  game.revision++;
  return true;
}

// ---------- striking ----------

function extendChain(game, player, now) {
  const count = chainAt(game, player, now) + 1;
  game.chain[player] = { count, at: now };
  game.bestChain[player] = Math.max(game.bestChain[player], count);
  return count;
}

function seize(game, tile, player, now) {
  tile.owner = player;
  tile.strength = 1;
  tile.changedAt = now;
  game.captures[player]++;
}

function blitz(game, tile, player, now) {
  const spread = neighbors(game, tile.id).map(n => game.tiles[n])
    .filter(t => t.owner === -1 && (t.terrain === 'plains' || t.terrain === 'forest') && !hasBounty(game, t.id, now))
    .sort((a, b) => TERRAIN[a.terrain].points - TERRAIN[b.terrain].points)
    .slice(0, BLITZ_SPREAD);
  for (const t of spread) seize(game, t, player, now);
  return spread.map(t => t.id);
}

function log(game, event) {
  game.seq++;
  game.events = [...game.events, { seq: game.seq, ...event }].slice(-EVENT_LOG_SIZE);
}

export function strike(game, id, player, answer, now = Date.now()) {
  finish(game, now);
  advance(game, now);
  const action = actionFor(game, id, player, now);
  if (!action) return { ok: false, error: 'That hex is out of reach.' };
  const tile = game.tiles[id];
  if (normalize(answer) !== tile.word) return { ok: false, error: 'Type the word exactly.' };
  const airdrop = isAirdrop(game, id, player);
  if (airdrop) game.airdrops[player]--;
  const chain = extendChain(game, player, now);
  const previousOwner = tile.owner;
  let kind = 'reinforce', spread = [], bounty = false;
  if (action === 'reinforce') tile.strength++;
  else {
    // An airdrop lands with no supply line behind it, so it takes the hex in one go or not at all.
    tile.strength -= airdrop ? tile.strength : chain >= RALLY_CHAIN ? 2 : 1;
    kind = 'hit';
    if (tile.strength <= 0) {
      kind = previousOwner === -1 ? 'capture' : 'steal';
      if (hasBounty(game, id, now)) { tile.bounty += BOUNTY_POINTS; game.bountyId = null; bounty = true; }
      seize(game, tile, player, now);
      if (chain >= BLITZ_CHAIN) spread = blitz(game, tile, player, now);
    }
  }
  tile.word = pickWord(game, TERRAIN[tile.terrain].tier);
  game.strikes[player]++;
  if (game.strikes[player] % STRIKES_PER_AIRDROP === 0) game.airdrops[player] = Math.min(MAX_AIRDROPS, game.airdrops[player] + 1);
  log(game, { id, player, kind, chain, spread, bounty, airdrop, from: previousOwner, at: now });
  game.revision++;
  return { ok: true, kind, chain, spread, bounty };
}
