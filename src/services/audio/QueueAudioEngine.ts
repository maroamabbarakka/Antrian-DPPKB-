// QueueAudioEngine.ts — Engine Audio Deterministik Berbasis Web Audio API
// Arsitektur Final (Dokumen 09): ONE AudioContext + Local Voice Assets
// TIDAK ADA: translate_tts runtime, speechSynthesis production, HTMLAudioElement voice
// Semua voice diputar dari berkas WAV lokal via AudioBufferSourceNode

import { audioBufferStore, withTimeout } from './AudioBufferStore';
import {
  buildQueueVoiceSequence,
  getRequiredAssetKeys,
  VoiceSequenceInput
} from './buildQueueVoiceSequence';
import { AUDIO_MANIFEST, ESSENTIAL_ASSET_KEYS, AudioAssetKey } from './queueAudioManifest';

// ─── Types ───────────────────────────────────────────────────────────────────

/** State engine audio. Setiap state mempunyai makna spesifik. */
export type AudioEngineState =
  | 'LOCKED'    // belum aktivasi dari user gesture
  | 'LOADING'   // sedang decode essential buffers
  | 'READY'     // AudioContext running + essential buffers siap
  | 'PLAYING'   // announcement sedang berjalan
  | 'BLOCKED'   // browser membutuhkan user gesture lagi (iOS background)
  | 'ERROR';    // asset/decode/engine error fatal

export interface AudioCallJob {
  id: string;
  ticketCode: string;
  counterName: string;
  serviceTitle: string;
  serviceGroup: string;
  timestamp: number;
  retryCount?: number;
  onComplete?: () => void;
  onError?: (err: string) => void;
}

export interface PlaybackResult {
  success: boolean;
  callId: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

/** Hasil tes audio terstruktur — setiap langkah dilaporkan */
export interface AudioTestResult {
  success: boolean;
  durationMs: number;
  steps: {
    context: { success: boolean; error?: string };
    assets: { success: boolean; missing?: string[]; error?: string };
    decode: { success: boolean; error?: string };
    chime: { success: boolean; error?: string };
    voice: { success: boolean; error?: string };
  };
}

type EngineStateListener = (state: AudioEngineState, job?: AudioCallJob | null) => void;

// ─── Engine ──────────────────────────────────────────────────────────────────

class QueueAudioEngine {
  private audioCtx: AudioContext | null = null;
  private state: AudioEngineState = 'LOCKED';

  private jobQueue: AudioCallJob[] = [];
  private currentJob: AudioCallJob | null = null;
  private isProcessing = false;

  /** Lifecycle tracking — playedCallIds hanya diisi SETELAH voice selesai */
  private receivedCallIds = new Set<string>();
  private queuedCallIds   = new Set<string>();
  private playingCallIds  = new Set<string>();
  private playedCallIds   = new Set<string>();
  private failedCallIds   = new Set<string>();

  private listeners = new Set<EngineStateListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      // Visibility recovery — iOS dapat men-suspend AudioContext saat background
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkAudioContextOnResume();
        }
      });
    }
  }

  // ─── State Management ─────────────────────────────────────────────────────

  getState(): AudioEngineState { return this.state; }

  subscribeState(listener: EngineStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.currentJob);
    return () => { this.listeners.delete(listener); };
  }

  private updateState(state: AudioEngineState): void {
    this.state = state;
    console.info('[AUDIO-ENGINE]', { event: 'STATE_CHANGE', state, timestamp: Date.now() });
    this.listeners.forEach(fn => fn(this.state, this.currentJob));
  }

  // ─── AudioContext Management ──────────────────────────────────────────────

  private getOrCreateAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    return this.audioCtx;
  }

  private async ensureRunningContext(): Promise<AudioContext> {
    const ctx = this.getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      await withTimeout(ctx.resume(), 2500, 'AUDIO_CONTEXT_RESUME_TIMEOUT');
    }
    if (ctx.state !== 'running') {
      throw new Error('AUDIO_CONTEXT_NOT_RUNNING');
    }
    return ctx;
  }

  /** Dipanggil saat app kembali ke foreground — iOS check */
  private checkAudioContextOnResume(): void {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      console.warn('[AUDIO-ENGINE]', { event: 'CONTEXT_SUSPENDED_ON_RESUME', timestamp: Date.now() });
      if (this.state === 'READY' || this.state === 'PLAYING') {
        this.updateState('BLOCKED');
      }
    }
  }

  // ─── Activation (dari User Gesture) ──────────────────────────────────────

  /**
   * Aktivasi audio dari tombol "AKTIFKAN SUARA" — harus dipanggil dari user gesture.
   * 1. Resume AudioContext
   * 2. Load + decode essential buffers
   * 3. Test chime singkat
   * 4. Set state READY
   */
  async unlockFromUserGesture(): Promise<boolean> {
    if (this.state === 'READY' || this.state === 'PLAYING') return true;

    try {
      this.updateState('LOADING');

      const ctx = await withTimeout(
        this.ensureRunningContext(),
        2500,
        'AUDIO_CONTEXT_RESUME_TIMEOUT'
      );

      // Load essential buffers
      const results = await audioBufferStore.loadAll(
        ESSENTIAL_ASSET_KEYS as string[],
        ctx
      );
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.error('[AUDIO-ENGINE] Essential buffers gagal:', failed);
        throw new Error(`ESSENTIAL_BUFFERS_FAILED:${failed.map(f => f.key).join(',')}`);
      }

      // Test chime singkat — verifikasi engine berfungsi
      await this.playChimeInternal(ctx, { shortTest: true });

      this.updateState('READY');
      this.processQueue();
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'UNKNOWN';
      console.error('[AUDIO-ENGINE]', { event: 'UNLOCK_FAILED', error: errMsg, timestamp: Date.now() });
      if (errMsg.includes('AUDIO_CONTEXT') || errMsg.includes('NotAllowedError')) {
        this.updateState('BLOCKED');
      } else {
        this.updateState('ERROR');
      }
      return false;
    }
  }

  // ─── Queue Management ─────────────────────────────────────────────────────

  queueCall(job: AudioCallJob): void {
    if (this.receivedCallIds.has(job.id) || this.playedCallIds.has(job.id)) {
      return; // Dedup — abaikan duplikat
    }

    console.info('[AUDIO-ENGINE]', { event: 'CALL_RECEIVED', callId: job.id, timestamp: Date.now() });
    this.receivedCallIds.add(job.id);
    this.queuedCallIds.add(job.id);
    this.jobQueue.push(job);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      if (!this.isProcessing && this.state === 'PLAYING') {
        this.updateState('READY');
      }
      return;
    }

    // Tahan jika belum READY
    if (this.state === 'LOCKED' || this.state === 'LOADING' || this.state === 'BLOCKED' || this.state === 'ERROR') {
      console.warn('[AUDIO-ENGINE]', { event: 'QUEUE_HELD', state: this.state, queueLen: this.jobQueue.length });
      return;
    }

    this.isProcessing = true;
    const job = this.jobQueue.shift()!;
    this.currentJob = job;
    this.queuedCallIds.delete(job.id);
    this.playingCallIds.add(job.id);

    this.updateState('PLAYING');
    console.info('[AUDIO-ENGINE]', { event: 'PLAY_START', callId: job.id, timestamp: Date.now() });

    const result = await this.executeJob(job);

    this.playingCallIds.delete(job.id);
    this.currentJob = null;

    if (result.success) {
      // playedCallIds hanya diisi SETELAH seluruh voice sequence selesai
      this.playedCallIds.add(job.id);
      console.info('[AUDIO-ENGINE]', { event: 'PLAY_ENDED', callId: job.id, timestamp: Date.now() });
      if (job.onComplete) job.onComplete();
    } else {
      const retry = (job.retryCount || 0) + 1;
      if (retry <= 1) {
        job.retryCount = retry;
        this.queuedCallIds.add(job.id);
        this.jobQueue.unshift(job);
        console.warn('[AUDIO-ENGINE]', { event: 'PLAY_RETRY', callId: job.id, attempt: retry });
      } else {
        this.failedCallIds.add(job.id);
        console.error('[AUDIO-ENGINE]', { event: 'PLAY_FAILED', callId: job.id, error: result.error });
        if (job.onError) job.onError(result.error || 'UNKNOWN');
      }
    }

    this.isProcessing = false;
    setTimeout(() => this.processQueue(), 400);
  }

  // ─── Job Execution ────────────────────────────────────────────────────────

  private async executeJob(job: AudioCallJob): Promise<PlaybackResult> {
    const startedAt = Date.now();
    const seqInput: VoiceSequenceInput = {
      ticketCode: job.ticketCode,
      counterName: job.counterName,
      serviceGroup: job.serviceGroup
    };

    try {
      const ctx = await this.ensureRunningContext();
      const sequence = buildQueueVoiceSequence(seqInput);
      const requiredKeys = getRequiredAssetKeys(sequence);

      // Pastikan semua buffer tersedia — load yang belum ada
      const missing = audioBufferStore.getMissingKeys(requiredKeys);
      if (missing.length > 0) {
        const loadResults = await audioBufferStore.loadAll(missing, ctx);
        const failedLoad = loadResults.filter(r => !r.success);
        if (failedLoad.length > 0) {
          return {
            success: false, callId: job.id, startedAt,
            error: `BUFFER_LOAD_FAILED:${failedLoad.map(r => r.key).join(',')}`
          };
        }
      }

      // SEMUA BUFFER READY → baru play chime
      await this.playChimeInternal(ctx);

      // Play sequence voice
      await this.playSequence(sequence, ctx);

      return { success: true, callId: job.id, startedAt, endedAt: Date.now() };
    } catch (err: any) {
      return {
        success: false, callId: job.id, startedAt,
        error: err?.message || 'PLAYBACK_ERROR'
      };
    }
  }

  // ─── Chime (Web Audio API — oscillator) ──────────────────────────────────

  async playChime(): Promise<void> {
    const ctx = await this.ensureRunningContext();
    return this.playChimeInternal(ctx);
  }

  private playChimeInternal(ctx: AudioContext, opts?: { shortTest?: boolean }): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const now = ctx.currentTime;
        const notes = opts?.shortTest
          ? [{ freq: 880, offset: 0, duration: 0.25, gain: 0.25 }]
          : [
              { freq: 523.25, offset: 0,    duration: 0.45, gain: 0.3  },
              { freq: 659.25, offset: 0.18, duration: 0.47, gain: 0.35 },
              { freq: 783.99, offset: 0.36, duration: 0.49, gain: 0.4  },
              { freq: 1046.5, offset: 0.54, duration: 0.66, gain: 0.45 }
            ];

        const endTime = now + (opts?.shortTest ? 0.3 : 1.3);
        notes.forEach(note => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          const t    = now + note.offset;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, t);
          gain.gain.setValueAtTime(note.gain, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + note.duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + note.duration);
        });

        setTimeout(() => resolve(), (endTime - now) * 1000 + 100);
      } catch (err) {
        reject(new Error('CHIME_PLAYBACK_FAILED'));
      }
    });
  }

  // ─── Sequence Playback (AudioBufferSourceNode) ────────────────────────────

  private async playSequence(sequence: string[], ctx: AudioContext): Promise<void> {
    let when = ctx.currentTime + 0.05;
    const PAUSE_SHORT_MS = 0.12;

    for (const token of sequence) {
      if (token === 'pause.short') {
        when += PAUSE_SHORT_MS;
        continue;
      }

      const buffer = audioBufferStore.get(token);
      if (!buffer) {
        console.warn('[AUDIO-ENGINE] Buffer tidak ditemukan:', token);
        continue;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(when);
      when += buffer.duration + 0.04; // gap antar kata
    }

    // Tunggu sampai seluruh sequence selesai
    const waitMs = Math.max(0, (when - ctx.currentTime) * 1000 + 200);
    await new Promise(r => setTimeout(r, waitMs));
  }

  // ─── Tes Audio Terstruktur ────────────────────────────────────────────────

  /**
   * Tes audio penuh — melaporkan setiap langkah secara terpisah.
   * Tidak menggunakan Google TTS atau Web Speech — hanya local engine.
   */
  async testCallFull(): Promise<AudioTestResult> {
    const startMs = Date.now();
    const steps: AudioTestResult['steps'] = {
      context: { success: false },
      assets:  { success: false },
      decode:  { success: false },
      chime:   { success: false },
      voice:   { success: false }
    };

    // Step 1: Context
    let ctx: AudioContext;
    try {
      ctx = await withTimeout(this.ensureRunningContext(), 2500, 'AUDIO_CONTEXT_RESUME_TIMEOUT');
      steps.context = { success: true };
    } catch (err: any) {
      steps.context = { success: false, error: err?.message };
      return { success: false, durationMs: Date.now() - startMs, steps };
    }

    // Step 2 + 3: Assets & Decode
    const testSequence = buildQueueVoiceSequence({
      ticketCode: 'A-001',
      counterName: 'Loket 1',
      serviceGroup: 'KB'
    });
    const requiredKeys = getRequiredAssetKeys(testSequence);
    const missing = audioBufferStore.getMissingKeys(requiredKeys);

    if (missing.length > 0) {
      steps.assets = { success: false, missing };
      try {
        const loadResults = await audioBufferStore.loadAll(missing, ctx!);
        const failed = loadResults.filter(r => !r.success);
        if (failed.length > 0) {
          steps.assets = { success: false, missing: failed.map(r => r.key), error: `BUFFER_LOAD_FAILED` };
          steps.decode = { success: false, error: `DECODE_FAILED:${failed.map(r => r.key).join(',')}` };
          return { success: false, durationMs: Date.now() - startMs, steps };
        }
        steps.assets = { success: true };
        steps.decode = { success: true };
      } catch (err: any) {
        steps.decode = { success: false, error: err?.message };
        return { success: false, durationMs: Date.now() - startMs, steps };
      }
    } else {
      steps.assets = { success: true };
      steps.decode = { success: true };
    }

    // Step 4: Chime
    try {
      await this.playChimeInternal(ctx!);
      steps.chime = { success: true };
    } catch (err: any) {
      steps.chime = { success: false, error: err?.message || 'CHIME_FAILED' };
      return { success: false, durationMs: Date.now() - startMs, steps };
    }

    // Step 5: Voice sequence
    try {
      await this.playSequence(testSequence, ctx!);
      steps.voice = { success: true };
    } catch (err: any) {
      steps.voice = { success: false, error: err?.message || 'VOICE_SEQUENCE_FAILED' };
      return { success: false, durationMs: Date.now() - startMs, steps };
    }

    return { success: true, durationMs: Date.now() - startMs, steps };
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────

  getPlayedCallCount(): number   { return this.playedCallIds.size; }
  getFailedCallCount(): number   { return this.failedCallIds.size; }
  getQueueLength(): number       { return this.jobQueue.length; }
  getBufferCount(): number       { return audioBufferStore.getLoadedCount(); }

  getAudioContextInfo(): Record<string, string | number | undefined> {
    if (!this.audioCtx) return { state: 'not_created' };
    return {
      state: this.audioCtx.state,
      sampleRate: this.audioCtx.sampleRate,
      baseLatency: (this.audioCtx as any).baseLatency
    };
  }
}

export const queueAudioEngine = new QueueAudioEngine();

// Re-export untuk komponen UI
export type { AudioAssetKey };
