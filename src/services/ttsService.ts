// ttsService.ts — Adapter Audio Antrean (High Compatibility)
// Mengarahkan ke QueueAudioEngine terpusat untuk keandalan audio di Smart TV & iOS.

import { queueAudioEngine, AudioTestResult } from './audio/QueueAudioEngine';
import { buildAnnouncementText, formatCodeSpoken, getServiceSpeechLabel } from './audio/queueAudioText';
import { ServiceGroup } from '../types/queue';

class TTSService {
  /**
   * Buka kunci audio dari User Gesture — async, menunggu konfirmasi
   * persistent player benar-benar berhasil memutar.
   */
  public async unlockAudio(): Promise<boolean> {
    return queueAudioEngine.unlockFromUserGesture();
  }

  public async playChime(): Promise<void> {
    return queueAudioEngine.playChime();
  }

  public formatCodeSpoken(code: string) {
    const info = formatCodeSpoken(code);
    return {
      letterSpoken: info.letterSpoken,
      digitsSpoken: info.digitsSpoken,
      defaultServiceName: getServiceSpeechLabel(info.inferredGroup),
      inferredGroup: info.inferredGroup as ServiceGroup
    };
  }

  public buildAnnouncementText(
    ticketCode: string,
    counterName: string,
    serviceTitle?: string,
    serviceGroup?: ServiceGroup
  ): string {
    return buildAnnouncementText(ticketCode, counterName, serviceTitle, serviceGroup);
  }

  public announceCall(
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

  public playTicketIssueChime(_code: string, _serviceTitle?: string): void {
    // Hening di kios — tidak ada suara saat pengambilan tiket
  }

  /**
   * Tes audio terstruktur — mengembalikan AudioTestResult lengkap.
   * Tombol "Tes Audio" di Navbar memanggil ini dan menampilkan hasilnya.
   * CHIME saja tanpa VOICE adalah GAGAL.
   */
  public async testAudio(): Promise<AudioTestResult> {
    // Pastikan audio terbuka dulu dari user gesture
    await queueAudioEngine.unlockFromUserGesture();
    return queueAudioEngine.testCallFull();
  }
}

export const ttsService = new TTSService();
