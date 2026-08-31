// PSY ANTHEM - tests/integration/full-pipeline.test.ts
// Config -> engine -> SMF bytes, end to end.
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { toMidi } from '../../src/export';

const config: AnthemConfig = {
  seed: 2026,
  intent: AnthemIntent.FULL_ON,
  scale: { root: 5, mode: 'minor' },
  energyCurve: EnergyCurve.BUILD_DROP,
  targetRange: { min: 48, max: 84 },
  voices: 4,
  bars: 24,
  bpm: 138,
};

describe('Full pipeline: config -> MIDI', () => {
  it('produces a complete, decodable SMF from a raw config', () => {
    const out = createAnthemEngine(config).generate();
    expect(out).not.toBeNull();

    const bytes = toMidi(out!, { bpm: config.bpm ?? 140 });
    expect(bytes.length).toBeGreaterThan(100);

    // Header
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    expect((bytes[8]! << 8) | bytes[9]!).toBe(1);              // format
    expect((bytes[10]! << 8) | bytes[11]!).toBe(config.voices); // tracks
    expect((bytes[12]! << 8) | bytes[13]!).toBe(480);           // division

    // Walk every track chunk and confirm each ends with EOT
    let pos = 14;
    let seen = 0;
    while (pos < bytes.length) {
      expect(Array.from(bytes.slice(pos, pos + 4))).toEqual([0x4d, 0x54, 0x72, 0x6b]);
      const len = ((bytes[pos + 4]! << 24) | (bytes[pos + 5]! << 16) | (bytes[pos + 6]! << 8) | bytes[pos + 7]!) >>> 0;
      const end = pos + 8 + len;
      expect(Array.from(bytes.slice(end - 3, end))).toEqual([0xff, 0x2f, 0x00]);
      pos = end;
      seen++;
    }
    expect(seen).toBe(config.voices);
  });

  it('respects a custom BPM in the tempo meta event', () => {
    const out = createAnthemEngine(config).generate()!;
    const bytes = toMidi(out, { bpm: 138 });
    const track0Start = 14 + 8; // after header; find FF 51 03 anywhere in track 0
    const uspq = Math.round(60000000 / 138);
    let found = false;
    for (let i = track0Start; i + 5 < bytes.length && i < track0Start + 200; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0x51 && bytes[i + 2] === 0x03) {
        const v = (bytes[i + 3]! << 16) | (bytes[i + 4]! << 8) | bytes[i + 5]!;
        if (v === uspq) found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
