// Temporary static server for local testing
// Run: node server.js  (serves http://localhost:3000)

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = __dirname;
const port = process.env.PORT || 3000;

const mime = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  if (body && body.pipe) body.pipe(res);
  else res.end(body);
}

function sanitize(p) {
  const resolved = path.normalize(p).replace(/^\/+/, '');
  if (resolved.includes('..')) return '';
  return resolved;
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  let rel = sanitize(pathname || '/');

  if (rel === '' || rel === '/' || rel === 'index.html') {
    rel = 'casino.html';
  }

  const filePath = path.join(root, rel);
  fs.stat(filePath, (err, stat) => {
    if (err) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=UTF-8' }, 'Not Found');
      return;
    }
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.access(indexPath, fs.constants.F_OK, (e2) => {
        if (e2) send(res, 403, { 'Content-Type': 'text/plain; charset=UTF-8' }, 'Forbidden');
        else streamFile(indexPath, res);
      });
      return;
    }
    streamFile(filePath, res);
  });
});

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send(res, 500, { 'Content-Type': 'text/plain; charset=UTF-8' }, 'Server Error'));
  send(res, 200, { 'Content-Type': type, 'Cache-Control': 'no-store' }, stream);
}

server.listen(port, () => {
  console.log(`Casino dev server running at http://localhost:${port}`);
});

