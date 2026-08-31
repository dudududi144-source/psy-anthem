// PSY ANTHEM - tests/harmony/intervals.test.ts
import { describe, it, expect } from 'bun:test';
import {
  isConsonant, isDissonant, intervalClass,
  scalePitchClasses, isInScale, snapToScale,
} from '../../src/harmony/intervals';

describe('Intervals', () => {
  it('classifies consonance', () => {
    expect(isConsonant(7)).toBe(true);   // P5
    expect(isConsonant(4)).toBe(true);   // M3
    expect(isConsonant(3)).toBe(true);   // m3
  });

  it('classifies dissonance', () => {
    expect(isDissonant(6)).toBe(true);   // tritone
    expect(isDissonant(1)).toBe(true);   // m2
    expect(isDissonant(11)).toBe(true);  // M7
  });

  it('intervalClass is symmetric mod 12', () => {
    expect(intervalClass(60, 67)).toBe(7);
    expect(intervalClass(67, 60)).toBe(7);
    expect(intervalClass(60, 72)).toBe(0);
  });
});

describe('Scales', () => {
  it('C natural minor pitch classes', () => {
    const pcs = scalePitchClasses({ root: 0, mode: 'minor' });
    expect(pcs).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('A major pitch classes', () => {
    const pcs = scalePitchClasses({ root: 9, mode: 'major' });
    expect(pcs).toEqual([9, 11, 1, 2, 4, 6, 8]);
  });

  it('isInScale works', () => {
    const pcs = scalePitchClasses({ root: 0, mode: 'minor' });
    expect(isInScale(60, pcs)).toBe(true);
    expect(isInScale(61, pcs)).toBe(false);
    expect(isInScale(72, pcs)).toBe(true);
  });

  it('snapToScale snaps to nearest in-scale pitch', () => {
    const pcs = scalePitchClasses({ root: 0, mode: 'minor' });
    const snapped = snapToScale(61, pcs, 48, 84);
    expect(isInScale(snapped, pcs)).toBe(true);
    expect(Math.abs(snapped - 61)).toBeLessThanOrEqual(1);
  });

  it('snapToScale respects bounds', () => {
    const pcs = scalePitchClasses({ root: 0, mode: 'minor' });
    const snapped = snapToScale(120, pcs, 48, 84);
    expect(snapped).toBeGreaterThanOrEqual(48);
    expect(snapped).toBeLessThanOrEqual(84);
  });
});
