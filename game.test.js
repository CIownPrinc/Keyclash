import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, strike, actionFor, matchingTiles, score, finish, advance, neighbors, capitalOf, supplied,
  isAirdrop, chainAt, MAPS, WORDS, TERRAIN, MAX_STRENGTH, RALLY_CHAIN, BLITZ_CHAIN, BLITZ_SPREAD, STRIKES_PER_AIRDROP, PROTECTION
} from './game.js';

const START = 1000;
const fresh = (map = 0) => createGame({ seed: 42, startAt: START, map });
const neighborOf = (game, id, owner = -1) => neighbors(game, id).find(n => game.tiles[n].owner === owner && game.tiles[n].terrain !== 'capital');
function hit(game, id, player, now) { return strike(game, id, player, game.tiles[id].word, now); }

test('every map is point-symmetric, connected, and has one capital per side', () => {
  for (const map of MAPS) {
    const at = new Map(map.cells.map(c => [`${c.col},${c.row}`, c]));
    for (const cell of map.cells) {
      const mirrorCol = cell.row % 2 === 0 ? map.cols - 1 - cell.col : map.cols - 2 - cell.col;
      const twin = at.get(`${mirrorCol},${map.rows.length - 1 - cell.row}`);
      assert.ok(twin, `${map.name}: ${cell.col},${cell.row} has no mirror`);
      assert.equal(twin.terrain, cell.terrain);
    }
    const seen = new Set([0]), queue = [0];
    while (queue.length) for (const n of map.adjacency[queue.shift()]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    assert.equal(seen.size, map.cells.length, `${map.name} is not connected`);
    assert.notEqual(map.capitals[0], -1);
    assert.notEqual(map.capitals[1], -1);
  }
});

test('no word is a prefix of another, so exact matches are unambiguous', () => {
  const all = Object.values(WORDS).flat();
  assert.equal(new Set(all).size, all.length);
  for (const a of all) for (const b of all) if (a !== b) assert.equal(b.startsWith(a), false, `${a} prefixes ${b}`);
});

test('the same seed always builds the same battlefield', () => {
  assert.deepEqual(createGame({ seed: 7, startAt: 0 }).tiles, createGame({ seed: 7, startAt: 0 }).tiles);
});

test('nothing can be struck before the countdown ends', () => {
  const game = fresh();
  const target = neighborOf(game, capitalOf(game, 0));
  assert.equal(actionFor(game, target, 0, START - 1), null);
  assert.equal(actionFor(game, target, 0, START), 'attack');
});

test('capitals can never be attacked', () => {
  const game = fresh();
  const enemyCapital = capitalOf(game, 1);
  for (const n of neighbors(game, enemyCapital)) game.tiles[n].owner = 0;
  assert.equal(actionFor(game, enemyCapital, 0, START + 5000), null);
});

test('typing a neutral plains word captures it and rotates the word', () => {
  const game = fresh();
  const target = neighbors(game, capitalOf(game, 0)).find(n => game.tiles[n].terrain === 'plains');
  const word = game.tiles[target].word;
  assert.equal(strike(game, target, 0, 'nope', START + 10).ok, false);
  const result = hit(game, target, 0, START + 10);
  assert.equal(result.kind, 'capture');
  assert.equal(game.tiles[target].owner, 0);
  assert.notEqual(game.tiles[target].word, word);
});

test('strong hexes take several words, and a chain doubles damage', () => {
  const game = fresh();
  const target = neighborOf(game, capitalOf(game, 0));
  game.tiles[target].strength = 3;
  assert.equal(hit(game, target, 0, START + 10).kind, 'hit');
  assert.equal(game.tiles[target].strength, 2);
  game.chain[0] = { count: RALLY_CHAIN - 1, at: START + 10 };
  assert.equal(hit(game, target, 0, START + 20).kind, 'capture');
});

test('the chain resets when you pause too long', () => {
  const game = fresh();
  const target = neighborOf(game, capitalOf(game, 0));
  game.tiles[target].strength = 3;
  hit(game, target, 0, START + 10);
  hit(game, target, 0, START + 1000);
  assert.equal(chainAt(game, 0, START + 1000), 2);
  assert.equal(chainAt(game, 0, START + 5000), 0);
});

test('frontline hexes can be reinforced up to the cap', () => {
  const game = fresh();
  const mine = neighborOf(game, capitalOf(game, 0));
  game.tiles[mine].owner = 0;
  const enemy = neighbors(game, mine).find(n => game.tiles[n].owner === -1 && game.tiles[n].terrain !== 'capital');
  game.tiles[enemy].owner = 1;
  assert.equal(actionFor(game, mine, 0, START + 2000), 'reinforce');
  game.tiles[mine].strength = MAX_STRENGTH;
  assert.equal(actionFor(game, mine, 0, START + 2000), null);
});

test('freshly flipped hexes are briefly protected', () => {
  const game = fresh();
  const target = neighborOf(game, capitalOf(game, 0));
  hit(game, target, 0, START + 10);
  game.tiles[neighborOf(game, target)].owner = 1;
  assert.equal(actionFor(game, target, 1, START + 10 + PROTECTION - 1), null);
  assert.equal(actionFor(game, target, 1, START + 10 + PROTECTION), 'attack');
});

test('blitz chains spread a capture to neighbouring neutral land', () => {
  const game = fresh();
  const target = neighbors(game, capitalOf(game, 0)).find(n => game.tiles[n].terrain === 'plains');
  game.chain[0] = { count: BLITZ_CHAIN - 1, at: START + 10 };
  const result = hit(game, target, 0, START + 20);
  assert.ok(result.spread.length > 0 && result.spread.length <= BLITZ_SPREAD);
  assert.ok(result.spread.every(id => game.tiles[id].owner === 0));
});

test('hexes cut off from the capital score nothing', () => {
  const game = fresh();
  const far = game.tiles.find(t => t.owner === -1 && t.terrain === 'plains' && !neighbors(game, t.id).some(n => game.tiles[n].owner === 0));
  far.owner = 0;
  assert.equal(supplied(game, 0).has(far.id), false);
  assert.equal(score(game)[0].points, TERRAIN.capital.points);
  assert.equal(score(game)[0].cutOff, 1);
});

test('every few strikes earns an airdrop onto land two hexes away', () => {
  const game = fresh();
  const target = neighbors(game, capitalOf(game, 0)).find(n => game.tiles[n].terrain === 'plains');
  game.tiles[target].strength = 99;
  for (let i = 0; i < STRIKES_PER_AIRDROP; i++) hit(game, target, 0, START + 10 + i * 5000);
  assert.equal(game.airdrops[0], 1);
  const drop = game.tiles.find(t => isAirdrop(game, t.id, 0));
  assert.ok(drop);
  assert.equal(actionFor(game, drop.id, 0, START + 30_000), 'attack');
  drop.strength = 2;
  assert.equal(hit(game, drop.id, 0, START + 30_000).kind, 'capture');
  assert.equal(game.airdrops[0], 0);
});

test('typing a prefix targets only hexes you can act on', () => {
  const game = fresh();
  const target = neighborOf(game, capitalOf(game, 0));
  const word = game.tiles[target].word;
  assert.ok(matchingTiles(game, 0, word.slice(0, 2), START).some(t => t.id === target));
  assert.deepEqual(matchingTiles(game, 0, ` ${word.toUpperCase()} `, START).map(t => t.id), [target]);
  assert.deepEqual(matchingTiles(game, 0, '', START), []);
});

test('bounties appear on contested neutral land and pay out permanently', () => {
  const game = fresh();
  assert.equal(advance(game, START + 8000), true);
  const id = game.bountyId;
  assert.equal(game.tiles[id].owner, -1);
  game.tiles[neighbors(game, id)[0]].owner = 0;
  game.tiles[id].strength = 1;
  assert.equal(hit(game, id, 0, START + 8001).bounty, true);
  assert.ok(game.tiles[id].bounty > 0);
});

test('the winner is decided when the clock runs out', () => {
  const game = fresh();
  hit(game, neighbors(game, capitalOf(game, 0)).find(n => game.tiles[n].terrain === 'plains'), 0, START + 10);
  assert.equal(finish(game, START + 59_999), false);
  assert.equal(finish(game, START + 60_000), true);
  assert.equal(game.winner, 0);
});
