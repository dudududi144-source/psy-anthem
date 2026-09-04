// PSY ANTHEM - tests/web/render-core.test.ts
// Golden-style tests for the v7 audio renderer core: determinism and format.
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

describe('render-core (v7 audio renderer)', () => {
  it('renders a valid stereo WAV with peaks', () => {
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
    expect(a.wav.length).toBe(b.wav.length);
    let identical = true;
    for (let i = 0; i < a.wav.length; i++) {
      if (a.wav[i] !== b.wav[i]) { identical = false; break; }
    }
    expect(identical).toBe(true);
    expect(a.seconds).toBe(b.seconds);
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
