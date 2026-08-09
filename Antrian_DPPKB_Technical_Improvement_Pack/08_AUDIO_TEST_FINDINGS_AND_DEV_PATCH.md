# Phase 0 — Audio Test Findings & Immediate Developer Patch

## Status Dokumen

Dokumen ini dibuat setelah pengujian ulang terhadap:

- source terbaru aplikasi,
- rekaman layar iPhone,
- simulasi failure mode audio engine,
- prototype alternatif Web Audio.

Dokumen ini harus dikerjakan **sebelum melanjutkan polishing UI atau phase non-kritis lainnya**.

> Scope tetap: Authentication/RBAC tidak termasuk pekerjaan ini.

---

# 1. Ringkasan Temuan Lapangan

Hasil pengujian nyata saat ini:

```text
Laptop utama / Chrome       → chime + voice ✅
Tablet Android              → chime + voice ✅
HP Android                  → chime + voice ✅

iPhone                      → chime ✅ voice ❌
Smart TV tertentu           → chime ✅ voice ❌
Laptop lain / Chrome        → chime ✅ voice ❌
```

Pola ini menunjukkan:

```text
Speaker/device audio bukan masalah utama.
Web Audio chime berhasil.
Yang gagal adalah jalur voice setelah chime.
```

---

# 2. Bukti dari Rekaman iPhone

Rekaman dianalisis secara numerik.

Durasi video sekitar:

```text
7.388 detik
```

Audio aktif hanya sekitar:

```text
2.118 – 3.071 detik
```

Setelah itu:

```text
±4.27 detik hening
```

Frekuensi dominan pada bagian audible:

```text
~524 Hz
~659 Hz
~783 Hz
~1046 Hz
```

Sedangkan source `QueueAudioEngine.playChime()` menggunakan oscillator:

```text
523.25 Hz
659.25 Hz
783.99 Hz
1046.5 Hz
```

Kesimpulan:

```text
Audio yang terdengar pada rekaman benar-benar chime engine.
Voice announcement tidak menghasilkan audio.
```

---

# 3. Root Cause #1 — Persistent Audio Player Tidak Global

Saat ini persistent `<audio>` hanya dimiliki oleh:

```text
TVDisplayView
```

Tetapi tombol:

```text
TES AUDIO
```

tersedia pada Navbar di:

```text
Kios
Operator
Admin
TV
```

Akibatnya pada Kios/Operator/Admin:

```text
QueueAudioEngine.player === null
```

Jalur primary voice via HTMLAudio gagal.

Browser/perangkat yang kebetulan mempunyai `speechSynthesis` yang berfungsi akan terdengar normal.

Browser/perangkat yang fallback Web Speech-nya tidak berfungsi akan hanya menghasilkan chime.

Ini sangat sesuai dengan hasil lapangan.

---

# 4. PATCH P0.1 — Buat GlobalAudioHost

Buat file:

```text
src/components/Common/GlobalAudioHost.tsx
```

Contoh:

```tsx
import {
  useEffect,
  useRef
} from 'react';

import {
  queueAudioEngine
} from '../../services/audio/QueueAudioEngine';

export function GlobalAudioHost() {
  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      queueAudioEngine.bindPlayer(
        audioRef.current
      );
    }

    return () => {
      queueAudioEngine.unbindPlayer?.();
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      style={{
        position: 'fixed',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
```

Mount sekali di root aplikasi.

Target:

```text
App
├── GlobalAudioHost
└── MainContainer
    ├── Kiosk
    ├── Operator
    ├── Admin
    └── TV
```

Setelah itu:

```text
Kios       → player tersedia
Operator   → player tersedia
Admin      → player tersedia
TV         → player tersedia
```

### Wajib

Jangan mempunyai dua persistent `<audio>`.

Setelah `GlobalAudioHost` dibuat, hapus ownership `<audio>` dari `TVDisplayView`.

---

# 5. Root Cause #2 — `testAudio()` Tidak Menunggu Unlock

Current behavior secara konsep:

```ts
unlockAudio();
announceCall();
```

Bukan:

```ts
await unlockAudio();
await announceCall();
```

Hal ini menimbulkan race:

```text
UNLOCKING
↓
announcement mulai
↓
player/audio state belum benar-benar READY
```

---

# 6. PATCH P0.2 — Ubah API Unlock Menjadi Async

Ubah:

```ts
public unlockAudio(): void
```

menjadi:

```ts
public async unlockAudio():
  Promise<boolean> {

  return await
    queueAudioEngine
      .unlockFromUserGesture();
}
```

Ubah `testAudio()` menjadi async:

```ts
public async testAudio():
  Promise<PlaybackResult> {

  const unlocked =
    await this.unlockAudio();

  if (!unlocked) {
    return {
      success: false,
      error: 'AUDIO_UNLOCK_FAILED'
    };
  }

  return await
    queueAudioEngine.testCall();
}
```

---

# 7. PATCH P0.3 — Queue Harus Menunggu State UNLOCKING

Current queue hanya menahan job bila:

```text
LOCKED
BLOCKED
```

Tambahkan:

```text
UNLOCKING
```

Contoh:

```ts
if (
  this.state === 'LOCKED' ||
  this.state === 'BLOCKED' ||
  this.state === 'UNLOCKING'
) {
  return;
}
```

Job baru boleh diproses saat voice path benar-benar siap.

---

# 8. Root Cause #3 — False READY

Current engine dapat menganggap:

```text
READY
```

jika:

```text
AudioContext berhasil
```

meskipun actual media test gagal.

Padahal hasil lapangan menunjukkan:

```text
AudioContext → chime berhasil
HTMLAudio/TTS → voice gagal
```

Jadi:

```text
AudioContext running != Voice Ready
```

---

# 9. PATCH P0.4 — Voice Ready Harus Berdasarkan Actual Playback

Jangan:

```ts
if (
  mediaSuccess ||
  audioCtxSuccess
) {
  state = 'READY';
}
```

Gunakan:

```text
READY
```

hanya jika persistent audio benar-benar berhasil memainkan `audio-ready.mp3`.

Lebih baik bedakan:

```ts
type AudioEngineState =
  | 'LOCKED'
  | 'UNLOCKING'
  | 'CHIME_READY'
  | 'VOICE_READY'
  | 'PLAYING'
  | 'BLOCKED'
  | 'ERROR';
```

Atau jika tidak ingin mengubah state terlalu besar:

```text
READY = actual voice media path sudah tervalidasi
```

---

# 10. Root Cause #4 — Web Speech Error Dianggap Success

Jika `speechSynthesis` tidak tersedia, jangan:

```ts
return Promise.resolve();
```

Harus:

```ts
return Promise.reject(
  new Error(
    'WEB_SPEECH_UNAVAILABLE'
  )
);
```

Jika utterance error, jangan:

```ts
utterance.onerror = finish;
```

dengan `finish()` melakukan resolve.

Gunakan:

```ts
utterance.onerror = event => {
  clearTimeout(timeout);

  reject(
    new Error(
      `WEB_SPEECH_ERROR:${event.error}`
    )
  );
};
```

Timeout juga harus reject:

```ts
reject(
  new Error(
    'WEB_SPEECH_TIMEOUT'
  )
);
```

---

# 11. PATCH P0.5 — CHIME_ONLY Bukan Success

Hapus konsep:

```ts
{
  success: true,
  source: 'CHIME_ONLY'
}
```

Untuk sistem antrean, chime tanpa voice adalah kegagalan.

Gunakan:

```ts
{
  success: false,
  error: 'VOICE_NOT_PLAYED'
}
```

UI/operator harus dapat melihat:

```text
PANGGILAN SUARA GAGAL
```

Tidak boleh silent failure.

---

# 12. Root Cause #5 — MP3 Start Timeout Tidak Dibatalkan Saat Playback Mulai

Current timeout dapat tetap aktif walau media sudah bermain.

Hal ini bisa menyebabkan:

```text
MP3 sudah PLAYING
↓
10 detik
↓
timeout reject
↓
fallback Web Speech mulai
↓
dua suara berpotensi overlap
```

---

# 13. PATCH P0.6 — Pisahkan Start Timeout dan Finish Timeout

Gunakan:

```ts
let started = false;

const startTimeout =
  window.setTimeout(() => {

    if (!started) {
      player.pause();

      reject(
        new Error(
          'AUDIO_START_TIMEOUT'
        )
      );
    }

  }, 5000);

player.onplaying = () => {
  started = true;
  clearTimeout(startTimeout);
};
```

Tambahkan finish timeout terpisah jika diperlukan.

Contoh:

```ts
const finishTimeout =
  window.setTimeout(() => {
    player.pause();

    reject(
      new Error(
        'AUDIO_FINISH_TIMEOUT'
      )
    );
  }, 30000);
```

Pada `ended`:

```ts
player.onended = () => {
  clearTimeout(startTimeout);
  clearTimeout(finishTimeout);

  resolve();
};
```

Pada error:

```ts
player.onerror = () => {
  clearTimeout(startTimeout);
  clearTimeout(finishTimeout);

  reject(
    new Error(
      `HTML_AUDIO_ERROR:${player.error?.code ?? 'unknown'}`
    )
  );
};
```

---

# 14. PATCH P0.7 — Stop Media Sebelum Masuk Fallback

Sebelum Web Speech fallback:

```ts
player.pause();
player.currentTime = 0;
```

Tujuan:

```text
tidak ada kemungkinan MP3 lama masih berjalan
ketika Web Speech mulai.
```

---

# 15. PATCH P0.8 — Perbaiki Tes Audio

Tombol:

```text
TES AUDIO
```

harus menguji voice lengkap.

Expected audio:

```text
♫ CHIME

Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

Status:

```text
TESTING
↓
CHIME OK
↓
VOICE STARTED
↓
VOICE ENDED
↓
AUDIO TEST PASS
```

Jika hanya chime:

```text
AUDIO TEST FAILED
VOICE PLAYBACK FAILED
```

Tidak boleh PASS.

---

# 16. Structured Result untuk Tes Audio

Contoh:

```ts
type AudioTestResult = {
  success: boolean;

  chime: {
    success: boolean;
  };

  voice: {
    success: boolean;
    source?:
      | 'SERVER_MP3'
      | 'WEB_SPEECH'
      | 'LOCAL_AUDIO';

    error?: string;
  };

  durationMs: number;
};
```

UI debug:

```text
AUDIO TEST

Chime       PASS
Voice       FAIL
Source      SERVER_MP3
Fallback    WEB_SPEECH FAIL
Error       WEB_SPEECH_ERROR
```

---

# 17. PATCH P0.9 — Jangan Hilangkan Call Event Sebelum Voice Berhasil

Gunakan flow:

```text
Firestore call event
↓
RECEIVED
↓
QUEUED
↓
PLAYING
↓
VOICE ENDED
↓
PLAYED
```

Jangan:

```text
received
↓
processed
↓
baru mencoba voice
```

Tracking:

```ts
seenCallIds
inFlightCallIds
playedCallIds
failedCallIds
```

`playedCallIds` hanya diisi setelah voice selesai.

---

# 18. Primary TTS Saat Ini Masih Tidak Ideal

Current primary source masih:

```text
translate.google.com/translate_tts
```

Ini sebaiknya tidak dijadikan final production voice source.

Setelah P0 stabil, kerjakan P1.

---

# 19. P1 — Same-Origin Cached TTS

Target:

```text
Browser
↓
/api/queue-tts
↓
Backend
↓
Official TTS provider
↓
generated audio
↓
cache
↓
same-origin audio URL
```

Contoh:

```text
/api/queue-audio/<hash>.mp3
```

Browser tidak perlu langsung mengakses third-party Translate endpoint.

---

# 20. P1 — Web Audio Voice Pipeline

Hasil prototype menunjukkan pipeline berikut valid:

```text
same-origin audio
↓
fetch()
↓
ArrayBuffer
↓
AudioContext.decodeAudioData()
↓
AudioBuffer
↓
AudioBufferSourceNode
↓
destination
```

Target arsitektur:

```text
CALL EVENT
↓
PRELOAD VOICE
↓
VOICE READY
↓
PLAY CHIME
↓
PLAY VOICE
```

Jangan:

```text
PLAY CHIME
↓
baru fetch voice
```

karena menghasilkan jeda hening jika network lambat.

---

# 21. P1 — Satu AudioContext untuk Chime + Voice

Karena chime Web Audio terbukti bekerja pada perangkat bermasalah, pertimbangkan menjadikan Web Audio sebagai final output engine.

Target:

```text
ONE AudioContext
├── Chime AudioBuffer / oscillator
└── Voice AudioBuffer
```

Sequence:

```ts
const now =
  audioContext.currentTime;

playChimeAt(now);

playVoiceAt(
  now + 1.25
);
```

Keuntungan:

```text
- tidak berpindah dari WebAudio ke HTMLAudio,
- mengurangi perbedaan behavior antar browser,
- lebih cocok untuk Smart TV yang mempunyai media decoder terbatas.
```

---

# 22. P1 — Local Prerecorded Fallback

Tambahkan:

```text
public/audio/voice/
  nomor-antrean.mp3
  silakan-menuju.mp3

  pelayanan-keluarga-berencana.mp3
  pelayanan-sekretariat.mp3

  digits/
    nol.mp3
    satu.mp3
    dua.mp3
    tiga.mp3
    empat.mp3
    lima.mp3
    enam.mp3
    tujuh.mp3
    delapan.mp3
    sembilan.mp3

  letters/
    a.mp3
    b.mp3

  counters/
    loket-1.mp3
    loket-2.mp3
    loket-3.mp3
```

Audio `KB` wajib berbunyi:

```text
Pelayanan Keluarga Berencana
```

Tidak boleh:

```text
Pelayanan KB
Pelayanan K B
```

---

# 23. Urutan Fallback Final

Target:

```text
1. Cached same-origin generated voice
        ↓ fail

2. Local prerecorded WebAudio
        ↓ fail

3. Web Speech API
        ↓ fail

4. VOICE ERROR
```

Jangan mempunyai:

```text
CHIME_ONLY = SUCCESS
```

---

# 24. Test Harness

Paket technical improvement menyertakan dua harness:

```text
tests/audio/audio_engine_logic_harness.mjs
tests/audio/audio_engine_patch_harness.mjs
```

Tujuan:

### `audio_engine_logic_harness.mjs`

Mereproduksi failure mode engine saat ini:

```text
- false READY
- Web Speech unavailable dianggap success
- Web Speech error dianggap success
- timeout saat media masih playing
- announcement mulai saat UNLOCKING
```

### `audio_engine_patch_harness.mjs`

Memastikan patch tidak regresi:

```text
- media fail tidak menghasilkan READY
- Web Speech unavailable = failure
- Web Speech error = failure
- timeout dibersihkan ketika onplaying
- media dihentikan sebelum fallback
- blocked/unlocking queue tidak kehilangan job
```

---

# 25. Pengujian Perangkat Setelah Patch P0

Wajib tes pada:

```text
Laptop utama
Laptop teman
Android HP
Android tablet
iPhone
Smart TV
```

Tekan:

```text
TES AUDIO
```

Expected:

```text
♫ CHIME

Nomor antrean A nol nol satu.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

Hasil dicatat sebagai:

```text
PASS / FAIL
```

---

# 26. Device Test Result Minimal

Catat:

```text
Device:
OS:
Browser:
User Agent:
Viewport:

AudioContext:
Persistent Player:
Audio Ready Test:
Server MP3:
Web Speech:
Final Voice:
Error:
```

---

# 27. Acceptance Criteria P0

P0 dianggap selesai hanya jika:

```text
- GlobalAudioHost tersedia pada seluruh mode aplikasi.
- Tes Audio dari Kios tidak lagi mempunyai player null.
- testAudio menunggu unlock.
- Queue tidak memproses saat UNLOCKING.
- READY tidak bergantung pada AudioContext saja.
- Web Speech unavailable/error menghasilkan failure.
- CHIME_ONLY bukan success.
- MP3 start timeout dibatalkan saat onplaying.
- Fallback tidak overlap dengan media sebelumnya.
- Event panggilan tidak dianggap played sebelum voice selesai.
- Audio "KB" menyebut "Pelayanan Keluarga Berencana".
```

---

# 28. Acceptance Criteria Device

Minimal:

```text
Laptop utama       PASS
Laptop teman       PASS
Android HP         PASS
Android tablet     PASS
iPhone             PASS
Smart TV target    PASS
```

PASS berarti:

```text
chime terdengar
+
voice announcement terdengar lengkap
```

Bukan hanya chime.

---

# 29. Urutan Pekerjaan Developer

## Step 1
Implement:

```text
GlobalAudioHost
```

## Step 2
Refactor:

```text
unlockAudio()
testAudio()
```

menjadi async dan result-based.

## Step 3
Perbaiki:

```text
LOCKED / UNLOCKING / READY / BLOCKED
```

state transition.

## Step 4
Perbaiki Web Speech resolve/reject.

## Step 5
Perbaiki HTMLAudio timeout.

## Step 6
Ubah CHIME_ONLY menjadi failure.

## Step 7
Perbaiki processed/played call lifecycle.

## Step 8
Jalankan harness.

## Step 9
Deploy staging.

## Step 10
Test perangkat nyata.

## Step 11
Jika masih ada device gagal:
lanjutkan P1 WebAudio same-origin voice pipeline.

---

# 30. Final Target

Tidak boleh lagi terjadi:

```text
CHIME
↓
VOICE GAGAL
↓
ENGINE MENGANGGAP SUCCESS
```

Target:

```text
CHIME
↓
VOICE
↓
VOICE ENDED
↓
PLAYED
```

atau:

```text
CHIME
↓
VOICE PRIMARY FAILED
↓
LOCAL FALLBACK
↓
VOICE ENDED
↓
PLAYED
```

atau jika semua gagal:

```text
VOICE ERROR
↓
VISIBLE ERROR
↓
CALL TETAP DAPAT DIRETRY
```

**Silent failure tidak diperbolehkan.**
