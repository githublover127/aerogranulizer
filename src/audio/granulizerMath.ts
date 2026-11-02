/**
 * Pure math and encoding utilities for Granular Synthesis & Resampling.
 * Decoupled from Web Audio API nodes for deterministic testing.
 */

export type EnvelopeType = 'hann' | 'gaussian' | 'triangle' | 'linear' | 'percussive';

/**
 * Generates an envelope window of length `sampleCount`.
 * Values are normalized between 0.0 and 1.0.
 */
export function calculateGrainEnvelope(type: EnvelopeType, sampleCount: number): Float32Array {
  const env = new Float32Array(sampleCount);
  if (sampleCount <= 0) return env;
  if (sampleCount === 1) {
    env[0] = 1.0;
    return env;
  }

  for (let i = 0; i < sampleCount; i++) {
    const phase = i / (sampleCount - 1); // 0 to 1

    switch (type) {
      case 'hann':
        // Standard Hann window (cosine bell)
        env[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase));
        break;

      case 'gaussian': {
        // Gaussian window with standard deviation sigma = 0.4
        const a = (phase - 0.5) / 0.4;
        env[i] = Math.exp(-0.5 * a * a);
        break;
      }

      case 'triangle':
        // Triangle window
        env[i] = 1 - Math.abs(2 * phase - 1);
        break;

      case 'percussive':
        // Sharp exponential decay (good for plucked / percussive grains)
        env[i] = Math.exp(-5 * phase);
        break;

      case 'linear':
      default:
        // Trapezoidal or gentle linear ramp up 15% and down 15%
        if (phase < 0.15) {
          env[i] = phase / 0.15;
        } else if (phase > 0.85) {
          env[i] = (1 - phase) / 0.15;
        } else {
          env[i] = 1.0;
        }
        break;
    }
  }

  return env;
}

/**
 * Calculates the playback rate multiplier from semitones and fine cents.
 * rate = 2 ^ ((semitones + cents/100) / 12)
 */
export function pitchToPlaybackRate(
  semitones: number,
  cents: number = 0,
  randomDetuneCents: number = 0
): number {
  const totalCents = semitones * 100 + cents + randomDetuneCents;
  const rate = Math.pow(2, totalCents / 1200);
  return Math.max(0.05, Math.min(16.0, rate)); // Guard against extreme values
}

/**
 * Computes the grain start offset and safe duration within an audio buffer.
 *
 * @param positionRatio 0.0 to 1.0 (where the scrubber playhead is)
 * @param sprayRatio 0.0 to 1.0 (random dispersion around position)
 * @param bufferDuration total length of buffer in seconds
 * @param grainDuration desired duration of the grain in seconds
 * @param reverseChance 0.0 to 1.0 probability of grain being reversed
 * @param randomSeedFn optional PRNG for deterministic testing
 */
export function calculateGrainOffset(
  positionRatio: number,
  sprayRatio: number,
  bufferDuration: number,
  grainDuration: number,
  reverseChance: number = 0,
  randomSeedFn: () => number = Math.random
): {
  startOffset: number;
  actualDuration: number;
  isReversed: boolean;
} {
  if (bufferDuration <= 0) {
    return { startOffset: 0, actualDuration: 0, isReversed: false };
  }

  // Add random spray around position (bipolar: -0.5 to +0.5)
  const sprayOffset = (randomSeedFn() - 0.5) * sprayRatio;
  let targetRatio = positionRatio + sprayOffset;

  // Wrap or clamp within 0 and 1
  targetRatio = Math.max(0, Math.min(1, targetRatio));

  let startOffset = targetRatio * bufferDuration;
  const safeGrainDuration = Math.min(grainDuration, bufferDuration);

  // Ensure grain start + duration doesn't exceed buffer end
  if (startOffset + safeGrainDuration > bufferDuration) {
    startOffset = Math.max(0, bufferDuration - safeGrainDuration);
  }

  const isReversed = reverseChance > 0 && randomSeedFn() < reverseChance;

  return {
    startOffset,
    actualDuration: safeGrainDuration,
    isReversed,
  };
}

/**
 * Encodes audio channel data (Float32Array for left/right) into a standard 16-bit PCM WAV Blob.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0]?.length || 0;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  /* "fmt " sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  /* "data" sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels & write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Hard clamp between -1.0 and 1.0 to prevent wrapping distortion
      sample = Math.max(-1.0, Math.min(1.0, sample));
      // Convert float [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(intSample), true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Formats a duration in seconds to "MM:SS.ss"
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toFixed(1).padStart(4, '0');
  return `${minsStr}:${secsStr}`;
}
