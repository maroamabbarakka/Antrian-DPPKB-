# Phase 5 — Code Architecture & Diagnostics

## Tujuan

Mengurangi logic ganda, membuat error mudah dilacak, dan menyiapkan codebase untuk pemeliharaan jangka panjang.

---

# 1. Pisahkan QueueContext

Jika `QueueContext.tsx` menjadi terlalu besar, pindahkan business logic ke service.

Target:

```text
src/
  services/
    audio/
      QueueAudioEngine.ts
      queueAudioSources.ts
      queueAudioText.ts

    queue/
      queueRepository.ts
      queueTransitions.ts
      queueEstimation.ts
      queueEvents.ts
```

`QueueContext` fokus pada:
- subscribe state,
- expose actions,
- orchestration,
- React state.

---

# 2. Hapus duplicate issueTicket logic

Cari implementasi:
- Firestore transaction,
- localStorage sequence,
- alternative issueTicket.

Pilih satu source of truth.

Jangan sisakan legacy function yang dapat dipakai kembali secara tidak sengaja.

---

# 3. Centralized service labels

Buat satu source:

```ts
export const SERVICE_LABELS = {
  KB: {
    display: 'Pelayanan KB',
    speech: 'Pelayanan Keluarga Berencana'
  },

  SK: {
    display: 'Pelayanan Sekretariat',
    speech: 'Pelayanan Sekretariat'
  }
};
```

UI boleh memakai `display`.
Audio **wajib** memakai `speech`.

---

# 4. Structured audio logs

Gunakan:

```ts
console.info('[QUEUE-AUDIO]', {
  event: 'PLAY_STARTED',
  callId,
  source,
  timestamp: Date.now()
});
```

Event minimal:

```text
AUDIO_UNLOCK_REQUEST
AUDIO_UNLOCK_SUCCESS
AUDIO_UNLOCK_FAILED
CALL_RECEIVED
CALL_QUEUED
TTS_FETCH_START
TTS_FETCH_SUCCESS
TTS_FETCH_FAILED
PLAY_REQUEST
PLAY_STARTED
PLAY_ENDED
PLAY_BLOCKED
PLAY_ERROR
FALLBACK_STARTED
```

---

# 5. Debug audio mode

URL:

```text
?view=tv&debugAudio=1
```

Panel:

```text
AUDIO ENGINE DEBUG

Audio State       READY
Audio Element     AVAILABLE
MP3 Support       probably
AudioContext      running
Speech API        available
ID Voice          yes/no
Network           online
Last Call ID      ...
Last Source       SERVER_MP3
Start Delay       ...
Last Error        ...
```

Buttons:

```text
[ TEST CHIME ]
[ TEST PANGGILAN A-001 ]
[ RESET AUDIO ENGINE ]
```

Semua memakai engine production yang sama.

---

# 6. Debug viewport mode

Tambahkan optional:

```text
?debugLayout=1
```

Tampilkan:

```text
viewport width
viewport height
devicePixelRatio
orientation
fullscreen state
safe-area support
userAgent
```

Berguna saat debugging langsung di Smart TV.

---

# 7. Audio health state

State global:

```ts
type AudioHealth =
  | 'READY'
  | 'PLAYING'
  | 'BLOCKED'
  | 'FALLBACK'
  | 'ERROR';
```

UI harus menampilkan status.

---

# 8. Error boundary

Pastikan error media/audio tidak meruntuhkan seluruh TV Display.

Tambahkan boundary atau minimal isolasi error pada:
- media player,
- QR,
- TTS/audio,
- announcement renderer.

---

# 9. Vite build compatibility

Tentukan browser target eksplisit setelah mengetahui model TV target.

Contoh awal:

```ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2017'
  }
});
```

Jika device lama wajib didukung:
- evaluasi plugin legacy,
- test polyfill,
- jangan menebak.

---

# 10. Dependency compatibility

Setiap upgrade besar:
- React,
- Vite,
- Firebase SDK,

harus diuji pada target Smart TV.

Jangan hanya rely pada local Chrome.

---

# 11. Naming & modules

Gunakan istilah konsisten:

```text
CallEvent
AudioCallJob
TicketEvent
QueueTransition
ServiceSpeechLabel
```

Hindari satu object memiliki field dengan arti ganda.

---

# 12. Acceptance Criteria Phase 5

```text
- Tidak ada duplicate primary business logic.
- Audio text mapping terpusat.
- QueueContext lebih kecil/terstruktur.
- Debug audio tersedia.
- Debug viewport tersedia.
- Error media tidak crash seluruh TV.
- Browser build target terdokumentasi.
```
