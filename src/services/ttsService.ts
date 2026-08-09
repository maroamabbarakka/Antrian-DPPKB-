// ttsService.ts — Adapter Audio Antrean (High Compatibility)
// Menggunakan QueueAudioEngine — Web Audio + Local Voice Assets.
// TIDAK ADA translate_tts runtime, speechSynthesis production.

import { queueAudioEngine, AudioTestResult } from './audio/QueueAudioEngine';
import { ServiceGroup } from '../types/queue';

/** Hasil unlock gagal sebagai AudioTestResult */
function audioUnlockFailedResult(): AudioTestResult {
  return {
    success: false,
    durationMs: 0,
    steps: {
      context: { success: false, error: 'AUDIO_UNLOCK_FAILED' },
      assets:  { success: false },
      decode:  { success: false },
      chime:   { success: false },
      voice:   { success: false }
    }
  };
}

class TTSService {
  /**
   * Buka kunci audio dari User Gesture.
   * Mengembalikan true jika AudioContext running dan essential buffers siap.
   */
  async unlockAudio(): Promise<boolean> {
    return queueAudioEngine.unlockFromUserGesture();
  }

  async playChime(): Promise<void> {
    return queueAudioEngine.playChime();
  }

  /** Antreankan panggilan untuk diputar oleh engine */
  announceCall(
    ticketCode: string,
    counterName: string,
    serviceTitle?: string,
    serviceGroup?: ServiceGroup,
    onComplete?: () => void
  ): void {
    queueAudioEngine.queueCall({
      id: `${ticketCode}-${counterName}-${Date.now()}`,
      ticketCode,
      counterName,
      serviceTitle: serviceTitle || 'Pelayanan',
      serviceGroup: serviceGroup || (ticketCode.startsWith('B-') ? 'SK' : 'KB'),
      timestamp: Date.now(),
      onComplete
    });
  }

  /** Tidak ada suara saat pengambilan tiket di kios */
  playTicketIssueChime(_code: string, _serviceTitle?: string): void {}

  /**
   * Tes audio terstruktur — mengembalikan AudioTestResult lengkap (5 langkah).
   * Section 37.1: wajib cek hasil unlock sebelum testCallFull().
   */
  async testAudio(): Promise<AudioTestResult> {
    const unlocked = await queueAudioEngine.unlockFromUserGesture();
    if (!unlocked) {
      return audioUnlockFailedResult();
    }
    return queueAudioEngine.testCallFull();
  }
}

export const ttsService = new TTSService();
