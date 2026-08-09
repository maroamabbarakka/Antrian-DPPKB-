# Phase 6 — Testing, Acceptance & Rollout

## Tujuan

Memastikan perubahan benar-benar bekerja pada perangkat lapangan, bukan hanya emulator browser desktop.

---

# 1. Device test matrix

Wajib uji:
- iPhone Safari
- iPad Safari jika tersedia
- Samsung Smart TV browser target
- LG webOS browser target
- Android TV browser
- Windows Chrome
- Android Chrome

---

# 2. Audio test cases

## A. Fresh load iPhone

```text
1. Buka ?view=tv
2. Startup audio gate tampil
3. Tap "AKTIFKAN SUARA & MULAI"
4. audio-ready terdengar
5. Tunggu 30–60 detik
6. Operator memanggil
7. announcement terdengar
```

Expected:
- tidak silent,
- tidak perlu reload.

## B. Background/foreground iPhone

```text
1. Audio sudah READY
2. Pindah app / lock sementara
3. Kembali Safari
4. Panggil ticket
```

Expected:
- terdengar,
- atau sistem menampilkan BLOCKED dan meminta unlock ulang.

## C. Samsung Smart TV

```text
1. Open TV Display
2. Remote focus ke activation button
3. Tekan OK
4. Test audio
5. Panggil 10–20 ticket
```

Expected:
- tidak silent,
- tidak overlap.

## D. LG webOS

Test:
- persistent audio element,
- 20 call berturut-turut,
- recall,
- network fail.

## E. Two calls close together

Expected:
- FIFO,
- audio tidak overlap.

## F. NotAllowedError

Simulasikan/trigger blocked state.

Expected:
- job tidak hilang,
- UI BLOCKED,
- retry setelah unlock.

## G. TTS endpoint fail

Expected:
- local fallback.

## H. speechSynthesis unavailable

Expected:
- tidak crash.

## I. KB speech

Input:

```text
serviceGroup = KB
```

Expected:

```text
Pelayanan Keluarga Berencana
```

Tidak boleh:

```text
Pelayanan KB
Pelayanan K B
```

---

# 3. Responsive test cases

Viewport:

```text
320 × 568
375 × 667
390 × 844
430 × 932
768 × 1024
820 × 1180
1024 × 768
1280 × 720
1366 × 768
1920 × 1080
2560 × 1440
2560 × 1080
3440 × 1440
```

Per viewport cek:

```text
- nomor antrean terlihat,
- loket terlihat,
- pelayanan terlihat,
- audio gate dapat dijangkau,
- tidak horizontal scroll,
- call overlay tidak crop,
- announcement tidak merusak layout.
```

---

# 4. Queue consistency tests

## Concurrent issue ticket
Jalankan 2+ request bersamaan.

Expected:
- nomor tidak collision.

## Concurrent call next
2 operator panggil pada waktu hampir sama.

Expected:
- tidak mengambil ticket sama.

## Stale update
Client A dan B membuka ticket sama.
B update dahulu.
A mencoba transition dari state lama.

Expected:
- transaction reject.

## Recall limit
Recall melebihi SOP.

Expected:
- reject.

## Transfer
Transfer service.

Expected:
- history tercatat.

---

# 5. Offline tests

```text
1. Load app sekali online.
2. Pastikan asset cached.
3. Putus internet.
4. Reload jika target PWA mendukung.
5. Jalankan local audio test.
```

Expected:
- app shell masih dapat tampil,
- local audio masih tersedia,
- TV tidak blank.

---

# 6. Build test

Wajib:

```bash
npm install
npm run build
```

Jika tersedia:

```bash
npm run lint
npm test
```

Target:
- zero TypeScript build errors.

---

# 7. Automated tests yang disarankan

## Service speech label

```ts
expect(
  getServiceSpeechLabel('KB')
).toBe(
  'Pelayanan Keluarga Berencana'
);
```

## Announcement text

```ts
const text = buildCallAnnouncement({
  ticketCode: 'A-023',
  counterName: 'Loket 1',
  serviceGroup: 'KB'
});

expect(text)
  .toContain('Pelayanan Keluarga Berencana');

expect(text)
  .not
  .toContain('Pelayanan KB');
```

## Queue transition

Test allowed/invalid transitions.

## ETA

Pastikan Kios dan TV memanggil service yang sama.

---

# 8. Rollout strategy

## Stage 1 — Development
- implement P0,
- test browser desktop,
- test iPhone.

## Stage 2 — Lab Smart TV
- Samsung,
- LG,
- Android TV.

## Stage 3 — Pilot device
Gunakan 1 TV aktual di kantor.

Pantau:
- audio errors,
- blocked state,
- missed calls,
- call delay,
- reconnect.

## Stage 4 — Full rollout
Setelah seluruh PASS.

---

# 9. Rollback

Sebelum deploy:
- tag release sebelumnya,
- simpan build terakhir yang stabil,
- dokumentasikan Firestore schema change.

Jika masalah:
- rollback hosting,
- jangan mengubah data existing secara destruktif.

---

# 10. Definition of Done

Release dianggap layak jika:

```text
AUDIO
- no silent failure
- no dropped calls
- no overlap
- retry works
- local fallback works
- KB speech full name

RESPONSIVE
- no horizontal scroll
- no critical crop
- portrait usable
- landscape usable
- TV/mobile usable

QUEUE
- invalid transition rejected
- recall enforced
- transfer history exists
- ETA unified

PWA
- base shell/audio fallback cached

QUALITY
- build pass
- device matrix documented
```
