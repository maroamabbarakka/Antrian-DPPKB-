# INSTRUKSI DEVELOPER — FINAL AUDIO PATCH
## Sistem Antrean DPPKB Majene

**Baseline audit:** branch `main` terbaru yang telah mengimplementasikan arsitektur Web Audio deterministik dengan local voice assets.

**Tujuan dokumen:** menyelesaikan masalah audio lintas perangkat tanpa mengganti arsitektur lagi.

**Target perangkat wajib:**
- Desktop Chrome utama
- Laptop Chrome lain
- Android Phone
- Android Tablet
- iPhone Safari
- iPhone Chrome
- Smart TV target

**Di luar scope:** Authentication/RBAC.

---

# 1. ARAH ARSITEKTUR SUDAH BENAR — JANGAN REWRITE LAGI

Pertahankan arsitektur:

```text
Call Event
→ Local Voice Assets
→ AudioBufferStore
→ Voice Sequence
→ ONE AudioContext
→ Chime
→ Voice
→ Playback Completed
```

Jangan kembali menggunakan:

```text
translate.google.com/translate_tts
speechSynthesis sebagai production voice
HTMLAudioElement sebagai primary voice
```

Fokus pekerjaan sekarang adalah **membersihkan implementasi**, bukan mencari engine baru.

---

# 2. PRIORITAS P0 — HAPUS `chime.wav` DARI MANIFEST

## Masalah

`queueAudioManifest.ts` masih mendefinisikan:

```text
/audio/queue/chime.wav
```

dan `chime` masuk ke essential assets.

Namun file tersebut tidak tersedia.

Chime sebenarnya sudah dibuat dengan oscillator Web Audio.

## Tindakan

Hapus:

```ts
chime
```

dari:

```text
AudioAssetKey
AUDIO_MANIFEST
ESSENTIAL_ASSET_KEYS
```

Jangan tambahkan `chime.wav`.

Gunakan oscillator Web Audio untuk chime seperti sekarang.

## Acceptance

```text
Fresh load
→ Activate Audio
→ tidak ada request 404 ke /audio/queue/chime.wav
→ essential buffer load PASS
```

---

# 3. PRIORITAS P0 — REGENERATE SEMUA FILE AUDIO MENJADI WAV ASLI

## Masalah

Generator saat ini menyimpan response audio langsung ke file berekstensi:

```text
.wav
```

tanpa transcoding.

Akibatnya file dapat berisi MPEG/MP3 tetapi bernama `.wav`.

Ini tidak boleh dibiarkan.

## Target format

Gunakan genuine PCM WAV:

```text
RIFF/WAVE
PCM
mono
16-bit
44.1 kHz
```

## Tindakan

Gunakan proses:

```text
source TTS
→ download source audio
→ transcode offline
→ PCM WAV
→ validate
→ copy to public/audio/queue
```

Contoh menggunakan ffmpeg:

```bash
ffmpeg -i input.mp3 \
  -ac 1 \
  -ar 44100 \
  -sample_fmt s16 \
  output.wav
```

## Validasi

Setiap `.wav` wajib mempunyai header:

```text
RIFF
....
WAVE
```

Gunakan:

```bash
ffprobe file.wav
```

atau script otomatis.

Release harus gagal jika:

```text
extension = .wav
tetapi codec/container bukan WAV PCM
```

---

# 4. PRIORITAS P0 — PERBAIKI PHRASE “SILAKAN MENUJU”

## Masalah

File:

```text
phrases/silakan-menuju.wav
```

saat ini dibuat dari:

```text
Silakan menuju Loket
```

Sementara sequence juga menambahkan:

```text
counter.loket
```

Akibatnya voice dapat berbunyi:

```text
Silakan menuju Loket Loket satu
```

## Tindakan

Regenerate file menjadi hanya:

```text
Silakan menuju
```

Sequence tetap:

```text
silakan-menuju
loket
satu
```

## Acceptance

A-001 / Loket 1 harus menghasilkan:

```text
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

Tidak boleh:

```text
Loket Loket satu
```

---

# 5. PRIORITAS P0 — JANGAN PAKAI FALLBACK DATA PALSU

## Masalah

Parser saat ini mempunyai fallback seperti:

```text
service tidak dikenal → Pelayanan Sekretariat
counter invalid → Loket 1
ticket invalid → A-001
```

Ini berbahaya.

## Tindakan

Ganti seluruh fallback menjadi fail-fast.

Contoh:

```ts
throw new Error(
  `UNSUPPORTED_SERVICE_GROUP:${serviceGroup}`
);
```

```ts
throw new Error(
  `INVALID_COUNTER_NAME:${counterName}`
);
```

```ts
throw new Error(
  `INVALID_TICKET_CODE:${ticketCode}`
);
```

## Prinsip

Lebih baik:

```text
AUDIO ERROR
```

daripada mengarahkan pengunjung ke loket/pelayanan yang salah.

---

# 6. PRIORITAS P0 — MISSING BUFFER HARUS ERROR

## Masalah

Current playback dapat:

```ts
if (!buffer) {
  console.warn(...);
  continue;
}
```

Akibatnya satu kata bisa hilang tetapi playback tetap dianggap sukses.

## Tindakan

Ubah menjadi:

```ts
if (!buffer) {
  throw new Error(
    `BUFFER_MISSING_DURING_PLAYBACK:${token}`
  );
}
```

## Acceptance

Jika satu buffer hilang:

```text
playback = FAIL
```

bukan partial voice.

---

# 7. PRIORITAS P0 — COMPLETION HARUS BERDASARKAN `onended`

## Masalah

Playback completion saat ini dihitung dengan timer berdasarkan estimasi durasi.

Itu tidak cukup kuat untuk:

```text
iPhone
Smart TV
background/foreground
AudioContext interruption
```

## Tindakan

Gunakan `onended` pada source terakhir.

Contoh:

```ts
await new Promise<void>((resolve, reject) => {
  const timeout =
    window.setTimeout(() => {
      reject(
        new Error(
          'VOICE_SEQUENCE_TIMEOUT'
        )
      );
    }, expectedDurationMs + 3000);

  finalSource.onended = () => {
    clearTimeout(timeout);
    resolve();
  };
});
```

## Acceptance

`success = true` hanya setelah source terakhir benar-benar `ended`.

---

# 8. PRIORITAS P0 — TERUSKAN FIRESTORE CALL EVENT ID KE AUDIO ENGINE

## Masalah

Firestore mempunyai:

```text
callEvent.id
```

tetapi audio service membuat ID baru berdasarkan:

```text
ticketCode + counterName + Date.now()
```

Akibatnya dedup Firestore dan dedup audio memakai ID berbeda.

## Tindakan

Ubah API menjadi:

```ts
announceCall(
  callId,
  ticketCode,
  counterName,
  serviceTitle,
  serviceGroup
)
```

Kemudian:

```ts
queueAudioEngine.queueCall({
  id: callId,
  ...
});
```

## Acceptance

```text
Firestore callEvent.id === AudioCallJob.id
```

untuk call dan recall.

---

# 9. PRIORITAS P0 — JANGAN MARK EVENT `PROCESSED` SEBELUM AUDIO SELESAI

## Masalah

QueueContext masih melakukan:

```text
processedCallIds.add(event.id)
```

sebelum playback selesai.

## Tindakan

Pisahkan lifecycle:

```text
receivedCallIds
queuedCallIds
playingCallIds
playedCallIds
failedCallIds
```

Flow:

```text
Firestore event
→ RECEIVED
→ QUEUED
→ PLAYING
→ VOICE ENDED
→ PLAYED
```

Jika error:

```text
FAILED
```

Jangan masuk `playedCallIds`.

---

# 10. PRIORITAS P0 — PERBAIKI INITIAL FIRESTORE SNAPSHOT

## Masalah

Initial snapshot masih dapat menandai seluruh event existing sebagai historical.

Jika TV reload tepat setelah call:

```text
call event baru
→ TV reload
→ initial snapshot
→ event dianggap processed
→ suara hilang
```

## Tindakan

Gunakan recent-event window:

```ts
const MAX_BOOT_EVENT_AGE_MS =
  20_000;
```

Jika:

```text
event age <= 20 detik
```

maka:

```text
queue event
```

Jika lebih tua:

```text
historical
```

Lebih baik lagi simpan:

```text
lastPlayedCallId
lastPlayedTimestamp
```

di session/local storage.

---

# 11. PRIORITAS P1 — PREFETCH AUDIO SEBELUM USER TAP

## Masalah

Saat Activate Audio ditekan, engine masih harus:

```text
resume AudioContext
→ fetch essential audio
→ decode
```

Ini membuat aktivasi lebih lama.

## Tindakan

Saat app startup:

```text
prefetch raw ArrayBuffer
```

tanpa membuat AudioContext.

Gunakan fungsi:

```text
AudioBufferStore.prefetch()
```

atau equivalent.

Saat user tap:

```text
resume AudioContext
→ decode bytes yang sudah tersedia
→ short chime
→ READY
```

## Acceptance

Activate Audio pada iPhone harus terasa cepat dan deterministic.

---

# 12. PRIORITAS P1 — SERVICE WORKER CACHE

Pastikan seluruh voice assets:

```text
/audio/queue/phrases/*
/audio/queue/digits/*
/audio/queue/letters/*
/audio/queue/counters/*
```

masuk cache.

Naikkan cache version setelah asset regenerate.

Contoh:

```js
const CACHE_NAME =
  'antri-dppkb-audio-v6';
```

Gunakan graceful caching.

Voice assets wajib tersedia offline setelah first load.

---

# 13. PRIORITAS P1 — BACKGROUND VIDEO SELALU MUTED

Untuk TV Display:

```text
background media = muted
```

Audio antrean harus satu-satunya audio penting.

Jangan ada audio video yang bersaing.

---

# 14. PRIORITAS P1 — TAMBAHKAN `playsInline`

Native video:

```tsx
<video
  playsInline
  autoPlay
  muted
  ...
/>
```

---

# 15. PERBAIKI LABEL UI

Ganti:

```text
LAYAR TV 16:9
```

menjadi:

```text
LAYAR TV
```

karena layout sekarang responsive.

Ganti tooltip Tes Audio yang masih menyebut:

```text
TTS
Pelayanan KB
```

menjadi:

```text
Tes Audio Panggilan Lokal
A-001, Loket 1,
Pelayanan Keluarga Berencana
```

---

# 16. TEST AUDIO PRODUCTION HARUS MENGUJI ENGINE YANG SAMA

Tes Audio tidak boleh mempunyai jalur khusus.

Flow:

```text
AudioContext resume
→ Essential buffer ready
→ Chime
→ Voice sequence
→ onended
→ PASS
```

Test phrase:

```text
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

---

# 17. HASIL TEST HARUS DETAIL

UI debug:

```text
AUDIO TEST

Context      PASS
Assets       PASS
Decode       PASS
Chime        PASS
Voice        PASS
Queue        PASS

Result:
AUDIO READY
```

Jika gagal:

```text
AUDIO TEST FAILED

Stage:
DECODE

Token:
digit.satu

Error:
DECODE_TIMEOUT:digit.satu
```

Jangan truncate error menjadi:

```text
WEB_SP...
```

---

# 18. DEVICE TEST WAJIB

Setelah patch P0 selesai, test:

```text
Desktop Chrome utama
Laptop Chrome lain
Android Phone
Android Tablet
iPhone Safari
iPhone Chrome
Smart TV target
```

Setiap perangkat menjalankan:

```text
TES AUDIO
```

Expected:

```text
CHIME
+
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

---

# 19. STRESS TEST

Pada setiap device penting:

```text
10 panggilan berurutan
```

Expected:

```text
no overlap
no missing word
no duplicate
no silent call
```

---

# 20. RECALL TEST

Call:

```text
A-001 event-1
```

Recall:

```text
A-001 event-2
```

Expected:

```text
event-1 → played once
event-2 → played once
```

Dedup berdasarkan:

```text
callEvent.id
```

---

# 21. RELOAD TEST

Scenario:

```text
Operator call
↓
2 detik kemudian TV reload
```

Expected:

```text
call tetap dibunyikan
```

selama masih dalam recent-event window.

---

# 22. BACKGROUND/FOREGROUND IPHONE

Scenario:

```text
Audio READY
↓
Safari/Chrome ke background
↓
kembali foreground
```

Expected:

```text
AudioContext running
```

atau:

```text
BLOCKED
→ tampil Activate Audio
```

Tidak boleh silent failure.

---

# 23. OFFLINE AUDIO TEST

Setelah first load dan cache:

```text
putus internet eksternal
↓
TES AUDIO
```

Expected:

```text
PASS
```

karena seluruh voice asset lokal.

---

# 24. VALIDASI ASSET OTOMATIS

Tambahkan script:

```text
scripts/validate-audio-assets.mjs
```

Periksa:

```text
- file exists
- size > minimum
- WAV header RIFF/WAVE
- seluruh token manifest tersedia
- tidak ada duplicate key
- tidak ada missing essential asset
```

Run sebelum build:

```json
{
  "scripts": {
    "validate:audio":
      "node scripts/validate-audio-assets.mjs",

    "build":
      "npm run validate:audio && tsc && vite build"
  }
}
```

---

# 25. UNIT TEST SEQUENCE

Input:

```text
A-001
Loket 1
KB
```

Expected token order:

```text
phrase.nomorAntrean
letter.a
digit.nol
digit.nol
digit.satu
pause.short
phrase.silakanMenuju
counter.loket
number.satu
pause.short
phrase.pelayananKB
```

Tidak boleh menghasilkan:

```text
Loket Loket
```

---

# 26. FAIL-FAST TEST

Test:

```text
serviceGroup = UNKNOWN
```

Expected:

```text
ERROR
```

bukan:

```text
Pelayanan Sekretariat
```

Test:

```text
counterName = invalid
```

Expected:

```text
ERROR
```

bukan:

```text
Loket 1
```

---

# 27. ACCEPTANCE MATRIX

| Device | Activate | Chime | Voice | 10 Calls | Recall | Reload Recovery | Offline |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop utama | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Laptop lain | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Android Phone | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Android Tablet | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| iPhone Safari | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| iPhone Chrome | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Smart TV target | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Jangan release jika target device masih:

```text
CHIME ONLY
```

---

# 28. HAL YANG TIDAK BOLEH DILAKUKAN LAGI

Jangan:

```text
- mengembalikan translate_tts ke production,
- mengembalikan speechSynthesis sebagai primary/fallback utama,
- menambah timeout acak,
- menambah workaround per browser tanpa bukti,
- membuat audio player baru,
- mengubah architecture Web Audio yang sekarang,
- menganggap missing buffer sebagai warning saja,
- menganggap timer selesai = audio selesai,
- menganggap event processed sebelum voice selesai.
```

---

# 29. ORDER OF WORK — WAJIB IKUTI URUTAN INI

## Step 1
Hapus `chime` dari manifest/essential.

## Step 2
Regenerate seluruh audio menjadi genuine WAV.

## Step 3
Fix `silakan-menuju.wav`.

## Step 4
Tambahkan asset validation script.

## Step 5
Fail-fast parser dan missing buffer.

## Step 6
Playback completion via `onended`.

## Step 7
Teruskan Firestore callEvent ID.

## Step 8
Refactor processed/played lifecycle.

## Step 9
Fix initial snapshot recovery.

## Step 10
Prefetch audio.

## Step 11
Update service worker cache.

## Step 12
Run automated/unit tests.

## Step 13
Deploy staging.

## Step 14
Test device matrix.

## Step 15
Baru deploy production.

---

# 30. DEFINITION OF DONE

Masalah audio dianggap selesai hanya jika:

```text
1. Tidak ada 404 chime.wav.
2. Semua .wav adalah genuine WAV PCM.
3. Tidak ada "Loket Loket".
4. KB selalu dibaca "Pelayanan Keluarga Berencana".
5. Missing buffer = error.
6. Unknown service/counter/ticket = error.
7. Success hanya setelah source terakhir onended.
8. Firestore callEvent.id = AudioCallJob.id.
9. Event tidak marked played sebelum voice selesai.
10. Recent call tidak hilang setelah reload.
11. iPhone Safari PASS.
12. iPhone Chrome PASS.
13. Smart TV target PASS.
14. Laptop kedua PASS.
15. Android tetap PASS.
16. Desktop utama tetap PASS.
17. Offline audio PASS.
18. Tidak ada translate_tts di production.
19. Tidak ada speechSynthesis di production.
20. Tidak ada CHIME_ONLY success.
```

---

# 31. CATATAN TERAKHIR

Arsitektur terbaru sudah berada di arah yang benar.

**Jangan rewrite audio engine lagi.**

Masalah sekarang adalah implementasi asset dan lifecycle.

Target developer:

```text
BERSIHKAN
VALIDASI
TEST
```

bukan:

```text
GANTI ARSITEKTUR LAGI
```

Setelah seluruh poin P0 dan acceptance matrix PASS, baru lanjutkan ke pekerjaan non-audio seperti:

```text
serverTimestamp
full lifecycle transaction
recall transaction
transfer transaction
unified ETA
reporting
```
