import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGrainEnvelope,
  pitchToPlaybackRate,
  calculateGrainOffset,
  encodeWav,
  formatTime,
} from './granulizerMath';

test('calculateGrainEnvelope generates symmetric Hann window with 0 edges and ~1 center', () => {
  const env = calculateGrainEnvelope('hann', 101);
  assert.equal(env.length, 101);
  assert.ok(Math.abs(env[0] - 0) < 0.001, 'First sample should be 0');
  assert.ok(Math.abs(env[100] - 0) < 0.001, 'Last sample should be 0');
  assert.ok(Math.abs(env[50] - 1.0) < 0.001, 'Midpoint should be 1.0');
});

test('calculateGrainEnvelope handles triangle and percussive envelopes', () => {
  const tri = calculateGrainEnvelope('triangle', 101);
  assert.ok(Math.abs(tri[0]) < 0.001);
  assert.ok(Math.abs(tri[50] - 1.0) < 0.001);

  const perc = calculateGrainEnvelope('percussive', 100);
  assert.ok(Math.abs(perc[0] - 1.0) < 0.001, 'Percussive envelope starts at 1');
  assert.ok(perc[99] < 0.01, 'Percussive envelope decays rapidly towards 0');
});

test('pitchToPlaybackRate converts semitones correctly', () => {
  assert.equal(pitchToPlaybackRate(0, 0), 1.0, '0 semitones is 1.0x rate');
  assert.equal(pitchToPlaybackRate(12, 0), 2.0, '+1 octave (+12st) is 2.0x rate');
  assert.equal(pitchToPlaybackRate(-12, 0), 0.5, '-1 octave (-12st) is 0.5x rate');
  assert.ok(Math.abs(pitchToPlaybackRate(7, 0) - 1.4983) < 0.01, 'Fifth (+7st) is ~1.5x rate');
});

test('calculateGrainOffset respects buffer boundaries and spray range', () => {
  const bufferDuration = 5.0; // 5 seconds
  const grainDuration = 0.2; // 200ms

  // Fixed deterministic PRNG that yields 0.5 (exact center, no spray deviation)
  const result = calculateGrainOffset(0.5, 0.2, bufferDuration, grainDuration, 0, () => 0.5);
  assert.equal(result.startOffset, 2.5);
  assert.equal(result.actualDuration, 0.2);
  assert.equal(result.isReversed, false);

  // Near end of buffer, must not overflow buffer bounds
  const endResult = calculateGrainOffset(0.99, 0, bufferDuration, grainDuration, 0, () => 0.5);
  assert.ok(endResult.startOffset + endResult.actualDuration <= bufferDuration);
});

test('encodeWav outputs a valid RIFF WAVE buffer with correct size and headers', async () => {
  const sampleRate = 44100;
  const numSamples = 1000;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Fill with dummy sine wave
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((i / 44100) * 440 * 2 * Math.PI);
    right[i] = Math.sin((i / 44100) * 880 * 2 * Math.PI);
  }

  const wavBlob = encodeWav([left, right], sampleRate);
  assert.equal(wavBlob.type, 'audio/wav');
  
  // Total size = 44 bytes header + (1000 samples * 2 channels * 2 bytes/sample) = 44 + 4000 = 4044
  assert.equal(wavBlob.size, 4044);

  const arrayBuffer = await wavBlob.arrayBuffer();
  const view = new DataView(arrayBuffer);
  
  // Check 'RIFF'
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(riff, 'RIFF');
  // Check 'WAVE'
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(wave, 'WAVE');
  // Check Channels = 2
  assert.equal(view.getUint16(22, true), 2);
  // Check Sample Rate = 44100
  assert.equal(view.getUint32(24, true), 44100);
});

test('formatTime formats seconds nicely into MM:SS.s', () => {
  assert.equal(formatTime(0), '00:00.0');
  assert.equal(formatTime(65.4), '01:05.4');
  assert.equal(formatTime(12.89), '00:12.9');
});
