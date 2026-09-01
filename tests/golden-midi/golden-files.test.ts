// PSY ANTHEM - tests/golden-midi/golden-files.test.ts
// Golden byte-stability guard: every golden MIDI file must match
// a fresh generation byte-for-byte. If this fails, either the engine
// or the SMF encoder changed output -> regenerate goldens deliberately:
//   bun run scripts/generate-golden.ts
import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import { createAnthemEngine } from '../../src/index';
import { toMidi } from '../../src/export';
import { GOLDEN_SPECS } from '../../scripts/generate-golden';

describe('Golden MIDI files', () => {
  it('has exactly 10 golden specs', () => {
    expect(GOLDEN_SPECS.length).toBe(10);
  });

  for (const spec of GOLDEN_SPECS) {
    it(spec.file + ' is byte-identical to a fresh generation', () => {
      const path = 'golden-midi/' + spec.file;
      expect(fs.existsSync(path)).toBe(true);

      const out = createAnthemEngine(spec.config).generate();
      expect(out).not.toBeNull();

      const fresh = toMidi(out!, { bpm: spec.config.bpm ?? 140 });
      const golden = fs.readFileSync(path);
      expect(golden.length).toBe(fresh.length);
      expect(Array.from(golden)).toEqual(Array.from(fresh));
    });
  }
});
