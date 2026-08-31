// PSY ANTHEM - tests/rng.test.ts
import { describe, it, expect } from 'bun:test';
import { createRNG, deriveSeeds } from '../src/rng';

describe('RNG determinism', () => {
  it('same seed produces identical sequence', () => {
    const a = createRNG(42);
    const b = createRNG(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('different seeds produce different sequences', () => {
    const a = createRNG(42);
    const b = createRNG(43);
    const sa: number[] = [];
    const sb: number[] = [];
    for (let i = 0; i < 100; i++) {
      sa.push(a.next());
      sb.push(b.next());
    }
    let allSame = true;
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) allSame = false;
    }
    expect(allSame).toBe(false);
  });

  it('edge seeds work', () => {
    for (const s of [0, -42, 2147483647]) {
      const v = createRNG(s).next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('RNG ranges', () => {
  it('next stays in [0,1)', () => {
    const rng = createRNG(12345);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt inclusive bounds', () => {
    const rng = createRNG(42);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('nextFloat bounds', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('nextBool respects probability', () => {
    const rng = createRNG(42);
    let t = 0;
    for (let i = 0; i < 10000; i++) {
      if (rng.nextBool(0.3)) t++;
    }
    expect(t / 10000).toBeGreaterThan(0.25);
    expect(t / 10000).toBeLessThan(0.35);
    for (let i = 0; i < 50; i++) expect(rng.nextBool(0)).toBe(false);
    for (let i = 0; i < 50; i++) expect(rng.nextBool(1)).toBe(true);
  });
});

describe('RNG pick/shuffle/weighted', () => {
  it('pick returns members and rejects empty', () => {
    const rng = createRNG(42);
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
    expect(() => rng.pick([])).toThrow();
  });

  it('shuffle is deterministic and preserves elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s1 = createRNG(42).shuffle(arr);
    const s2 = createRNG(42).shuffle(arr);
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('weighted respects weights', () => {
    const rng = createRNG(42);
    const choices = [
      { value: 'a', weight: 90 },
      { value: 'b', weight: 10 },
    ];
    let a = 0;
    for (let i = 0; i < 10000; i++) {
      if (rng.weighted(choices) === 'a') a++;
    }
    expect(a / 10000).toBeGreaterThan(0.85);
  });
});

describe('deriveSeeds', () => {
  it('deterministic, unique, correct count', () => {
    expect(deriveSeeds(42, 5)).toEqual(deriveSeeds(42, 5));
    const s = deriveSeeds(42, 10);
    expect(s).toHaveLength(10);
    expect(new Set(s).size).toBe(10);
    expect(deriveSeeds(42, 5)).not.toEqual(deriveSeeds(43, 5));
  });
});
