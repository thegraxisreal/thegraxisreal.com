// Lightweight local leaderboard server (no DB), port 3002
// Endpoints:
//  - POST /report { username, balance } -> updates in-memory state; appends new usernames to users.txt
//  - GET /leaderboard -> returns top 10 by balance with lastSeen
//  - GET /health -> { ok: true }

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;
const TTL_MS = 10 * 60 * 1000; // 10 minutes freshness window

const state = new Map(); // key = usernameLower -> { balance, lastSeen, display }
const usersFile = path.join(__dirname, 'users.txt');
let usersSet = new Set();

// Load existing usernames if file exists
try {
  if (fs.existsSync(usersFile)) {
    const lines = fs.readFileSync(usersFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      const [namePart, balPart] = line.split(/\s*,\s*/);
      if (!namePart) continue;
      const name = namePart.trim();
      const bal = balPart ? parseInt(balPart, 10) : 0;
      usersSet.add(name);
      state.set(name.toLowerCase(), { balance: Number.isFinite(bal) ? bal : 0, lastSeen: 0, display: name });
    }
  }
} catch (e) {
  console.error('Failed to read users.txt', e);
}

function persistUsers() {
  try {
    const lines = [];
    // Prefer display name, include latest balance; one line per user
    const seen = new Set();
    for (const [key, val] of state.entries()) {
      const name = val.display || key;
      if (seen.has(name)) continue;
      seen.add(name);
      lines.push(`${name},${Math.floor(val.balance || 0)}`);
    }
    // Also include any usernames we had without state (unlikely)
    for (const name of usersSet) {
      if (!seen.has(name)) lines.push(`${name},0`);
    }
    fs.writeFile(usersFile, lines.join('\n') + (lines.length ? '\n' : ''), (err) => {
      if (err) console.error('Failed to write users.txt', err);
    });
  } catch (e) {
    console.error('Persist error', e);
  }
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(body);
}

function handleReport(req, res) {
  let data = '';
  req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try {
      const json = JSON.parse(data || '{}');
      let { username, balance } = json;
      if (typeof username !== 'string' || !username.trim()) return send(res, 400, { ok: false, error: 'invalid username' });
      username = username.trim();
      const display = username; // store as provided; for ranking use as-is
      const bal = Number(balance);
      if (!Number.isFinite(bal) || bal < 0) return send(res, 400, { ok: false, error: 'invalid balance' });
      state.set(username.toLowerCase(), { balance: Math.floor(bal), lastSeen: Date.now(), display });
      usersSet.add(username);
      persistUsers();
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 400, { ok: false, error: 'bad json' });
    }
  });
}

function handleLeaderboard(req, res) {
  const now = Date.now();
  const arr = [];
  for (const [key, val] of state.entries()) {
    if (now - val.lastSeen <= TTL_MS) arr.push({ username: val.display, balance: val.balance, lastSeen: val.lastSeen });
  }
  arr.sort((a, b) => b.balance - a.balance);
  send(res, 200, { ok: true, top: arr.slice(0, 10), count: arr.length, updated: now });
}

function handleUsers(req, res) {
  try {
    const users = Array.from(usersSet.values()).sort((a,b)=>a.localeCompare(b));
    send(res, 200, { ok: true, users, count: users.length });
  } catch (e) {
    send(res, 500, { ok: false, error: 'users failed' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    // Preflight handling
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  if (req.method === 'POST' && url.pathname === '/report') return handleReport(req, res);
  if (req.method === 'GET' && url.pathname === '/leaderboard') return handleLeaderboard(req, res);
  if (req.method === 'GET' && url.pathname === '/users') return handleUsers(req, res);
  send(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Leaderboard server listening on http://localhost:${PORT}`);
});
