import {
  createGame, strike, actionFor, isAirdrop, matchingTiles, normalize, score, supplied, finish, advance, chainAt, CONTRACTS,
  hasBounty, nextRandom, TERRAIN, DURATION, COUNTDOWN, CHAIN_WINDOW, RALLY_CHAIN, BLITZ_CHAIN, STRIKES_PER_AIRDROP, COMMANDERS, MAPS
} from './game.js';
import { createBattlefield } from './map.js';
import { planBotMove, BOT_LEVELS } from './bot.js';
import { play, setSoundEnabled } from './sound.js';
import {
  DEFAULT_PREFS, rankFor, xpForMatch, wordsPerMinute, accuracy, dailyInfo, recordDaily, liveStreak, mapEmoji, shareText
} from './progress.js';

const $ = id => document.getElementById(id);
const input = $('typeInput');
const POLL_INTERVAL = 350;
const BOT_NAME = 'Nova';
const COACH = {
  start: ['Type a word', 'Any white outline is in reach. Your shared round contract above the map shows the bonus route worth chasing.'],
  strength: ['Tough ground', 'Dots show strength. Every word knocks one off.'],
  rally: ['Rally!', 'Three in a row. Your words now hit twice as hard. Keep the chain going.'],
  blitz: ['Blitz!', 'Six in a row. Captures now spill onto open land next door.'],
  bounty: ['Bounty', 'Take the 💰 hex for 2 points that stay with it.'],
  airdrop: ['Airdrop ready', 'Purple hexes two steps out are in reach. Land behind their lines.'],
  defend: ['They took a hex', 'Type the words on your own border to add strength.'],
  cutoff: ['Cut off', 'Land that is not linked to your castle scores nothing. Reconnect it.']
};

let selectedMap = 0;
let selectedCommander = 'vanguard';
const prefs = loadPrefs();
const battlefield = createBattlefield({ svg: $('map'), overlay: $('fx'), onSelect: lockOn });
let game = createGame({ seed: dailyInfo().seed, startAt: Date.now() });
let mode = 'preview';
let player = 0;
let selected = null;
let room = null;
let token = null;
let match = 0;
let clockOffset = 0;
let bestRoundTrip = Infinity;
let lastRevision = -1;
let awaitingAbove = -1;
let lastSeq = 0;
let resultShown = false;
let rematchRequested = false;
let pollTimer = null;
let pollInFlight = false;
let botTimer = null;
let botRandom = Math.random;
let botLevel = 'steady';
let lastCount = null;
let lastSecond = null;
let lastBountyId = null;
let missing = false;
let stats = { chars: 0, typos: 0 };
let coachQueue = [];
let coachTimer = null;
let lineKey = '';
const localFx = new Map();

const now = () => Date.now() + clockOffset;
const playing = () => mode !== 'preview' && (mode !== 'online' || match > 0) && !game.finished;
const live = () => playing() && now() >= game.startedAt;
const againstBot = () => mode === 'bot' || mode === 'daily';
const rival = () => 1 - player;

// ---------- preferences ----------

function loadPrefs() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('keyclash') || '{}'); } catch { /* start fresh */ }
  const prefs = { ...DEFAULT_PREFS, ...stored };
  prefs.seen = Array.isArray(stored.seen) ? [...stored.seen] : [];
  if (Number.isInteger(prefs.map)) selectedMap = ((prefs.map % MAPS.length) + MAPS.length) % MAPS.length;
  if (COMMANDERS.some(c => c.id === prefs.commander)) selectedCommander = prefs.commander;
  return prefs;
}
function savePrefs() {
  try { localStorage.setItem('keyclash', JSON.stringify(prefs)); } catch { /* storage is a convenience */ }
}

// ---------- small view helpers ----------

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function hideOverlays() { ['menuOverlay', 'resultOverlay', 'roomOverlay', 'waitingOverlay', 'helpOverlay'].forEach(hide); }
function setText(id, text) { if ($(id).textContent !== text) $(id).textContent = text; }
function hint(message, kind = '') { $('typeHint').textContent = message || ' '; $('typeHint').className = `type-hint ${kind}`; }
function restart(node, className) { node.classList.remove(className); void node.offsetWidth; node.classList.add(className); }

function names() {
  const fallback = mode === 'online' ? ['Player 1', 'Player 2'] : ['You', BOT_NAME];
  const list = [0, 1].map(i => room?.players?.[i] ?? fallback[i]);
  if (mode !== 'online') list[0] = 'You';
  return list;
}

function clearEntry() {
  selected = null;
  input.value = '';
  setMissing(false);
}
function setMissing(value) {
  missing = value;
  if (value) restart($('typeLine').parentElement, 'miss');
  else $('typeLine').parentElement.classList.remove('miss');
}

// ---------- coach hints (each shown once, ever) ----------

function coach(key) {
  if (prefs.seen.includes(key) || !playing()) return;
  prefs.seen.push(key);
  savePrefs();
  coachQueue.push(key);
  if (!coachTimer) nextCoach();
}
function nextCoach() {
  const key = coachQueue.shift();
  if (!key) { hide('coach'); coachTimer = null; return; }
  const [title, text] = COACH[key];
  setText('coachTitle', title);
  setText('coachText', text);
  hide('coach');
  void $('coach').offsetWidth;
  show('coach');
  coachTimer = setTimeout(nextCoach, 4200);
}
function resetCoach() {
  clearTimeout(coachTimer);
  coachTimer = null;
  coachQueue = [];
  hide('coach');
}

// ---------- rendering ----------

function aimedTiles(t = now()) {
  if (!live()) return [];
  if (selected !== null) return actionFor(game, selected, player, t) ? [game.tiles[selected]] : [];
  return matchingTiles(game, player, input.value, t);
}

function render() {
  const t = now();
  if (selected !== null && !actionFor(game, selected, player, t)) selected = null;
  const actions = new Map();
  if (live()) for (const tile of game.tiles) { const action = actionFor(game, tile.id, player, t); if (action) actions.set(tile.id, action); }
  const aimed = aimedTiles(t);
  const typed = normalize(input.value);
  battlefield.paint(game, {
    player,
    actions,
    airdrops: new Set([...actions.keys()].filter(id => isAirdrop(game, id, player))),
    aimed: new Set(aimed.map(tile => tile.id)),
    typed,
    typing: typed.length > 0,
    selected,
    bountyId: game.bountyId !== null && hasBounty(game, game.bountyId, t) ? game.bountyId : null,
    contractTargets: new Set(game.contract === 0 ? game.tiles.filter(tile => tile.terrain === 'shrine').map(tile => tile.id) : []),
    supplied: [supplied(game, 0), supplied(game, 1)],
    names: names()
  });
  renderHud();
  renderContract();
  renderChain(t);
  renderTypeLine(aimed, typed);
  renderInput();
  renderClock(t);
}

function renderContract() {
  const contract = CONTRACTS[game.contract] ?? CONTRACTS[0];
  setText('contractIcon', contract.icon);
  setText('contractName', contract.name);
  setText('contractDescription', contract.description);
  setText('matchMapName', MAPS[game.map]?.name ?? MAPS[0].name);
  $('contractStrip').classList.toggle('hidden', mode === 'preview' || (mode === 'online' && match === 0));
}

function renderHud() {
  const scores = score(game);
  const list = names();
  [player, rival()].forEach((p, side) => {
    setText(`name${side}`, list[p]);
    const scoreEl = $(`score${side}`);
    if (scoreEl.textContent !== String(scores[p].points)) { scoreEl.textContent = scores[p].points; restart(scoreEl, 'bump'); }
    const away = mode === 'online' && room?.players?.length === 2 && room?.connected && !room.connected[p];
    const commander = COMMANDERS.find(c => c.id === game.commanders?.[p])?.name ?? 'Vanguard';
    const note = away ? 'Disconnected' : mode === 'preview' ? ' ' : scores[p].cutOff ? `${commander} · ${scores[p].cutOff} cut off` : `${commander} · ${scores[p].tiles} hexes`;
    setText(`note${side}`, note);
    $(`tug${side}`).style.flexGrow = String(Math.max(1, scores[p].points));
  });
  const lead = scores[player].points - scores[rival()].points;
  document.querySelector('.side-0').classList.toggle('leading', playing() && lead > 0);
  document.querySelector('.side-1').classList.toggle('leading', playing() && lead < 0);
  if (live() && scores[player].cutOff) coach('cutoff');
  const drops = game.airdrops[player];
  $('dropIcons').querySelectorAll('i').forEach((icon, i) => icon.classList.toggle('ready', i < drops));
  const dropEvery = game.commanders?.[player] === 'quartermaster' ? 4 : game.commanders?.[player] ? 6 : STRIKES_PER_AIRDROP;
  setText('dropLabel', drops ? `${drops} airdrop${drops > 1 ? 's' : ''}` : wordsToGo(dropEvery - game.strikes[player] % dropEvery));
  if (drops && live()) coach('airdrop');
}

function wordsToGo(count) {
  return `${count} word${count === 1 ? '' : 's'} to go`;
}

function renderChain(t) {
  const count = live() ? chainAt(game, player, t) : 0;
  const left = count ? Math.max(0, 1 - (t - game.chain[player].at) / CHAIN_WINDOW) : 0;
  const chain = $('chain');
  setText('chainCount', String(count));
  setText('chainLabel', count >= BLITZ_CHAIN ? 'BLITZ' : count >= RALLY_CHAIN ? 'RALLY ×2' : 'chain');
  chain.classList.toggle('lit', count > 0);
  chain.classList.toggle('rally', count >= RALLY_CHAIN && count < BLITZ_CHAIN);
  chain.classList.toggle('blitz', count >= BLITZ_CHAIN);
  $('chainRing').style.strokeDashoffset = String(176 * (1 - left));
}

function renderInput() {
  const disabled = !live();
  if (input.disabled !== disabled) input.disabled = disabled;
}

function renderTypeLine(aimed, typed) {
  const key = `${mode}|${live()}|${game.finished}|${aimed.map(t => t.word).join(',')}|${typed}|${missing}`;
  if (key === lineKey) return;
  lineKey = key;
  const line = $('typeLine');
  const placeholder = text => { line.innerHTML = '<span class="type-placeholder"></span>'; line.firstChild.textContent = text; };
  if (!playing()) return placeholder(game.finished ? 'Battle over' : 'Pick a mode to start');
  if (!live()) return placeholder('Get ready…');
  if (aimed.length === 1 && aimed[0].word.startsWith(typed)) return renderWord(line, aimed[0].word, typed.length);
  if (aimed.length > 1) {
    line.replaceChildren(Object.assign(document.createElement('span'), { className: 'type-options' }));
    for (const tile of aimed.slice(0, 5)) {
      const chip = document.createElement('span');
      chip.append(Object.assign(document.createElement('em'), { textContent: tile.word.slice(0, typed.length) }), tile.word.slice(typed.length));
      line.firstChild.append(chip);
    }
    return;
  }
  if (typed) { line.innerHTML = '<span class="wrong"></span>'; line.firstChild.textContent = typed; return; }
  placeholder('Type any word with a white outline');
}

function renderWord(line, word, done) {
  line.replaceChildren(...[...word].map((ch, i) => Object.assign(document.createElement('span'), {
    className: i < done ? 'done' : i === done ? 'next' : 'todo',
    textContent: ch
  })));
}

function renderClock(t) {
  const left = mode === 'preview' || (mode === 'online' && match === 0) ? DURATION : Math.min(DURATION, Math.max(0, game.endsAt - t));
  const sec = Math.ceil(left / 1000);
  setText('timer', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
  $('timer').classList.toggle('urgent', live() && sec <= 10);
  if (live() && sec <= 5 && sec !== lastSecond && sec > 0) play('tick');
  lastSecond = sec;
  const bountyLive = game.bountyId !== null && hasBounty(game, game.bountyId, t) && live();
  const bountySoon = !bountyLive && live() && t < game.nextBountyAt && game.nextBountyAt - t <= 3000;
  $('bountyBanner').classList.toggle('hidden', !bountyLive && !bountySoon);
  setText('bountyLabel', bountyLive ? '💰 Bounty up!' : 'Bounty drop in');
  if (bountyLive) setText('bountyTime', String(Math.ceil((game.bountyUntil - t) / 1000)));
  else if (bountySoon) setText('bountyTime', String(Math.ceil((game.nextBountyAt - t) / 1000)));
  if (bountyLive && game.bountyId !== lastBountyId) { play('bounty'); coach('bounty'); }
  lastBountyId = bountyLive ? game.bountyId : null;
  renderCountdown(t);
}

function renderCountdown(t) {
  const count = playing() && t < game.startedAt ? Math.ceil((game.startedAt - t) / 1000) : null;
  if (count === lastCount) return;
  const wasCounting = lastCount !== null;
  lastCount = count;
  if (count !== null) return flashCountdown(String(count), '', 'count');
  if (wasCounting && playing()) {
    flashCountdown('Clash!', 'go', 'clash', 700);
    hint('Go!', 'good');
    input.disabled = false;
    input.focus();
    coach('start');
  }
}

function flashCountdown(text, className, sound, hideAfter) {
  const num = $('countdownNum');
  num.textContent = text;
  num.className = className;
  restart(num, 'pop');
  show('countdown');
  play(sound);
  clearTimeout(flashCountdown.timer);
  if (hideAfter) flashCountdown.timer = setTimeout(() => hide('countdown'), hideAfter);
}

// ---------- battle events → effects ----------

// Online, your own strikes are shown the instant you type them, so their server echo is skipped.
function processEvents() {
  for (const event of game.events) {
    if (event.seq <= lastSeq) continue;
    lastSeq = event.seq;
    const echo = mode === 'online' && event.player === player && Date.now() - (localFx.get(event.id) ?? 0) < 2000;
    if (!echo) showEvent(event);
  }
}

function showEvent(event) {
  const mine = event.player === player;
  const team = mine ? 0 : 1;
  const who = mine ? 'mine' : 'theirs';
  const tile = game.tiles[event.id];
  if (event.kind === 'reinforce') {
    battlefield.pulse(event.id, 'shine');
    battlefield.floatText(event.id, '+1 🛡', who);
    if (mine) play('reinforce');
    return;
  }
  const source = event.airdrop ? undefined : battlefield.nearestOwned(game, event.player, event.id);
  if (event.airdrop) battlefield.floatText(event.id, '🪂', who);
  if (mine) play(event.kind === 'hit' ? 'hit' : event.kind === 'steal' ? 'steal' : 'capture', event.chain);
  else play('enemy');
  if (event.kind === 'steal' && event.from === player) {
    setTimeout(() => { restart($('field'), 'quake'); play('lost'); }, 300);
    coach('defend');
  }
  battlefield.volley(source, event.id, team, () => {
    if (event.kind === 'hit') {
      battlefield.burst(event.id, team, .6);
      battlefield.pulse(event.id, 'jolt');
      battlefield.floatText(event.id, event.chain >= RALLY_CHAIN ? '−2' : '−1', who);
      if (mine) coach('strength');
      return;
    }
    battlefield.burst(event.id, team, 1.2);
    battlefield.pulse(event.id, 'flip');
    battlefield.plantFlag(event.id, team);
    battlefield.floatText(event.id, event.kind === 'steal' ? 'Taken!' : `+${TERRAIN[tile.terrain].points}`, who);
    if (event.bounty) setTimeout(() => battlefield.floatText(event.id, '💰 +2', 'big'), 250);
    event.spread.forEach((id, i) => setTimeout(() => { battlefield.pulse(id, 'flip'); battlefield.burst(id, team, .7); }, 110 * (i + 1)));
    if (event.spread.length) { battlefield.floatText(event.id, 'BLITZ!', 'big'); if (mine) play('blitz'); }
  });
}

// ---------- typing ----------

function lockOn(id) {
  if (!live()) return input.focus();
  if (actionFor(game, id, player, now())) {
    selected = selected === id ? null : id;
    input.value = '';
    setMissing(false);
    hint(selected === null ? 'Unlocked' : 'Locked on. Type the word.');
    render();
  }
  input.focus();
}

function onType() {
  if (!live()) { input.value = ''; return; }
  const typed = normalize(input.value);
  const aimed = aimedTiles();
  const exact = aimed.find(tile => tile.word === typed);
  if (exact) return submit(exact, typed);
  if (!typed) { setMissing(false); hint(''); }
  else if (aimed.some(tile => tile.word.startsWith(typed))) {
    setMissing(false);
    play('key');
    hint(aimed.length > 1 ? `${aimed.length} words match` : describe(aimed[0]));
  } else miss(typed);
  render();
}

function describe(tile) {
  const action = actionFor(game, tile.id, player, now());
  if (action === 'reinforce') return 'Your border: +1 strength';
  if (isAirdrop(game, tile.id, player)) return 'Airdrop behind the lines';
  const damage = chainAt(game, player, now()) + 1 >= RALLY_CHAIN ? 2 : 1;
  const wordsLeft = Math.ceil(tile.strength / damage);
  const what = tile.owner === -1 ? TERRAIN[tile.terrain].label : 'Enemy hex';
  return wordsLeft > 1 ? `${what}: ${wordsLeft} words to take it` : `${what}: take it`;
}

function miss(typed) {
  if (!missing) { stats.typos++; play('typo'); }
  setMissing(true);
  const elsewhere = game.tiles.some(tile => tile.word.startsWith(typed));
  hint(elsewhere && selected === null ? 'Not in reach yet' : 'Typo. Backspace to fix it.', 'bad');
}

function submit(tile, typed) {
  if (mode === 'online') return submitOnline(tile, typed);
  const result = strike(game, tile.id, player, typed, now());
  if (!result.ok) { clearEntry(); hint(result.error, 'bad'); return render(); }
  stats.chars += typed.length + 1;
  clearEntry();
  hint(result.kind === 'hit' ? 'Hit! Keep going.' : result.kind === 'reinforce' ? 'Dug in.' : result.kind === 'steal' ? 'Taken from them!' : 'Captured!', 'good');
  if (result.chain === RALLY_CHAIN) coach('rally');
  if (result.chain === BLITZ_CHAIN) coach('blitz');
  restart($('chain'), 'bump');
  processEvents();
  render();
}

// The client never has the seed, so it cannot know the next word or bounty. It plays the strike on a
// copy for instant feedback, shows "…" for the new word, and lets the server's answer replace the board.
function submitOnline(tile, typed) {
  if (now() >= game.nextBountyAt) { clearEntry(); sendStrike(tile.id, typed); return; }
  awaitingAbove = lastRevision;
  const predicted = structuredClone(game);
  const result = strike(predicted, tile.id, player, typed, now());
  if (!result.ok) { clearEntry(); hint(result.error, 'bad'); return render(); }
  predicted.tiles[tile.id].word = '…';
  stats.chars += typed.length + 1;
  localFx.set(tile.id, Date.now());
  showEvent(predicted.events.at(-1));
  predicted.events = game.events;
  predicted.seq = game.seq;
  game = predicted;
  clearEntry();
  hint(result.kind === 'hit' ? 'Hit! Keep going.' : result.kind === 'reinforce' ? 'Dug in.' : result.kind === 'steal' ? 'Taken from them!' : 'Captured!', 'good');
  if (result.chain === RALLY_CHAIN) coach('rally');
  if (result.chain === BLITZ_CHAIN) coach('blitz');
  restart($('chain'), 'bump');
  render();
  sendStrike(tile.id, typed);
}

// ---------- bot ----------

function scheduleBot() {
  if (!againstBot() || game.finished) return;
  const plan = planBotMove(game, BOT_LEVELS[botLevel], botRandom, Math.max(now(), game.startedAt));
  const wait = Math.max(0, game.startedAt - now());
  botTimer = setTimeout(() => playBotMove(plan.target), wait + plan.delay);
}

function playBotMove(target) {
  if (!againstBot() || game.finished) return;
  if (target && actionFor(game, target.id, 1, now())) {
    const wasAimed = aimedTiles().includes(target) && input.value;
    strike(game, target.id, 1, target.word, now());
    if (wasAimed && !aimedTiles().length) { clearEntry(); hint(`${BOT_NAME} got there first!`, 'bad'); }
    processEvents();
    render();
  }
  scheduleBot();
}

// ---------- online ----------

async function api(path, method = 'GET', data) {
  const sentAt = Date.now();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data ? JSON.stringify(data) : undefined
    });
  } catch { throw Error('Cannot reach the server. Check your connection.'); }
  const value = await res.json().catch(() => ({}));
  if (typeof value.now === 'number') syncClock(value.now, sentAt, Date.now());
  if (!res.ok) throw Object.assign(Error(value.error || `Server error (${res.status}).`), { status: res.status, state: value });
  return value;
}

// Keep the sample with the shortest round trip: it bounds the clock error most tightly.
function syncClock(serverNow, sentAt, receivedAt) {
  const roundTrip = receivedAt - sentAt;
  if (roundTrip > bestRoundTrip) return;
  bestRoundTrip = roundTrip;
  clockOffset = serverNow - (sentAt + receivedAt) / 2;
}

function acceptRoom(data) {
  if (mode !== 'online') return;
  room = { code: data.code, players: data.players, connected: data.connected, rematch: data.rematch };
  if (!data.game) return;
  if (data.match !== match) return startOnlineMatch(data);
  if (data.game.revision < lastRevision || data.game.revision <= awaitingAbove) return;
  adoptGame(data.game);
}

function adoptGame(next) {
  lastRevision = next.revision;
  game = next;
  processEvents();
  if (game.finished) endBattle();
  if (resultShown) renderResultActions();
  render();
}

function startOnlineMatch(data) {
  match = data.match;
  lastRevision = -1;
  awaitingAbove = -1;
  lastSeq = data.game.seq;
  resultShown = false;
  rematchRequested = false;
  stats = { chars: 0, typos: 0 };
  clearEntry();
  resetCoach();
  hideOverlays();
  document.body.classList.remove('home-view');
  game = data.game;
  adoptGame(data.game);
}

function sendStrike(id, answer) {
  api(`/api/room/${room.code}`, 'POST', { id, answer })
    .then(data => { awaitingAbove = -1; acceptRoom(data); })
    .catch(error => {
      awaitingAbove = -1;
      hint(error.message === 'That hex is out of reach.' ? 'Your rival got there first.' : error.message, 'bad');
      if (error.state?.game) adoptGame(error.state.game);
    });
}

function startPolling() { clearInterval(pollTimer); pollTimer = setInterval(poll, POLL_INTERVAL); poll(); }

async function poll() {
  if (!room || mode !== 'online' || pollInFlight) return;
  pollInFlight = true;
  try { acceptRoom(await api(`/api/room/${room.code}`)); }
  catch (error) { onRoomError(error); }
  finally { pollInFlight = false; }
}

function onRoomError(error) {
  if (error.status !== 401 && error.status !== 404) return hint(`Connection issue: ${error.message}`, 'bad');
  goToMenu();
  hide('menuOverlay');
  show('roomOverlay');
  setText('roomMessage', 'That room has closed. Make a new one or join another.');
}

function enterRoom(seat) {
  stopBattle();
  token = seat.token;
  player = seat.player;
  mode = 'online';
  match = 0;
  bestRoundTrip = Infinity;
  clockOffset = 0;
  room = { code: seat.code, players: seat.players ?? [] };
  history.replaceState(null, '', `/?room=${seat.code}`);
  try { sessionStorage.setItem('keyclash-seat', JSON.stringify({ code: seat.code, token: seat.token, player: seat.player })); } catch { /* resume is a convenience */ }
}

function savedSeat(code) {
  try {
    const seat = JSON.parse(sessionStorage.getItem('keyclash-seat') || 'null');
    return seat?.code === code ? seat : null;
  } catch { return null; }
}

function forgetSeat() {
  try { sessionStorage.removeItem('keyclash-seat'); } catch { /* nothing to forget */ }
}

function showWaiting(code) {
  setText('codeDisplay', code);
  setText('copyCode', 'Copy invite link');
  setText('waitSummary', `${MAPS[selectedMap].name} · ${COMMANDERS.find(c => c.id === selectedCommander)?.name} commander · battle starts when they join.`);
  hideOverlays();
  show('waitingOverlay');
  render();
}

async function resumeSeat(seat) {
  enterRoom(seat);
  hide('menuOverlay');
  try {
    const data = await api(`/api/room/${seat.code}`);
    if (!data.game) showWaiting(data.code);
    acceptRoom(data);
    startPolling();
  } catch (error) { onRoomError(error); }
}

// ---------- battle lifecycle ----------

function stopBattle() {
  clearTimeout(botTimer);
  clearInterval(pollTimer);
  pollTimer = null;
  resetCoach();
  hide('countdown');
}

function goToMenu() {
  stopBattle();
  mode = 'preview';
  room = null;
  token = null;
  clockOffset = 0;
  forgetSeat();
  clearEntry();
  game = createGame({ seed: dailyInfo().seed, startAt: Date.now() });
  lastSeq = game.seq;
  history.replaceState(null, '', '/');
  hideOverlays();
  renderMenu();
  show('menuOverlay');
  hint('');
  render();
}

function startBattle(kind) {
  stopBattle();
  const daily = dailyInfo();
  mode = kind;
  player = 0;
  resultShown = false;
  clockOffset = 0;
  stats = { chars: 0, typos: 0 };
  botLevel = kind === 'daily' ? 'steady' : prefs.played === 0 ? 'chill' : prefs.level;
  const seed = kind === 'daily' ? daily.seed : undefined;
  const commanderIndex = COMMANDERS.findIndex(c => c.id === selectedCommander);
  const botCommander = COMMANDERS[(commanderIndex + 1 + ((seed ?? Date.now()) % 2)) % COMMANDERS.length].id;
  game = createGame({ seed, map: kind === 'daily' ? undefined : selectedMap, commanders: [selectedCommander, botCommander], startAt: Date.now() + COUNTDOWN });
  lastSeq = game.seq;
  const botState = { seed: (kind === 'daily' ? daily.seed : Date.now()) ^ 0x9e3779b9 };
  botRandom = kind === 'daily' ? () => nextRandom(botState) : Math.random;
  room = null;
  clearEntry();
  hideOverlays();
  document.body.classList.remove('home-view');
  hint(kind === 'daily' ? `Daily island #${daily.number}` : `${BOT_NAME} is on ${botLevel} pace`);
  input.disabled = true;
  render();
  scheduleBot();
}

function endBattle() {
  if (resultShown) return;
  resultShown = true;
  clearTimeout(botTimer);
  clearEntry();
  resetCoach();
  hint('');
  flashCountdown('Time!', 'go', 'clash');
  setTimeout(() => { hide('countdown'); showResult(); }, 1300);
}

function showResult() {
  const scores = score(game);
  const mine = scores[player], theirs = scores[rival()];
  const won = game.winner === player, tied = game.winner === -1;
  const wpm = wordsPerMinute(stats.chars, DURATION);
  const acc = accuracy(stats.chars, stats.typos);
  const bestChain = game.bestChain[player];
  const earned = xpForMatch({ points: mine.points, won, tied, bestChain, wpm });
  const before = rankFor(prefs.xp);
  const records = { wpm: wpm > prefs.bestWpm && prefs.played > 0, chain: bestChain > prefs.bestChain && prefs.played > 0 };
  Object.assign(prefs, {
    xp: prefs.xp + earned, played: prefs.played + 1, wins: prefs.wins + (won ? 1 : 0),
    bestWpm: Math.max(prefs.bestWpm, wpm), bestChain: Math.max(prefs.bestChain, bestChain)
  });
  if (mode === 'daily') {
    Object.assign(prefs, recordDaily(prefs, dailyInfo().key, {
      number: dailyInfo().number, won, tied, mine: mine.points, theirs: theirs.points, wpm, bestChain, grid: mapEmoji(game, player)
    }));
  }
  savePrefs();
  const after = rankFor(prefs.xp);

  const stamp = $('resultStamp');
  stamp.textContent = tied ? 'Draw' : won ? 'Victory' : 'Defeat';
  stamp.className = `stamp ${tied ? 'draw' : won ? 'win' : 'loss'}`;
  const list = names();
  setText('final0', String(mine.points));
  setText('final1', String(theirs.points));
  setText('finalName0', list[player]);
  setText('finalName1', list[rival()]);
  $('resultStats').replaceChildren(...[
    [wpm, 'battle WPM', records.wpm], [`${acc}%`, 'accuracy', false], [bestChain, 'best chain', records.chain], [mine.tiles, 'hexes', false], [`+${mine.contractBonus}`, 'contract pts', false]
  ].map(([value, label, record]) => {
    const cell = document.createElement('div');
    if (record) cell.className = 'record';
    cell.append(Object.assign(document.createElement('b'), { textContent: String(value) }), Object.assign(document.createElement('small'), { textContent: record ? `${label} · best!` : label }));
    return cell;
  }));
  setText('xpRank', `${after.icon} ${after.name}`);
  setText('xpEarned', `+${earned} XP`);
  $('xpGainFill').style.width = `${(after.index > before.index ? 0 : before.progress) * 100}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => { $('xpGainFill').style.width = `${after.progress * 100}%`; }));
  $('rankUp').classList.toggle('hidden', after.index === before.index);
  if (after.index > before.index) { setText('rankUp', `Promoted to ${after.name}! ${after.icon}`); setTimeout(() => play('rankup'), 600); }
  $('shareBtn').classList.toggle('hidden', mode !== 'daily');
  setText('shareBtn', 'Share result');
  renderResultActions();
  renderRank();
  play(won || tied ? 'win' : 'lose');
  show('resultOverlay');
  $('playAgain').focus();
}

function renderResultActions() {
  const button = $('playAgain');
  if (mode !== 'online') {
    button.disabled = false;
    setText('playAgain', mode === 'daily' ? 'Quick battle' : 'Play again');
    return;
  }
  const rivalWants = room?.rematch?.[rival()];
  const rivalGone = room?.connected && !room.connected[rival()];
  button.disabled = rematchRequested || rivalGone;
  setText('playAgain', rivalGone ? 'Your rival left' : rematchRequested ? 'Waiting for your rival…' : rivalWants ? 'Accept rematch' : 'Ask for a rematch');
}

async function requestRematch() {
  rematchRequested = true;
  renderResultActions();
  try { acceptRoom(await api(`/api/room/${room.code}/rematch`, 'POST', {})); }
  catch (error) { rematchRequested = false; renderResultActions(); hint(error.message, 'bad'); }
}

async function shareDaily() {
  const daily = prefs.daily;
  if (!daily) return;
  const text = shareText({
    number: daily.number, outcome: daily.tied ? 'Draw' : daily.won ? 'Victory' : 'Defeat',
    mine: daily.mine, theirs: daily.theirs, wpm: daily.wpm, bestChain: daily.bestChain, grid: daily.grid
  });
  try { await navigator.clipboard.writeText(text); setText('shareBtn', 'Copied!'); }
  catch { setText('shareBtn', 'Could not copy'); }
}

// ---------- menu, rank, sound ----------

function renderMenu() {
  document.body.classList.add('home-view');
  $('commanderOptions').replaceChildren(...COMMANDERS.map(commander => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'commander-card';
    button.setAttribute('aria-pressed', String(selectedCommander === commander.id));
    button.innerHTML = `<span class="commander-icon" aria-hidden="true">${commander.icon}</span><b>${commander.name}</b><small>${commander.description}</small>`;
    button.addEventListener('click', () => { selectedCommander = commander.id; prefs.commander = commander.id; savePrefs(); renderMenu(); });
    return button;
  }));
  setText('mapTitle', MAPS[selectedMap].name);
  setText('mapCaption', ['Balanced shores and a contested center', 'Short chokepoints around a risky central pass', 'Long mountain routes and shrine control'][selectedMap]);
  const preview = $('mapPreview');
  preview.style.gridTemplateColumns = `repeat(${MAPS[selectedMap].cols}, 19px)`;
  preview.replaceChildren(...MAPS[selectedMap].cells.map(cell => {
    const hex = document.createElement('i');
    hex.className = `mini-hex ${cell.terrain}`;
    hex.style.gridColumn = String(cell.col + 1); hex.style.gridRow = String(cell.row + 1);
    if (cell.row % 2) hex.style.transform = 'translateX(9px)';
    return hex;
  }));
  document.querySelectorAll('.pace button').forEach(button => button.setAttribute('aria-checked', String(button.dataset.level === prefs.level)));
  const daily = dailyInfo();
  const doneToday = prefs.lastDaily === daily.key && prefs.daily;
  const streak = liveStreak(prefs, daily.key);
  setText('dailyTitle', `Daily island #${daily.number}`);
  setText('dailySub', doneToday
    ? `${doneToday.won ? 'Won' : doneToday.tied ? 'Drew' : 'Lost'} ${doneToday.mine}–${doneToday.theirs}. New map tomorrow.`
    : streak ? `🔥 ${streak} day streak. Keep it alive.` : 'Same map for everyone today');
  $('dailyBtn').classList.toggle('done', Boolean(doneToday));
  const roomText = $('friendBtn').querySelector('small');
  if (roomText) roomText.textContent = 'Create a room or join by link. No account.';
  setText('menuRecord', prefs.played ? `${prefs.wins} win${prefs.wins === 1 ? '' : 's'} in ${prefs.played} battle${prefs.played === 1 ? '' : 's'} · best ${prefs.bestWpm} battle WPM · best chain ${prefs.bestChain}` : '');
  renderRank();
}

function renderRank() {
  const rank = rankFor(prefs.xp);
  setText('rankIcon', rank.icon);
  setText('rankName', rank.name);
  $('xpFill').style.width = `${rank.progress * 100}%`;
  const streak = liveStreak(prefs, dailyInfo().key);
  $('streakChip').classList.toggle('hidden', !streak);
  setText('streakCount', String(streak));
}

function renderSound() {
  setSoundEnabled(prefs.sound);
  setText('soundBtn', prefs.sound ? '🔊' : '🔇');
  $('soundBtn').setAttribute('aria-label', prefs.sound ? 'Mute sound' : 'Unmute sound');
}

function rememberName() {
  prefs.name = $('playerName').value;
  savePrefs();
  return prefs.name;
}

function tick() {
  if (againstBot()) {
    advance(game, now());
    if (finish(game, now())) endBattle();
  }
  if (mode === 'online' && match > 0 && !game.finished && now() >= game.endsAt) poll();
  processEvents();
  render();
}

// ---------- wiring ----------

$('playBtn').onclick = () => startBattle('bot');
$('dailyBtn').onclick = () => startBattle('daily');
$('friendBtn').onclick = () => { hide('menuOverlay'); show('roomOverlay'); $('playerName').focus(); };
$('closeRoom').onclick = () => { hide('roomOverlay'); show('menuOverlay'); };
$('mapPrev').onclick = () => { selectedMap = (selectedMap + MAPS.length - 1) % MAPS.length; prefs.map = selectedMap; savePrefs(); renderMenu(); };
$('mapNext').onclick = () => { selectedMap = (selectedMap + 1) % MAPS.length; prefs.map = selectedMap; savePrefs(); renderMenu(); };
document.querySelectorAll('.pace button').forEach(button => {
  button.onclick = () => { prefs.level = button.dataset.level; savePrefs(); renderMenu(); };
});
$('createRoom').onclick = async () => {
  setText('roomMessage', '');
  try {
    const data = await api('/api/create', 'POST', { name: rememberName(), map: selectedMap, commander: selectedCommander });
    enterRoom(data);
    showWaiting(data.code);
    startPolling();
  } catch (error) { setText('roomMessage', error.message); }
};
$('joinRoom').onclick = async () => {
  setText('roomMessage', '');
  try {
    const data = await api('/api/join', 'POST', { code: $('roomCode').value.trim().toUpperCase(), name: rememberName(), commander: selectedCommander });
    enterRoom(data);
    acceptRoom(data);
    startPolling();
  } catch (error) { setText('roomMessage', error.message); }
};
$('roomCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinRoom').click(); });
$('playerName').addEventListener('keydown', e => { if (e.key === 'Enter') ($('roomCode').value ? $('joinRoom') : $('createRoom')).click(); });
$('copyCode').onclick = async () => {
  const link = `${location.origin}/?room=${room.code}`;
  try { await navigator.clipboard.writeText(link); setText('copyCode', 'Link copied'); }
  catch { setText('copyCode', link); }
};
$('cancelWait').onclick = goToMenu;
$('menuBtn').onclick = goToMenu;
$('playAgain').onclick = () => (mode === 'online' ? requestRematch() : startBattle('bot'));
$('shareBtn').onclick = shareDaily;
$('helpBtn').onclick = () => { show('helpOverlay'); $('gotIt').focus(); };
$('closeHelp').onclick = $('gotIt').onclick = () => { hide('helpOverlay'); if (playing()) input.focus(); };
$('soundBtn').onclick = () => { prefs.sound = !prefs.sound; savePrefs(); renderSound(); };
input.addEventListener('input', onType);
input.addEventListener('keydown', e => {
  if (e.key === 'Escape') { clearEntry(); hint('Cleared'); render(); }
  if (e.key === 'Enter' && input.value) { clearEntry(); render(); }
});
$('field').addEventListener('pointerdown', () => { if (playing()) setTimeout(() => input.focus()); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('helpOverlay').classList.contains('hidden')) return $('closeHelp').click();
  if (e.key === 'Escape' && !$('roomOverlay').classList.contains('hidden')) return $('closeRoom').click();
  const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (printable && live() && document.activeElement !== input && !(document.activeElement instanceof HTMLInputElement)) input.focus();
});

$('playerName').value = prefs.name;
renderSound();
renderMenu();
const invite = new URLSearchParams(location.search).get('room');
const seat = invite && savedSeat(invite.toUpperCase());
if (seat) resumeSeat(seat);
else if (invite) { $('roomCode').value = invite.toUpperCase().slice(0, 5); hide('menuOverlay'); show('roomOverlay'); $('playerName').select(); }
lastSeq = game.seq;
render();
setInterval(tick, 100);
