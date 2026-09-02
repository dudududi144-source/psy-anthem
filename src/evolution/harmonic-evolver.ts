// PSY ANTHEM - src/evolution/harmonic-evolver.ts
// Harmonic evolution (phase 13): chord substitutions applied over time.
// Deterministic for a given RNG stream. Supports tritone / relative /
// parallel / chromatic substitutions with an allowlist.

import type { RNG } from '../rng';
import type { ChordSymbol } from '../types';
import type { HarmonicSubstitution } from '../integration/psybus-types';

export interface HarmonicEvolutionConfig {
  substitutionRate: number; // 0-1 per chord
  allowedSubstitutions: HarmonicSubstitution[];
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export class HarmonicEvolver {
  private readonly originalProgression: ChordSymbol[];
  private progression: ChordSymbol[];
  private readonly rng: RNG;
  private readonly config: HarmonicEvolutionConfig;

  constructor(progression: ChordSymbol[], rng: RNG, config: HarmonicEvolutionConfig) {
    this.originalProgression = progression.map((c) => ({ ...c }));
    this.progression = progression.map((c) => ({ ...c }));
    this.rng = rng;
    this.config = config;
  }

  /** Apply substitutions probabilistically; returns the evolved progression. */
  evolve(): ChordSymbol[] {
    const evolved = this.progression.map((c) => ({ ...c }));
    for (let i = 0; i < evolved.length; i++) {
      if (this.rng.next() < this.config.substitutionRate) {
        const sub = this.chooseSubstitution(evolved[i]!, i, evolved);
        if (sub) evolved[i] = sub;
      }
    }
    this.progression = evolved;
    return this.progression.map((c) => ({ ...c }));
  }

  getProgression(): ChordSymbol[] {
    return this.progression.map((c) => ({ ...c }));
  }

  getOriginalProgression(): ChordSymbol[] {
    return this.originalProgression.map((c) => ({ ...c }));
  }

  reset(): void {
    this.progression = this.originalProgression.map((c) => ({ ...c }));
  }

  // ---- internals ----

  private chooseSubstitution(
    chord: ChordSymbol,
    index: number,
    progression: ChordSymbol[],
  ): ChordSymbol | null {
    if (this.config.allowedSubstitutions.length === 0) return null;
    const type = this.rng.pick(this.config.allowedSubstitutions);

    switch (type) {
      case 'tritone': {
        // Tritone substitution applies to dominant chords.
        if (chord.quality !== 'dominant7' && chord.quality !== 'dominant13') return null;
        return { ...chord, root: mod12(chord.root + 6) };
      }

      case 'relative': {
        const isMinor = chord.quality.includes('minor');
        if (isMinor) {
          return { ...chord, root: mod12(chord.root + 3), quality: 'major' };
        }
        return { ...chord, root: mod12(chord.root - 3), quality: 'minor' };
      }

      case 'parallel': {
        const isMinor = chord.quality.includes('minor');
        return { ...chord, quality: isMinor ? 'major' : 'minor' };
      }

      case 'chromatic': {
        // Chromatic approach into the NEXT chord from a half-step below.
        const nextChord = progression[index + 1];
        if (!nextChord) return null;
        return { ...chord, root: mod12(nextChord.root - 1), quality: 'dominant7' };
      }
    }
  }
}
