import { targetTiles, actionFor, hasBounty, isFrontline, chainAt, supplied, TERRAIN, CHAIN_WINDOW, RALLY_CHAIN, neighbors } from './game.js';

export const BOT_LEVELS = {
  chill: { pace: 1.6, noise: 3, hesitate: .45 },
  steady: { pace: 1.35, noise: 2, hesitate: .3 },
  fierce: { pace: 1.02, noise: .8, hesitate: .2 }
};

const BOT = 1;

function moveValue(game, tile, now, linked) {
  const action = actionFor(game, tile.id, BOT, now);
  const points = TERRAIN[tile.terrain].points + tile.bounty;
  if (action === 'reinforce') {
    const threatened = neighbors(game, tile.id).filter(n => game.tiles[n].owner === 0).length;
    return tile.strength === 1 ? 1 + threatened * .6 : .3;
  }
  const damage = chainAt(game, BOT, now) + 1 >= RALLY_CHAIN ? 2 : 1;
  const finishes = tile.strength <= damage;
  // Land that would not link back to the castle scores nothing, so the bot mostly avoids it.
  const connected = neighbors(game, tile.id).some(n => linked.has(n));
  const value = points * (finishes ? 1.3 : .6) + (hasBounty(game, tile.id, now) ? 6 : 0)
    + (tile.owner === 0 ? 1.4 : 0) + (tile.owner === 0 && isFrontline(game, tile.id) ? .5 : 0);
  return connected ? value : value * .25;
}

// Picks the bot's next target and how long a human of this level would take to type it.
export function planBotMove(game, level, random, now) {
  const options = targetTiles(game, BOT, now);
  if (!options.length) return { target: null, delay: 400 };
  const linked = supplied(game, BOT);
  const ranked = options
    .map(tile => ({ tile, value: moveValue(game, tile, now, linked) - tile.word.length * .1 + random() * level.noise }))
    .sort((a, b) => b.value - a.value);
  const target = ranked[0].tile;
  const typing = 800 + random() * 500 + target.word.length * 120;
  const pause = random() < level.hesitate ? CHAIN_WINDOW * (.6 + random() * .6) : 0;
  return { target, delay: typing * level.pace + pause };
}
