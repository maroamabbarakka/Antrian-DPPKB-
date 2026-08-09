// Layanan audio panggilan antrean.
// Prioritas utama: chime lokal + satu MP3 server-generated agar suara konsisten di Smart TV.

import { ServiceGroup } from '../types/queue';

class TTSService {
  private audioCtx: AudioContext | null = null;
  private speechQueue: Array<{ text: string; onComplete?: () => void }> = [];
  private isSpeaking = false;
  private activeAudio: HTMLAudioElement | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  private hasSpeechApi(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  private stopActiveSpeech(): void {
    try {
      if (this.activeAudio) {
        this.activeAudio.pause();
        this.activeAudio.src = '';
        this.activeAudio.load();
      }
    } catch {
      // noop
    }

    this.activeAudio = null;
    this.activeUtterance = null;

    if (this.hasSpeechApi()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // noop
      }
    }
  }

  private getServerGeneratedMp3Url(text: string): string {
    const params = new URLSearchParams({
      ie: 'UTF-8',
      client: 'tw-ob',
      tl: 'id',
      q: text
    });

    return `https://translate.google.com/translate_tts?${params.toString()}`;
  }

  private async playServerGeneratedMp3(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(this.getServerGeneratedMp3Url(text));
      let done = false;
      let started = false;
      this.activeAudio = audio;

      const finish = (error?: unknown) => {
        if (done) return;
        done = true;
        window.clearTimeout(startTimer);
        window.clearTimeout(finishTimer);
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.activeAudio === audio) this.activeAudio = null;
        if (error) reject(error);
        else resolve();
      };

      audio.preload = 'auto';
      audio.volume = 1;

      audio.onplaying = () => {
        started = true;
      };
      audio.onended = () => finish();
      audio.onerror = () => finish(new Error('Audio MP3 panggilan gagal dimuat/diputar.'));

      const startTimer = window.setTimeout(() => {
        if (!started) finish(new Error('Audio MP3 panggilan tidak mulai diputar.'));
      }, 4500);

      const finishTimer = window.setTimeout(() => {
        finish();
      }, Math.max(9000, Math.min(text.length * 135, 22000)));

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => finish(error));
      }
    });
  }

  private async speakWithBrowserTts(text: string): Promise<void> {
    if (!this.hasSpeechApi()) return;

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let done = false;
      let started = false;

      try {
        synth.cancel();
        synth.resume();
      } catch {
        // noop
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.84;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = synth.getVoices();
      const idVoice = voices.find((voice) => {
        const lang = voice.lang.toLowerCase().replace('_', '-');
        const name = voice.name.toLowerCase();
        return lang === 'id-id' || lang.startsWith('id') || name.includes('indonesia') || name.includes('bahasa');
      });

      if (idVoice) utterance.voice = idVoice;
      this.activeUtterance = utterance;

      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(startTimer);
        window.clearTimeout(finishTimer);
        this.activeUtterance = null;
        resolve();
      };

      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      const startTimer = window.setTimeout(() => {
        if (!started) {
          try {
            synth.cancel();
          } catch {
            // noop
          }
          finish();
        }
      }, 3500);

      const finishTimer = window.setTimeout(() => {
        try {
          synth.cancel();
        } catch {
          // noop
        }
        finish();
      }, Math.max(12000, text.length * 130));

      try {
        synth.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  public unlockAudio(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (this.hasSpeechApi()) {
        window.speechSynthesis.resume();
        window.speechSynthesis.getVoices();
      }
    } catch (e) {
      console.warn('Gagal membuka kunci audio:', e);
    }
  }

  public async playChime(): Promise<void> {
    try {
      this.unlockAudio();
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, offset: 0, duration: 0.45, gain: 0.3 },
        { freq: 659.25, offset: 0.18, duration: 0.47, gain: 0.35 },
        { freq: 783.99, offset: 0.36, duration: 0.49, gain: 0.4 },
        { freq: 1046.5, offset: 0.54, duration: 0.66, gain: 0.45 }
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + note.offset;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, start);
        gain.gain.setValueAtTime(note.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + note.duration);
      });

      return new Promise((resolve) => setTimeout(resolve, 1250));
    } catch (e) {
      console.warn('Gagal membunyikan chime audio:', e);
    }
  }

  public formatCodeSpoken(code: string): { letterSpoken: string; digitsSpoken: string; defaultServiceName: string; inferredGroup: ServiceGroup } {
    const [rawPrefix = '', rawNumber = ''] = code.split('-');
    const prefix = rawPrefix.toUpperCase();
    const inferredGroup: ServiceGroup = prefix === 'B' || prefix === 'SK' || prefix.startsWith('B') ? 'SK' : 'KB';
    const digitWords: Record<string, string> = {
      '0': 'nol',
      '1': 'satu',
      '2': 'dua',
      '3': 'tiga',
      '4': 'empat',
      '5': 'lima',
      '6': 'enam',
      '7': 'tujuh',
      '8': 'delapan',
      '9': 'sembilan'
    };

    return {
      letterSpoken: inferredGroup === 'SK' ? 'B' : 'A',
      digitsSpoken: rawNumber.split('').map((digit) => digitWords[digit] || digit).join(' '),
      defaultServiceName: inferredGroup === 'SK' ? 'Pelayanan Sekretariat' : 'Pelayanan Keluarga Berencana',
      inferredGroup
    };
  }

  private resolveServiceName(ticketCode: string, serviceTitle?: string, serviceGroup?: ServiceGroup): string {
    const { inferredGroup } = this.formatCodeSpoken(ticketCode);
    const title = (serviceTitle || '').toLowerCase();
    const resolvedGroup = serviceGroup || inferredGroup;

    if (resolvedGroup === 'SK') return 'Pelayanan Sekretariat';
    if (resolvedGroup === 'KB') return 'Pelayanan Keluarga Berencana';

    if (/sekretariat|sekretariatan|surat|administrasi|rekomendasi/.test(title)) {
      return 'Pelayanan Sekretariat';
    }

    return 'Pelayanan Keluarga Berencana';
  }

  public buildAnnouncementText(ticketCode: string, counterName: string, serviceTitle?: string, serviceGroup?: ServiceGroup): string {
    const { letterSpoken, digitsSpoken } = this.formatCodeSpoken(ticketCode);
    const cleanCounterName = counterName
      .replace(/,?\s*Pelayanan\s*(Keluarga\s*Berencana|Sekretariat|KB|SK).*/i, '')
      .replace(/\(.*\)/, '')
      .replace(/-\s*Pelayanan.*/i, '')
      .trim() || 'Loket 1';
    const serviceSpoken = this.resolveServiceName(ticketCode, serviceTitle, serviceGroup);

    return `Nomor antrean ${letterSpoken} ${digitsSpoken}. Silakan menuju ${cleanCounterName}. ${serviceSpoken}.`;
  }

  public announceCall(ticketCode: string, counterName: string, serviceTitle?: string, serviceGroup?: ServiceGroup, onComplete?: () => void): void {
    const text = this.buildAnnouncementText(ticketCode, counterName, serviceTitle, serviceGroup);
    this.speechQueue.push({ text, onComplete });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.speechQueue.length === 0) return;
    this.isSpeaking = true;

    const item = this.speechQueue.shift();
    if (!item) {
      this.isSpeaking = false;
      return;
    }

    this.stopActiveSpeech();

    try {
      await this.playChime();
      await new Promise((resolve) => setTimeout(resolve, 180));

      try {
        await this.playServerGeneratedMp3(item.text);
      } catch (mp3Error) {
        console.warn('MP3 server-generated gagal, memakai Web Speech fallback:', mp3Error);
        await this.speakWithBrowserTts(item.text);
      }
    } catch (error) {
      console.error('Gagal memproses panggilan suara:', error);
    } finally {
      this.isSpeaking = false;
      if (item.onComplete) item.onComplete();
      setTimeout(() => this.processQueue(), 450);
    }
  }

  public playTicketIssueChime(_code: string, _serviceTitle?: string): void {
    // Hening: kios tidak membunyikan panggilan saat mengambil tiket.
  }

  public testAudio(): void {
    this.unlockAudio();
    this.announceCall('A-001', 'Loket 1', 'Pelayanan Keluarga Berencana', 'KB');
  }
}

export const ttsService = new TTSService();
