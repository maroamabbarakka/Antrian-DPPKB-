// queueAudioSources.ts — VoiceSource Interface & URL Helper untuk QueueAudioEngine
// Memisahkan logika pembuatan URL sumber audio dari engine agar mudah diganti.
// P1 target: same-origin cached TTS endpoint dan Web Audio pipeline.

export type VoiceSourceType = 'SERVER_MP3' | 'LOCAL_AUDIO' | 'WEB_SPEECH';

export interface VoiceSource {
  type: VoiceSourceType;
  /** URL sumber audio (untuk SERVER_MP3 dan LOCAL_AUDIO) */
  url?: string;
  /** Teks untuk Web Speech API */
  text?: string;
}

// ─── Google TTS (P0 — sementara, bukan final production) ─────────────────────

/**
 * Menghasilkan URL Google Translate TTS untuk teks pengumuman.
 * Ini sumber P0 sementara — P1 akan diganti dengan same-origin endpoint.
 * @deprecated Ganti dengan same-origin TTS endpoint saat P1 dikerjakan.
 */
export function buildGoogleTtsUrl(text: string): string {
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: 'id',
    q: text
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

// ─── Local Prerecorded Audio Paths ────────────────────────────────────────────

/**
 * Daftar path berkas audio pre-recorded untuk frasa umum.
 * Digunakan sebagai fallback lokal (P1 — Local Prerecorded Fallback).
 * Berkas diletakkan di public/audio/voice/.
 */
export const LOCAL_VOICE_PATHS = {
  // Frasa umum
  nomorAntrean: '/audio/voice/nomor-antrean.mp3',
  silakaMenuju: '/audio/voice/silakan-menuju.mp3',

  // Nama layanan
  pelayananKeluargaBerencana: '/audio/voice/pelayanan-keluarga-berencana.mp3',
  pelayananSekretariat: '/audio/voice/pelayanan-sekretariat.mp3',

  // Angka (0-9)
  digits: {
    '0': '/audio/voice/digits/nol.mp3',
    '1': '/audio/voice/digits/satu.mp3',
    '2': '/audio/voice/digits/dua.mp3',
    '3': '/audio/voice/digits/tiga.mp3',
    '4': '/audio/voice/digits/empat.mp3',
    '5': '/audio/voice/digits/lima.mp3',
    '6': '/audio/voice/digits/enam.mp3',
    '7': '/audio/voice/digits/tujuh.mp3',
    '8': '/audio/voice/digits/delapan.mp3',
    '9': '/audio/voice/digits/sembilan.mp3',
  } as Record<string, string>,

  // Huruf kode tiket
  letters: {
    'a': '/audio/voice/letters/a.mp3',
    'b': '/audio/voice/letters/b.mp3',
    'c': '/audio/voice/letters/c.mp3',
    'd': '/audio/voice/letters/d.mp3',
    'e': '/audio/voice/letters/e.mp3',
  } as Record<string, string>,

  // Nomor loket
  counters: {
    '1': '/audio/voice/counters/loket-1.mp3',
    '2': '/audio/voice/counters/loket-2.mp3',
    '3': '/audio/voice/counters/loket-3.mp3',
    '4': '/audio/voice/counters/loket-4.mp3',
    '5': '/audio/voice/counters/loket-5.mp3',
  } as Record<string, string>,
} as const;

// ─── Source Priority Chain ────────────────────────────────────────────────────

/**
 * Membangun daftar sumber audio dalam urutan prioritas fallback.
 * 
 * Urutan: SERVER_MP3 (Google TTS) → WEB_SPEECH
 * Saat P1 selesai, tambahkan LOCAL_AUDIO di antara keduanya.
 */
export function buildVoiceSourceChain(text: string): VoiceSource[] {
  return [
    {
      type: 'SERVER_MP3',
      url: buildGoogleTtsUrl(text),
    },
    // TODO P1: Tambahkan LOCAL_AUDIO pipeline di sini setelah berkas pre-recorded tersedia
    {
      type: 'WEB_SPEECH',
      text,
    },
  ];
}
