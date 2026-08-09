// AudioBufferStore.ts — Loader, Decoder, dan Cache AudioBuffer untuk Web Audio Engine
// Fetch berkas WAV lokal → ArrayBuffer → decodeAudioData → AudioBuffer cache
// Tidak ada ketergantungan pada remote TTS, speechSynthesis, atau HTMLAudioElement.

import { AudioAssetKey, AUDIO_MANIFEST } from './queueAudioManifest';

/** Timeout helper — semua operasi async harus punya batas waktu */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorCode: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorCode)), ms)
    )
  ]);
}

export interface LoadResult {
  key: string;
  success: boolean;
  error?: string;
}

class AudioBufferStore {
  /** Penyimpanan ArrayBuffer sebelum AudioContext tersedia (preload sebelum aktivasi) */
  private rawBuffers = new Map<string, ArrayBuffer>();
  /** Penyimpanan AudioBuffer yang sudah di-decode (siap diputar) */
  private decodedBuffers = new Map<string, AudioBuffer>();

  /** Validasi respon HTTP dan header magic byte RIFF/WAVE */
  private validateWavBuffer(key: string, response: Response, bytes: ArrayBuffer): void {
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (contentType.includes('text/html')) {
      throw new Error(`AUDIO_RECEIVED_HTML:${key}`);
    }

    const header = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
    const text = String.fromCharCode(...header);
    const isWav = text.slice(0, 4) === 'RIFF' && text.slice(8, 12) === 'WAVE';
    if (!isWav) {
      throw new Error(`INVALID_WAV_HEADER:${key}`);
    }
  }

  // ─── Preload (boleh sebelum AudioContext aktif) ────────────────────────

  /**
   * Fetch dan simpan ArrayBuffer TANPA decode.
   * Dapat dipanggil saat app startup sebelum user gesture.
   */
  async prefetch(key: string, url: string): Promise<void> {
    if (this.rawBuffers.has(key) || this.decodedBuffers.has(key)) return;

    const response = await withTimeout(
      fetch(url),
      5000,
      `FETCH_TIMEOUT:${key}`
    );

    if (!response.ok) {
      throw new Error(`AUDIO_HTTP_${response.status}:${key}`);
    }

    const bytes = await response.arrayBuffer();
    this.validateWavBuffer(key, response, bytes);
    this.rawBuffers.set(key, bytes);
  }

  // ─── Decode (butuh AudioContext aktif) ────────────────────────────────

  /**
   * Decode ArrayBuffer yang sudah di-prefetch menjadi AudioBuffer.
   * Harus dipanggil setelah AudioContext dalam state 'running'.
   */
  async decode(key: string, ctx: AudioContext): Promise<AudioBuffer> {
    if (this.decodedBuffers.has(key)) {
      return this.decodedBuffers.get(key)!;
    }

    let rawBuffer = this.rawBuffers.get(key);

    if (!rawBuffer) {
      // Jika belum di-prefetch, lakukan fetch + decode langsung
      const url = AUDIO_MANIFEST[key as Exclude<AudioAssetKey, 'pause.short'>];
      if (!url) throw new Error(`ASSET_KEY_NOT_FOUND:${key}`);

      const response = await withTimeout(
        fetch(url),
        5000,
        `FETCH_TIMEOUT:${key}`
      );
      if (!response.ok) {
        throw new Error(`AUDIO_HTTP_${response.status}:${key}`);
      }
      rawBuffer = await response.arrayBuffer();
      this.validateWavBuffer(key, response, rawBuffer);
    }

    // decodeAudioData membutuhkan salinan baru (slice(0)) agar thread-safe
    let decoded: AudioBuffer;
    try {
      decoded = await withTimeout(
        ctx.decodeAudioData(rawBuffer.slice(0)),
        5000,
        `DECODE_TIMEOUT:${key}`
      );
    } catch (err: any) {
      this.rawBuffers.delete(key);
      throw err;
    }

    this.decodedBuffers.set(key, decoded);
    this.rawBuffers.delete(key); // Bebaskan memori raw setelah decode

    return decoded;
  }

  // ─── Load (prefetch + decode sekaligus) ───────────────────────────────

  /**
   * Load, decode, dan cache satu asset.
   * Jika sudah ada di cache, langsung kembalikan.
   */
  async load(key: string, ctx: AudioContext): Promise<AudioBuffer> {
    if (this.decodedBuffers.has(key)) {
      return this.decodedBuffers.get(key)!;
    }
    return this.decode(key, ctx);
  }

  // ─── Load Multiple ────────────────────────────────────────────────────

  /**
   * Load beberapa asset sekaligus.
   * Mengembalikan array LoadResult (tidak throw pada kegagalan parsial).
   */
  async loadAll(keys: string[], ctx: AudioContext): Promise<LoadResult[]> {
    const results = await Promise.allSettled(
      keys.map(key => this.load(key, ctx))
    );

    return results.map((result, i) => ({
      key: keys[i],
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? (result.reason as Error)?.message : undefined
    }));
  }

  // ─── Get (dari cache — synchronous, jangan load) ─────────────────────

  get(key: string): AudioBuffer | undefined {
    return this.decodedBuffers.get(key);
  }

  has(key: string): boolean {
    return this.decodedBuffers.has(key);
  }

  /** Kunci yang belum ter-decode */
  getMissingKeys(keys: string[]): string[] {
    return keys.filter(k => !this.decodedBuffers.has(k));
  }

  getLoadedCount(): number {
    return this.decodedBuffers.size;
  }

  clear(): void {
    this.decodedBuffers.clear();
    this.rawBuffers.clear();
  }
}

/** Instance tunggal — dibagi seluruh engine */
export const audioBufferStore = new AudioBufferStore();
