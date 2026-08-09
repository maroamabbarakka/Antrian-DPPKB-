// Layanan adapter audio antrean kompatibilitas tinggi.
// Mengarahkan ke QueueAudioEngine terpusat untuk keandalan audio di Smart TV & iOS.

import { queueAudioEngine } from './audio/QueueAudioEngine';
import { buildAnnouncementText, formatCodeSpoken, getServiceSpeechLabel } from './audio/queueAudioText';
import { ServiceGroup } from '../types/queue';

class TTSService {
  public unlockAudio(): void {
    queueAudioEngine.unlockFromUserGesture();
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
    // Hening di kios
  }

  public testAudio(): void {
    this.unlockAudio();
    this.announceCall('A-001', 'Loket 1', 'Pelayanan Keluarga Berencana', 'KB');
  }
}

export const ttsService = new TTSService();
