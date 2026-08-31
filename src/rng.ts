// PSY ANTHEM — rng.ts
// Deterministic RNG: single source of randomness for the entire engine.
// mulberry32: fast, high-quality 32-bit PRNG with excellent distribution.

export interface WeightedChoice<T> { value: T; weight: number; }

export interface RNG {
  next(): number;
  nextInt(min: number, max: number): number;
  nextFloat(min: number, max: number): number;
  nextBool(probability?: number): boolean;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  weighted<T>(choices: ReadonlyArray<WeightedChoice<T>>): T;
}

export function createRNG(seed: number): RNG {
  let state = seed | 0;

  function next(): number {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }

  function nextFloat(min: number, max: number): number {
    return min + next() * (max - min);
  }

  function nextBool(probability: number = 0.5): boolean {
    return next() < probability;
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(next() * arr.length)]!;
  }

  function shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
    return result;
  }

  function weighted<T>(choices: ReadonlyArray<WeightedChoice<T>>): T {
    if (choices.length === 0) throw new Error('Cannot weight from empty choices');
    const total = choices.reduce((s, c) => s + c.weight, 0);
    let r = next() * total;
    for (const c of choices) {
      r -= c.weight;
      if (r < 0) return c.value;
    }
    return choices[choices.length - 1]!.value;
  }

  return { next, nextInt, nextFloat, nextBool, pick, shuffle, weighted };
}

// Derive N distinct deterministic sub-seeds from a master seed.
export function deriveSeeds(masterSeed: number, count: number): number[] {
  const rng = createRNG(masterSeed);
  const seen = new Set<number>();
  const out: number[] = [];
  while (out.length < count) {
    const s = rng.nextInt(1, 0x7FFFFFFE);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
