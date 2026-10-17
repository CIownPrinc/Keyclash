import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createGame, strike, finish, advance, COUNTDOWN } from './game.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const rooms = new Map();
const port = Number(process.env.PORT || 3000);
const countdown = Number(process.env.COUNTDOWN_MS ?? COUNTDOWN);
const MAX_ROOMS = 1000;
const MAX_BODY = 2048;
const ROOM_IDLE_LIMIT = 30 * 60 * 1000;
const PRESENCE_WINDOW = 4000;
const RATE_WINDOW = 60_000;
const RATE_LIMIT = 20;
// Faster than any human on record: anything quicker is a macro.
const MAX_WPM = 250;
const STATIC_FILES = new Set(['index.html', 'style.css', 'app.js', 'game.js', 'map.js', 'bot.js', 'sound.js', 'progress.js']);
const visits = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, data) {
  res.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let input = '';
  for await (const chunk of req) {
    input += chunk;
    if (input.length > MAX_BODY) throw new HttpError(413, 'Request too large.');
  }
  try { return JSON.parse(input || '{}'); }
  catch { throw new HttpError(400, 'Request body must be JSON.'); }
}
// The seed drives future words and bounty spots, so clients never see it.
function publicGame(game) {
  return game && { ...game, seed: null };
}
function state(room) {
  const now = Date.now();
  if (room.game) { advance(room.game, now); finish(room.game, now); }
  return {
    code: room.code,
    status: room.game ? (room.game.finished ? 'finished' : 'playing') : 'waiting',
    match: room.match,
    game: publicGame(room.game),
    players: room.players.map(p => p.name),
    connected: room.players.map(p => now - p.lastSeen < PRESENCE_WINDOW),
    rematch: room.players.map((_, i) => room.rematch.has(i)),
    now
  };
}
function cleanName(value) { return String(value || 'Player').replace(/[p{C}<>]/gu, '').trim().slice(0, 18) || 'Player'; }
function limitRate(req) {
  const ip = req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const entry = visits.get(ip);
  if (!entry || now - entry.since > RATE_WINDOW) return visits.set(ip, { since: now, count: 1 });
  if (++entry.count > RATE_LIMIT) throw new HttpError(429, 'Too many rooms too quickly. Wait a minute and try again.');
}
function sameToken(a, b) {
  const left = Buffer.from(String(a)), right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function code() {
  let value;
  do { value = crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase(); } while (rooms.has(value));
  return value;
}
function addPlayer(room, name) {
  const player = { name: cleanName(name), token: crypto.randomUUID(), lastSeen: Date.now(), lastStrikeAt: 0 };
  room.players.push(player);
  return player;
}
function startMatch(room) {
  room.game = createGame({ startAt: Date.now() + countdown });
  room.match++;
  room.rematch.clear();
}
function authorize(req, room) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const player = room.players.findIndex(p => token && sameToken(p.token, token));
  if (player < 0) throw new HttpError(401, 'Invalid room token.');
  room.players[player].lastSeen = room.lastActivity = Date.now();
  return player;
}

async function createRoom(req, res) {
  limitRate(req);
  if (rooms.size >= MAX_ROOMS) throw new HttpError(503, 'The arena is full right now. Try again in a few minutes.');
  const data = await body(req);
  const room = { code: code(), players: [], game: null, match: 0, rematch: new Set(), lastActivity: Date.now() };
  const host = addPlayer(room, data.name);
  rooms.set(room.code, room);
  json(res, 200, { ...state(room), token: host.token, player: 0 });
}
async function joinRoom(req, res) {
  limitRate(req);
  const data = await body(req);
  const room = rooms.get(String(data.code || '').toUpperCase());
  if (!room) throw new HttpError(404, 'Room not found. Check the code with your friend.');
  if (room.players.length === 2) throw new HttpError(409, 'This room is full.');
  const guest = addPlayer(room, data.name);
  startMatch(room);
  json(res, 200, { ...state(room), token: guest.token, player: 1 });
}
async function strikeTile(req, res, room, player) {
  if (!room.game) throw new HttpError(409, 'Waiting for opponent.');
  const data = await body(req);
  const seat = room.players[player];
  const now = Date.now();
  const humanGap = (String(data.answer ?? '').length + 1) / 5 / MAX_WPM * 60_000;
  if (now - seat.lastStrikeAt < humanGap) return json(res, 429, { ok: false, error: 'Slow down: that was faster than anyone can type.', ...state(room) });
  const result = strike(room.game, Number(data.id), player, data.answer, now);
  if (result.ok) seat.lastStrikeAt = now;
  json(res, result.ok ? 200 : 409, { ...result, ...state(room) });
}
function requestRematch(res, room, player) {
  if (!room.game?.finished) throw new HttpError(409, 'The match is still running.');
  room.rematch.add(player);
  if (room.rematch.size === room.players.length && room.players.length === 2) startMatch(room);
  json(res, 200, state(room));
}
async function roomRoute(req, res, roomCode, action) {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) throw new HttpError(404, 'Room expired.');
  const player = authorize(req, room);
  if (!action && req.method === 'GET') return json(res, 200, state(room));
  if (!action && req.method === 'POST') return strikeTile(req, res, room, player);
  if (action === 'rematch' && req.method === 'POST') return requestRematch(res, room, player);
  throw new HttpError(405, 'Method not allowed.');
}
async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!STATIC_FILES.has(file)) throw new HttpError(404, 'Not found.');
  const content = await fs.readFile(path.join(root, file));
  res.writeHead(200, { ...securityHeaders, 'content-type': `${types[path.extname(file)]}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/create' && req.method === 'POST') return await createRoom(req, res);
    if (pathname === '/api/join' && req.method === 'POST') return await joinRoom(req, res);
    const match = pathname.match(/^\/api\/room\/([A-Z0-9]+)(?:\/(rematch))?$/i);
    if (match) return await roomRoute(req, res, match[1], match[2]);
    await serveStatic(req, res, pathname);
  } catch (error) {
    if (error instanceof HttpError) return json(res, error.status, { error: error.message });
    console.error(error);
    json(res, 500, { error: 'Something went wrong on the server. Please try again.' });
  }
});

setInterval(() => {
  const cutoff = Date.now() - ROOM_IDLE_LIMIT;
  for (const [roomCode, room] of rooms) if (room.lastActivity < cutoff) rooms.delete(roomCode);
  for (const [ip, entry] of visits) if (Date.now() - entry.since > RATE_WINDOW) visits.delete(ip);
}, 60_000).unref();

server.listen(port, () => console.log(`KEYCLASH ready at http://localhost:${port}`));
