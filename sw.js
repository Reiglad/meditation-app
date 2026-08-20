// sw.js
// アプリシェルの簡易オフラインキャッシュ用 Service Worker。
//
// 【重要・運用ルール】
// index.html / css / js / manifest.json / icons など PRECACHE_URLS 内のファイルを
// 1文字でも変更したら、必ず下記 CACHE_NAME の末尾の数字（vN）をインクリメントすること。
// Service Workerはファイル内容がバイト単位で前回と一致すると「更新なし」と判断し、
// installイベントが発火せず、古いキャッシュ（例: 差し替え前のconfig.jsの内容）が
// 使われ続けてしまう。CACHE_NAMEを変えることでsw.js自体のバイト内容が変わり、
// 確実に新しいバージョンとして認識・再キャッシュされる。
const CACHE_NAME = 'meditation-app-cache-v17';

// 背景写真（images/nature/*.webp）・音声ファイル（audio/*.mp3）はここには含めない。
// 事前キャッシュすると初回ロードが重くなる（背景写真15枚・約7MB、音声4本・約77MB）ため、
// fetchハンドラのcache-first戦略に任せ、実際に表示・再生されたものから順にキャッシュされる。
// つまり音声は「一度オンラインで再生済みのものはオフラインでも再生できる」設計になる。
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/storage.js',
  './js/stats.js',
  './js/audio-player.js',
  './js/timer.js',
  './js/nsdr.js',
  './js/quotes.js',
  './js/backgrounds.js',
  './js/chime.js',
  './js/wakelock.js',
  './js/health.js',
  './js/health-chart.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 他オリジン（Google Fonts等）へのリクエストはキャッシュ対象外。ネットワークにそのまま委ねる。
  if (url.origin !== self.location.origin) {
    return;
  }

  // 同一オリジンのGETリクエストのみキャッシュ戦略を適用（cache-first, フォールバックでネットワーク）
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // 正常なレスポンスのみキャッシュに追加
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // オフラインかつキャッシュも無い場合はindex.htmlへフォールバック（SPAのため）
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
