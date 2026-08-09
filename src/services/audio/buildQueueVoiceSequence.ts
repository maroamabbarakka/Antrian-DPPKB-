// buildQueueVoiceSequence.ts — Builder token sequence voice dari data tiket antrean
// Input: ticketCode, counterName, serviceGroup
// Output: AudioAssetKey[] token sequence yang siap diputar oleh engine
//
// ATURAN WAJIB: KB harus selalu menggunakan token 'phrase.pelayananKB'
// yang berbunyikan "Pelayanan Keluarga Berencana" — TIDAK PERNAH singkatan.

import { AudioAssetKey } from './queueAudioManifest';

export type VoiceToken = AudioAssetKey;

export interface VoiceSequenceInput {
  ticketCode: string;   // misal: "A-001", "B-012"
  counterName: string;  // misal: "Loket 1", "Loket 3"
  serviceGroup: string; // misal: "KB", "SK"
}

/**
 * Bangun sequence token audio untuk satu panggilan antrean.
 *
 * Contoh A-001 / Loket 1 / KB menghasilkan:
 * [
 *   'phrase.nomorAntrean',
 *   'letter.a', 'digit.0', 'digit.0', 'digit.1',
 *   'pause.short',
 *   'phrase.silakanMenuju', 'counter.loket', 'counter.1',
 *   'pause.short',
 *   'phrase.pelayananKB'
 * ]
 *
 * Hasilnya terdengar: "Nomor antrean A nol nol satu. Silakan menuju Loket satu.
 * Pelayanan Keluarga Berencana."
 */
export function buildQueueVoiceSequence(
  input: VoiceSequenceInput
): VoiceToken[] {
  const sequence: VoiceToken[] = [];

  // ─── Bagian 1: "Nomor antrean [HURUF] [DIGIT DIGIT DIGIT]" ──────────
  sequence.push('phrase.nomorAntrean');

  const { letterTokens, digitTokens } = parseTicketCode(input.ticketCode);
  sequence.push(...letterTokens);
  sequence.push(...digitTokens);

  sequence.push('pause.short');

  // ─── Bagian 2: "Silakan menuju Loket [ANGKA]" ────────────────────────
  sequence.push('phrase.silakanMenuju');
  sequence.push('counter.loket');

  const counterNumber = parseCounterNumber(input.counterName);
  if (counterNumber >= 1 && counterNumber <= 10) {
    sequence.push(`counter.${counterNumber}` as VoiceToken);
  }

  sequence.push('pause.short');

  // ─── Bagian 3: Nama layanan ───────────────────────────────────────────
  const serviceToken = resolveServiceToken(input.serviceGroup);
  sequence.push(serviceToken);

  return sequence;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse kode tiket menjadi huruf + digit.
 * "A-001" → letters: ['letter.a'], digits: ['digit.0', 'digit.0', 'digit.1']
 * "B-012" → letters: ['letter.b'], digits: ['digit.0', 'digit.1', 'digit.2']
 */
function parseTicketCode(ticketCode: string): {
  letterTokens: VoiceToken[];
  digitTokens: VoiceToken[];
} {
  const parts = ticketCode.split('-');
  const letterPart = (parts[0] || 'A').toLowerCase();
  const numberPart = parts[1] || '001';

  const letterTokens: VoiceToken[] = [];
  for (const char of letterPart) {
    const key = `letter.${char}` as VoiceToken;
    letterTokens.push(key);
  }

  const digitTokens: VoiceToken[] = [];
  for (const char of numberPart) {
    const digit = parseInt(char, 10);
    if (!isNaN(digit)) {
      digitTokens.push(`digit.${digit}` as VoiceToken);
    }
  }

  return { letterTokens, digitTokens };
}

/**
 * Ekstrak nomor loket dari nama loket.
 * "Loket 1" → 1, "Loket 10" → 10
 */
function parseCounterNumber(counterName: string): number {
  const match = counterName.match(/\d+/);
  if (!match) return 1;
  return parseInt(match[0], 10);
}

/**
 * Tentukan token layanan berdasarkan serviceGroup.
 *
 * KB → 'phrase.pelayananKB' = "Pelayanan Keluarga Berencana"
 * SK → 'phrase.pelayananSK' = "Pelayanan Sekretariat"
 * Default → 'phrase.pelayananSK' (fallback aman)
 *
 * WAJIB: Tidak ada kode yang menghasilkan teks singkatan "KB" dalam speech path.
 */
function resolveServiceToken(serviceGroup: string): VoiceToken {
  const group = serviceGroup.toUpperCase();
  if (group === 'KB') return 'phrase.pelayananKB';
  if (group === 'SK') return 'phrase.pelayananSK';
  // Fallback aman — lebih baik sebut SK daripada diam
  return 'phrase.pelayananSK';
}

/** Dapatkan semua key unik yang dibutuhkan untuk sequence ini (untuk preload) */
export function getRequiredAssetKeys(sequence: VoiceToken[]): string[] {
  return [...new Set(sequence.filter(t => t !== 'pause.short'))];
}
