// ttsService.ts — Adapter Audio Antrean (High Compatibility)
// Menggunakan QueueAudioEngine — Web Audio + Local Voice Assets.
// TIDAK ADA translate_tts runtime, speechSynthesis production.

import { queueAudioEngine, AudioTestResult } from './audio/QueueAudioEngine';
import { ServiceGroup } from '../types/queue';

/** Hasil unlock gagal sebagai AudioTestResult */
function audioUnlockFailedResult(detailError?: string): AudioTestResult {
  const err = detailError ? `AUDIO_UNLOCK_FAILED:${detailError}` : 'AUDIO_UNLOCK_FAILED';
  return {
    success: false,
    durationMs: 0,
    steps: {
      context: { success: false, error: err },
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

  /**
   * Antreankan panggilan untuk diputar oleh engine.
   * Dokumen 10 P0 #8: Teruskan `callId` asli dari Firestore call event!
   */
  announceCall(
    ticketCode: string,
    counterName: string,
    serviceTitle?: string,
    serviceGroup?: ServiceGroup,
    onComplete?: () => void,
    callId?: string,
    onError?: (err: string) => void
  ): void {
    const finalCallId = callId || `${ticketCode}-${counterName}-${Date.now()}`;
    queueAudioEngine.queueCall({
      id: finalCallId,
      ticketCode,
      counterName,
      serviceTitle: serviceTitle || 'Pelayanan',
      serviceGroup: serviceGroup || (ticketCode.startsWith('B-') ? 'SK' : 'KB'),
      timestamp: Date.now(),
      onComplete,
      onError
    });
  }

  /** Tidak ada suara saat pengambilan tiket di kios */
  playTicketIssueChime(_code: string, _serviceTitle?: string): void {}

  /**
   * Tes audio terstruktur — mengembalikan AudioTestResult lengkap (5 langkah).
   * Cek hasil unlock sebelum testCallFull().
   */
  async testAudio(): Promise<AudioTestResult> {
    const unlocked = await queueAudioEngine.unlockFromUserGesture();
    if (!unlocked) {
      return audioUnlockFailedResult(queueAudioEngine.getLastError() || undefined);
    }
    return queueAudioEngine.testCallFull();
  }
}

export const ttsService = new TTSService();
