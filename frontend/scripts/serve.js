// Static file server for developing the frontend.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIRS = ['css', 'js', 'assets', 'fonts'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  });
  res.end(body);
}

export function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (decoded === '/' || decoded === '/index.html') return path.join(ROOT, 'index.html');
  const file = path.resolve(ROOT, `.${decoded}`);
  const relative = path.relative(ROOT, file);
  const [topDir] = relative.split(path.sep);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !PUBLIC_DIRS.includes(topDir)) return null;
  if (relative.split(path.sep).some((part) => part.startsWith('.'))) return null;
  return file;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    const file = resolveFile(req.url || '/');
    if (!file) return send(res, 404, 'Not found');
    try {
      const info = await stat(file);
      if (!info.isFile()) return send(res, 404, 'Not found');
      const body = await readFile(file);
      return send(res, 200, req.method === 'HEAD' ? '' : body, TYPES[path.extname(file)] || 'application/octet-stream');
    } catch {
      return send(res, 404, 'Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, HOST, () => {
    console.log(`PoultryStart frontend: http://localhost:${PORT} (the backend API should run on http://localhost:5000)`);
  });
}
