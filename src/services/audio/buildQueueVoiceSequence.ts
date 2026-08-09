// buildQueueVoiceSequence.ts — Builder token sequence voice dari data tiket antrean
// Input: ticketCode, counterName, serviceGroup
// Output: AudioAssetKey[] token sequence yang siap diputar oleh engine
//
// ATURAN WAJIB (Dokumen 10 P0 #5 — Fail-Fast Parser):
// Throw error jika serviceGroup, counterName, atau ticketCode invalid!
// KB WAJIB selalu menggunakan token 'phrase.pelayananKB' = "Pelayanan Keluarga Berencana"

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
  if (!input.ticketCode || typeof input.ticketCode !== 'string') {
    throw new Error(`INVALID_TICKET_CODE:${input.ticketCode}`);
  }
  if (!input.counterName || typeof input.counterName !== 'string') {
    throw new Error(`INVALID_COUNTER_NAME:${input.counterName}`);
  }
  if (!input.serviceGroup || typeof input.serviceGroup !== 'string') {
    throw new Error(`UNSUPPORTED_SERVICE_GROUP:${input.serviceGroup}`);
  }

  const sequence: VoiceToken[] = [];

  // ─── Bagian 1: "Nomor antrean [HURUF] [DIGIT DIGIT DIGIT]" ──────────
  sequence.push('phrase.nomorAntrean');

  const { letterTokens, digitTokens } = parseTicketCode(input.ticketCode);
  sequence.push(...letterTokens);
  sequence.push(...digitTokens);

  sequence.push('pause.short');

  // ─── Bagian 2: "Silakan menuju Loket [ANGKA]" ────────────────────────
  // Note P0 Dokumen 10: 'phrase.silakanMenuju' adalah "Silakan menuju".
  // 'counter.loket' adalah "Loket". Kombinasi ini = "Silakan menuju Loket X".
  sequence.push('phrase.silakanMenuju');
  sequence.push('counter.loket');

  const counterNumber = parseCounterNumber(input.counterName);
  if (counterNumber < 1 || counterNumber > 10) {
    throw new Error(`INVALID_COUNTER_NUMBER:${counterNumber} (dari ${input.counterName})`);
  }
  sequence.push(`counter.${counterNumber}` as VoiceToken);

  sequence.push('pause.short');

  // ─── Bagian 3: Nama pelayanan (Fail-Fast) ───────────────────────────
  const serviceToken = resolveServiceToken(input.serviceGroup);
  sequence.push(serviceToken);

  return sequence;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse kode tiket menjadi huruf + digit.
 * Fail-fast jika format tiket tidak valid!
 */
function parseTicketCode(ticketCode: string): {
  letterTokens: VoiceToken[];
  digitTokens: VoiceToken[];
} {
  const cleanCode = ticketCode.trim();
  const parts = cleanCode.split('-');
  if (parts.length < 2) {
    throw new Error(`INVALID_TICKET_CODE_FORMAT:${ticketCode}`);
  }

  const letterPart = parts[0].toLowerCase();
  const numberPart = parts[1];

  const validLetters = ['a', 'b', 'c', 'd', 'e'];
  const letterTokens: VoiceToken[] = [];
  for (const char of letterPart) {
    if (!validLetters.includes(char)) {
      throw new Error(`UNSUPPORTED_TICKET_LETTER:${char} (dari ${ticketCode})`);
    }
    letterTokens.push(`letter.${char}` as VoiceToken);
  }

  const digitTokens: VoiceToken[] = [];
  for (const char of numberPart) {
    const digit = parseInt(char, 10);
    if (isNaN(digit) || digit < 0 || digit > 9) {
      throw new Error(`INVALID_TICKET_DIGIT:${char} (dari ${ticketCode})`);
    }
    digitTokens.push(`digit.${digit}` as VoiceToken);
  }

  return { letterTokens, digitTokens };
}

/**
 * Ekstrak nomor loket dari nama loket.
 * Fail-fast jika tidak ada angka loket!
 */
function parseCounterNumber(counterName: string): number {
  const match = counterName.match(/\d+/);
  if (!match) {
    throw new Error(`INVALID_COUNTER_NAME_NO_DIGITS:${counterName}`);
  }
  return parseInt(match[0], 10);
}

/**
 * Tentukan token layanan berdasarkan serviceGroup (Fail-Fast P0 Dokumen 10).
 * KB → 'phrase.pelayananKB' = "Pelayanan Keluarga Berencana"
 * SK → 'phrase.pelayananSK' = "Pelayanan Sekretariat"
 * Lainnya → Throw Error UNSUPPORTED_SERVICE_GROUP
 */
function resolveServiceToken(serviceGroup: string): VoiceToken {
  const group = serviceGroup.toUpperCase().trim();
  if (group === 'KB') return 'phrase.pelayananKB';
  if (group === 'SK') return 'phrase.pelayananSK';
  throw new Error(`UNSUPPORTED_SERVICE_GROUP:${serviceGroup}`);
}

/** Dapatkan semua key unik yang dibutuhkan untuk sequence ini */
export function getRequiredAssetKeys(sequence: VoiceToken[]): string[] {
  return [...new Set(sequence.filter(t => t !== 'pause.short'))];
}
