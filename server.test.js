import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { MAPS, targetTiles } from './game.js';

const port = 31357;
let child;

test.before(async () => {
  child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), COUNTDOWN_MS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('Server exited'); })]);
});
test.after(() => child.kill());

async function request(path, data, token) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : typeof data === 'string' ? data : JSON.stringify(data)
  });
  return { status: response.status, headers: response.headers, value: await response.json() };
}
async function openRoom() {
  const host = await request('/api/create', { name: 'Alpha' });
  const guest = await request('/api/join', { code: host.value.code, name: 'Beta' });
  return { host: host.value, guest: guest.value };
}

test('room creation, joining, and authoritative strikes', async () => {
  const host = await request('/api/create', { name: 'Player Alpha' });
  assert.equal(host.status, 200);
  assert.equal(host.value.status, 'waiting');
  assert.equal(host.value.players[0], 'Player Alpha');
  const guest = await request('/api/join', { code: host.value.code, name: 'Beta' });
  assert.equal(guest.status, 200);
  assert.equal(guest.value.status, 'playing');
  assert.equal(guest.value.match, 1);
  assert.equal(typeof guest.value.now, 'number');
  const game = guest.value.game;
  const capital = MAPS[game.map].capitals[0];
  const target = MAPS[game.map].adjacency[capital].find(id => game.tiles[id].terrain === 'plains');
  const wrong = await request(`/api/room/${host.value.code}`, { id: target, answer: 'nope' }, host.value.token);
  assert.equal(wrong.status, 409);
  const claim = await request(`/api/room/${host.value.code}`, { id: target, answer: game.tiles[target].word }, host.value.token);
  assert.equal(claim.status, 200);
  assert.equal(claim.value.kind, 'capture');
  assert.equal(claim.value.game.tiles[target].owner, 0);
  const outOfReach = await request(`/api/room/${host.value.code}`, { id: target, answer: claim.value.game.tiles[target].word }, guest.value.token);
  assert.equal(outOfReach.status, 409);
});

test('clients never receive the seed that decides future words', async () => {
  const { guest } = await openRoom();
  assert.equal(guest.game.seed, null);
});

test('friend rooms apply the host map and each player\'s commander', async () => {
  const host = await request('/api/create', { name: 'Host', map: 2, commander: 'warden' });
  const guest = await request('/api/join', { code: host.value.code, name: 'Guest', commander: 'quartermaster' });
  assert.equal(guest.value.game.map, 2);
  assert.deepEqual(guest.value.game.commanders, ['warden', 'quartermaster']);
});

test('strikes faster than a human can type are refused', async () => {
  const { host, guest } = await openRoom();
  const first = targetTiles(guest.game, 0, guest.now)[0];
  assert.equal((await request(`/api/room/${host.code}`, { id: first.id, answer: first.word }, host.token)).status, 200);
  const view = await request(`/api/room/${host.code}`, undefined, host.token);
  const second = targetTiles(view.value.game, 0, view.value.now).find(t => t.id !== first.id);
  const tooFast = await request(`/api/room/${host.code}`, { id: second.id, answer: second.word }, host.token);
  assert.equal(tooFast.status, 429);
});

test('both players are reported as connected once they poll', async () => {
  const { host, guest } = await openRoom();
  await request(`/api/room/${host.code}`, undefined, host.token);
  const view = await request(`/api/room/${host.code}`, undefined, guest.token);
  assert.deepEqual(view.value.connected, [true, true]);
});

test('rematch is refused while the match is still running', async () => {
  const { host } = await openRoom();
  const early = await request(`/api/room/${host.code}/rematch`, {}, host.token);
  assert.equal(early.status, 409);
});

test('bad requests get clear status codes', async () => {
  assert.equal((await request('/api/join', { code: 'ZZZZZ' })).status, 404);
  assert.equal((await request('/api/create', '{not json')).status, 400);
  assert.equal((await request('/api/create', JSON.stringify({ name: 'x'.repeat(4000) }))).status, 413);
  const { host } = await openRoom();
  assert.equal((await request(`/api/room/${host.code}`, undefined, 'forged')).status, 401);
  const page = await fetch(`http://localhost:${port}/`);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});

// Runs last: it uses up this address's room quota.
test('room creation is rate limited per address', async () => {
  let status = 200;
  for (let i = 0; i < 25 && status === 200; i++) status = (await request('/api/create', { name: 'Spam' })).status;
  assert.equal(status, 429);
});
