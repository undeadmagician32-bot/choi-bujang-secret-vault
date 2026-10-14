// 오프라인 안내 전용 서비스 워커입니다. 정적 안내 페이지(/offline.html) 한 장만 보관합니다.
// 자료·메모·로그인 토큰·/api 응답은 가로채지도 보관하지도 않으므로 보호 요청은 그대로 서버로 갑니다.
const CACHE = 'vault-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 화면 이동(navigate)이 네트워크 오류로 실패할 때만 안내 페이지를 보여 줍니다.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
