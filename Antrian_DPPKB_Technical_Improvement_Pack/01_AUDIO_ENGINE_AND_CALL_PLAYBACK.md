# Phase 1 — Audio Engine & Call Playback Reliability

## Tujuan

Memperbaiki masalah suara panggilan yang tidak muncul pada:

- iPhone / Safari iOS
- iPad / Safari
- Samsung Smart TV browser
- LG webOS browser
- Android TV browser
- Chrome/Edge desktop

Masalah utama saat ini bukan hanya "suara kadang tidak muncul", tetapi arsitektur audio belum menjamin bahwa:

1. browser sudah benar-benar mengizinkan playback bersuara,
2. elemen audio tetap hidup setelah user gesture,
3. event panggilan tidak dibuang ketika playback gagal,
4. fallback audio bekerja jika TTS utama gagal,
5. panggilan tidak overlap.

---

# 1. Arsitektur audio target

Gunakan alur:

```text
Firestore callEvent
        ↓
Queue Event Listener
        ↓
Audio Call Queue
        ↓
deduplicate / order
        ↓
QueueAudioEngine
        ↓
Persistent <audio>
        ↓
Primary audio source
        ↓
Fallback source
        ↓
Playback confirmed
        ↓
mark PLAYED
```

Fallback:

```text
1. Cached server-generated MP3
2. Local prerecorded audio
3. Web Speech API
```

Jangan menjadikan Web Speech API sebagai satu-satunya fallback.

---

# 2. Persistent audio element

## Masalah

Jangan membuat:

```ts
const audio = new Audio(url);
```

untuk setiap panggilan.

Pada Smart TV dan iOS, player baru yang dibuat beberapa detik setelah user gesture dapat kembali dianggap tidak memenuhi playback permission atau berperilaku tidak konsisten.

## Implementasi

Di `TVDisplayView.tsx`, buat satu elemen audio permanen:

```tsx
const queueAudioRef = useRef<HTMLAudioElement | null>(null);

return (
  <div className="tv-screen">
    <audio
      ref={queueAudioRef}
      preload="auto"
      style={{ display: 'none' }}
    />

    {/* existing display */}
  </div>
);
```

Bind ke engine:

```ts
useEffect(() => {
  if (queueAudioRef.current) {
    queueAudioEngine.bindPlayer(queueAudioRef.current);
  }
}, []);
```

Elemen ini:

```text
- dibuat sekali,
- tidak di-unmount selama TV Display aktif,
- dipakai ulang untuk semua announcement.
```

---

# 3. Buat QueueAudioEngine

Buat:

```text
src/services/audio/QueueAudioEngine.ts
```

Interface contoh:

```ts
type AudioEngineState =
  | 'LOCKED'
  | 'UNLOCKING'
  | 'READY'
  | 'FETCHING'
  | 'PLAYING'
  | 'BLOCKED'
  | 'NETWORK_ERROR'
  | 'PLAYBACK_ERROR';

type PlaybackResult = {
  success: boolean;
  source?: 'SERVER_MP3' | 'LOCAL_AUDIO' | 'WEB_SPEECH';
  error?: string;
};

class QueueAudioEngine {
  private player: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;

  bindPlayer(player: HTMLAudioElement) {
    this.player = player;
  }

  async unlockFromUserGesture(): Promise<boolean> {
    // implementasi
    return false;
  }

  async announceCall(job: AudioCallJob): Promise<PlaybackResult> {
    // implementasi
    return { success: false };
  }

  async recover(): Promise<void> {
    // implementasi
  }

  stop(): void {
    // implementasi
  }
}
```

---

# 4. Audio unlock harus benar-benar melakukan playback

## Jangan lakukan

```ts
audioContext.resume();
setIsAudioUnlocked(true);
```

tanpa actual media playback.

## Lakukan

Tambahkan:

```text
public/audio/audio-ready.mp3
```

Isi file:
- chime pendek,
- 200–600 ms,
- terdengar jelas,
- bukan file silent.

Ketika user menekan:

```text
AKTIFKAN SUARA & MULAI
```

jalankan langsung:

```ts
public unlockFromUserGesture(): Promise<boolean> {
  if (!this.player) {
    return Promise.resolve(false);
  }

  const player = this.player;

  player.src = '/audio/audio-ready.mp3';
  player.preload = 'auto';
  player.currentTime = 0;

  const mediaPlayPromise = player.play();

  let ctxPromise: Promise<void> = Promise.resolve();

  try {
    const Ctx =
      window.AudioContext ||
      (window as any).webkitAudioContext;

    if (Ctx) {
      if (!this.audioContext) {
        this.audioContext = new Ctx();
      }

      if (this.audioContext.state === 'suspended') {
        ctxPromise = this.audioContext.resume();
      }
    }
  } catch (error) {
    console.warn('[AUDIO] AudioContext unavailable', error);
  }

  return Promise.allSettled([
    mediaPlayPromise,
    ctxPromise
  ]).then(results => {
    const mediaOK = results[0].status === 'fulfilled';
    return mediaOK;
  });
}
```

Poin terpenting:

```ts
player.play()
```

dipanggil langsung dari click/touch/remote OK/ENTER.

---

# 5. Startup audio gate

Saat membuka:

```text
?view=tv
```

jangan menganggap audio langsung siap.

Tampilkan overlay:

```text
SISTEM ANTRIAN DPPKB

Audio panggilan belum aktif.

[ AKTIFKAN SUARA & MULAI ]

Tekan OK / ENTER pada remote
atau sentuh tombol pada layar.
```

Button:

```tsx
<button
  autoFocus
  tabIndex={0}
  onClick={activateAudio}
  onKeyDown={(event) => {
    if (event.key === 'Enter') {
      activateAudio();
    }
  }}
>
  AKTIFKAN SUARA & MULAI
</button>
```

Logic:

```ts
const ok = await queueAudioEngine.unlockFromUserGesture();

if (ok) {
  setAudioState('READY');
} else {
  setAudioState('BLOCKED');
}
```

Jika gagal:

```text
SUARA BELUM BERHASIL DIAKTIFKAN

Periksa volume TV lalu tekan ulang.

[ COBA LAGI ]
```

---

# 6. Pisahkan audio unlock dari fullscreen

Jangan jadikan satu fungsi:

```text
unlock audio + requestFullscreen
```

Buat terpisah:

```ts
activateAudio();
toggleFullscreen();
```

Alasan:
- fullscreen bisa gagal,
- API fullscreen berbeda antar browser,
- audio readiness tidak boleh bergantung pada fullscreen.

---

# 7. Handle NotAllowedError

Jika:

```ts
player.play()
```

reject dengan:

```text
NotAllowedError
```

maka:

```ts
audioState = 'BLOCKED';
```

Tampilkan:

```text
AUDIO TERKUNCI OLEH BROWSER

Tekan OK / sentuh layar untuk mengaktifkan kembali.
```

Panggilan yang gagal **jangan dihapus dari queue**.

Setelah user unlock:

```text
retry current failed call
```

---

# 8. Jangan mark event sebagai processed terlalu awal

Hindari pola:

```text
call diterima
↓
langsung masukkan ke processedCallIds
↓
baru mencoba audio
```

Gunakan:

```ts
seenCallIds
inFlightCallIds
playedCallIds
```

Flow:

```text
Firestore event
    ↓
seen
    ↓
queued
    ↓
inFlight
    ↓
audio success
    ↓
played
```

Jika playback gagal:

```text
seen
↓
queued / retry
↓
BLOCKED / ERROR
```

jangan masuk `playedCallIds`.

---

# 9. `announceCall()` harus return hasil

Jangan:

```ts
announceCall(...): void
```

Gunakan:

```ts
async announceCall(
  event: QueueCallEvent
): Promise<PlaybackResult>
```

Pemakaian:

```ts
const result =
  await queueAudioEngine.announceCall(event);

if (result.success) {
  markCallAsPlayed(event.id);
} else {
  markCallAsFailed(event.id, result.error);
}
```

---

# 10. Persistent player playback function

Contoh:

```ts
private playWithPersistentElement(
  src: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.player) {
      reject(new Error('Audio player belum terikat'));
      return;
    }

    const player = this.player;

    const cleanup = () => {
      clearTimeout(startTimeout);

      player.onplaying = null;
      player.onended = null;
      player.onerror = null;
      player.onstalled = null;
    };

    player.pause();
    player.src = src;
    player.preload = 'auto';
    player.currentTime = 0;

    player.onplaying = () => {
      console.info('[AUDIO] playback started');
    };

    player.onended = () => {
      cleanup();
      resolve();
    };

    player.onerror = () => {
      cleanup();

      reject(
        new Error(
          `HTMLAudio error: ${player.error?.code ?? 'unknown'}`
        )
      );
    };

    player.onstalled = () => {
      console.warn('[AUDIO] stalled', src);
    };

    const startTimeout = window.setTimeout(() => {
      cleanup();

      reject(
        new Error('Audio playback start timeout')
      );
    }, 12000);

    const promise = player.play();

    if (promise) {
      promise.catch(error => {
        cleanup();
        reject(error);
      });
    }
  });
}
```

Gunakan event browser sebagai indikator utama, bukan hanya `setTimeout`.

---

# 11. Audio call queue

Interface:

```ts
interface AudioCallJob {
  id: string;
  ticketCode: string;
  counterName: string;
  serviceTitle: string;
  serviceGroup: string;
  timestamp: number;
  retryCount: number;
}
```

State:

```text
IDLE
↓
FETCHING
↓
PLAYING
↓
DONE
↓
NEXT
```

Jika error:

```text
ERROR
↓
FALLBACK
↓
PLAYING
```

Jika blocked:

```text
BLOCKED
↓
WAIT USER ACTIVATION
↓
RETRY CURRENT JOB
```

Panggilan tidak boleh overlap.

---

# 12. Retry policy

Contoh:

```ts
const MAX_NETWORK_RETRY = 2;
const MAX_PLAYBACK_RETRY = 1;
```

Flow:

```text
Primary MP3
  attempt 1
      ↓ fail
  attempt 2
      ↓ fail
Local fallback
      ↓ fail
Web Speech
      ↓ fail
visible Audio Error
```

Tidak boleh infinite retry.

---

# 13. Penyebutan Pelayanan KB — WAJIB NAMA LENGKAP

## Rule

Untuk:

```ts
serviceGroup === 'KB'
```

audio/TTS **tidak boleh** membaca:

```text
Pelayanan KB
Pelayanan K B
KB
```

Audio harus menyebut:

```text
Pelayanan Keluarga Berencana
```

Contoh:

```text
Nomor antrean A nol dua tiga.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

## Centralized mapping

Buat:

```text
src/services/audio/queueAudioText.ts
```

Contoh:

```ts
export const SERVICE_SPEECH_LABELS: Record<string, string> = {
  KB: 'Pelayanan Keluarga Berencana',
  SK: 'Pelayanan Sekretariat'
};
```

Helper:

```ts
export function getServiceSpeechLabel(
  serviceGroup: string,
  serviceTitle?: string
): string {
  return (
    SERVICE_SPEECH_LABELS[serviceGroup] ||
    serviceTitle ||
    serviceGroup
  );
}
```

Pisahkan:

```ts
serviceGroup
serviceDisplayLabel
serviceSpeechLabel
```

Contoh:

```ts
{
  serviceGroup: 'KB',
  serviceDisplayLabel: 'Pelayanan KB',
  serviceSpeechLabel: 'Pelayanan Keluarga Berencana'
}
```

---

# 14. Ticket code speech formatter

Jangan menyerahkan string ticket mentah jika pronunciation bisa ambigu.

Buat formatter:

```ts
function buildSpokenTicketCode(code: string): string {
  // contoh A-023 -> A nol dua tiga
}
```

Lebih baik hasil:

```text
A nol dua tiga
```

daripada:

```text
A dua puluh tiga
```

jika SOP memang menginginkan digit-by-digit.

Pastikan aturan ini konsisten pada semua layanan.

---

# 15. Ganti remote Translate TTS sebagai primary source

Jangan menjadikan URL `translate_tts` sebagai basis production utama.

Target:

```text
TV
↓
same-origin queue TTS endpoint
↓
cached MP3
↓
persistent audio element
```

Endpoint contoh:

```text
/api/queue-tts
```

Input:

```ts
{
  ticketCode: 'A-023',
  counterName: 'Loket 1',
  serviceGroup: 'KB',
  serviceSpeechLabel: 'Pelayanan Keluarga Berencana'
}
```

Output:

```ts
{
  audioUrl: '/api/queue-audio/<hash>.mp3',
  cacheKey: '<hash>',
  durationMs: 7400
}
```

Gunakan `audio/mpeg`/MP3 sebagai format utama.

---

# 16. Cache server-generated TTS

Buat normalized text:

```text
Nomor antrean A nol dua tiga.
Silakan menuju Loket satu.
Pelayanan Keluarga Berencana.
```

Hash:

```text
hash(normalizedText + voiceVersion)
```

Cache:

```text
tts-cache/
  <hash>.mp3
```

Flow:

```text
request
↓
calculate hash
↓
cache exists?
├── yes → return
└── no
    ↓
  synthesize
    ↓
  save
    ↓
  return
```

---

# 17. Local prerecorded fallback

Tambahkan:

```text
public/audio/
  audio-ready.mp3
  call-chime.mp3
  nomor-antrean.mp3
  silakan-menuju.mp3
  pelayanan-keluarga-berencana.mp3
  pelayanan-sekretariat.mp3

  digits/
    0.mp3
    1.mp3
    ...
    9.mp3

  letters/
    a.mp3
    b.mp3

  counters/
    loket-1.mp3
    loket-2.mp3
    ...
```

Minimal fallback harus tetap bisa menghasilkan:

```text
Nomor antrean
+
A
+
nol dua tiga
+
silakan menuju
+
Loket satu
+
Pelayanan Keluarga Berencana
```

---

# 18. Web Speech hanya fallback terakhir

Jangan hanya cek:

```ts
'speechSynthesis' in window
```

dan langsung menganggap voice siap.

Gunakan `voiceschanged`.

Contoh:

```ts
async function loadVoices(
  timeoutMs = 1500
): Promise<SpeechSynthesisVoice[]> {

  const synth = window.speechSynthesis;
  let voices = synth.getVoices();

  if (voices.length > 0) {
    return voices;
  }

  return new Promise(resolve => {
    const timer = window.setTimeout(() => {
      resolve(synth.getVoices());
    }, timeoutMs);

    const handler = () => {
      const updated = synth.getVoices();

      if (updated.length > 0) {
        clearTimeout(timer);

        synth.removeEventListener(
          'voiceschanged',
          handler
        );

        resolve(updated);
      }
    };

    synth.addEventListener(
      'voiceschanged',
      handler
    );
  });
}
```

Jika voice list tetap kosong:
- jangan crash,
- lanjut ke visible error state.

---

# 19. Chime

Sediakan:

```text
public/audio/call-chime.mp3
```

Jangan hanya mengandalkan oscillator Web Audio.

Paling stabil:

```text
1 announcement = 1 final MP3
```

yang sudah berisi:

```text
[chime]
Nomor antrean...
```

Jika pipeline backend belum dapat menggabungkan, putar chime melalui persistent player/engine secara berurutan.

---

# 20. Background video audio ducking

Sebelum announcement:

```ts
beforeAnnouncement() {
  video.muted = true;
}
```

Setelah announcement:

```ts
afterAnnouncement() {
  video.muted = previousMutedState;
}
```

Untuk fase awal, rekomendasi:
- background media tetap muted,
- audio antrean selalu memiliki prioritas tertinggi.

---

# 21. Recovery setelah background / suspend

Tambahkan:

```ts
document.addEventListener(
  'visibilitychange',
  async () => {
    if (document.visibilityState === 'visible') {
      await queueAudioEngine.recover();
    }
  }
);

window.addEventListener(
  'pageshow',
  () => queueAudioEngine.recover()
);

window.addEventListener(
  'focus',
  () => queueAudioEngine.recover()
);
```

`recover()`:
- cek player,
- cek AudioContext,
- resume jika memungkinkan,
- jika gesture dibutuhkan lagi → state `BLOCKED`.

---

# 22. Session state

Simpan call ID terakhir yang sukses diputar:

```text
sessionStorage:
dppkb_tv_last_played_call
dppkb_tv_played_calls
```

Batas:
- 50–100 event terakhir.

Tujuan:
- mencegah duplicate playback saat reconnect/remount,
- tetapi jangan menyimpan event sebagai played sebelum `ended`.

---

# 23. Firestore bootstrap call event

Initial snapshot jangan langsung dianggap seluruhnya historical tanpa melihat umur event.

Gunakan threshold, misalnya:

```text
20 detik
```

Contoh:

```ts
const bootTime = Date.now();

snapshot.docs.forEach(docSnap => {
  const event = docSnap.data();

  const age =
    bootTime - Number(event.timestamp || 0);

  if (age <= 20_000) {
    enqueueCall(event);
  } else {
    markHistorical(event.id);
  }
});
```

Tujuan:
- TV reload tidak kehilangan panggilan yang baru terjadi beberapa detik sebelumnya.

---

# 24. Audio status indicator

Tambahkan indikator:

```text
● AUDIO READY
● AUDIO PLAYING
● AUDIO BLOCKED
● AUDIO OFFLINE FALLBACK
● AUDIO ERROR
```

Failure tidak boleh hanya terlihat di console.

---

# 25. Acceptance Criteria Phase 1

Wajib PASS:

```text
- Fresh-load iPhone Safari → unlock → audio test terdengar.
- Tunggu >30 detik → call baru tetap terdengar.
- Samsung Smart TV → remote OK dapat unlock.
- LG Smart TV → 20 call berturut-turut tidak silent.
- Call event gagal playback → tidak hilang.
- NotAllowedError → tampil BLOCKED + retry.
- Dua call berdekatan → tidak overlap.
- Recall → hanya satu playback per event recall.
- Remote TTS fail → local fallback.
- speechSynthesis unavailable → tidak crash.
- AudioContext unavailable → MP3 player tetap dicoba.
- Audio KB selalu menyebut "Pelayanan Keluarga Berencana".
```
