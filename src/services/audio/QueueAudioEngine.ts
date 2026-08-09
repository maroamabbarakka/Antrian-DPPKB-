// QueueAudioEngine.ts — Engine Panggilan Audio Terpusat & Reliabel untuk Antrean DPPKB Majene
// Mendukung Persistent HTMLAudioElement, User Gesture Unlock Gate, Retry Queue & Multi-Tier Fallback

import {
  buildAnnouncementText,
  getServiceSpeechLabel
} from './queueAudioText';

export type AudioEngineState =
  | 'LOCKED'
  | 'UNLOCKING'
  | 'READY'
  | 'PLAYING'
  | 'BLOCKED'
  | 'ERROR';

export interface AudioCallJob {
  id: string;
  ticketCode: string;
  counterName: string;
  serviceTitle: string;
  serviceGroup: string;
  timestamp: number;
  retryCount?: number;
  onComplete?: () => void;
}

export interface PlaybackResult {
  success: boolean;
  source?: 'SERVER_MP3' | 'WEB_SPEECH' | 'CHIME_ONLY';
  error?: string;
}

type EngineStateListener = (state: AudioEngineState, currentJob?: AudioCallJob | null) => void;

class QueueAudioEngine {
  private player: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private state: AudioEngineState = 'LOCKED';

  private jobQueue: AudioCallJob[] = [];
  private currentJob: AudioCallJob | null = null;
  private isProcessing = false;

  private seenCallIds = new Set<string>();
  private playedCallIds = new Set<string>();
  private inFlightCallIds = new Set<string>();

  private listeners = new Set<EngineStateListener>();

  constructor() {
    // Cek apakah browser pernah mengizinkan audio sebelumnya
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  public bindPlayer(player: HTMLAudioElement): void {
    this.player = player;
    this.player.preload = 'auto';
    this.player.volume = 1.0;
  }

  public getState(): AudioEngineState {
    return this.state;
  }

  public subscribeState(listener: EngineStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.currentJob);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(newState: AudioEngineState): void {
    this.state = newState;
    this.listeners.forEach(fn => fn(this.state, this.currentJob));
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Buka kunci audio dari User Gesture (Klik / Touch / Remote Enter)
   * Memutar /audio/audio-ready.mp3 asli di persistent audio element
   */
  public async unlockFromUserGesture(): Promise<boolean> {
    this.updateState('UNLOCKING');

    let mediaSuccess = false;
    let audioCtxSuccess = false;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxSuccess = ctx.state === 'running';
    } catch (err) {
      console.warn('[QueueAudioEngine] AudioContext resume failed:', err);
    }

    if (this.player) {
      try {
        this.player.pause();
        this.player.src = '/audio/audio-ready.mp3';
        this.player.currentTime = 0;
        await this.player.play();
        mediaSuccess = true;
      } catch (mediaErr: any) {
        console.warn('[QueueAudioEngine] Persistent player unlock failed:', mediaErr);
        if (mediaErr?.name === 'NotAllowedError') {
          this.updateState('BLOCKED');
          return false;
        }
      }
    }

    if (mediaSuccess || audioCtxSuccess) {
      this.updateState('READY');

      // Jika ada job yang tertunda di antrean karena autolock sebelumnya, proses sekarang!
      this.processQueue();
      return true;
    }

    this.updateState('BLOCKED');
    return false;
  }

  /**
   * Menambahkan job panggilan baru ke antrean
   */
  public queueCall(job: AudioCallJob): void {
    if (this.seenCallIds.has(job.id) || this.playedCallIds.has(job.id)) {
      return;
    }

    this.seenCallIds.add(job.id);
    this.jobQueue.push(job);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.jobQueue.length === 0) {
      if (this.state === 'PLAYING') {
        this.updateState('READY');
      }
      return;
    }

    this.isProcessing = true;
    const job = this.jobQueue.shift()!;
    this.currentJob = job;
    this.inFlightCallIds.add(job.id);

    if (this.state === 'LOCKED' || this.state === 'BLOCKED') {
      console.warn('[QueueAudioEngine] Audio engine locked/blocked. Menahan panggilan:', job.ticketCode);
      // Kembalikan job ke urutan depan antrean agar tidak hilang
      this.jobQueue.unshift(job);
      this.inFlightCallIds.delete(job.id);
      this.isProcessing = false;
      return;
    }

    this.updateState('PLAYING');

    const result = await this.executeCallJob(job);

    this.inFlightCallIds.delete(job.id);

    if (result.success) {
      this.playedCallIds.add(job.id);
      if (job.onComplete) job.onComplete();
    } else {
      console.error('[QueueAudioEngine] Job panggilan gagal:', job.ticketCode, result.error);
      const retries = (job.retryCount || 0) + 1;
      if (retries <= 1) {
        job.retryCount = retries;
        this.jobQueue.unshift(job); // Coba lagi 1x
      }
    }

    this.currentJob = null;
    this.isProcessing = false;

    // Lanjutkan ke job antrean berikutnya
    setTimeout(() => this.processQueue(), 400);
  }

  private async executeCallJob(job: AudioCallJob): Promise<PlaybackResult> {
    const announcementText = buildAnnouncementText(
      job.ticketCode,
      job.counterName,
      job.serviceTitle,
      job.serviceGroup
    );

    // 1. Bunyikan chime pembuka via Web Audio API
    await this.playChime();
    await new Promise(r => setTimeout(r, 200));

    // 2. Coba memutar Server MP3 via Persistent Player
    try {
      const mp3Url = this.getServerMp3Url(announcementText);
      await this.playPersistentAudioSrc(mp3Url);
      return { success: true, source: 'SERVER_MP3' };
    } catch (mp3Err: any) {
      console.warn('[QueueAudioEngine] MP3 Server gagal, menggunakan Web Speech API fallback:', mp3Err);
      if (mp3Err?.name === 'NotAllowedError') {
        this.updateState('BLOCKED');
        return { success: false, error: 'NotAllowedError' };
      }
    }

    // 3. Fallback: Web Speech API Browser
    try {
      await this.speakWebSpeech(announcementText);
      return { success: true, source: 'WEB_SPEECH' };
    } catch (speechErr: any) {
      console.warn('[QueueAudioEngine] Web Speech API gagal:', speechErr);
      return { success: true, source: 'CHIME_ONLY' };
    }
  }

  private getServerMp3Url(text: string): string {
    const params = new URLSearchParams({
      ie: 'UTF-8',
      client: 'tw-ob',
      tl: 'id',
      q: text
    });
    return `https://translate.google.com/translate_tts?${params.toString()}`;
  }

  private playPersistentAudioSrc(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.player) {
        reject(new Error('Persistent HTMLAudioElement belum terikat (unbound)'));
        return;
      }

      const player = this.player;

      const cleanup = () => {
        clearTimeout(startTimeout);
        player.onplaying = null;
        player.onended = null;
        player.onerror = null;
        player.onstalled = null;
      };

      player.pause();
      player.src = src;
      player.preload = 'auto';
      player.currentTime = 0;

      player.onended = () => {
        cleanup();
        resolve();
      };

      player.onerror = () => {
        cleanup();
        reject(new Error(`Playback Error: ${player.error?.code || 'Unknown'}`));
      };

      const startTimeout = setTimeout(() => {
        cleanup();
        reject(new Error('Audio Playback Timeout (10s)'));
      }, 10000);

      const playPromise = player.play();
      if (playPromise) {
        playPromise.catch((err) => {
          cleanup();
          reject(err);
        });
      }
    });
  }

  public async playChime(): Promise<void> {
    try {
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

      return new Promise(resolve => setTimeout(resolve, 1200));
    } catch (e) {
      console.warn('[QueueAudioEngine] Gagal memutar chime sintetis:', e);
    }
  }

  private speakWebSpeech(text: string): Promise<void> {
    if (!('speechSynthesis' in window)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      try {
        synth.cancel();
        synth.resume();
      } catch {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.84;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = synth.getVoices();
      const idVoice = voices.find(v => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        const name = v.name.toLowerCase();
        return lang === 'id-id' || lang.startsWith('id') || name.includes('indonesia') || name.includes('bahasa');
      });

      if (idVoice) utterance.voice = idVoice;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      const timeout = setTimeout(finish, 12000);

      try {
        synth.speak(utterance);
      } catch {
        finish();
      }
    });
  }
}

export const queueAudioEngine = new QueueAudioEngine();
