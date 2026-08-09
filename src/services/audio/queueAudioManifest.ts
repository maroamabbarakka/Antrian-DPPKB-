// queueAudioManifest.ts — Daftar path terpusat semua voice asset lokal
// Semua voice dipanggil dari /audio/queue/ — tidak ada remote TTS runtime.
// KB WAJIB menggunakan: pelayanan-keluarga-berencana (bukan "KB" singkatan)
// Note: Chime dihasilkan 100% via Web Audio Oscillator (tidak ada chime.wav)

/** Kunci semua audio asset yang tersedia */
export type AudioAssetKey =
  // Frasa
  | 'phrase.nomorAntrean'
  | 'phrase.silakanMenuju'
  | 'phrase.pelayananKB'
  | 'phrase.pelayananSK'
  // Huruf tiket
  | 'letter.a'
  | 'letter.b'
  | 'letter.c'
  | 'letter.d'
  | 'letter.e'
  // Digit 0-9
  | 'digit.0' | 'digit.1' | 'digit.2' | 'digit.3' | 'digit.4'
  | 'digit.5' | 'digit.6' | 'digit.7' | 'digit.8' | 'digit.9'
  // Loket (kata "loket" + angka loket)
  | 'counter.loket'
  | 'counter.1' | 'counter.2' | 'counter.3' | 'counter.4' | 'counter.5'
  | 'counter.6' | 'counter.7' | 'counter.8' | 'counter.9' | 'counter.10'
  // Jeda
  | 'pause.short';

/** Pemetaan kunci ke URL path berkas lokal (sama-asal/same-origin) */
export const AUDIO_MANIFEST: Record<Exclude<AudioAssetKey, 'pause.short'>, string> = {
  // ─── Frasa Umum ─────────────────────────────────────────────────────────
  'phrase.nomorAntrean':  '/audio/queue/phrases/nomor-antrean.wav',
  'phrase.silakanMenuju': '/audio/queue/phrases/silakan-menuju.wav',
  /**
   * ATURAN WAJIB: KB selalu dibunyikan sebagai "Pelayanan Keluarga Berencana"
   * tidak boleh disingkat atau dibaca "KB" / "K B" / "Pelayanan KB"
   */
  'phrase.pelayananKB':   '/audio/queue/phrases/pelayanan-keluarga-berencana.wav',
  'phrase.pelayananSK':   '/audio/queue/phrases/pelayanan-sekretariat.wav',

  // ─── Huruf Kode Tiket ────────────────────────────────────────────────────
  'letter.a': '/audio/queue/letters/a.wav',
  'letter.b': '/audio/queue/letters/b.wav',
  'letter.c': '/audio/queue/letters/c.wav',
  'letter.d': '/audio/queue/letters/d.wav',
  'letter.e': '/audio/queue/letters/e.wav',

  // ─── Digit Nomor ─────────────────────────────────────────────────────────
  'digit.0': '/audio/queue/digits/nol.wav',
  'digit.1': '/audio/queue/digits/satu.wav',
  'digit.2': '/audio/queue/digits/dua.wav',
  'digit.3': '/audio/queue/digits/tiga.wav',
  'digit.4': '/audio/queue/digits/empat.wav',
  'digit.5': '/audio/queue/digits/lima.wav',
  'digit.6': '/audio/queue/digits/enam.wav',
  'digit.7': '/audio/queue/digits/tujuh.wav',
  'digit.8': '/audio/queue/digits/delapan.wav',
  'digit.9': '/audio/queue/digits/sembilan.wav',

  // ─── Nomor Loket ─────────────────────────────────────────────────────────
  'counter.loket': '/audio/queue/counters/loket.wav',
  'counter.1':     '/audio/queue/counters/satu.wav',
  'counter.2':     '/audio/queue/counters/dua.wav',
  'counter.3':     '/audio/queue/counters/tiga.wav',
  'counter.4':     '/audio/queue/counters/empat.wav',
  'counter.5':     '/audio/queue/counters/lima.wav',
  'counter.6':     '/audio/queue/counters/enam.wav',
  'counter.7':     '/audio/queue/counters/tujuh.wav',
  'counter.8':     '/audio/queue/counters/delapan.wav',
  'counter.9':     '/audio/queue/counters/sembilan.wav',
  'counter.10':    '/audio/queue/counters/sepuluh.wav',
};

/** Asset yang WAJIB berhasil di-load — jika ini gagal, engine jangan READY */
export const ESSENTIAL_ASSET_KEYS: Exclude<AudioAssetKey, 'pause.short'>[] = [
  'phrase.nomorAntrean',
  'phrase.silakanMenuju',
  'phrase.pelayananKB',
  'phrase.pelayananSK',
  'letter.a',
  'letter.b',
  'digit.0',
  'digit.1',
  'digit.2',
  'digit.3',
  'digit.4',
  'digit.5',
  'digit.6',
  'digit.7',
  'digit.8',
  'digit.9',
  'counter.loket',
  'counter.1',
  'counter.2',
  'counter.3',
];

/** Seluruh URL asset untuk di-cache oleh Service Worker */
export const ALL_AUDIO_ASSET_URLS: string[] = Object.values(AUDIO_MANIFEST);
