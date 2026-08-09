# Antrian DPPKB Majene — Technical Improvement Pack

Dokumen ini merupakan paket arahan teknis bertahap untuk memperbaiki aplikasi antrean DPPKB Majene berdasarkan audit source code sebelumnya, dengan fokus utama pada:

1. **Reliabilitas audio panggilan** pada iPhone/iOS Safari dan berbagai Smart TV.
2. **TV Display responsif** untuk viewport yang tidak selalu 16:9.
3. **Reliabilitas lifecycle antrean** dan sinkronisasi Firestore.
4. **Offline/PWA resilience** untuk TV Display.
5. **Perapihan arsitektur kode**, testing, observability, dan rollout.

> **Scope penting:** autentikasi/RBAC tidak termasuk dalam paket pekerjaan ini.

Repository acuan:

```text
https://github.com/maroamabbarakka/Antrian-DPPKB-
```

## Prinsip implementasi

- Jangan hanya membuat solusi yang bekerja di Chrome desktop.
- Jangan menganggap semua Smart TV memakai browser modern.
- Jangan menganggap semua layar/viewport 16:9.
- Jangan membuang event panggilan jika audio gagal.
- Jangan menandai panggilan selesai sebelum playback benar-benar berhasil.
- Jangan membuat elemen audio baru untuk setiap panggilan.
- Jangan menggunakan singkatan `KB` sebagai teks suara.
- Gunakan **"Pelayanan Keluarga Berencana"** untuk seluruh audio/TTS terkait `serviceGroup === "KB"`.
- Perubahan business-critical antrean harus sebisa mungkin transactional.
- Semua failure penting harus terlihat, tercatat, dan dapat dipulihkan.


## Phase 0 — Hasil Pengujian Audio Aktual

**Kerjakan ini terlebih dahulu sebelum Phase 1.**

```text
08_AUDIO_TEST_FINDINGS_AND_DEV_PATCH.md
```

Dokumen ini berisi temuan dari rekaman iPhone dan test harness aktual, termasuk:

- persistent audio player hanya tersedia di TV Display,
- `testAudio()` tidak menunggu unlock,
- false `READY`,
- Web Speech error/unavailable dianggap sukses,
- `CHIME_ONLY` salah dianggap sukses,
- bug timeout MP3,
- rekomendasi `GlobalAudioHost`,
- rekomendasi same-origin/WebAudio sebagai Phase P1 bila P0 belum cukup.

Harness pengujian tersedia di:

```text
tests/audio/audio_engine_logic_harness.mjs
tests/audio/audio_engine_patch_harness.mjs
```


## Urutan pengerjaan

### Phase 1 — Audio Critical Fix
Kerjakan:

```text
01_AUDIO_ENGINE_AND_CALL_PLAYBACK.md
```

Target:
- Audio iPhone dan Smart TV lebih reliabel.
- Tidak ada silent failure.
- Event panggilan tidak hilang.

### Phase 2 — Responsive TV Display
Kerjakan:

```text
02_RESPONSIVE_TV_DISPLAY.md
```

Target:
- TV Display tidak dikunci ke layout 16:9.
- Mobile, tablet, Smart TV browser, fullscreen dan non-fullscreen tetap usable.

### Phase 3 — Queue & Firestore Reliability
Kerjakan:

```text
03_QUEUE_AND_FIRESTORE_RELIABILITY.md
```

Target:
- Lifecycle ticket lebih aman terhadap race condition.
- Recall, transfer, timestamp, ETA, dan event history lebih konsisten.

### Phase 4 — Offline/PWA
Kerjakan:

```text
04_OFFLINE_PWA_AND_MEDIA_RESILIENCE.md
```

Target:
- TV Display tidak kehilangan fungsi dasar ketika internet eksternal bermasalah.
- Audio dasar dan app shell dapat tersedia dari cache.

### Phase 5 — Code Architecture & Diagnostics
Kerjakan:

```text
05_CODE_ARCHITECTURE_AND_DIAGNOSTICS.md
```

Target:
- Business logic tidak tersebar/duplikat.
- Audio engine dan queue engine lebih mudah dirawat.

### Phase 6 — Testing & Rollout
Kerjakan:

```text
06_TESTING_ACCEPTANCE_AND_ROLLOUT.md
```

Target:
- Ada test matrix nyata untuk iPhone, Samsung TV, LG TV, Android TV dan desktop.
- Ada acceptance criteria yang jelas sebelum release.

### Device test template
Gunakan:

```text
07_DEVICE_COMPATIBILITY_TEMPLATE.md
```

---

## File yang kemungkinan paling banyak berubah

```text
src/services/ttsService.ts
src/context/QueueContext.tsx
src/components/TVDisplay/TVDisplayView.tsx
src/services/queueService.ts
public/sw.js
vite.config.ts
public/audio/*
```

Disarankan membuat struktur baru:

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

Jika server-generated TTS diterapkan:

```text
functions/
  src/
    queueTts.ts
```

---

## Definition of Done global

Paket perbaikan dianggap selesai jika:

```text
- Tidak ada missed call karena audio blocked/fail.
- Tidak ada overlapping announcement.
- Tidak ada duplicate playback saat reconnect/reload ringan.
- Tidak ada silent failure.
- TV Display tetap usable di portrait maupun landscape.
- Tidak ada horizontal scroll pada target viewport.
- Nomor antrean, loket, dan nama pelayanan tetap terlihat.
- "KB" tidak dibacakan sebagai singkatan.
- Untuk layanan KB, audio selalu menyebut "Pelayanan Keluarga Berencana".
- Lifecycle ticket utama memakai validasi/transaction yang lebih aman.
- PWA mempunyai fallback dasar.
- Build production lolos tanpa error TypeScript.
- Test perangkat nyata terdokumentasi.
```
