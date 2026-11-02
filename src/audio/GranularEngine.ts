/**
 * AeroGrain Granular Synthesis Engine & Resampler
 * Uses Web Audio API for ultra-low latency, multi-voice grain generation and lossless PCM resampling.
 */

import {
  calculateGrainEnvelope,
  pitchToPlaybackRate,
  calculateGrainOffset,
  encodeWav,
  type EnvelopeType,
} from './granulizerMath';

export interface GranularParams {
  position: number; // 0.0 to 1.0
  spray: number; // 0.0 to 1.0
  grainSize: number; // 0.02 to 0.6 seconds (20ms - 600ms)
  density: number; // grains per second (4 to 80)
  pitchSemitones: number; // -24 to +24 semitones
  pitchCents: number; // -50 to +50 cents
  pitchJitterCents: number; // 0 to 1200 cents (random pitch spread)
  envelope: EnvelopeType;
  panSpread: number; // 0.0 (center) to 1.0 (full stereo spread)
  reverseChance: number; // 0.0 to 1.0
  scanSpeed: number; // -2.0 to 2.0 (how fast playhead advances)
  isFrozen: boolean; // freeze position in place
  volume: number; // 0.0 to 1.5

  // Effects
  filterType: BiquadFilterType;
  filterCutoff: number; // 20 to 18000 Hz
  filterResonance: number; // 0.1 to 15
  delayTime: number; // 0.05 to 0.8s
  delayFeedback: number; // 0.0 to 0.85
  delayWet: number; // 0.0 to 1.0
  reverbWet: number; // 0.0 to 1.0
  reverbDecay: number; // 0.5 to 6.0 seconds
}

export interface GrainVisualEvent {
  id: number;
  position: number; // 0 to 1
  pan: number; // -1 to +1
  size: number; // seconds
  pitchRate: number;
  isReversed: boolean;
  time: number;
}

export interface ResampleTake {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  sizeBytes: number;
}

export const DEFAULT_PARAMS: GranularParams = {
  position: 0.25,
  spray: 0.15,
  grainSize: 0.12,
  density: 28,
  pitchSemitones: 0,
  pitchCents: 0,
  pitchJitterCents: 0,
  envelope: 'hann',
  panSpread: 0.75,
  reverseChance: 0.1,
  scanSpeed: 0.1,
  isFrozen: false,
  volume: 0.85,

  filterType: 'lowpass',
  filterCutoff: 8500,
  filterResonance: 2.5,
  delayTime: 0.24,
  delayFeedback: 0.45,
  delayWet: 0.35,
  reverbWet: 0.4,
  reverbDecay: 3.2,
};

export class GranularEngine {
  private ctx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private params: GranularParams = { ...DEFAULT_PARAMS };
  private isRunning: boolean = false;
  private isDroneActive: boolean = false;
  private activeNotes: Set<number> = new Set(); // MIDI notes held down

  // Scheduling timer & state
  private schedulerTimerId: number | null = null;
  private lastScheduledTime: number = 0;
  private grainCounter: number = 0;
  private grainVisualListeners: ((event: GrainVisualEvent) => void)[] = [];
  private playheadPositionListener: ((pos: number) => void) | null = null;

  // Audio Node Graph
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private delayDryGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;

  // Resampler Tap
  private isResampling: boolean = false;
  private resampleStartTime: number = 0;
  private resampleChannelL: Float32Array[] = [];
  private resampleChannelR: Float32Array[] = [];
  private resampleScriptNode: ScriptProcessorNode | null = null;
  private onResampleTimeUpdate: ((elapsed: number) => void) | null = null;
  private resampleTimerInterval: number | null = null;
  private takes: ResampleTake[] = [];
  private takesListeners: ((takes: ResampleTake[]) => void)[] = [];

  constructor() {
    // Engine initializes lazily on first user interaction to comply with iOS audio policy
  }

  public async initAudio(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.buildAudioGraph();
      await this.loadPreset('aquatic_chimes');
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private buildAudioGraph(): void {
    if (!this.ctx) return;

    // Filter Node
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = this.params.filterType;
    this.filterNode.frequency.setValueAtTime(this.params.filterCutoff, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(this.params.filterResonance, this.ctx.currentTime);

    // Aquatic Delay Network
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.params.delayTime, this.ctx.currentTime);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.setValueAtTime(this.params.delayFeedback, this.ctx.currentTime);
    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.setValueAtTime(this.params.delayWet, this.ctx.currentTime);
    this.delayDryGain = this.ctx.createGain();
    this.delayDryGain.gain.setValueAtTime(1.0 - this.params.delayWet * 0.5, this.ctx.currentTime);

    // Reverb Network
    this.reverbConvolver = this.ctx.createConvolver();
    this.generateSyntheticImpulse(this.params.reverbDecay);
    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(this.params.reverbWet, this.ctx.currentTime);
    this.reverbDryGain = this.ctx.createGain();
    this.reverbDryGain.gain.setValueAtTime(1.0 - this.params.reverbWet * 0.4, this.ctx.currentTime);

    // Master Limiter / Dynamics
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(-1.5, this.ctx.currentTime);
    this.limiterNode.knee.setValueAtTime(6, this.ctx.currentTime);
    this.limiterNode.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.limiterNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiterNode.release.setValueAtTime(0.1, this.ctx.currentTime);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.params.volume, this.ctx.currentTime);

    // Routing Graph:
    // Grains -> filterNode
    // filterNode -> delayDryGain -> delayMixer
    // filterNode -> delayNode -> delayWetGain -> delayMixer
    // delayNode -> delayFeedbackGain -> delayNode
    // delayMixer -> reverbDryGain -> reverbMixer
    // delayMixer -> reverbConvolver -> reverbWetGain -> reverbMixer
    // reverbMixer -> limiterNode -> masterGain -> ctx.destination

    const delayMixer = this.ctx.createGain();
    this.filterNode.connect(this.delayDryGain);
    this.delayDryGain.connect(delayMixer);

    this.filterNode.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(delayMixer);
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);

    const reverbMixer = this.ctx.createGain();
    delayMixer.connect(this.reverbDryGain);
    this.reverbDryGain.connect(reverbMixer);

    delayMixer.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(reverbMixer);

    reverbMixer.connect(this.limiterNode);
    this.limiterNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * Generates a lush, shimmer-tailed synthetic impulse response for the convolver
   */
  private generateSyntheticImpulse(durationSec: number): void {
    if (!this.ctx || !this.reverbConvolver) return;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * Math.max(0.2, durationSec));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const decay = Math.exp(-3.5 * (t / durationSec));
      // Stereo decorrelated diffusion with high frequency absorption
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbConvolver.buffer = impulse;
  }

  public updateParams(newParams: Partial<GranularParams>): void {
    this.params = { ...this.params, ...newParams };

    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (newParams.filterCutoff !== undefined && this.filterNode) {
      this.filterNode.frequency.setTargetAtTime(newParams.filterCutoff, t, 0.05);
    }
    if (newParams.filterResonance !== undefined && this.filterNode) {
      this.filterNode.Q.setTargetAtTime(newParams.filterResonance, t, 0.05);
    }
    if (newParams.filterType !== undefined && this.filterNode) {
      this.filterNode.type = newParams.filterType;
    }
    if (newParams.delayTime !== undefined && this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(newParams.delayTime, t, 0.05);
    }
    if (newParams.delayFeedback !== undefined && this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.setTargetAtTime(newParams.delayFeedback, t, 0.05);
    }
    if (newParams.delayWet !== undefined && this.delayWetGain && this.delayDryGain) {
      this.delayWetGain.gain.setTargetAtTime(newParams.delayWet, t, 0.05);
      this.delayDryGain.gain.setTargetAtTime(1.0 - newParams.delayWet * 0.5, t, 0.05);
    }
    if (newParams.reverbWet !== undefined && this.reverbWetGain && this.reverbDryGain) {
      this.reverbWetGain.gain.setTargetAtTime(newParams.reverbWet, t, 0.05);
      this.reverbDryGain.gain.setTargetAtTime(1.0 - newParams.reverbWet * 0.4, t, 0.05);
    }
    if (newParams.volume !== undefined && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(newParams.volume, t, 0.05);
    }
    if (newParams.reverbDecay !== undefined) {
      this.generateSyntheticImpulse(newParams.reverbDecay);
    }
  }

  public getParams(): GranularParams {
    return { ...this.params };
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  /**
   * Load audio file uploaded from user's phone or computer
   */
  public async loadAudioFile(file: File): Promise<void> {
    await this.initAudio();
    if (!this.ctx) return;
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(arrayBuffer);
    this.audioBuffer = decoded;
    this.params.position = 0.2;
  }

  /**
   * Load audio from a raw Blob (e.g. from a resample take)
   */
  public async loadAudioFromBlob(blob: Blob): Promise<void> {
    await this.initAudio();
    if (!this.ctx) return;
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.audioBuffer = decoded;
    this.params.position = 0.2;
  }

  /**
   * Built-in Frutiger Aero high-fidelity procedural ambient presets
   */
  public async loadPreset(
    presetId: 'aquatic_chimes' | 'aero_aurora' | 'bioluminescent_forest' | 'liquid_crystal' | 'glass_harp'
  ): Promise<void> {
    await this.initAudio();
    if (!this.ctx) return;

    const rate = this.ctx.sampleRate;
    const duration = 6.0; // 6-second rich harmonic soundscape
    const numSamples = Math.floor(rate * duration);
    const buffer = this.ctx.createBuffer(2, numSamples, rate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / rate;

      if (presetId === 'aquatic_chimes') {
        // Crystalline water drops & resonant chime bells (E-maj9: E4, G#4, B4, D#5, F#5)
        const drop1 = Math.sin(2 * Math.PI * (329.63 * Math.exp(-1.8 * (t % 1.5))) * t) * Math.exp(-3 * (t % 1.5));
        const drop2 = Math.sin(2 * Math.PI * (415.30 * Math.exp(-2.2 * ((t + 0.5) % 2.0))) * t) * Math.exp(-2.5 * ((t + 0.5) % 2.0));
        const chime = Math.sin(2 * Math.PI * 622.25 * t) * Math.exp(-1.2 * (t % 3.0)) * 0.4 +
                      Math.sin(2 * Math.PI * 739.99 * t) * Math.exp(-1.5 * ((t + 1.2) % 3.0)) * 0.3;
        const waterRipples = (Math.sin(2 * Math.PI * 8.0 * t) + 1) * 0.1 * Math.sin(2 * Math.PI * 196.0 * t);
        
        left[i] = (drop1 * 0.7 + chime * 0.5 + waterRipples) * 0.6;
        right[i] = (drop2 * 0.7 + chime * 0.5 - waterRipples) * 0.6;
      } else if (presetId === 'aero_aurora') {
        // Ethereal vocal choir pad with warm formant sweeps
        const f1 = 220 + 30 * Math.sin(2 * Math.PI * 0.2 * t);
        const f2 = 277.18 + 40 * Math.cos(2 * Math.PI * 0.15 * t);
        const f3 = 329.63 + 20 * Math.sin(2 * Math.PI * 0.3 * t);
        const choir = Math.sin(2 * Math.PI * f1 * t) * 0.4 +
                      Math.sin(2 * Math.PI * f2 * t) * 0.35 +
                      Math.sin(2 * Math.PI * f3 * t) * 0.35 +
                      Math.sin(2 * Math.PI * f1 * 2 * t) * 0.15;
        const breath = (Math.random() * 2 - 1) * 0.04;
        left[i] = choir * 0.5 + breath;
        right[i] = (choir * 0.48 + Math.cos(2 * Math.PI * f2 * 1.5 * t) * 0.1) * 0.5 + breath;
      } else if (presetId === 'bioluminescent_forest') {
        // Organic wooden clicks, glass insect chimes, deep moss drone
        const woodClick = (Math.sin(2 * Math.PI * 520 * t) * Math.exp(-25 * (t % 0.8))) * 0.6;
        const shimmer = Math.sin(2 * Math.PI * (1200 + 400 * Math.sin(t * 12)) * t) * 0.15;
        const mossDrone = Math.sin(2 * Math.PI * 110 * t) * 0.35 + Math.sin(2 * Math.PI * 164.81 * t) * 0.25;
        left[i] = woodClick * 0.8 + shimmer + mossDrone;
        right[i] = (Math.sin(2 * Math.PI * 580 * t) * Math.exp(-25 * ((t + 0.4) % 0.8))) * 0.6 + shimmer * 0.8 + mossDrone;
      } else if (presetId === 'liquid_crystal') {
        // Pure FM crystal bell with undulating harmonics
        const mod = Math.sin(2 * Math.PI * 880 * t) * 3.5;
        const carrier1 = Math.sin(2 * Math.PI * 440 * t + mod) * Math.exp(-0.8 * (t % 4.0));
        const carrier2 = Math.sin(2 * Math.PI * 659.25 * t + mod * 0.7) * Math.exp(-1.1 * ((t + 1.5) % 4.0));
        left[i] = (carrier1 * 0.6 + carrier2 * 0.4) * 0.7;
        right[i] = (carrier1 * 0.4 + carrier2 * 0.6) * 0.7;
      } else {
        // Glass Harp resonance
        const glass1 = Math.sin(2 * Math.PI * 523.25 * t) * 0.5; // C5
        const glass2 = Math.sin(2 * Math.PI * 659.25 * t) * 0.35; // E5
        const glass3 = Math.sin(2 * Math.PI * 783.99 * t) * 0.3; // G5
        const rubFriction = (Math.random() * 2 - 1) * 0.03 * (Math.sin(2 * Math.PI * 2 * t) + 1);
        left[i] = (glass1 + glass2 + glass3 + rubFriction) * 0.45;
        right[i] = (glass1 * 0.9 + glass2 * 1.1 + glass3 * 0.8 + rubFriction) * 0.45;
      }
    }

    this.audioBuffer = buffer;
  }

  /**
   * Record audio sample directly from device microphone
   */
  public async recordMicSample(
    durationSeconds: number = 4.0,
    onProgress?: (ratio: number) => void
  ): Promise<void> {
    await this.initAudio();
    if (!this.ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    const startTime = performance.now();
    const totalMs = durationSeconds * 1000;
    const progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const ratio = Math.min(1.0, elapsed / totalMs);
      if (onProgress) onProgress(ratio);
      if (elapsed >= totalMs) {
        clearInterval(progressInterval);
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }
    }, 50);

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(progressInterval);
        stream.getTracks().forEach((track) => track.stop());
        try {
          const micBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuf = await micBlob.arrayBuffer();
          if (this.ctx) {
            const decoded = await this.ctx.decodeAudioData(arrayBuf);
            this.audioBuffer = decoded;
            this.params.position = 0.2;
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      mediaRecorder.onerror = (err) => {
        clearInterval(progressInterval);
        stream.getTracks().forEach((track) => track.stop());
        reject(err);
      };

      mediaRecorder.start();
    });
  }

  /**
   * Starts / Stops continuous ambient drone mode
   */
  public toggleDrone(active?: boolean): boolean {
    if (active !== undefined) {
      this.isDroneActive = active;
    } else {
      this.isDroneActive = !this.isDroneActive;
    }

    if (this.isDroneActive) {
      this.startScheduler();
    } else if (this.activeNotes.size === 0) {
      this.stopScheduler();
    }

    return this.isDroneActive;
  }

  public isDrone(): boolean {
    return this.isDroneActive;
  }

  /**
   * Note On / Note Off for interactive synth keyboard / scale pads
   */
  public noteOn(midiNote: number): void {
    this.activeNotes.add(midiNote);
    this.startScheduler();
  }

  public noteOff(midiNote: number): void {
    this.activeNotes.delete(midiNote);
    if (!this.isDroneActive && this.activeNotes.size === 0) {
      this.stopScheduler();
    }
  }

  /**
   * Granular Clock Scheduler
   */
  private startScheduler(): void {
    if (this.isRunning) return;
    this.initAudio().then(() => {
      this.isRunning = true;
      if (this.ctx) {
        this.lastScheduledTime = this.ctx.currentTime;
      }
      this.scheduleLoop();
    });
  }

  private stopScheduler(): void {
    this.isRunning = false;
    if (this.schedulerTimerId !== null) {
      window.clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  private scheduleLoop = (): void => {
    if (!this.isRunning || !this.ctx || !this.audioBuffer) {
      this.schedulerTimerId = window.setTimeout(this.scheduleLoop, 35);
      return;
    }

    const currentTime = this.ctx.currentTime;
    const lookahead = 0.08; // 80ms lookahead
    const grainInterval = 1.0 / Math.max(1, this.params.density);

    while (this.lastScheduledTime < currentTime + lookahead) {
      // Advance playhead if scanSpeed is active and not frozen
      if (!this.params.isFrozen && this.params.scanSpeed !== 0) {
        const step = (this.params.scanSpeed * grainInterval) / this.audioBuffer.duration;
        let nextPos = this.params.position + step;
        if (nextPos > 1.0) nextPos = nextPos % 1.0;
        if (nextPos < 0.0) nextPos = (nextPos % 1.0) + 1.0;
        this.params.position = nextPos;
        if (this.playheadPositionListener) {
          this.playheadPositionListener(nextPos);
        }
      }

      // If activeNotes are pressed, trigger grains tuned to those notes
      if (this.activeNotes.size > 0) {
        this.activeNotes.forEach((midi) => {
          const semitoneOffset = midi - 60; // 60 = Middle C
          this.spawnGrain(this.lastScheduledTime, semitoneOffset);
        });
      } else if (this.isDroneActive) {
        this.spawnGrain(this.lastScheduledTime, 0);
      }

      this.lastScheduledTime += grainInterval;
    }

    this.schedulerTimerId = window.setTimeout(this.scheduleLoop, 25);
  };

  /**
   * Spawns a single grain voice with pitch, window envelope, stereo pan, and reverse options
   */
  private spawnGrain(scheduleTime: number, noteSemitones: number = 0): void {
    if (!this.ctx || !this.audioBuffer || !this.filterNode) return;

    const grainDuration = Math.max(0.015, this.params.grainSize);
    const { startOffset, actualDuration, isReversed } = calculateGrainOffset(
      this.params.position,
      this.params.spray,
      this.audioBuffer.duration,
      grainDuration,
      this.params.reverseChance
    );

    // Create source
    const source = this.ctx.createBufferSource();
    source.buffer = this.audioBuffer;

    // Pitch calculation
    const randomJitter = (Math.random() * 2 - 1) * this.params.pitchJitterCents;
    const totalSemitones = this.params.pitchSemitones + noteSemitones;
    const rate = pitchToPlaybackRate(totalSemitones, this.params.pitchCents, randomJitter);
    source.playbackRate.setValueAtTime(rate, scheduleTime);

    // Envelope Gain
    const grainGain = this.ctx.createGain();
    grainGain.gain.setValueAtTime(0, scheduleTime);

    // Apply window curve via gain automation
    const attackTime = actualDuration * 0.3;
    const releaseTime = actualDuration * 0.5;
    grainGain.gain.linearRampToValueAtTime(1.0, scheduleTime + attackTime);
    grainGain.gain.linearRampToValueAtTime(0, scheduleTime + actualDuration);

    // Stereo Panner
    let panner: StereoPannerNode | GainNode;
    const panOffset = (Math.random() * 2 - 1) * this.params.panSpread;
    if (this.ctx.createStereoPanner) {
      const stereoPanner = this.ctx.createStereoPanner();
      stereoPanner.pan.setValueAtTime(panOffset, scheduleTime);
      panner = stereoPanner;
    } else {
      panner = this.ctx.createGain();
    }

    // Connect grain voice: source -> grainGain -> panner -> filterNode
    source.connect(grainGain);
    grainGain.connect(panner);
    panner.connect(this.filterNode);

    // Schedule play & stop
    const safeStart = Math.max(0, startOffset);
    source.start(scheduleTime, safeStart, actualDuration);
    source.stop(scheduleTime + actualDuration + 0.05);

    // Cleanup nodes after grain expires
    setTimeout(() => {
      source.disconnect();
      grainGain.disconnect();
      panner.disconnect();
    }, (actualDuration + 0.1) * 1000);

    // Notify visualizer
    const visualEvent: GrainVisualEvent = {
      id: ++this.grainCounter,
      position: this.params.position,
      pan: panOffset,
      size: actualDuration,
      pitchRate: rate,
      isReversed,
      time: performance.now(),
    };

    for (const listener of this.grainVisualListeners) {
      listener(visualEvent);
    }
  }

  /**
   * Subscribe to grain visual events for drawing Frutiger Aero bubble clouds
   */
  public addGrainVisualListener(listener: (e: GrainVisualEvent) => void): () => void {
    this.grainVisualListeners.push(listener);
    return () => {
      this.grainVisualListeners = this.grainVisualListeners.filter((l) => l !== listener);
    };
  }

  public setPlayheadPositionListener(listener: ((pos: number) => void) | null): void {
    this.playheadPositionListener = listener;
  }

  /* ========================================================================= */
  /* RESAMPLE / AUDIO EXPORT SYSTEM                                           */
  /* ========================================================================= */

  public startResampling(onTimeUpdate?: (elapsed: number) => void): boolean {
    if (this.isResampling || !this.ctx || !this.masterGain) return false;

    this.isResampling = true;
    this.resampleStartTime = performance.now();
    this.resampleChannelL = [];
    this.resampleChannelR = [];
    this.onResampleTimeUpdate = onTimeUpdate || null;

    // We tap the masterGain output into a ScriptProcessorNode for lossless 32-bit float PCM capture
    const bufferSize = 4096;
    this.resampleScriptNode = this.ctx.createScriptProcessor(bufferSize, 2, 2);

    this.resampleScriptNode.onaudioprocess = (e) => {
      if (!this.isResampling) return;
      const inL = e.inputBuffer.getChannelData(0);
      const inR = e.inputBuffer.getChannelData(1);

      // Clone samples into storage arrays
      this.resampleChannelL.push(new Float32Array(inL));
      this.resampleChannelR.push(new Float32Array(inR));
    };

    // Tap without interfering with master destination
    this.masterGain.connect(this.resampleScriptNode);
    this.resampleScriptNode.connect(this.ctx.destination);

    // Live update timer for the UI recording badge
    this.resampleTimerInterval = window.setInterval(() => {
      if (this.onResampleTimeUpdate) {
        const elapsedSec = (performance.now() - this.resampleStartTime) / 1000;
        this.onResampleTimeUpdate(elapsedSec);
      }
    }, 100);

    return true;
  }

  public stopResampling(takeName?: string): ResampleTake | null {
    if (!this.isResampling || !this.ctx || !this.resampleScriptNode) return null;

    this.isResampling = false;
    if (this.resampleTimerInterval !== null) {
      clearInterval(this.resampleTimerInterval);
      this.resampleTimerInterval = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect(this.resampleScriptNode);
    }
    this.resampleScriptNode.disconnect();
    this.resampleScriptNode = null;

    const sampleRate = this.ctx.sampleRate;
    const totalChunks = this.resampleChannelL.length;
    if (totalChunks === 0) return null;

    // Concatenate chunks into continuous Float32Arrays
    const totalSamples = totalChunks * 4096;
    const mergedL = new Float32Array(totalSamples);
    const mergedR = new Float32Array(totalSamples);

    let offset = 0;
    for (let i = 0; i < totalChunks; i++) {
      mergedL.set(this.resampleChannelL[i], offset);
      mergedR.set(this.resampleChannelR[i], offset);
      offset += 4096;
    }

    // Encode to WAV Blob using pure encodeWav utility
    const wavBlob = encodeWav([mergedL, mergedR], sampleRate);
    const url = URL.createObjectURL(wavBlob);
    const duration = totalSamples / sampleRate;

    const take: ResampleTake = {
      id: `take_${Date.now()}`,
      name: takeName || `AeroGrain_Take_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
      blob: wavBlob,
      url,
      duration,
      timestamp: new Date(),
      sizeBytes: wavBlob.size,
    };

    this.takes = [take, ...this.takes];
    for (const l of this.takesListeners) {
      l(this.takes);
    }

    return take;
  }

  public getTakes(): ResampleTake[] {
    return [...this.takes];
  }

  public deleteTake(id: string): void {
    this.takes = this.takes.filter((t) => t.id !== id);
    for (const l of this.takesListeners) {
      l(this.takes);
    }
  }

  public addTakesListener(listener: (takes: ResampleTake[]) => void): () => void {
    this.takesListeners.push(listener);
    return () => {
      this.takesListeners = this.takesListeners.filter((l) => l !== listener);
    };
  }

  public getIsResampling(): boolean {
    return this.isResampling;
  }
}

// Global Singleton for easy state sharing across UI controls
export const engine = new GranularEngine();
