# Phase 4 — Offline/PWA & Media Resilience

## Tujuan

TV Display harus tetap memiliki fungsi dasar ketika:
- internet eksternal terputus,
- endpoint TTS gagal,
- media remote gagal,
- browser reload saat koneksi buruk.

---

# 1. App shell cache

`public/sw.js` jangan hanya cache logo/manifest.

Tambahkan:

```js
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Logo_DPPKB.png',

  '/audio/audio-ready.mp3',
  '/audio/call-chime.mp3',

  '/audio/nomor-antrean.mp3',
  '/audio/silakan-menuju.mp3',

  '/audio/pelayanan-keluarga-berencana.mp3',
  '/audio/pelayanan-sekretariat.mp3'
];
```

Tambahkan digit/letter/counter audio jika local phrase engine digunakan.

---

# 2. Cache strategy

Gunakan:
- cache-first untuk immutable static assets,
- stale-while-revalidate untuk sebagian media,
- network-first untuk data yang memang perlu fresh.

Jangan cache Firestore data manual tanpa memahami consistency model.

---

# 3. Navigation fallback

Pastikan:

```text
/index.html
```

benar-benar ada di cache jika service worker memakai fallback navigation ke file tersebut.

---

# 4. Audio fallback offline

Primary:

```text
cached generated MP3
```

Fallback:

```text
local phrase audio
```

Jika internet putus, TV minimal masih dapat menyebut:
- nomor antrean,
- loket,
- nama pelayanan.

Untuk `KB`:
- file wajib bernama/berisi **Pelayanan Keluarga Berencana**.

---

# 5. Runtime cache untuk TTS MP3

Jika TTS URL hash-based:

```text
/api/queue-audio/<hash>.mp3
```

maka file cocok disimpan dalam runtime cache karena immutable.

Pattern:

```text
CACHE HIT
↓
play immediately

CACHE MISS
↓
network
↓
cache response
↓
play
```

---

# 6. Background media

Jangan membuat TV Display bergantung pada video remote untuk tetap usable.

Jika media gagal:
- panggilan antrean tetap tampil,
- audio tetap berfungsi,
- layout tidak collapse.

Tambahkan fallback:

```text
default poster / local looping visual
```

---

# 7. Upload media future-ready

Jika nanti admin upload media:
- simpan di storage,
- metadata di Firestore,
- TV download/cache,
- gunakan version/hash.

Target metadata:

```ts
{
  id,
  url,
  type,
  version,
  checksum,
  enabled
}
```

---

# 8. Online/offline indicator

Tambahkan status:

```text
ONLINE
OFFLINE
OFFLINE FALLBACK ACTIVE
```

Gunakan:

```ts
window.addEventListener('online', ...)
window.addEventListener('offline', ...)
```

Jangan langsung menganggap `navigator.onLine === true` berarti seluruh backend reachable, tetapi cukup sebagai indikator awal.

---

# 9. Recovery

Saat kembali online:
- jangan replay seluruh historical event,
- sinkronkan hanya event yang belum `played`,
- validasi berdasarkan call event ID.

---

# 10. Acceptance Criteria Phase 4

```text
- App shell dapat terbuka setelah pernah dimuat.
- Audio ready/chime/local phrase tersedia offline.
- Internet putus tidak membuat TV blank.
- Primary TTS fail → local fallback.
- Media remote fail → antrean tetap usable.
- Reconnect tidak memutar ulang semua historical calls.
```
