// PSY ANTHEM - harmony/voice-leading.ts
import { VOICE_RANGES } from '../constants';
import type { AnthemConfig, ChordSymbol, InternalNoteEvent, MotifDNA, SectionPlan, SolverResult, VoiceOutput } from '../types';
import type { RNG } from '../rng';
import type { ChordProgression } from './chord-progressions';
import { chordTones } from './chord-progressions';
import { scalePitchClasses, snapToScale } from './intervals';
import { transformMotifForSection } from '../motif/transformer';

export interface VoiceLeadingInput {
  motif: MotifDNA;
  sections: SectionPlan[];
  progression: ChordProgression;
  config: AnthemConfig;
}

export function detectParallelFifths(a1: number, a2: number, b1: number, b2: number): boolean {
  const i1 = Math.abs(a1 - a2) % 12;
  const i2 = Math.abs(b1 - b2) % 12;
  return i1 === 7 && i2 === 7;
}

export function detectParallelOctaves(a1: number, a2: number, b1: number, b2: number): boolean {
  const i1 = Math.abs(a1 - a2) % 12;
  const i2 = Math.abs(b1 - b2) % 12;
  return i1 === 0 && i2 === 0 && Math.abs(a1 - b1) > 0;
}

function nearestPitchOfClass(pc: number, around: number, lo: number, hi: number): number {
  const target = ((pc % 12) + 12) % 12;
  let best = around;
  let bestDist = Infinity;
  for (let p = lo; p <= hi; p++) {
    if (((p % 12) + 12) % 12 === target) {
      const d = Math.abs(p - around);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}

function chordForBar(chords: ChordSymbol[], bar: number): ChordSymbol {
  const found = chords.find((c) => bar >= c.startBar && bar < c.startBar + c.durationBars);
  return found ?? chords[0]!;
}
