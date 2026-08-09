# Phase 2 — Responsive TV Display

## Tujuan

TV Display tidak boleh menganggap seluruh perangkat mempunyai rasio 16:9.

Target:
- Smart TV 16:9
- Smart TV dengan viewport browser yang berbeda dari resolusi panel
- Samsung Tizen browser
- LG webOS browser
- Android TV
- desktop
- tablet
- iPad
- iPhone portrait/landscape
- Android phone
- fullscreen
- non-fullscreen
- PWA standalone

Prinsip:

```text
Responsive reflow berdasarkan viewport
```

bukan:

```text
1920 × 1080
↓
scale seluruh canvas
```

---

# 1. Root layout

Gunakan:

```css
html,
body,
#root {
  width: 100%;
  min-height: 100%;
  margin: 0;
}

.tv-screen {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;

  overflow: hidden;

  display: flex;
  flex-direction: column;

  box-sizing: border-box;
}
```

Jangan hard-code:

```css
width: 1920px;
height: 1080px;
```

---

# 2. Viewport meta

Pastikan:

```html
<meta
  name="viewport"
  content="
    width=device-width,
    initial-scale=1,
    viewport-fit=cover
  "
/>
```

Hindari mematikan zoom user tanpa alasan kuat.

---

# 3. Safe area

Gunakan:

```css
.tv-screen {
  padding:
    max(12px, env(safe-area-inset-top))
    max(12px, env(safe-area-inset-right))
    max(12px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
}
```

---

# 4. Grid/flex sebagai struktur utama

Gunakan:

```css
.tv-main {
  flex: 1;

  display: grid;

  grid-template-columns:
    minmax(0, 1.6fr)
    minmax(260px, 0.7fr);

  gap: clamp(
    8px,
    1.5vw,
    24px
  );
}
```

Jangan mengandalkan absolute positioning untuk seluruh layout.

---

# 5. Breakpoint

Contoh:

```css
/* Phone */
@media (max-width: 599px) {
}

/* Compact / tablet */
@media (
  min-width: 600px
) and (
  max-width: 899px
) {
}

/* Desktop / TV */
@media (min-width: 900px) {
}

/* Very wide */
@media (
  min-width: 1600px
) and (
  min-aspect-ratio: 2/1
) {
}
```

Breakpoint adalah titik awal, harus disempurnakan lewat device test.

---

# 6. Orientation

Portrait:

```css
@media (orientation: portrait) {
  .tv-main {
    grid-template-columns: 1fr;
  }
}
```

Landscape TV/desktop:

```css
@media (
  orientation: landscape
) and (
  min-width: 900px
) {
  .tv-main {
    grid-template-columns:
      minmax(0, 1.6fr)
      minmax(260px, 0.7fr);
  }
}
```

---

# 7. Mobile content priority

Pada viewport kecil, urutan informasi:

```text
1. Nomor antrean yang dipanggil
2. Loket
3. Nama pelayanan
4. Status audio
5. Antrean berikutnya/terakhir
6. Pengumuman
7. Media sekunder
```

Jangan mengecilkan seluruh desktop layout hingga tidak terbaca.

Gunakan reflow.

---

# 8. Fluid typography

Contoh:

```css
.ticket-number {
  font-size: clamp(
    2.5rem,
    8vw,
    7rem
  );
}

.counter-name {
  font-size: clamp(
    1.25rem,
    3vw,
    3rem
  );
}

.service-title {
  font-size: clamp(
    0.9rem,
    1.8vw,
    1.8rem
  );
}
```

---

# 9. Aspect ratio hanya untuk media

Boleh:

```css
.media-player {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```

Tidak boleh:

```css
.tv-screen {
  aspect-ratio: 16 / 9;
}
```

TV Display mengikuti viewport.

---

# 10. Video behavior

Untuk informational media:

```css
.media-player video,
.media-player iframe {
  width: 100%;
  height: 100%;
}

.media-player video {
  object-fit: contain;
}
```

Gunakan `cover` hanya untuk decorative background.

Tambahkan:

```tsx
<video
  playsInline
  autoPlay
  muted={videoMuted}
/>
```

---

# 11. Compact landscape

Untuk device dengan tinggi kecil:

```css
@media (
  max-height: 600px
) and (
  orientation: landscape
) {
  .secondary-information {
    display: none;
  }

  .call-number {
    font-size: clamp(
      2.5rem,
      14vh,
      7rem
    );
  }
}
```

Utamakan informasi kritikal.

---

# 12. Very-wide layout

```css
@media (
  min-aspect-ratio: 21/9
) {
  .tv-main {
    max-width: none;

    grid-template-columns:
      minmax(0, 2fr)
      minmax(320px, 0.65fr);
  }
}
```

---

# 13. Responsive call overlay

```css
.call-overlay {
  position: fixed;
  inset: 0;

  display: grid;
  place-items: center;

  padding:
    max(16px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));

  z-index: 9999;
}
```

Card:

```css
.call-overlay-card {
  width: min(
    92vw,
    1100px
  );

  max-height: 90dvh;

  overflow: hidden;
}
```

Ticket:

```css
.call-overlay-ticket {
  font-size: clamp(
    3rem,
    12vw,
    10rem
  );

  line-height: 0.95;
}
```

---

# 14. Responsive audio startup gate

```css
.audio-startup-gate {
  position: fixed;
  inset: 0;

  width: 100%;

  min-height: 100vh;
  min-height: 100dvh;

  display: grid;
  place-items: center;

  padding: clamp(
    16px,
    4vw,
    48px
  );
}
```

Button:

```css
.audio-start-button {
  width: min(
    100%,
    520px
  );

  min-height: 56px;

  font-size: clamp(
    1rem,
    2.2vw,
    1.5rem
  );
}
```

Harus dapat diakses:
- touchscreen,
- mouse,
- keyboard,
- remote Smart TV.

---

# 15. Fullscreen bukan requirement

Responsive layout harus tetap benar saat:

```text
fullscreen = false
```

Fullscreen hanya enhancement.

---

# 16. ResizeObserver

Jika komponen membutuhkan ukuran JS:

```ts
useEffect(() => {
  const node = containerRef.current;

  if (!node) return;

  const observer =
    new ResizeObserver(entries => {
      const rect =
        entries[0].contentRect;

      setViewport({
        width: rect.width,
        height: rect.height
      });
    });

  observer.observe(node);

  return () => {
    observer.disconnect();
  };
}, []);
```

---

# 17. QR responsive

```css
.qr-code {
  width: clamp(
    90px,
    12vw,
    180px
  );

  aspect-ratio: 1;
}
```

Pada mobile:

```css
@media (max-width: 599px) {
  .qr-section {
    display: none;
  }
}
```

jika mengganggu informasi utama.

---

# 18. Announcement text

Desktop:

```css
.announcement-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
```

Mobile:

```css
@media (max-width: 599px) {
  .announcement-text {
    white-space: normal;
  }
}
```

---

# 19. Tidak boleh horizontal scroll

Acceptance:

```ts
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

pada target viewport.

---

# 20. Minimum viewport test

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

---

# 21. Acceptance Criteria Phase 2

PASS jika:

```text
- Tidak ada elemen penting terpotong.
- Tidak ada horizontal scrollbar.
- Nomor antrean selalu terbaca.
- Loket selalu terlihat.
- Nama pelayanan selalu terlihat.
- Audio activation button selalu dapat dijangkau.
- Call overlay selalu masuk viewport.
- Portrait usable.
- Landscape usable.
- Fullscreen dan non-fullscreen usable.
- Smart TV browser tidak membutuhkan layout khusus 16:9.
- Mobile tidak hanya menampilkan versi desktop yang diperkecil.
```
