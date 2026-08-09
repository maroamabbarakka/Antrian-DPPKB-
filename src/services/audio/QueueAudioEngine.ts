// QueueAudioEngine.ts — Engine Panggilan Audio Terpusat & Reliabel (P0 Patch Lengkap)
// Menangani: GlobalAudioHost, Async Unlock, Voice Ready Validation,
// Anti-Overlap Timeout, failedCallIds, AudioTestResult terstruktur.

import {
  buildAnnouncementText,
  getServiceSpeechLabel
} from './queueAudioText';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  source?: 'SERVER_MP3' | 'WEB_SPEECH' | 'LOCAL_AUDIO';
  error?: string;
}

/** Hasil tes audio terstruktur — chime dan voice dilaporkan terpisah */
export interface AudioTestResult {
  success: boolean;
  durationMs: number;
  chime: {
    success: boolean;
    error?: string;
  };
  voice: {
    success: boolean;
    source?: 'SERVER_MP3' | 'WEB_SPEECH' | 'LOCAL_AUDIO';
    error?: string;
  };
}

type EngineStateListener = (state: AudioEngineState, currentJob?: AudioCallJob | null) => void;

// ─── Engine ──────────────────────────────────────────────────────────────────

class QueueAudioEngine {
  private player: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private state: AudioEngineState = 'LOCKED';

  private jobQueue: AudioCallJob[] = [];
  private currentJob: AudioCallJob | null = null;
  private isProcessing = false;

  /** IDs yang sudah diterima dan dijadwalkan (dedup guard) */
  private seenCallIds = new Set<string>();
  /** IDs yang sedang diputar */
  private inFlightCallIds = new Set<string>();
  /** IDs yang sudah berhasil diputar suaranya hingga selesai */
  private playedCallIds = new Set<string>();
  /** IDs yang gagal setelah seluruh fallback habis */
  private failedCallIds = new Set<string>();

  private listeners = new Set<EngineStateListener>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  // ─── Player Management ────────────────────────────────────────────────────

  public bindPlayer(player: HTMLAudioElement): void {
    this.player = player;
    this.player.preload = 'auto';
    this.player.volume = 1.0;
    console.info('[QUEUE-AUDIO]', { event: 'PLAYER_BOUND', timestamp: Date.now() });
  }

  public unbindPlayer(): void {
    if (this.player) {
      try {
        this.player.pause();
        this.player.src = '';
      } catch {}
    }
    this.player = null;
    console.info('[QUEUE-AUDIO]', { event: 'PLAYER_UNBOUND', timestamp: Date.now() });
  }

  // ─── State Management ─────────────────────────────────────────────────────

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

  // ─── Audio Context ────────────────────────────────────────────────────────

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // ─── Unlock ───────────────────────────────────────────────────────────────

  /**
   * Buka kunci audio dari User Gesture (Klik / Touch / Remote Enter).
   * Hanya mengembalikan true jika persistent audio element
   * BENAR-BENAR berhasil memutar /audio/audio-ready.mp3.
   * AudioContext running saja tidak cukup.
   */
  public async unlockFromUserGesture(): Promise<boolean> {
    if (this.state === 'READY' || this.state === 'PLAYING') {
      return true;
    }

    this.updateState('UNLOCKING');
    console.info('[QUEUE-AUDIO]', { event: 'AUDIO_UNLOCK_REQUEST', timestamp: Date.now() });

    if (!this.player) {
      console.warn('[QUEUE-AUDIO]', { event: 'AUDIO_UNLOCK_FAILED', reason: 'player_unbound', timestamp: Date.now() });
      this.updateState('BLOCKED');
      return false;
    }

    // Resume AudioContext jika ada
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (err) {
      console.warn('[QUEUE-AUDIO] AudioContext resume error:', err);
    }

    // WAJIB: persistent player harus berhasil memutar audio-ready.mp3
    try {
      this.player.pause();
      this.player.src = '/audio/audio-ready.mp3';
      this.player.currentTime = 0;
      await this.player.play();

      console.info('[QUEUE-AUDIO]', { event: 'AUDIO_UNLOCK_SUCCESS', timestamp: Date.now() });
      this.updateState('READY');
      this.processQueue();
      return true;
    } catch (mediaErr: any) {
      const errName = mediaErr?.name || 'Unknown';
      console.warn('[QUEUE-AUDIO]', { event: 'AUDIO_UNLOCK_FAILED', reason: errName, timestamp: Date.now() });

      if (errName === 'NotAllowedError') {
        this.updateState('BLOCKED');
      } else {
        this.updateState('ERROR');
      }
      return false;
    }
  }

  // ─── Queue ────────────────────────────────────────────────────────────────

  /**
   * Tambahkan panggilan baru ke antrean.
   * Duplikat (berdasarkan id) diabaikan.
   */
  public queueCall(job: AudioCallJob): void {
    if (this.seenCallIds.has(job.id) || this.playedCallIds.has(job.id)) {
      return;
    }

    console.info('[QUEUE-AUDIO]', { event: 'CALL_QUEUED', callId: job.id, timestamp: Date.now() });
    this.seenCallIds.add(job.id);
    this.jobQueue.push(job);
    this.processQueue();
  }

  // ─── Test ─────────────────────────────────────────────────────────────────

  /**
   * Tes audio sederhana — untuk backward compatibility.
   * Mengembalikan boolean berhasil/tidak.
   */
  public async testCall(): Promise<PlaybackResult> {
    const result = await this.testCallFull();
    return {
      success: result.success,
      source: result.voice.source,
      error: result.voice.error
    };
  }

  /**
   * Tes audio terstruktur — melaporkan chime dan voice secara terpisah.
   * Wajib dipakai oleh Navbar tombol "Tes Audio".
   */
  public async testCallFull(): Promise<AudioTestResult> {
    const startMs = Date.now();

    const testJob: AudioCallJob = {
      id: `test-call-${Date.now()}`,
      ticketCode: 'A-001',
      counterName: 'Loket 1',
      serviceTitle: 'Pelayanan Keluarga Berencana',
      serviceGroup: 'KB',
      timestamp: Date.now()
    };

    let chimeResult = { success: false, error: undefined as string | undefined };
    let voiceResult = { success: false, source: undefined as 'SERVER_MP3' | 'WEB_SPEECH' | 'LOCAL_AUDIO' | undefined, error: undefined as string | undefined };

    // Chime
    try {
      await this.playChime();
      chimeResult = { success: true, error: undefined };
    } catch (err: any) {
      chimeResult = { success: false, error: err?.message || 'CHIME_FAILED' };
    }

    await new Promise(r => setTimeout(r, 200));

    // Voice
    const announcementText = buildAnnouncementText(
      testJob.ticketCode,
      testJob.counterName,
      testJob.serviceTitle,
      testJob.serviceGroup
    );

    try {
      const mp3Url = this.getServerMp3Url(announcementText);
      await this.playPersistentAudioSrc(mp3Url);
      voiceResult = { success: true, source: 'SERVER_MP3', error: undefined };
    } catch (mp3Err: any) {
      if (mp3Err?.name === 'NotAllowedError') {
        this.updateState('BLOCKED');
        voiceResult = { success: false, source: undefined, error: 'NotAllowedError' };
      } else {
        // Fallback Web Speech
        try {
          await this.speakWebSpeech(announcementText);
          voiceResult = { success: true, source: 'WEB_SPEECH', error: undefined };
        } catch (speechErr: any) {
          voiceResult = { success: false, source: undefined, error: speechErr?.message || 'VOICE_NOT_PLAYED' };
        }
      }
    }

    const durationMs = Date.now() - startMs;
    const overallSuccess = voiceResult.success; // chime saja BUKAN success

    return {
      success: overallSuccess,
      durationMs,
      chime: chimeResult,
      voice: voiceResult
    };
  }

  // ─── Queue Processor ──────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.jobQueue.length === 0) {
      if (this.state === 'PLAYING') this.updateState('READY');
      return;
    }

    // Tahan jika audio belum siap — LOCKED, BLOCKED, atau UNLOCKING
    if (
      this.state === 'LOCKED' ||
      this.state === 'BLOCKED' ||
      this.state === 'UNLOCKING'
    ) {
      console.warn('[QUEUE-AUDIO]', { event: 'PLAY_BLOCKED', state: this.state, queueLen: this.jobQueue.length, timestamp: Date.now() });
      return;
    }

    this.isProcessing = true;
    const job = this.jobQueue.shift()!;
    this.currentJob = job;
    this.inFlightCallIds.add(job.id);

    this.updateState('PLAYING');
    console.info('[QUEUE-AUDIO]', { event: 'PLAY_REQUEST', callId: job.id, ticketCode: job.ticketCode, timestamp: Date.now() });

    const result = await this.executeCallJob(job);

    this.inFlightCallIds.delete(job.id);

    if (result.success) {
      // playedCallIds hanya diisi SETELAH voice berhasil selesai
      this.playedCallIds.add(job.id);
      console.info('[QUEUE-AUDIO]', { event: 'PLAY_ENDED', callId: job.id, source: result.source, timestamp: Date.now() });
      if (job.onComplete) job.onComplete();
    } else {
      console.error('[QUEUE-AUDIO]', { event: 'PLAY_ERROR', callId: job.id, error: result.error, timestamp: Date.now() });

      const retries = (job.retryCount || 0) + 1;
      if (retries <= 1) {
        job.retryCount = retries;
        this.jobQueue.unshift(job); // Coba ulang 1 kali
      } else {
        // Setelah retry habis, masuk failedCallIds agar tidak dibuang diam-diam
        this.failedCallIds.add(job.id);
        console.error('[QUEUE-AUDIO]', { event: 'PLAY_BLOCKED', callId: job.id, reason: 'max_retry_exceeded', timestamp: Date.now() });
      }
    }

    this.currentJob = null;
    this.isProcessing = false;

    setTimeout(() => this.processQueue(), 400);
  }

  // ─── Job Executor ─────────────────────────────────────────────────────────

  private async executeCallJob(job: AudioCallJob): Promise<PlaybackResult> {
    const announcementText = buildAnnouncementText(
      job.ticketCode,
      job.counterName,
      job.serviceTitle,
      job.serviceGroup
    );

    console.info('[QUEUE-AUDIO]', { event: 'TTS_FETCH_START', callId: job.id, timestamp: Date.now() });

    // 1. Chime pembuka
    await this.playChime();
    await new Promise(r => setTimeout(r, 200));

    // 2. Coba Server MP3
    try {
      const mp3Url = this.getServerMp3Url(announcementText);
      await this.playPersistentAudioSrc(mp3Url);
      console.info('[QUEUE-AUDIO]', { event: 'TTS_FETCH_SUCCESS', callId: job.id, source: 'SERVER_MP3', timestamp: Date.now() });
      return { success: true, source: 'SERVER_MP3' };
    } catch (mp3Err: any) {
      console.warn('[QUEUE-AUDIO]', { event: 'FALLBACK_STARTED', callId: job.id, reason: mp3Err?.message, timestamp: Date.now() });
      if (mp3Err?.name === 'NotAllowedError') {
        this.updateState('BLOCKED');
        return { success: false, error: 'NotAllowedError' };
      }
    }

    // 3. Pastikan player berhenti sebelum fallback (anti-overlap)
    if (this.player) {
      try { this.player.pause(); this.player.currentTime = 0; } catch {}
    }

    // 4. Fallback Web Speech API
    try {
      await this.speakWebSpeech(announcementText);
      console.info('[QUEUE-AUDIO]', { event: 'TTS_FETCH_SUCCESS', callId: job.id, source: 'WEB_SPEECH', timestamp: Date.now() });
      return { success: true, source: 'WEB_SPEECH' };
    } catch (speechErr: any) {
      return { success: false, error: speechErr?.message || 'VOICE_NOT_PLAYED' };
    }
  }

  // ─── Server TTS URL ───────────────────────────────────────────────────────

  private getServerMp3Url(text: string): string {
    const params = new URLSearchParams({
      ie: 'UTF-8',
      client: 'tw-ob',
      tl: 'id',
      q: text
    });
    return `https://translate.google.com/translate_tts?${params.toString()}`;
  }

  // ─── Persistent Audio Player ──────────────────────────────────────────────

  private playPersistentAudioSrc(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.player) {
        reject(new Error('Persistent HTMLAudioElement belum terikat (unbound)'));
        return;
      }

      const player = this.player;
      let started = false;
      let done = false;

      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(startTimeout);
        clearTimeout(finishTimeout);
        player.onplaying = null;
        player.onended = null;
        player.onerror = null;
      };

      player.pause();
      player.src = src;
      player.preload = 'auto';
      player.currentTime = 0;

      player.onplaying = () => {
        started = true;
        clearTimeout(startTimeout); // Batalkan start timeout saat audio mulai diputar
        console.info('[QUEUE-AUDIO]', { event: 'PLAY_STARTED', src: src.substring(0, 60), timestamp: Date.now() });
      };

      player.onended = () => {
        cleanup();
        resolve();
      };

      player.onerror = () => {
        cleanup();
        reject(new Error(`HTML_AUDIO_ERROR:${player.error?.code ?? 'unknown'}`));
      };

      // Start Timeout: jika audio tidak mulai dalam 4.5 detik, hentikan dan fallback
      const startTimeout = setTimeout(() => {
        if (!started) {
          cleanup();
          try { player.pause(); player.currentTime = 0; } catch {}
          reject(new Error('AUDIO_START_TIMEOUT'));
        }
      }, 4500);

      // Finish Timeout: keamanan maksimal 20 detik
      const finishTimeout = setTimeout(() => {
        cleanup();
        resolve();
      }, 20000);

      const playPromise = player.play();
      if (playPromise) {
        playPromise.catch((err) => {
          cleanup();
          reject(err);
        });
      }
    });
  }

  // ─── Chime (Web Audio API) ────────────────────────────────────────────────

  public async playChime(): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, offset: 0,    duration: 0.45, gain: 0.3  },
        { freq: 659.25, offset: 0.18, duration: 0.47, gain: 0.35 },
        { freq: 783.99, offset: 0.36, duration: 0.49, gain: 0.4  },
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
      console.warn('[QUEUE-AUDIO] Gagal memutar chime sintetis:', e);
    }
  }

  // ─── Web Speech Fallback ──────────────────────────────────────────────────

  private speakWebSpeech(text: string): Promise<void> {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      return Promise.reject(new Error('WEB_SPEECH_UNAVAILABLE'));
    }

    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      let done = false;

      try { synth.cancel(); synth.resume(); } catch {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.84;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = synth.getVoices();
      const idVoice = voices.find(v => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        const name = v.name.toLowerCase();
        return lang === 'id-id' || lang.startsWith('id') ||
          name.includes('indonesia') || name.includes('bahasa');
      });
      if (idVoice) utterance.voice = idVoice;

      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
      };

      utterance.onend = () => { cleanup(); resolve(); };
      utterance.onerror = (evt) => {
        cleanup();
        reject(new Error(`WEB_SPEECH_ERROR:${evt.error || 'unknown'}`));
      };

      const timeout = setTimeout(() => {
        cleanup();
        try { synth.cancel(); } catch {}
        reject(new Error('WEB_SPEECH_TIMEOUT'));
      }, 12000);

      try {
        synth.speak(utterance);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  // ─── Public Diagnostics ───────────────────────────────────────────────────

  /** Jumlah panggilan gagal setelah semua fallback habis */
  public getFailedCallCount(): number {
    return this.failedCallIds.size;
  }

  /** Jumlah panggilan berhasil diputar hingga selesai */
  public getPlayedCallCount(): number {
    return this.playedCallIds.size;
  }
}

export const queueAudioEngine = new QueueAudioEngine();

// Export label helper untuk komponen UI
export { getServiceSpeechLabel };
