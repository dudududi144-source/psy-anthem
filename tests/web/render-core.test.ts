// PSY ANTHEM - tests/web/render-core.test.ts
// Golden-style tests for the v9 sound-library renderer: determinism, format,
// and sound selection.
import { describe, it, expect } from 'bun:test';
import { renderSong } from '../../web/render-core.js';

function makeEvents() {
  const events = [];
  for (let i = 0; i < 32; i++) {
    events.push({
      type: 'note',
      timestamp: i * 0.5,
      duration: 0.5,
      channel: i % 4,
      data: { pitch: 57 + (i % 12), velocity: 90 + (i % 20) },
    });
  }
  return events;
}
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

describe('render-core (v9 sound library)', () => {
  it('renders a valid stereo WAV with peaks (default sounds)', () => {
    const out = renderSong(makeEvents(), 140);
    expect(out.wav.length).toBeGreaterThan(44);
    expect(String.fromCharCode(out.wav[0], out.wav[1], out.wav[2], out.wav[3])).toBe('RIFF');
    expect(String.fromCharCode(out.wav[8], out.wav[9], out.wav[10], out.wav[11])).toBe('WAVE');
    expect(out.wav[22]).toBe(2); // stereo
    expect(out.wav[34]).toBe(16); // 16-bit
    expect(out.seconds).toBeGreaterThan(0);
    expect(out.peaks.length).toBe(900);
    expect(out.peaks.some((p: number) => p > 0.1)).toBe(true);
  });

  it('is deterministic: same input -> byte-identical WAV', () => {
    const a = renderSong(makeEvents(), 140);
    const b = renderSong(makeEvents(), 140);
    expect(sameBytes(a.wav, b.wav)).toBe(true);
    expect(a.seconds).toBe(b.seconds);
  });

  it('is deterministic with explicit sound selection (intent + seed)', () => {
    const opts = { intent: 'dark-psy', seed: 7 };
    const a = renderSong(makeEvents(), 140, undefined, opts);
    const b = renderSong(makeEvents(), 140, undefined, { intent: 'dark-psy', seed: 7 });
    expect(sameBytes(a.wav, b.wav)).toBe(true);
  });

  it('different intents select different sounds (byte-different output)', () => {
    // lead pools of euphoric-trance [0,1,3] and dark-psy [5,2] are disjoint,
    // so the renders must differ regardless of seed.
    const a = renderSong(makeEvents(), 140, undefined, { intent: 'euphoric-trance', seed: 3 });
    const b = renderSong(makeEvents(), 140, undefined, { intent: 'dark-psy', seed: 3 });
    expect(sameBytes(a.wav, b.wav)).toBe(false);
  });

  it('sound selection differs from the default sound set', () => {
    const dflt = renderSong(makeEvents(), 140);
    const dark = renderSong(makeEvents(), 140, undefined, { intent: 'dark-psy', seed: 1 });
    expect(sameBytes(dflt.wav, dark.wav)).toBe(false);
  });

  it('different bpm changes the render', () => {
    const a = renderSong(makeEvents(), 140);
    const b = renderSong(makeEvents(), 100);
    expect(a.wav.length).not.toBe(b.wav.length);
  });

  it('reports monotonic progress within 0..90', () => {
    const seen: number[] = [];
    renderSong(makeEvents(), 140, (p: number) => seen.push(p));
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    for (const p of seen) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(90); }
  });

  it('throws on empty input', () => {
    expect(() => renderSong([], 140)).toThrow();
  });
});
