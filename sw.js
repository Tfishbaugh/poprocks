// Offline support: every app file is cached on install. Requests try the network first
// (so updates show up right away) and fall back to the cache when offline or slow.

const CACHE = 'poprocks-v1';
const TIMEOUT_MS = 4000;

const FILES = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/copy.js',
  './js/dom.js',
  './js/effects.js',
  './js/grid.js',
  './js/pattern.js',
  './js/recorder.js',
  './js/save.js',
  './js/scheduler.js',
  './js/slots.js',
  './js/sounds.js',
  './js/kits.js',
  './sounds/chord.mp3',
  './sounds/crash.mp3',
  './sounds/hey.mp3',
  './sounds/riff.mp3',
  './js/strip.js',
  './js/tour.js',
  './js/holds.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Other apps on this github.io origin share the cache list: only touch our own old caches.
  const old = (keys) => keys.filter((key) => key.startsWith('poprocks-') && key !== CACHE).map((key) => caches.delete(key));
  event.waitUntil(caches.keys().then((keys) => Promise.all(old(keys))).then(() => self.clients.claim()));
});

async function fromNetwork(request, cache) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(request.url, { cache: 'no-cache', signal: controller.signal });
    if (response.ok) await cache.put(request.url, response.clone());
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function respond(request) {
  const cache = await caches.open(CACHE);
  try {
    return await fromNetwork(request, cache);
  } catch {
    const cached = await cache.match(request.url, { ignoreSearch: true });
    if (cached || request.mode !== 'navigate') return cached ?? Response.error();
    return (await cache.match('./index.html')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(respond(request));
});
