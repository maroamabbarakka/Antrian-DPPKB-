# Phase 3 — Queue & Firestore Reliability

## Tujuan

Memperbaiki konsistensi data dan lifecycle antrean tanpa mengubah scope autentikasi.

Prioritas:
- transition lebih aman,
- timestamp authoritative,
- recall enforcement,
- transfer history,
- idempotency,
- ETA konsisten,
- event history.

---

# 1. Gunakan transaction untuk lifecycle penting

`callNextTicket()` sudah menggunakan transaction dan pola ini perlu diperluas.

Target operasi:

```text
startService
complete
noShow
transfer
cancel
recall
supervisor override
```

Gunakan helper:

```ts
transitionTicket(
  ticketId,
  expectedStatus,
  targetStatus,
  patch
)
```

Contoh:

```ts
await runTransaction(db, async tx => {
  const ref = doc(db, 'tickets', ticketId);

  const snap = await tx.get(ref);

  if (!snap.exists()) {
    throw new Error('Ticket not found');
  }

  const ticket = snap.data() as Ticket;

  if (ticket.status !== 'CALLED') {
    throw new Error(
      `Invalid transition ${ticket.status} -> SERVING`
    );
  }

  tx.update(ref, {
    status: 'SERVING',
    serviceStartedAtServer: serverTimestamp(),
    version: ticket.version + 1
  });
});
```

---

# 2. State machine

Definisikan allowed transitions eksplisit:

```text
WAITING -> CALLED
CALLED -> SERVING
CALLED -> NO_SHOW
CALLED -> WAITING        (recall/return sesuai SOP)
SERVING -> COMPLETED
SERVING -> TRANSFERRED
TRANSFERRED -> WAITING
WAITING -> CANCELED
```

Untuk override:
- tetap harus membuat event,
- jangan langsung menimpa status tanpa history.

---

# 3. Server timestamp

Jangan hanya bergantung pada:

```ts
Date.now()
```

untuk timestamp business-critical.

Gunakan:

```ts
serverTimestamp()
```

Field yang disarankan:

```text
createdAtServer
calledAtServer
serviceStartedAtServer
completedAtServer
updatedAtServer
```

Client time tetap boleh ada:

```text
clientCreatedAt
clientReceivedAt
```

untuk diagnostic latency.

---

# 4. Sequence ticket

Pertahankan transaction atomic untuk sequence.

Pastikan:
- sequence scoped per tanggal,
- per site jika nanti multi-site,
- per group jika memang numbering dipisahkan.

Sequence tidak boleh kembali menggunakan localStorage sebagai primary source.

---

# 5. Idempotency

Jika ticket mempunyai:

```text
idempotencyKey
```

maka key harus benar-benar dipakai.

Target:
- request issue-ticket dengan key yang sama tidak membuat ticket kedua.

Pattern:

```text
idempotency/{key}
```

atau simpan lookup pada ticket.

Transaction:
1. cek key,
2. jika sudah ada → return ticket existing,
3. jika belum → create ticket + claim key.

---

# 6. Recall limit

Jika SOP maksimal 2 recall:

```ts
if (ticket.callCount >= 2) {
  throw new Error(
    'Batas maksimum recall telah tercapai'
  );
}
```

Jangan hanya disable tombol UI.

Tambahkan event:

```text
RECALLED
```

dengan:
- callCount,
- timestamp,
- counterId.

---

# 7. Transfer history

Jangan langsung mengubah:

```text
serviceGroup -> newGroup
status -> WAITING
```

tanpa rekam history.

Simpan:

```ts
{
  transferFromGroup,
  transferToGroup,
  transferFromCounterId,
  transferToCounterId,
  transferReason,
  transferredAtServer
}
```

Lebih baik ada event:

```text
TRANSFERRED
```

---

# 8. Ticket events

Disarankan collection:

```text
tickets/{ticketId}/events/{eventId}
```

atau:

```text
ticketEvents/{eventId}
```

Event minimal:

```text
ISSUED
CALLED
RECALLED
SERVING
TRANSFERRED
COMPLETED
NO_SHOW
CANCELED
OVERRIDDEN
```

Isi:

```ts
{
  ticketId,
  type,
  fromStatus,
  toStatus,
  counterId,
  serviceGroup,
  timestampServer,
  metadata
}
```

---

# 9. Audio call event linkage

Setiap `callEvent` harus mempunyai:
- `ticketId`,
- `ticketCode`,
- `callCount`,
- `counterId`,
- `serviceGroup`,
- `timestampServer`,
- unique `eventId`.

Tujuan:
- recall tidak tercampur dengan call pertama,
- dedup audio bisa berdasarkan event, bukan ticket saja.

---

# 10. Unified ETA

Buat:

```text
src/services/queue/queueEstimation.ts
```

Jangan ada rumus berbeda di Kios dan TV.

Contoh:

```ts
calculateEstimatedWait({
  waitingCount,
  activeCounters,
  averageServiceMinutes
});
```

Versi awal:

```text
ETA =
waitingCount
× averageServiceMinutes
÷ max(activeCounters, 1)
```

Versi lanjutan:
- rolling average actual service time,
- per service,
- per jam/hari.

---

# 11. Priority queue

Current absolute priority perlu dipastikan sesuai SOP.

Jika dipertahankan:
- dokumentasikan.

Jika ingin fairness:
- pertimbangkan weighted priority.

Contoh:

```text
2 priority
3 regular
```

atau aging score:

```text
priorityScore =
basePriority
+
waitingTimeWeight
```

Jangan ubah policy tanpa persetujuan SOP.

---

# 12. Daily boundary / timezone

Pastikan seluruh logic tanggal menggunakan timezone operasional:

```text
Asia/Makassar
```

Jangan mengandalkan timezone browser jika device bisa salah konfigurasi.

Helper:

```text
getOperationalDate()
```

harus konsisten untuk:
- ticket date,
- sequence,
- report,
- daily query.

---

# 13. Historical reporting

Jika UI menyebut "lintas hari", jangan hanya memakai listener ticket hari aktif.

Buat query berdasarkan:
- startDate,
- endDate,
- service,
- counter,
- status.

Metric:
- issued,
- completed,
- no-show,
- canceled,
- average wait,
- average service duration,
- peak hour,
- priority percentage.

---

# 14. Acceptance Criteria Phase 3

```text
- Tidak ada transition status ilegal tanpa error.
- Dua client stale tidak dapat saling menimpa lifecycle secara diam-diam.
- Recall limit enforced di business logic.
- Transfer menghasilkan history.
- Timestamp authoritative tersedia.
- ETA Kios dan TV berasal dari service yang sama.
- Idempotency key benar-benar mencegah duplicate ticket.
- Sequence tetap atomic.
- Report lintas hari benar-benar query historical data.
```
