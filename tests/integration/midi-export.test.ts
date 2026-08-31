// PSY ANTHEM - tests/integration/midi-export.test.ts
// writeMidiFile round-trip: bytes on disk match the encoder output.
import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { toMidi, writeMidiFile } from '../../src/export';

const config: AnthemConfig = {
  seed: 99,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 4, mode: 'dorian' },
  energyCurve: EnergyCurve.WAVE,
  targetRange: { min: 48, max: 84 },
  voices: 2,
  bars: 12,
  bpm: 136,
};

describe('MIDI file round-trip', () => {
  it('writes a .mid file whose bytes match toMidi exactly', () => {
    const out = createAnthemEngine(config).generate()!;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psy-anthem-'));
    const file = path.join(dir, 'nested', 'out.mid'); // exercises mkdir

    const size = writeMidiFile(out, file, { bpm: 136 });
    expect(fs.existsSync(file)).toBe(true);

    const disk = fs.readFileSync(file);
    expect(disk.length).toBe(size);
    expect(Array.from(disk.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]); // MThd

    const expected = toMidi(out, { bpm: 136 });
    expect(Array.from(disk)).toEqual(Array.from(expected));

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('supports 1-voice output (single track)', () => {
    const out = createAnthemEngine({ ...config, voices: 1 }).generate()!;
    const bytes = toMidi(out, { bpm: 136 });
    expect((bytes[10]! << 8) | bytes[11]!).toBe(1);
  });
});
