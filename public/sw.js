// sw.js — Service Worker Antrian DPPKB Majene (v5 — Voice Assets Cache)
// Cache: app shell + SEMUA voice assets WAV lokal (offline-first audio)

const CACHE_NAME = 'antri-dppkb-audio-v5';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Logo_DPPKB.png'
];

// Seluruh voice asset lokal — harus sesuai dengan queueAudioManifest.ts
const VOICE_ASSETS = [
  // Frasa
  '/audio/queue/phrases/nomor-antrean.wav',
  '/audio/queue/phrases/silakan-menuju.wav',
  '/audio/queue/phrases/pelayanan-keluarga-berencana.wav',
  '/audio/queue/phrases/pelayanan-sekretariat.wav',

  // Huruf tiket
  '/audio/queue/letters/a.wav',
  '/audio/queue/letters/b.wav',
  '/audio/queue/letters/c.wav',
  '/audio/queue/letters/d.wav',
  '/audio/queue/letters/e.wav',

  // Digit 0-9
  '/audio/queue/digits/nol.wav',
  '/audio/queue/digits/satu.wav',
  '/audio/queue/digits/dua.wav',
  '/audio/queue/digits/tiga.wav',
  '/audio/queue/digits/empat.wav',
  '/audio/queue/digits/lima.wav',
  '/audio/queue/digits/enam.wav',
  '/audio/queue/digits/tujuh.wav',
  '/audio/queue/digits/delapan.wav',
  '/audio/queue/digits/sembilan.wav',

  // Loket
  '/audio/queue/counters/loket.wav',
  '/audio/queue/counters/satu.wav',
  '/audio/queue/counters/dua.wav',
  '/audio/queue/counters/tiga.wav',
  '/audio/queue/counters/empat.wav',
  '/audio/queue/counters/lima.wav',
  '/audio/queue/counters/enam.wav',
  '/audio/queue/counters/tujuh.wav',
  '/audio/queue/counters/delapan.wav',
  '/audio/queue/counters/sembilan.wav',
  '/audio/queue/counters/sepuluh.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Core assets — strict (gagal satu = install gagal)
      await cache.addAll(CORE_ASSETS);

      // Voice assets — graceful (satu gagal tidak menghentikan install lainnya)
      await Promise.allSettled(
        VOICE_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.error('[SW] Gagal cache voice asset:', url, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.info('[SW] Menghapus cache lama:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Navigation — network first, fallback ke index.html
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Voice assets WAV — cache first (offline-first audio)
  if (request.url.includes('/audio/queue/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Semua aset lain — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});