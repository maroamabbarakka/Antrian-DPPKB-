# AUDIT FINAL & REKOMENDASI PERBAIKAN AUDIO
## Sistem Antrean DPPKB Majene

**Tujuan dokumen:** menghentikan masalah audio lintas perangkat yang sudah berulang selama beberapa hari dan mengganti pendekatan tambal-sulam dengan arsitektur yang lebih sederhana, deterministik, dan mudah diuji.

**Scope utama:**
- suara panggilan antrean,
- iPhone Safari,
- iPhone Chrome,
- desktop/laptop Chrome,
- Smart TV,
- TV Display,
- tes audio,
- queue/retry audio,
- service worker/cache audio.

**Di luar scope:** Authentication/RBAC.

---

# 1. KESIMPULAN AUDIT

Masalah utama bukan speaker, volume, Firebase, atau teks antrean.

Bukti lapangan menunjukkan:

```text
Desktop Chrome tertentu:
chime + voice, tetapi voice terdengar aneh

Android:
chime + voice berjalan

iPhone Safari:
chime terdengar
voice tidak terdengar
test berakhir GAGAL

iPhone Chrome:
tidak terdengar apa pun
status MENGUJI terus

Smart TV:
chime terdengar
voice tidak terdengar
```

Kesimpulan sederhana:

```text
CHIME ENGINE BEKERJA.

VOICE ENGINE TIDAK KONSISTEN.
```

Saat ini aplikasi menggunakan tiga jalur audio sekaligus:

```text
1. Web Audio API
   → chime

2. HTMLAudioElement + translate.google.com/translate_tts
   → voice utama

3. browser speechSynthesis
   → voice fallback
```

Masalah utamanya adalah setiap browser/device mempunyai implementasi dan policy yang berbeda untuk jalur #2 dan #3.

Karena itu:

> **Jangan lagi mencoba membuat tiga jalur tersebut sama-sama sempurna pada semua device.**

Rekomendasi final:

> **Gunakan SATU jalur produksi: Web Audio API + audio voice lokal/same-origin yang sudah dipersiapkan.**

Untuk versi paling stabil dan sederhana, **jangan generate TTS saat runtime terlebih dahulu**.

Gunakan file voice lokal yang sudah dibuat sebelumnya.

---

# 2. TARGET ARSITEKTUR FINAL — SANGAT SEDERHANA

Target produksi:

```text
USER AKTIFKAN AUDIO
        ↓
ONE AudioContext
        ↓
AudioContext RUNNING
        ↓
preload/decode voice assets
        ↓
READY

OPERATOR CALL
        ↓
call event
        ↓
build token sequence
        ↓
pastikan semua AudioBuffer READY
        ↓
PLAY CHIME
        ↓
PLAY VOICE TOKENS
        ↓
VOICE ENDED
        ↓
mark call PLAYED
```

Tidak ada lagi:

```text
new Audio(remote TTS)
speechSynthesis sebagai voice utama
translate.google.com runtime dependency
```

---

# 3. MENGAPA WEB AUDIO DIPILIH

Hasil video menunjukkan chime yang dibuat dengan Web Audio dapat berbunyi pada perangkat yang justru gagal memainkan voice.

Artinya jalur:

```text
AudioContext
→ oscillator / AudioBuffer
→ speaker
```

sudah terbukti paling konsisten dari hasil lapangan.

Dengan Web Audio:

- output hanya memakai satu audio engine,
- tidak bergantung pada voice bawaan OS,
- tidak bergantung pada `speechSynthesis`,
- tidak bergantung pada autoplay behavior HTML `<audio>` setelah call,
- tidak bergantung pada endpoint Google Translate,
- seluruh perangkat mendengar voice yang sama,
- voice dapat tersedia offline,
- lebih mudah dibuat deterministic.

---

# 4. SOLUSI PALING SEDERHANA: LOCAL VOICE ASSETS

Buat library voice lokal.

Disarankan format:

```text
WAV PCM
mono
16-bit
44.1 kHz
```

MP3 boleh dipakai, tetapi WAV PCM lebih sederhana untuk library kecil dan tidak bergantung pada kompresi runtime.

Jumlah file yang dibutuhkan sedikit.

Struktur:

```text
public/
  audio/
    queue/
      chime.wav

      phrases/
        nomor-antrean.wav
        silakan-menuju.wav
        pelayanan-keluarga-berencana.wav
        pelayanan-sekretariat.wav

      letters/
        a.wav
        b.wav

      digits/
        nol.wav
        satu.wav
        dua.wav
        tiga.wav
        empat.wav
        lima.wav
        enam.wav
        tujuh.wav
        delapan.wav
        sembilan.wav

      counters/
        loket.wav
        satu.wav
        dua.wav
        tiga.wav
        empat.wav
        lima.wav
        enam.wav
        tujuh.wav
        delapan.wav
        sembilan.wav
        sepuluh.wav
```

Atau angka dapat memakai file digit yang sama jika artikulasinya cocok.

---

# 5. CONTOH PANGGILAN A-001

Data:

```text
Ticket:
A-001

Counter:
Loket 1

Service:
KB
```

Jangan runtime TTS.

Bangun sequence:

```text
nomor-antrean.wav
a.wav
nol.wav
nol.wav
satu.wav

silakan-menuju.wav
loket.wav
satu.wav

pelayanan-keluarga-berencana.wav
```

Hasil yang harus terdengar:

```text
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

**Aturan wajib:**

```text
KB
```

tidak pernah dibaca:

```text
"KB"
"K B"
"Pelayanan KB"
```

Voice wajib:

```text
Pelayanan Keluarga Berencana
```

---

# 6. KEUNTUNGAN LOCAL VOICE

Tidak ada network call saat panggilan.

Tidak ada:

```text
translate_tts
Cloud API latency
CORS
403
network timeout
browser speech voice availability
perbedaan voice Windows/Apple/Android/TV
```

Call event tetap dapat berbunyi saat internet luar bermasalah selama aplikasi dan Firestore masih memiliki jalur komunikasi yang dibutuhkan atau event sudah diterima.

Untuk audio sendiri:

```text
100% local.
```

---

# 7. VOICE BISA DIBUAT SEKALI DENGAN TTS PROFESIONAL

Developer tidak perlu merekam manual.

Voice assets dapat dibuat sekali menggunakan provider TTS resmi atau recording profesional.

Setelah dibuat:

```text
download file
normalize
potong dengan rapi
simpan di public/audio/queue
```

Browser **tidak perlu memanggil TTS provider saat runtime**.

Ini memisahkan:

```text
PROSES PEMBUATAN VOICE
```

dari:

```text
PROSES PEMUTARAN VOICE.
```

Itu membuat sistem jauh lebih sederhana.

---

# 8. HAPUS DIRECT GOOGLE TRANSLATE TTS DARI PRODUCTION

Current code masih mempunyai fungsi yang membentuk:

```text
https://translate.google.com/translate_tts
```

Jangan gunakan endpoint tersebut dalam jalur production.

Hapus dari:

```text
QueueAudioEngine
```

atau pindahkan hanya ke experimental/debug code.

Production tidak boleh tergantung kepadanya.

---

# 9. SPEECHSYNTHESIS JANGAN MENJADI FALLBACK PRODUCTION

Current fallback menggunakan:

```text
window.speechSynthesis
```

Masalah yang sudah terlihat:

- desktop tertentu memilih voice berbeda,
- suara terdengar aneh,
- iPhone Safari gagal,
- Smart TV dapat tidak memiliki voice Indonesia,
- behavior berbeda antar browser/profile.

Untuk production:

```text
speechSynthesis = DISABLED
```

atau hanya tersedia melalui:

```text
?debugAudio=1
```

untuk diagnostic.

Jangan gunakan untuk panggilan pelayanan.

---

# 10. QUEUE AUDIO ENGINE BARU

Buat ulang/bersihkan:

```text
src/services/audio/QueueAudioEngine.ts
```

menjadi lebih kecil.

Target tanggung jawab:

```text
1. Create/resume one AudioContext
2. Load local audio assets
3. Decode assets menjadi AudioBuffer
4. Maintain buffer cache
5. Maintain call queue
6. Play call sequence
7. Return explicit result
```

Jangan lagi menangani:

```text
HTMLAudioElement voice
translate_tts
speechSynthesis production fallback
```

---

# 11. AUDIO ENGINE STATE

Gunakan state minimal:

```ts
type AudioState =
  | 'LOCKED'
  | 'LOADING'
  | 'READY'
  | 'PLAYING'
  | 'BLOCKED'
  | 'ERROR';
```

Makna:

```text
LOCKED
user belum aktivasi

LOADING
asset belum siap

READY
AudioContext running + essential buffer siap

PLAYING
announcement sedang berjalan

BLOCKED
browser membutuhkan user gesture lagi

ERROR
asset / decode / engine error
```

Jangan mempunyai state yang ambigu.

---

# 12. AUDIO UNLOCK — LOGIKA BARU

Sederhanakan.

Tidak perlu persistent `<audio>` sebagai syarat voice.

Pada tombol:

```text
AKTIFKAN SUARA
```

jalankan langsung dari user gesture:

```ts
async function activateAudio() {
  const ctx = getOrCreateAudioContext();

  await withTimeout(
    ctx.resume(),
    2500,
    'AUDIO_CONTEXT_RESUME_TIMEOUT'
  );

  if (ctx.state !== 'running') {
    throw new Error(
      'AUDIO_CONTEXT_NOT_RUNNING'
    );
  }

  await ensureEssentialBuffers();

  await playBuffer(
    'chime',
    { shortTest: true }
  );

  setState('READY');
}
```

---

# 13. JANGAN ADA `MENGUJI...` TANPA BATAS

Semua async operation wajib timeout.

Contoh helper:

```ts
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorCode: string
): Promise<T> {

  return Promise.race([
    promise,

    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(errorCode)
        );
      }, ms);
    })
  ]);
}
```

Gunakan untuk:

```text
AudioContext resume:
2500 ms

asset fetch:
5000 ms

decode:
5000 ms

test:
10000 ms
```

Tidak boleh ada infinite pending.

---

# 14. PRELOAD AUDIO SEBELUM DIPERLUKAN

Pada app startup:

```text
fetch semua local voice asset
↓
simpan ArrayBuffer
```

Fetch boleh dilakukan sebelum audio activation.

Contoh:

```ts
const assetArrayBuffers =
  new Map<string, ArrayBuffer>();
```

Setelah AudioContext aktif:

```text
decodeAudioData
↓
AudioBuffer cache
```

Cache:

```ts
const buffers =
  new Map<string, AudioBuffer>();
```

---

# 15. AUDIO MANIFEST

Jangan hard-code file tersebar.

Buat:

```text
src/services/audio/queueAudioManifest.ts
```

Contoh:

```ts
export const AUDIO_ASSETS = {
  chime:
    '/audio/queue/chime.wav',

  nomorAntrean:
    '/audio/queue/phrases/nomor-antrean.wav',

  silakanMenuju:
    '/audio/queue/phrases/silakan-menuju.wav',

  pelayananKB:
    '/audio/queue/phrases/pelayanan-keluarga-berencana.wav',

  pelayananSK:
    '/audio/queue/phrases/pelayanan-sekretariat.wav',

  letterA:
    '/audio/queue/letters/a.wav',

  letterB:
    '/audio/queue/letters/b.wav'
};
```

Digits/counters dapat memakai maps.

---

# 16. BUFFER LOADER

Buat:

```text
src/services/audio/AudioBufferStore.ts
```

Pseudo-code:

```ts
class AudioBufferStore {
  private buffers =
    new Map<string, AudioBuffer>();

  async load(
    key: string,
    url: string,
    ctx: AudioContext
  ) {
    if (this.buffers.has(key)) {
      return this.buffers.get(key)!;
    }

    const response =
      await withTimeout(
        fetch(url),
        5000,
        `FETCH_TIMEOUT:${key}`
      );

    if (!response.ok) {
      throw new Error(
        `AUDIO_HTTP_${response.status}:${key}`
      );
    }

    const bytes =
      await response.arrayBuffer();

    const buffer =
      await withTimeout(
        ctx.decodeAudioData(
          bytes.slice(0)
        ),
        5000,
        `DECODE_TIMEOUT:${key}`
      );

    this.buffers.set(
      key,
      buffer
    );

    return buffer;
  }
}
```

---

# 17. SEQUENCE BUILDER

Buat:

```text
src/services/audio/buildQueueVoiceSequence.ts
```

Input:

```ts
{
  ticketCode: 'A-001',
  counterName: 'Loket 1',
  serviceGroup: 'KB'
}
```

Output:

```ts
[
  'phrase.nomorAntrean',
  'letter.a',
  'digit.nol',
  'digit.nol',
  'digit.satu',

  'pause.short',

  'phrase.silakanMenuju',
  'counter.loket',
  'number.satu',

  'pause.short',

  'service.kb'
]
```

Tidak ada teks bebas dalam playback production.

---

# 18. PLAYBACK SEQUENCE

Gunakan AudioBufferSourceNode.

Contoh konsep:

```ts
async function playSequence(
  keys: string[]
) {
  const ctx =
    await ensureRunningContext();

  let when =
    ctx.currentTime + 0.05;

  for (const key of keys) {
    if (key === 'pause.short') {
      when += 0.12;
      continue;
    }

    const buffer =
      bufferStore.get(key);

    const source =
      ctx.createBufferSource();

    source.buffer = buffer;
    source.connect(
      ctx.destination
    );

    source.start(when);

    when += buffer.duration + 0.04;
  }

  await waitUntilAudioTime(
    ctx,
    when
  );
}
```

Semua voice keluar dari:

```text
ONE AudioContext.
```

---

# 19. CHIME HANYA BOLEH DIMAINKAN SETELAH VOICE SIAP

Current logic:

```text
chime
↓
baru coba voice
```

harus diubah.

Target:

```text
CALL RECEIVED
↓
build sequence
↓
cek semua buffer tersedia
↓
jika ada buffer missing:
    load/decode
↓
SEMUA READY
↓
PLAY CHIME
↓
PLAY VOICE
```

Artinya:

> Jika chime terdengar, voice harus sudah siap menyusul.

Tidak boleh lagi:

```text
ting tong
...
...
diam.
```

---

# 20. CALL QUEUE

Jangan overlap.

State:

```text
IDLE
↓
PREPARING
↓
PLAYING
↓
DONE
↓
NEXT
```

Queue:

```ts
AudioCallJob[]
```

Hanya satu job berjalan.

---

# 21. HASIL PLAYBACK HARUS EXPLICIT

```ts
type PlaybackResult = {
  success: boolean;
  callId: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
};
```

Success hanya jika:

```text
SELURUH sequence selesai.
```

Tidak ada:

```text
CHIME_ONLY = success.
```

---

# 22. CALL EVENT JANGAN DIANGGAP SELESAI SEBELUM VOICE SELESAI

Current Firestore listener masih mempunyai konsep:

```text
processedCallIds
```

yang dapat ditambahkan sebelum playback voice selesai.

Refactor:

```ts
receivedCallIds
queuedCallIds
playingCallIds
playedCallIds
failedCallIds
```

Flow:

```text
Firestore event
↓
RECEIVED

↓
QUEUED

↓
PLAYING

↓
VOICE COMPLETED

↓
PLAYED
```

Jika error:

```text
FAILED
```

Call tetap tersedia untuk:

```text
retry
```

---

# 23. INITIAL FIRESTORE SNAPSHOT

Jangan langsung menandai seluruh initial snapshot sebagai sudah diproses.

Risiko:

```text
TV reload
↓
call baru saja terjadi
↓
initial snapshot
↓
event dianggap lama
↓
voice hilang
```

Gunakan:

```text
event age
```

Contoh:

```ts
const MAX_BOOT_CALL_AGE_MS =
  20_000;
```

Saat startup:

```text
event <= 20 detik
→ boleh queue

event > 20 detik
→ historical
```

Atau lebih baik persist:

```text
lastPlayedCallId
lastPlayedTimestamp
```

di session/local storage.

---

# 24. RECALL HARUS MENJADI EVENT BARU

Setiap recall:

```text
new callEvent ID
```

jadi bisa diputar ulang secara sah.

Dedup berdasarkan:

```text
callEvent.id
```

bukan hanya ticket ID.

---

# 25. SERVICE WORKER

Cache semua voice asset.

Naikkan:

```text
CACHE_NAME
```

misalnya:

```js
const CACHE_NAME =
  'antri-dppkb-audio-v5';
```

Tambahkan seluruh manifest audio.

Jangan satu `cache.addAll()` besar tanpa error visibility.

Lebih aman:

```js
await Promise.allSettled(
  CORE_ASSETS.map(async url => {
    try {
      await cache.add(url);
    } catch (err) {
      console.error(
        '[SW] cache failed',
        url,
        err
      );
    }
  })
);
```

Essential assets dapat diperlakukan strict.

Voice fallback wajib tersedia offline.

---

# 26. BACKGROUND VIDEO

Selama announcement:

```text
video.muted = true
```

Rekomendasi paling sederhana:

> Background video TV selalu muted.

Tidak perlu ada audio media lain yang bersaing dengan panggilan antrean.

---

# 27. NATIVE VIDEO

Tambahkan:

```tsx
playsInline
```

pada native `<video>`.

Contoh:

```tsx
<video
  playsInline
  autoPlay
  muted
  ...
/>
```

---

# 28. TES AUDIO BARU

Tes audio tidak perlu mengetes Google TTS atau Web Speech.

Tes production harus mengetes engine yang sama dengan call nyata.

Flow:

```text
1. AudioContext resume
2. Load essential buffers
3. Decode
4. Chime
5. Full test call
6. End
```

Test phrase:

```text
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

---

# 29. STATUS TES AUDIO

UI:

```text
AUDIO TEST

Context       PASS
Assets        PASS
Decode        PASS
Chime         PASS
Voice         PASS
Queue Engine  PASS

AUDIO READY
```

Error:

```text
AUDIO TEST FAILED

Step:
DECODE

Asset:
digit.satu

Error:
DECODE_TIMEOUT:digit.satu
```

Tidak boleh hanya:

```text
WEB_SP...
```

Error harus lengkap.

---

# 30. DEBUG INFO

Debug page harus tampilkan:

```text
User Agent
Browser
Viewport
AudioContext State
sampleRate
baseLatency jika tersedia
buffer count
missing buffers
last call ID
last playback result
last error
service worker version
cache version
```

Jangan hanya:

```text
Web Speech tersedia / tidak.
```

Karena Web Speech tidak lagi production dependency.

---

# 31. IPHONE CHROME & SAFARI

Di iOS, fokus hanya:

```text
Apakah AudioContext dapat di-resume lewat user gesture?
```

Tidak perlu men-debug:

```text
HTMLAudio TTS autoplay
speechSynthesis voice
```

untuk production.

Pada first open:

```text
AKTIFKAN SUARA
```

User tekan sekali.

Jika context running:

```text
READY
```

Jika iOS men-suspend AudioContext setelah background:

```text
BLOCKED
```

dan tampilkan lagi:

```text
AKTIFKAN SUARA
```

Jangan mencoba resume tanpa visibility check secara diam-diam.

---

# 32. VISIBILITY RECOVERY

Tambahkan:

```ts
document.addEventListener(
  'visibilitychange',
  () => {
    if (
      document.visibilityState === 'visible'
    ) {
      checkAudioContext();
    }
  }
);
```

Jika:

```text
ctx.state === suspended
```

jangan langsung menyatakan READY.

Set:

```text
BLOCKED
```

dan minta gesture ulang jika perlu.

---

# 33. SMART TV

Untuk Smart TV:

- satu AudioContext,
- asset lokal,
- tidak runtime TTS,
- background video muted,
- jangan membuat banyak `<audio>` player,
- remote OK harus dapat menekan Activate Audio,
- jangan membutuhkan fullscreen untuk aktivasi suara.

---

# 34. JANGAN GABUNG FULLSCREEN & AUDIO

Tetap:

```text
AKTIFKAN SUARA
```

dan:

```text
FULLSCREEN
```

sebagai action terpisah.

Kegagalan fullscreen tidak boleh memengaruhi audio.

---

# 35. RESPONSIVE

TV Display tetap:

```text
responsive viewport
```

bukan fixed 16:9.

16:9 hanya untuk video media jika diperlukan.

Pastikan:

```text
iPhone portrait
iPhone landscape
tablet
Smart TV
desktop
```

semua dapat melihat tombol Activate Audio.

---

# 36. LABEL UI

Hindari label seperti:

```text
LAYAR TV 16:9
```

Gunakan:

```text
LAYAR TV
```

karena mode tersebut responsive.

---

# 37. PERBAIKAN CURRENT CODE YANG TETAP WAJIB WALAU MIGRASI BERTAHAP

Sebelum engine baru selesai, patch current engine:

## 37.1 `testAudio()` wajib cek hasil unlock

Jangan:

```ts
await unlockFromUserGesture();
return testCallFull();
```

Gunakan:

```ts
const unlocked =
  await unlockFromUserGesture();

if (!unlocked) {
  return audioUnlockFailedResult();
}

return testCallFull();
```

---

## 37.2 Unlock wajib outer timeout

Current unlock berisiko pending terlalu lama.

Gunakan max:

```text
2.5–3 detik
```

Jika timeout:

```text
AUDIO_UNLOCK_TIMEOUT
```

---

## 37.3 Finish timeout tidak boleh resolve

Jika media stall:

```text
timeout
```

harus:

```ts
reject(
  new Error(
    'AUDIO_FINISH_TIMEOUT'
  )
);
```

Bukan resolve.

---

## 37.4 `playChime()` jangan swallow error

Current chime catch dapat membuat caller mengira berhasil.

Gunakan:

```ts
catch (err) {
  throw new Error(
    'CHIME_PLAYBACK_FAILED'
  );
}
```

---

## 37.5 Jangan chime sebelum voice ready

Bahkan selama transitional patch:

```text
prepare voice
↓
voice ready
↓
chime
↓
voice
```

---

# 38. RENCANA PENGERJAAN DI IDE — JANGAN DIKERJAKAN SEKALIGUS

## STEP 1 — Freeze current audio behavior

Jangan tambah workaround baru.

Buat branch:

```text
fix/audio-deterministic-engine
```

---

## STEP 2 — Tambah local voice assets

Selesaikan semua file audio.

Verifikasi manual:
- tidak clipped,
- volume konsisten,
- tidak ada leading silence berlebihan,
- tidak ada trailing silence berlebihan.

---

## STEP 3 — Buat AudioBufferStore

Test:
- fetch,
- decode,
- cache.

---

## STEP 4 — Buat sequence builder

Unit test:

```text
A-001 / Loket 1 / KB
```

harus menghasilkan sequence tepat.

---

## STEP 5 — Buat new QueueAudioEngine

Jangan hubungkan Firestore dulu.

Gunakan hanya:

```text
TES AUDIO
```

---

## STEP 6 — Uji 6 perangkat

Wajib:

```text
Desktop utama
Desktop/laptop lain
Android HP
Android tablet
iPhone Safari
iPhone Chrome
Smart TV target
```

Jangan lanjut sebelum semuanya PASS.

---

## STEP 7 — Hubungkan QueueAudioEngine ke call event

Baru setelah test manual penuh PASS.

---

## STEP 8 — Refactor call lifecycle

`played` hanya setelah playback selesai.

---

## STEP 9 — Service Worker cache

Pastikan voice assets offline.

---

## STEP 10 — Hapus production legacy path

Hapus/pensiunkan:

```text
translate_tts runtime
speechSynthesis production
HTMLAudio voice path
```

---

# 39. UNIT TEST YANG WAJIB

## Text/sequence

```ts
expect(
  buildVoiceSequence({
    ticketCode: 'A-001',
    counterName: 'Loket 1',
    serviceGroup: 'KB'
  })
).toEqual([
  ...
]);
```

Pastikan service KB menggunakan asset:

```text
pelayanan-keluarga-berencana
```

---

# 40. BUFFER TEST

Simulasi:
- asset 404,
- fetch timeout,
- decode fail.

Expected:

```text
explicit failure
```

bukan pending.

---

# 41. QUEUE TEST

Simulasi dua call berdekatan:

```text
A-001
B-002
```

Expected:

```text
A-001 selesai
↓
B-002 mulai
```

Tidak overlap.

---

# 42. RECALL TEST

Call:

```text
A-001 event-1
```

Recall:

```text
A-001 event-2
```

Keduanya harus berbunyi satu kali.

---

# 43. VISIBILITY TEST

iPhone:

```text
READY
↓
background
↓
foreground
```

Expected:

```text
READY
```

atau:

```text
BLOCKED → Activate Audio
```

Tidak boleh invisible silent failure.

---

# 44. OFFLINE TEST

Setelah app sudah cached:

```text
putus external internet
↓
TES AUDIO
```

Expected:

```text
PASS
```

karena audio lokal.

Ini merupakan acceptance test penting.

---

# 45. ACCEPTANCE TEST FINAL

Setiap perangkat harus menghasilkan kalimat lengkap:

```text
Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

Tidak cukup:

```text
chime saja.
```

---

# 46. ACCEPTANCE MATRIX

| Device | Activate | Chime | Voice | 10x Call | Recall | Background Recovery | Offline Voice |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop Chrome utama | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Laptop Chrome lain | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Android Phone | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Android Tablet | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| iPhone Safari | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| iPhone Chrome | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Smart TV target | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Jangan release apabila salah satu target utama masih:

```text
CHIME ONLY.
```

---

# 47. HAL YANG HARUS DIHENTIKAN

Jangan lagi:

```text
- menambah setTimeout acak,
- mengganti rate SpeechSynthesis,
- mencari voice berdasarkan nama OS,
- mencoba translate_tts URL alternatif,
- membuat player baru,
- menganggap browser yang berbeda memerlukan patch khusus satu per satu,
- menjadikan chime sebagai bukti voice engine bekerja,
- menganggap online berarti TTS tersedia.
```

Semua itu menambah kompleksitas tanpa menyelesaikan root cause.

---

# 48. PRINSIP FINAL

Sistem antrean hanya membutuhkan suara yang konsisten.

Tidak membutuhkan TTS dinamis penuh.

Kalimat panggilan mempunyai struktur terbatas dan predictable.

Karena itu solusi paling aman adalah:

```text
PRE-GENERATED VOICE ASSETS
+
ONE WEB AUDIO ENGINE
+
LOCAL CACHE
+
DETERMINISTIC SEQUENCE
```

Bukan:

```text
MULTIPLE BROWSER TTS ENGINES
+
REMOTE UNOFFICIAL TTS
+
MULTIPLE FALLBACK
```

---

# 49. TARGET KODE AKHIR

Struktur:

```text
src/
  services/
    audio/
      QueueAudioEngine.ts
      AudioBufferStore.ts
      queueAudioManifest.ts
      buildQueueVoiceSequence.ts
      queueAudioText.ts

public/
  audio/
    queue/
      chime.wav
      phrases/
      digits/
      letters/
      counters/
```

Tidak perlu kompleks.

---

# 50. DEFINISI SELESAI

Masalah audio dianggap **SELESAI** hanya bila:

```text
1. iPhone Safari PASS.
2. iPhone Chrome PASS.
3. Smart TV target PASS.
4. Laptop kedua PASS.
5. Android tetap PASS.
6. Desktop utama tetap PASS.
7. Voice sama/seragam di semua device.
8. Tidak ada speechSynthesis di production call path.
9. Tidak ada translate_tts di production call path.
10. Tidak ada infinite "Menguji...".
11. Tidak ada chime-only success.
12. Call tidak overlap.
13. Recall tetap berbunyi.
14. Audio masih berfungsi dari local cache.
15. KB selalu disebut "Pelayanan Keluarga Berencana".
```

---

# 51. PRIORITAS SETELAH AUDIO STABIL

Setelah audio benar-benar PASS pada perangkat fisik, baru lanjutkan:

```text
- Firestore server timestamp,
- full transactional lifecycle,
- recall transaction,
- transfer transaction,
- unified ETA integration,
- automated testing,
- responsive polishing,
- reporting.
```

Jangan mengerjakan polishing sebelum audio production path stabil.

---

# 52. CATATAN AUDIT NON-AUDIO YANG MASIH PERLU DILANJUTKAN

Audit source juga menunjukkan beberapa pekerjaan lain yang belum sempurna:

```text
- Firestore initial call snapshot masih dapat menganggap event baru sebagai historical.
- processedCallIds masih dapat diisi sebelum playback benar-benar selesai.
- recallTicketAtomic/transferTicketAtomic belum semuanya benar-benar memakai transaction.
- lifecycle SERVING/COMPLETED/NO_SHOW/CANCELED masih memakai local-state update + async sync.
- serverTimestamp sudah di-import di repository tetapi timestamp utama masih banyak memakai Date.now().
- unified ETA module sudah dibuat tetapi harus dipastikan benar-benar dipakai seluruh view.
```

Pekerjaan ini penting, tetapi **jangan mencampurkannya ke branch perbaikan audio** kecuali diperlukan untuk call acknowledgement.

---

# 53. REKOMENDASI PALING PENTING UNTUK DEVELOPER

Jangan lagi bertanya:

```text
"Bagaimana supaya translate_tts bekerja di Safari?"
```

atau:

```text
"Voice apa yang cocok untuk speechSynthesis di Smart TV?"
```

Pertanyaan yang benar adalah:

```text
"Bagaimana memastikan satu set file suara lokal
dapat dimainkan oleh satu AudioContext
secara sama di semua perangkat?"
```

Itu masalah yang jauh lebih kecil, lebih deterministik, dan lebih mudah diselesaikan.

---

# 54. FINAL RECOMMENDATION

**Lakukan rewrite kecil khusus voice layer, bukan rewrite seluruh aplikasi.**

Pertahankan:
- Firebase,
- QueueContext,
- UI,
- call event,
- responsive TV,
- ticket logic.

Ganti hanya:

```text
VOICE DELIVERY LAYER
```

dari:

```text
Web Audio chime
+ HTMLAudio remote TTS
+ Web Speech fallback
```

menjadi:

```text
ONE Web Audio Engine
+ Local Voice Assets
+ Local Cache
```

Setelah solusi ini PASS pada iPhone Safari, iPhone Chrome, Smart TV, laptop kedua, desktop utama, dan Android, barulah pertimbangkan tambahan server-generated full phrase sebagai enhancement, bukan dependency utama.
