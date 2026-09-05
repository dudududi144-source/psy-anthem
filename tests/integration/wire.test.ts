// PSY ANTHEM - tests/integration/wire.test.ts
// Task 17: the WHAT→HOW wire conformance suite.
//
// These tests pin the claim CONTRACT.md used to make and break: the wire
// this repo emits is REAL PSYBUS v2, validated by the verbatim foundation
// codec, mappable 1:1 to foundation's /api/render-notes. If any of these
// fail, the wire is lying again — fix the mapping, not the test.
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine } from '../../src/engine';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';
import {
  anthemToWire,
  wireToRenderNotesBody,
  wireSize,
  FOUNDATION_TRACKS,
  VOICE_TRACK_MAP,
} from '../../src/integration/wire';
import { validateEnvelope, canonicalJson } from '../../src/foundation-shim/psybus-v2-envelope';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

function gen(overrides: Partial<AnthemConfig> = {}) {
  const out = createAnthemEngine({ ...base, ...overrides }).generate();
  expect(out).not.toBeNull();
  return out!;
}

describe('Task 17 — anthemToWire (PSYBUS v2 conformance)', () => {
  it('maps every note event 1:1 onto validated envelopes (nothing lost, nothing rejected)', () => {
    const out = gen();
    const notes = out.events.filter((e) => e.type === 'note').length;
    const wire = anthemToWire(out, { bpm: 140 });
    expect(wire.envelopes.length).toBe(notes);
    expect(wire.rejected).toBe(0);
    expect(wire.unmappedChannel).toBe(0);
  });

  it('every envelope passes foundation validateEnvelope independently (spot check all)', () => {
    const wire = anthemToWire(gen(), { bpm: 145 });
    for (const env of wire.envelopes) {
      expect(validateEnvelope(env).ok).toBe(true);
    }
  });

  it('payload fields obey the foundation bounds (note 0-127, vel 0..1, known track)', () => {
    const wire = anthemToWire(gen(), { bpm: 140 });
    for (const env of wire.envelopes) {
      const p = env.payload;
      expect(p.kind).toBe('note');
      expect(p.note).toBeGreaterThanOrEqual(0);
      expect(p.note).toBeLessThanOrEqual(127);
      expect(p.vel).toBeGreaterThanOrEqual(0);
      expect(p.vel).toBeLessThanOrEqual(1);
      expect(FOUNDATION_TRACKS).toContain(p.track);
      expect(p.durBeats).toBeGreaterThanOrEqual(0);
    }
  });

  it('time math: envelope ts (seconds) = beats × 60/bpm; span fits the section', () => {
    const bpm = 145;
    const out = gen({ bars: 8 });
    const wire = anthemToWire(out, { bpm });
    const first = out.events.find((e) => e.type === 'note')!;
    expect(wire.envelopes[0]!.ts).toBeCloseTo(first.timestamp * (60 / bpm), 6);
    expect(wire.spanSec).toBeLessThanOrEqual(8 * 4 * (60 / bpm) + 1e-9);
    expect(wire.spanSec).toBeGreaterThan(8 * 4 * (60 / bpm) - 2); // music reaches the last bars
  });

  it('voice mapping: lead→lead, harmony→pad, counter→counter, bass→bass', () => {
    expect(VOICE_TRACK_MAP[0]).toBe('lead');
    expect(VOICE_TRACK_MAP[1]).toBe('pad');
    expect(VOICE_TRACK_MAP[2]).toBe('counter');
    expect(VOICE_TRACK_MAP[3]).toBe('bass');
    // A 4-voice generation exercises all four mappings.
    const out = gen({ voices: 4, bars: 8 });
    const wire = anthemToWire(out, { bpm: 140 });
    const used = new Set(wire.envelopes.map((e) => e.payload.track));
    expect(used.size).toBeGreaterThanOrEqual(3); // dense 4-voice section uses multiple voices
  });

  it('determinism: same seed → byte-identical canonical wire; different seed → different', () => {
    const a = anthemToWire(gen({ seed: 42, bars: 8 }), { bpm: 140 });
    const b = anthemToWire(gen({ seed: 42, bars: 8 }), { bpm: 140 });
    const c = anthemToWire(gen({ seed: 43, bars: 8 }), { bpm: 140 });
    expect(canonicalJson(a.envelopes)).toBe(canonicalJson(b.envelopes));
    expect(canonicalJson(a.envelopes)).not.toBe(canonicalJson(c.envelopes));
  });

  it('rev is monotonic and seed is carried from the composition', () => {
    const wire = anthemToWire(gen({ seed: 4242, bars: 8 }), { bpm: 140 });
    wire.envelopes.forEach((env, i) => {
      expect(env.rev).toBe(i + 1);
      expect(env.seed).toBe(4242);
    });
  });

  it('renders-notes body: envelope array passes foundation-side validation rules verbatim', () => {
    const wire = anthemToWire(gen({ bars: 8 }), { bpm: 145 });
    const body = JSON.parse(
      wireToRenderNotesBody(wire.envelopes, { seed: 42, bpm: 145, bars: 8 })
    ) as { seed: number; bpm: number; bars: number; notes: unknown[] };
    expect(body.notes.length).toBe(wire.envelopes.length);
    for (const n of body.notes) {
      // Foundation's endpoint runs validateEnvelope on every array element —
      // the same codec this repo vendors, so this IS the endpoint's check.
      const r = validateEnvelope(n);
      expect(r.ok).toBe(true);
    }
  });

  it('wire size is bounded (measured: ~2.1 KB per bar on the canonical config)', () => {
    const out = gen({ bars: 32 });
    const wire = anthemToWire(out, { bpm: 140 });
    const bytesPerBar = wire.wireBytes / 32;
    // Full PSYBUS v2 envelopes (6 fields + provenance-free note payload) cost
    // ~2.1 KB/bar at 140 BPM ≈ 9 KB/s of music — cheap for HTTP, fine for a
    // local bus. Guard against accidental blow-up (e.g. adding fat fields).
    expect(bytesPerBar).toBeLessThan(3072);
    expect(bytesPerBar).toBeGreaterThan(512);
    expect(wireSize(wire.envelopes)).toBe(wire.wireBytes);
  });

  it('all 11 intents × 4 voices × curves produce a conformant wire (the grid)', () => {
    const intents = Object.values(AnthemIntent);
    const curves = [
      EnergyCurve.FLAT,
      EnergyCurve.ARC,
      EnergyCurve.BUILD_DROP,
      EnergyCurve.WAVE,
    ];
    for (const intent of intents) {
      for (const voices of [1, 4]) {
        for (const energyCurve of curves) {
          const out = gen({ intent, voices, energyCurve, bars: 8, seed: 7 });
          const wire = anthemToWire(out, { bpm: 140 });
          expect(wire.rejected).toBe(0);
          expect(wire.envelopes.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
