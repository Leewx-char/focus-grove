// sw.js — Service Worker：离线缓存（cache-first）
// iOS 上「添加到主屏幕」+ 本 SW = 可安装的 PWA；通知能力需要 iOS 16.4+。

const CACHE = 'focus-grove-v2';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/storage.js', 'js/timer.js', 'js/tree.js', 'js/stats.js', 'js/blocklist.js', 'js/app.js',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ?? fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('index.html')) // 导航兜底
    )
  );
});
