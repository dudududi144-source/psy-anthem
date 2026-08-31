// PSY ANTHEM - tests/export/midi.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine } from '../../src/index';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig, AnthemOutput } from '../../src/types';
import { toMidi, encodeVarLen, DEFAULT_DIVISION } from '../../src/export';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

function anthem(): AnthemOutput {
  const out = createAnthemEngine(config).generate();
  if (!out) throw new Error('generation failed');
  return out;
}

function u16(bytes: Uint8Array, i: number): number {
  return (bytes[i]! << 8) | bytes[i + 1]!;
}

function u32(bytes: Uint8Array, i: number): number {
  return ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
}

interface TrackSlice { start: number; length: number; data: Uint8Array; }

function parseTracks(bytes: Uint8Array): TrackSlice[] {
  const ntrks = u16(bytes, 10);
  const tracks: TrackSlice[] = [];
  let pos = 14;
  for (let t = 0; t < ntrks; t++) {
    // 'MTrk'
    if (bytes[pos] !== 0x4d || bytes[pos + 1] !== 0x54 || bytes[pos + 2] !== 0x72 || bytes[pos + 3] !== 0x6b) {
      throw new Error('bad MTrk header at track ' + t);
    }
    const length = u32(bytes, pos + 4);
    tracks.push({ start: pos + 8, length, data: bytes.slice(pos + 8, pos + 8 + length) });
    pos += 8 + length;
  }
  return tracks;
}

describe('encodeVarLen', () => {
  it('encodes canonical MIDI examples', () => {
    expect(encodeVarLen(0)).toEqual([0x00]);
    expect(encodeVarLen(0x7f)).toEqual([0x7f]);
    expect(encodeVarLen(0x80)).toEqual([0x81, 0x00]);
    expect(encodeVarLen(0x2000)).toEqual([0xc0, 0x00]);
    expect(encodeVarLen(0x0FFFFFFF)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe('toMidi - SMF structure', () => {
  it('writes a valid MThd header (format 1, correct ntrks, division 480)', () => {
    const bytes = toMidi(anthem(), { bpm: 140 });
    expect(bytes[0]).toBe(0x4d); // M
    expect(bytes[1]).toBe(0x54); // T
    expect(bytes[2]).toBe(0x68); // h
    expect(bytes[3]).toBe(0x64); // d
    expect(u32(bytes, 4)).toBe(6);
    expect(u16(bytes, 8)).toBe(1);              // format 1
    expect(u16(bytes, 10)).toBe(config.voices); // one track per voice
    expect(u16(bytes, 12)).toBe(DEFAULT_DIVISION);
  });

  it('every track chunk is well formed and ends with End-Of-Track', () => {
    const bytes = toMidi(anthem(), { bpm: 140 });
    const tracks = parseTracks(bytes);
    expect(tracks.length).toBe(config.voices);
    for (const tr of tracks) {
      expect(tr.data.length).toBe(tr.length);
      const tail = tr.data.slice(tr.data.length - 3);
      expect(Array.from(tail)).toEqual([0xff, 0x2f, 0x00]);
    }
  });

  it('byte size equals header + all track chunks exactly', () => {
    const bytes = toMidi(anthem(), { bpm: 140 });
    const tracks = parseTracks(bytes);
    let total = 14;
    for (const tr of tracks) total += 8 + tr.length;
    expect(bytes.length).toBe(total);
  });

  it('carries tempo meta (140 BPM) and 4/4 time signature on track 0', () => {
    const bytes = toMidi(anthem(), { bpm: 140 });
    const tracks = parseTracks(bytes);
    const t0 = Array.from(tracks[0]!.data);
    const uspq = Math.round(60000000 / 140);
    const tempoIdx = t0.findIndex((b, i) => b === 0xff && t0[i + 1] === 0x51 && t0[i + 2] === 0x03);
    expect(tempoIdx).toBeGreaterThanOrEqual(0);
    const encoded = (t0[tempoIdx + 3]! << 16) | (t0[tempoIdx + 4]! << 8) | t0[tempoIdx + 5]!;
    expect(encoded).toBe(uspq);
    const tsIdx = t0.findIndex((b, i) => b === 0xff && t0[i + 1] === 0x58 && t0[i + 2] === 0x04);
    expect(tsIdx).toBeGreaterThanOrEqual(0);
    expect(t0[tsIdx + 3]).toBe(4); // numerator
    expect(t0[tsIdx + 4]).toBe(2); // denominator power
  });

  it('emits the expected program change per voice track', () => {
    const bytes = toMidi(anthem(), { bpm: 140 });
    const tracks = parseTracks(bytes);
    const expected = [0, 80, 24, 33];
    for (let v = 0; v < tracks.length; v++) {
      const data = Array.from(tracks[v]!.data);
      const status = 0xc0 | v;
      const pcIdx = data.findIndex((b, i) => b === status);
      expect(pcIdx).toBeGreaterThanOrEqual(0);
      expect(data[pcIdx + 1]).toBe(expected[v]);
    }
  });
});
