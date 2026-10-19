import { MAPS, isCapital } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const R = 44;
const SQ3 = Math.sqrt(3);
const PAD = 26;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent?.appendChild(node);
  return node;
}

function corner(i, scale = 1) {
  const angle = Math.PI / 180 * (60 * i - 30);
  return [R * scale * Math.cos(angle), R * scale * Math.sin(angle)];
}

function hexPoints(scale = 1) {
  return [0, 1, 2, 3, 4, 5].map(i => corner(i, scale).map(v => v.toFixed(1)).join(',')).join(' ');
}

// Geometry is fixed per map, so it is computed once and cached.
const layouts = new Map();
function layoutFor(mapIndex) {
  if (layouts.has(mapIndex)) return layouts.get(mapIndex);
  const map = MAPS[mapIndex];
  const centers = map.cells.map(({ col, row }) => ({ x: PAD + SQ3 * R * (col + .5 * (row & 1)) + SQ3 * R / 2, y: PAD + R + 1.5 * R * row }));
  const byPosition = new Map(centers.map((c, id) => [`${Math.round(c.x)},${Math.round(c.y)}`, id]));
  const edges = centers.map(c => [0, 1, 2, 3, 4, 5].map(i => {
    const angle = Math.PI / 180 * 60 * i;
    return byPosition.get(`${Math.round(c.x + SQ3 * R * Math.cos(angle))},${Math.round(c.y + SQ3 * R * Math.sin(angle))}`);
  }));
  const width = PAD * 2 + SQ3 * R * (map.cols + .5);
  const height = PAD * 2 + R * 2 + 1.5 * R * (map.rows.length - 1);
  const layout = { centers, edges, width, height };
  layouts.set(mapIndex, layout);
  return layout;
}

function decorate(group, terrain) {
  const deco = el('g', { class: `deco deco-${terrain}` }, group);
  if (terrain === 'plains') {
    for (const [x, y] of [[-16, -14], [12, -20], [-2, -26]]) el('path', { d: `M${x - 3},${y + 3} l3,-5 l3,5`, class: 'grass' }, deco);
  } else if (terrain === 'forest') {
    for (const [x, y, s] of [[-15, -10, 9], [0, -16, 11], [15, -10, 9]]) {
      el('rect', { x: x - 1.2, y: y + 2, width: 2.4, height: 5, class: 'trunk' }, deco);
      el('path', { d: `M${x},${y - s * 1.6} L${x + s},${y + 3} L${x - s},${y + 3}Z`, class: 'tree' }, deco);
    }
  } else if (terrain === 'mountain') {
    el('path', { d: 'M-24,-2 L-9,-30 L6,-2Z', class: 'peak' }, deco);
    el('path', { d: 'M-4,-2 L10,-24 L24,-2Z', class: 'peak peak-back' }, deco);
    el('path', { d: 'M-14,-21 L-9,-30 L-4,-21 L-7,-23 L-9,-20 L-11,-23Z', class: 'snow' }, deco);
    el('path', { d: 'M6,-18 L10,-24 L14,-18 L12,-19 L10,-17 L8,-19Z', class: 'snow' }, deco);
  } else if (terrain === 'shrine') {
    el('circle', { cx: 0, cy: -18, r: 13, class: 'shrine-glow' }, deco);
    el('path', { d: 'M0,-31 L9,-18 L0,-5 L-9,-18Z', class: 'gem' }, deco);
    el('path', { d: 'M0,-31 L4,-18 L0,-5 L-9,-18Z', class: 'gem-shade' }, deco);
  } else if (terrain === 'capital') {
    el('path', { d: 'M-20,0 V-20 h5 v4 h5 v-4 h5 v-10 h10 v10 h5 v4 h5 v-4 h5 V0Z', class: 'castle' }, deco);
    el('rect', { x: -4, y: -9, width: 8, height: 9, rx: 4, class: 'gate' }, deco);
    el('line', { x1: 0, y1: -30, x2: 0, y2: -46, class: 'pole' }, deco);
    el('path', { d: 'M0,-46 q8,3 16,0 v9 q-8,3 -16,0Z', class: 'banner' }, deco);
  }
}

export function createBattlefield({ svg, overlay, onSelect }) {
  let built = null;
  let hexes = [];
  const fx = { svg: null, html: overlay };

  function build(game) {
    const layout = layoutFor(game.map);
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${layout.width.toFixed(0)} ${layout.height.toFixed(0)}`);
    svg.parentElement.style.setProperty('--ratio', (layout.width / layout.height).toFixed(4));
    buildDefs();
    const sea = el('g', { class: 'sea' }, svg);
    el('rect', { x: -200, y: -200, width: layout.width + 400, height: layout.height + 400, fill: 'url(#waves)', class: 'sea-waves' }, sea);
    const shallows = el('g', { class: 'shallows' }, svg);
    const coast = el('g', { class: 'coast' }, svg);
    for (const c of layout.centers) {
      el('polygon', { points: hexPoints(1.32), transform: `translate(${c.x},${c.y})` }, shallows);
      el('polygon', { points: hexPoints(1.1), transform: `translate(${c.x},${c.y})` }, coast);
    }
    const land = el('g', { class: 'land' }, svg);
    hexes = game.tiles.map(tile => buildHex(land, tile, layout.centers[tile.id]));
    const outlines = el('g', { class: 'outlines' }, svg);
    const paths = Object.fromEntries(['border-0', 'border-1', 'front-0', 'front-1'].map(key => [key, el('path', { class: key }, outlines)]));
    built = { map: game.map, layout, paths, bordersKey: null };
    const labels = el('g', { class: 'labels' }, svg);
    for (const hex of hexes) labels.appendChild(hex.label);
    fx.svg = el('g', { class: 'fx' }, svg);
  }

  function buildDefs() {
    const defs = el('defs', {}, svg);
    const waves = el('pattern', { id: 'waves', width: 60, height: 30, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 60, height: 30, class: 'water' }, waves);
    el('path', { d: 'M0,15 q7.5,-6 15,0 t15,0', class: 'wave' }, waves);
    el('path', { d: 'M30,28 q7.5,-6 15,0 t15,0', class: 'wave wave-faint' }, waves);
    for (const [terrain, [top, bottom]] of Object.entries({
      plains: ['#9fd47a', '#74b45a'], forest: ['#5fa35a', '#3f7d45'], mountain: ['#b4b0a4', '#857f73'],
      shrine: ['#f6e3a1', '#d9b45c'], capital: ['#d9cfb8', '#ad9f84']
    })) {
      const gradient = el('linearGradient', { id: `terrain-${terrain}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: 0, 'stop-color': top }, gradient);
      el('stop', { offset: 1, 'stop-color': bottom }, gradient);
    }
  }

  function buildHex(land, tile, center) {
    const group = el('g', { class: 'hex', transform: `translate(${center.x.toFixed(1)},${center.y.toFixed(1)})`, 'data-id': tile.id }, land);
    const body = el('g', { class: 'hex-body' }, group);
    el('polygon', { points: hexPoints(.97), class: 'hex-base', fill: `url(#terrain-${tile.terrain})` }, body);
    decorate(body, tile.terrain);
    el('polygon', { points: hexPoints(.97), class: 'hex-tint' }, body);
    el('polygon', { points: hexPoints(.86), class: 'hex-target' }, body);
    const pips = el('g', { class: 'pips' }, body);
    for (const x of [-12, -4, 4, 12]) el('circle', { cx: x, cy: -2, r: 3.2 }, pips);
    const bounty = el('g', { class: 'bounty-icon' }, body);
    el('circle', { cx: 0, cy: -22, r: 14, class: 'bounty-ring' }, bounty);
    el('text', { x: 0, y: -16, 'text-anchor': 'middle' }, bounty).textContent = '💰';
    const label = el('g', { class: 'label', transform: group.getAttribute('transform') });
    const plaque = el('rect', { y: 5, height: 22, rx: 7, class: 'plaque' }, label);
    const text = el('text', { x: 0, y: 21, 'text-anchor': 'middle', class: 'word' }, label);
    const typed = el('tspan', { class: 'typed' }, text);
    const rest = el('tspan', {}, text);
    group.addEventListener('pointerdown', () => onSelect(tile.id));
    label.addEventListener('pointerdown', () => onSelect(tile.id));
    return { group, label, plaque, typed, rest, pips: [...pips.children], className: '', word: null, done: -1 };
  }

  function paint(game, view) {
    if (!built || built.map !== game.map) build(game);
    for (const tile of game.tiles) paintHex(game, tile, hexes[tile.id], view);
    paintBorders(game, view.player);
  }

  function paintHex(game, tile, hex, view) {
    const action = view.actions.get(tile.id);
    const classes = ['hex', `terrain-${tile.terrain}`, tile.owner === -1 ? 'neutral' : tile.owner === view.player ? 'mine' : 'theirs'];
    if (action) classes.push('target', `act-${action}`);
    if (view.airdrops.has(tile.id)) classes.push('airdrop');
    if (view.aimed.has(tile.id)) classes.push('aimed');
    else if (view.typing && action) classes.push('dim');
    if (view.selected === tile.id) classes.push('locked');
    if (view.bountyId === tile.id) classes.push('has-bounty');
    if (view.contractTargets?.has(tile.id)) classes.push('contract-target');
    if (tile.owner !== -1 && !isCapital(game, tile.id) && !view.supplied[tile.owner].has(tile.id)) classes.push('cut-off');
    if (tile.bounty) classes.push('bountied');
    const className = classes.join(' ');
    if (hex.className !== className) {
      hex.className = className;
      hex.group.setAttribute('class', className);
      hex.label.setAttribute('class', `label ${className.replace(/\bhex\b/, '')}`);
    }
    const pipState = i => (tile.strength < 2 ? 'hidden' : i < tile.strength ? 'on' : 'off');
    hex.pips.forEach((pip, i) => { if (pip.getAttribute('class') !== pipState(i)) pip.setAttribute('class', pipState(i)); });
    const word = isCapital(game, tile.id) ? (view.names[tile.owner] ?? 'HQ').toUpperCase() : tile.word;
    const done = view.aimed.has(tile.id) && tile.word.startsWith(view.typed) ? view.typed.length : 0;
    if (hex.word !== word || hex.done !== done) {
      hex.word = word;
      hex.done = done;
      hex.typed.textContent = word.slice(0, done);
      hex.rest.textContent = word.slice(done);
      const width = Math.max(32, word.length * 8.9 + 14);
      hex.plaque.setAttribute('x', (-width / 2).toFixed(1));
      hex.plaque.setAttribute('width', width.toFixed(1));
    }
  }

  // Each side's outline is split into calm borders and glowing front lines where it touches the enemy.
  // Colours are relative to the viewer: team 0 is always "you".
  function paintBorders(game, player) {
    const key = `${player}:${game.tiles.map(t => t.owner).join('')}`;
    if (built.bordersKey === key) return;
    built.bordersKey = key;
    const segments = { 'border-0': [], 'border-1': [], 'front-0': [], 'front-1': [] };
    const { edges, centers } = built.layout;
    for (const tile of game.tiles) {
      if (tile.owner === -1) continue;
      const { x, y } = centers[tile.id];
      edges[tile.id].forEach((neighbor, i) => {
        const other = neighbor === undefined ? -2 : game.tiles[neighbor].owner;
        if (other === tile.owner) return;
        const [ax, ay] = corner(i, .9), [bx, by] = corner(i + 1, .9);
        const kind = other === 1 - tile.owner ? 'front' : 'border';
        segments[`${kind}-${tile.owner === player ? 0 : 1}`].push(`M${(x + ax).toFixed(1)},${(y + ay).toFixed(1)}L${(x + bx).toFixed(1)},${(y + by).toFixed(1)}`);
      });
    }
    for (const [key, list] of Object.entries(segments)) built.paths[key].setAttribute('d', list.join(''));
  }

  // ---------- effects ----------

  function center(id) { return built.layout.centers[id]; }

  function animate(duration, step, done) {
    const start = performance.now();
    const frame = time => {
      const t = Math.min(1, (time - start) / duration);
      step(t);
      if (t < 1) requestAnimationFrame(frame); else done?.();
    };
    requestAnimationFrame(frame);
  }

  function volley(fromId, toId, team, onImpact) {
    if (!built || fromId === undefined) return onImpact?.();
    const a = center(fromId), b = center(toId);
    const lift = Math.hypot(b.x - a.x, b.y - a.y) * .45 + 20;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - lift;
    const trail = el('path', { d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`, class: `trail team-${team}` }, fx.svg);
    const length = trail.getTotalLength();
    trail.style.strokeDasharray = `${length}`;
    const shot = el('circle', { r: 5, class: `shot team-${team}` }, fx.svg);
    animate(320, t => {
      const p = trail.getPointAtLength(length * t);
      shot.setAttribute('cx', p.x);
      shot.setAttribute('cy', p.y);
      trail.style.strokeDashoffset = `${length * (1 - t)}`;
      trail.style.opacity = String(1 - t * .6);
    }, () => { shot.remove(); trail.remove(); onImpact?.(); });
  }

  function burst(id, team, size = 1) {
    if (!built) return;
    const { x, y } = center(id);
    const ring = el('circle', { cx: x, cy: y, r: 8, class: `ring team-${team}` }, fx.svg);
    animate(520, t => { ring.setAttribute('r', 8 + 44 * size * t); ring.style.opacity = String(1 - t); }, () => ring.remove());
    const count = Math.round(10 * size);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = (30 + Math.random() * 40) * size;
      const spark = el('circle', { cx: x, cy: y, r: 2 + Math.random() * 2.5, class: `spark team-${team}` }, fx.svg);
      animate(480 + Math.random() * 240, t => {
        spark.setAttribute('cx', x + Math.cos(angle) * speed * t);
        spark.setAttribute('cy', y + Math.sin(angle) * speed * t + 30 * t * t);
        spark.style.opacity = String(1 - t);
      }, () => spark.remove());
    }
  }

  function pulse(id, className, ms = 650) {
    const hex = hexes[id];
    if (!hex) return;
    hex.group.classList.remove(className);
    void hex.group.getBBox();
    hex.group.classList.add(className);
    setTimeout(() => hex.group.classList.remove(className), ms);
  }

  function plantFlag(id, team) {
    if (!built) return;
    const { x, y } = center(id);
    const spot = el('g', { transform: `translate(${x},${y})` }, fx.svg);
    const flag = el('g', { class: `planted team-${team}` }, spot);
    el('line', { x1: 10, y1: -4, x2: 10, y2: -34, class: 'pole' }, flag);
    el('path', { d: 'M10,-34 q8,3 15,0 v9 q-7,3 -15,0Z', class: 'flag-cloth' }, flag);
    setTimeout(() => spot.remove(), 1400);
  }

  function floatText(id, text, className = '') {
    if (!built) return;
    const { x, y } = center(id);
    const note = document.createElement('div');
    note.className = `float-text ${className}`;
    note.textContent = text;
    note.style.left = `${x / built.layout.width * 100}%`;
    note.style.top = `${(y - 12) / built.layout.height * 100}%`;
    fx.html.appendChild(note);
    note.addEventListener('animationend', () => note.remove());
  }

  function nearestOwned(game, player, id) {
    const target = center(id);
    let best, bestDistance = Infinity;
    for (const tile of game.tiles) {
      if (tile.owner !== player || tile.id === id) continue;
      const c = center(tile.id), d = Math.hypot(c.x - target.x, c.y - target.y);
      if (d < bestDistance) { best = tile.id; bestDistance = d; }
    }
    return best;
  }

  return { paint, volley, burst, pulse, plantFlag, floatText, nearestOwned };
}

