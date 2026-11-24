// Builds the deployable frontend in dist/: copies the app's files and writes the production API address
// (the API_BASE_URL environment variable) into index.html's API meta tag and Content Security Policy.
//
//   API_BASE_URL=https://your-backend.example.com/api npm run build
//
// No packages are used. The source files are never changed, and the build stops if API_BASE_URL is missing or
// invalid, so a production build can never silently point at localhost.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const COPIED = ['css', 'js', 'fonts', 'assets'];

function fail(message) {
  console.error(`Frontend build failed: ${message}`);
  process.exit(1);
}

const raw = (process.env.API_BASE_URL || '').trim();
if (!raw) fail('set API_BASE_URL to the backend API address, for example https://your-backend.example.com/api');
let url;
try {
  url = new URL(raw);
} catch {
  fail(`API_BASE_URL is not a valid address: ${raw}`);
}
const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) fail('API_BASE_URL must use https:// (http:// only for localhost)');
if (url.search || url.hash || url.username || url.password) fail('API_BASE_URL must not contain a query, fragment or credentials');
const apiBaseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');

let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const metaPattern = /(<meta name="poultrystart-api-base-url" content=")[^"]*(">)/;
const connectPattern = /connect-src [^;"]*/;
if (!metaPattern.test(html)) fail('index.html has no poultrystart-api-base-url meta tag');
if (!connectPattern.test(html)) fail('index.html has no connect-src in its Content Security Policy');
html = html.replace(metaPattern, `$1${apiBaseUrl}$2`).replace(connectPattern, `connect-src 'self' ${url.origin}`);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);
for (const folder of COPIED) cpSync(path.join(ROOT, folder), path.join(DIST, folder), { recursive: true });
writeFileSync(path.join(DIST, 'index.html'), html);

console.log(`Frontend built in dist/ for the API at ${apiBaseUrl} (CSP connect-src: 'self' ${url.origin}).`);
