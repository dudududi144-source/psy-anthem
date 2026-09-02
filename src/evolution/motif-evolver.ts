// PSY ANTHEM - src/evolution/motif-evolver.ts
// Real-time motif evolution (phase 13): constrained mutations applied over
// time, fully deterministic for a given RNG stream.
//
// Guarantees:
//   - Every applied pitch/interval mutation moves at least 1 semitone and
//     never more than constraints.maxIntervalChange from the ORIGINAL note.
//   - preserveRhythm excludes rhythm mutations; preserveContour excludes
//     contour mutations.
//   - At mutationRate > 0 an evolve() call that passes the rate gate always
//     changes at least one pitch (fallback mutation).

import type { RNG } from '../rng';
import type { MotifDNA } from '../types';
import type { EvolutionDepth } from '../integration/psybus-types';

export interface EvolutionConstraints {
  preserveRhythm: boolean;
  preserveContour: boolean;
  maxIntervalChange: number; // semitones
}

export interface EvolutionConfig {
  mutationRate: number; // 0-1
  evolutionDepth: EvolutionDepth;
  constraints: EvolutionConstraints;
}

export type MutationType = 'pitch' | 'rhythm' | 'interval' | 'contour';

export interface Mutation {
  type: MutationType;
  position: number;
  oldValue: number;
  newValue: number;
}

export interface EvolutionEvent {
  bar: number;
  originalMotif: MotifDNA;
  evolvedMotif: MotifDNA;
  mutations: Mutation[];
}

const RHYTHM_OPTIONS = [0.25, 0.5, 1, 2];

function cloneMotif(m: MotifDNA): MotifDNA {
  return {
    coreNotes: [...m.coreNotes],
    coreRhythm: [...m.coreRhythm],
    transformations: [...m.transformations],
    occurrences: [...m.occurrences],
  };
}

export class MotifEvolver {
  private readonly originalMotif: MotifDNA;
  private currentMotif: MotifDNA;
  private readonly evolutionHistory: EvolutionEvent[] = [];
  private readonly rng: RNG;
  private readonly config: EvolutionConfig;

  constructor(motif: MotifDNA, rng: RNG, config: EvolutionConfig) {
    this.originalMotif = cloneMotif(motif);
    this.currentMotif = cloneMotif(motif);
    this.rng = rng;
    this.config = config;
  }

  /** Possibly evolve this bar; returns the (possibly unchanged) motif. */
  evolve(bar: number): MotifDNA {
    if (this.rng.next() > this.config.mutationRate) {
      return cloneMotif(this.currentMotif);
    }

    const mutations: Mutation[] = [];
    const evolvedNotes = [...this.currentMotif.coreNotes];
    const evolvedRhythm = [...this.currentMotif.coreRhythm];
    const originalSnapshot = [...this.currentMotif.coreNotes];

    const count =
      this.config.evolutionDepth === 'shallow' ? 1 :
      this.config.evolutionDepth === 'medium' ? 2 : 3;

    for (let i = 0; i < count; i++) {
      const type = this.chooseMutationType();
      const position = this.rng.nextInt(0, evolvedNotes.length - 1);
      const m = this.applyMutation(type, position, evolvedNotes, evolvedRhythm, originalSnapshot);
      if (m) mutations.push(m);
    }

    // Guarantee audible evolution: at least one pitch must move.
    const hasPitchChange = mutations.some((m) => m.type === 'pitch' || m.type === 'interval');
    if (!hasPitchChange) {
      const position = this.rng.nextInt(0, evolvedNotes.length - 1);
      const dir = this.rng.nextBool() ? 1 : -1;
      const max = Math.max(1, this.config.constraints.maxIntervalChange);
      const delta = this.rng.nextInt(1, max);
      const oldValue = evolvedNotes[position]!;
      const newValue = Math.max(0, Math.min(127, oldValue + dir * delta));
      evolvedNotes[position] = newValue;
      mutations.push({ type: 'pitch', position, oldValue, newValue });
    }

    const evolvedMotif: MotifDNA = {
      coreNotes: evolvedNotes,
      coreRhythm: evolvedRhythm,
      transformations: [
        ...this.currentMotif.transformations,
        { type: 'EVOLUTION', params: { bar, mutationCount: mutations.length } },
      ],
      occurrences: [...this.currentMotif.occurrences],
    };

    this.evolutionHistory.push({
      bar,
      originalMotif: cloneMotif(this.currentMotif),
      evolvedMotif: cloneMotif(evolvedMotif),
      mutations,
    });
    this.currentMotif = evolvedMotif;
    return cloneMotif(evolvedMotif);
  }

  getCurrentMotif(): MotifDNA {
    return cloneMotif(this.currentMotif);
  }

  getEvolutionHistory(): EvolutionEvent[] {
    return this.evolutionHistory.map((e) => ({
      ...e,
      originalMotif: cloneMotif(e.originalMotif),
      evolvedMotif: cloneMotif(e.evolvedMotif),
      mutations: [...e.mutations],
    }));
  }

  reset(): void {
    this.currentMotif = cloneMotif(this.originalMotif);
    this.evolutionHistory.length = 0;
  }

  // ---- internals ----

  private chooseMutationType(): MutationType {
    const c = this.config.constraints;
    const types: MutationType[] = ['pitch', 'interval'];
    if (!c.preserveRhythm) types.push('rhythm');
    if (!c.preserveContour) types.push('contour');
    return this.rng.pick(types);
  }

  private applyMutation(
    type: MutationType,
    position: number,
    notes: number[],
    rhythm: number[],
    originalNotes: number[],
  ): Mutation | null {
    const max = Math.max(1, this.config.constraints.maxIntervalChange);

    switch (type) {
      case 'pitch': {
        let delta = this.rng.nextInt(-max, max);
        if (delta === 0) delta = 1;
        const oldValue = notes[position]!;
        let newValue = oldValue + delta;
        // Keep within maxIntervalChange of the ORIGINAL note.
        const orig = originalNotes[position]!;
        if (Math.abs(newValue - orig) > max) {
          newValue = orig + (newValue > orig ? max : -max);
        }
        newValue = Math.max(0, Math.min(127, newValue));
        notes[position] = newValue;
        return { type: 'pitch', position, oldValue, newValue };
      }

      case 'rhythm': {
        const oldValue = rhythm[position]!;
        const newValue = this.rng.pick(RHYTHM_OPTIONS);
        rhythm[position] = newValue;
        return { type: 'rhythm', position, oldValue, newValue };
      }

      case 'interval': {
        if (position === 0) return null;
        const oldValue = notes[position]! - notes[position - 1]!;
        let newInterval = this.rng.nextInt(-max, max);
        if (newInterval === 0) newInterval = 1;
        let newNote = notes[position - 1]! + newInterval;
        const orig = originalNotes[position]!;
        if (Math.abs(newNote - orig) > max) {
          newNote = orig + (newNote > orig ? max : -max);
        }
        newNote = Math.max(0, Math.min(127, newNote));
        notes[position] = newNote;
        return { type: 'interval', position, oldValue, newValue: newInterval };
      }

      case 'contour': {
        const segmentLength = this.rng.nextInt(2, Math.min(4, notes.length));
        const start = Math.max(0, Math.min(position - Math.floor(segmentLength / 2), notes.length - segmentLength));
        const end = start + segmentLength;
        const segment = notes.slice(start, end).reverse();
        // Only apply if every note stays within maxIntervalChange of its original.
        for (let i = 0; i < segment.length; i++) {
          if (Math.abs(segment[i]! - originalNotes[start + i]!) > max) return null;
        }
        for (let i = 0; i < segment.length; i++) {
          notes[start + i] = segment[i]!;
        }
        return { type: 'contour', position, oldValue: start, newValue: end };
      }
    }
  }
}
