// Static checks: syntax, offline file list, relative paths, CSP, no outside URLs.
// Run with: npm run check

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const fail = (message) => problems.push(message);
const failEach = (items, message) => items.forEach((item) => fail(message(item)));
const read = (path) => readFileSync(path, 'utf8');
const list = (dir, ext) => readdirSync(dir).filter((name) => name.endsWith(ext)).map((name) => join(dir, name));

const APP_JS = list('js', '.js');
const ICONS = [...list('icons', '.svg'), ...list('icons', '.png')];
const APP_FILES = ['index.html', 'app.css', 'manifest.webmanifest', 'sw.js', ...APP_JS, ...ICONS];
const ALL_JS = [...APP_JS, 'sw.js', 'playwright.config.js', ...list('scripts', '.mjs'), ...list('tests/unit', '.js'), ...list('tests/e2e', '.js')];

function checkSyntax() {
  ALL_JS.forEach((file) => {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      fail(`${file}: syntax error\n${error.stderr}`);
    }
  });
}

// Every app file is cached for offline use, and every cached file exists.
function checkOfflineList() {
  const cached = [...read('sw.js').matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const wanted = APP_FILES.filter((file) => file !== 'sw.js');
  failEach(wanted.filter((file) => !cached.includes(file)), (file) => `sw.js doesn't cache ${file}`);
  failEach(cached.filter((file) => !existsSync(file)), (file) => `sw.js caches missing file ${file}`);
}

function checkHtmlRefs(html) {
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  failEach(refs.filter((ref) => ref.startsWith('/') || ref.includes(':')), (ref) => `index.html: ${ref} isn't a relative path`);
  failEach(refs.filter((ref) => !ref.includes(':') && !existsSync(ref)), (ref) => `index.html: ${ref} doesn't exist`);
}

function checkHtmlSafety(html) {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  if (!csp.includes("default-src 'self'")) fail("index.html: the CSP needs default-src 'self'");
  if (/unsafe-(inline|eval)/.test(csp)) fail('index.html: the CSP must not allow unsafe-inline or unsafe-eval');
  if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) fail('index.html: inline <script> found');
  if (/<style|\sstyle="|\son[a-z]+="/.test(html)) fail('index.html: inline style or event handler found');
  if (/<(a|iframe|form)\b/.test(html)) fail('index.html: links, frames and forms are not allowed');
}

function checkManifest() {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  if (manifest.name !== 'PopRocks') fail('manifest: name must be PopRocks');
  failEach([manifest.start_url, manifest.scope, manifest.id].filter((url) => url !== './'), (url) => `manifest: ${url} must be ./`);
  failEach(manifest.icons.filter(({ src }) => !existsSync(src)), ({ src }) => `manifest: missing icon ${src}`);
}

// No outside URLs in anything the app ships (the SVG namespace is a name, not a request).
function checkNoOutsideUrls() {
  APP_FILES.filter((file) => !file.endsWith('.png')).forEach((file) => {
    const text = read(file).replaceAll('http://www.w3.org/2000/svg', '');
    if (/https?:\/\//.test(text)) fail(`${file}: has an outside URL`);
  });
}

function checkNoRiskyJs() {
  [...APP_JS, 'sw.js'].forEach((file) => {
    if (/\binnerHTML\b|\beval\(|new Function\(|document\.write/.test(read(file))) fail(`${file}: uses innerHTML, eval or document.write`);
  });
}

checkSyntax();
checkOfflineList();
checkHtmlRefs(read('index.html'));
checkHtmlSafety(read('index.html'));
checkManifest();
checkNoOutsideUrls();
checkNoRiskyJs();

if (problems.length) {
  console.error(problems.map((p) => `✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✔ check passed (${ALL_JS.length} scripts, ${APP_FILES.length} app files)`);
