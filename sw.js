// 🚨 ルール2: デプロイ時は必ずこのバージョン番号を変更すること（例: v1.0.0 → v1.0.1）
const CACHE_VERSION = 'step-cache-v1.0.0';

// キャッシュするアセットのリスト
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './js/main.js',
    './manifest.json',
    './icon.png',
    './サムネイル.png',
    // 画像
    './地面.png', './大気圏.png', './月.png', './金星.png', 
    './水星.png', './太陽.png', './宇宙.png', './ゴール惑星.png',
    // 音楽・動画
    './始まり.mp3', './大気圈.mp3', './月.mp3', './金星.mp3', 
    './水星.mp3', './太陽.mp3', './宇宙.mp3', './ゴール惑星.mp3',
    './エンディング.mp4',
    // 外部ライブラリ (CDN)
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700&display=swap'
];

// インストール処理：全アセットをキャッシュに保存
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// アクティベート処理：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// フェッチ処理：オフライン対応のルーティング
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // 音楽・動画・画像・CDNライブラリは「キャッシュファースト」（高速化＆オフライン化）
    if (request.destination === 'audio' || request.destination === 'video' || request.destination === 'image' || request.url.includes('http')) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(request).then((networkResponse) => {
                    return caches.open(CACHE_VERSION).then((cache) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // HTML, CSS, JSなどは「ネットワークファースト」（常に最新版を取得し、オフライン時のみキャッシュを使用）
    event.respondWith(
        fetch(request)
            .then((response) => {
                return caches.open(CACHE_VERSION).then((cache) => {
                    cache.put(request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});
