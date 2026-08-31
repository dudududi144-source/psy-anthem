// PSY ANTHEM - motif/transformer.ts
import type { MotifDNA, Transformation, SectionPlan } from '../types';

export interface TransformedMaterial {
  notes: number[];
  rhythm: number[];
}

export function applyTransform(notes: number[], rhythm: number[], t: Transformation): TransformedMaterial {
  switch (t.type) {
    case 'TRANSPOSE': {
      const d = t.params['degree'] ?? 0;
      return { notes: notes.map((n) => n + d), rhythm: [...rhythm] };
    }
    case 'SEQUENCE': {
      const d = t.params['degree'] ?? 2;
      return { notes: notes.map((n) => n + d), rhythm: [...rhythm] };
    }
    case 'INVERT': {
      const pivot = notes[0] ?? 60;
      const out: number[] = [pivot];
      for (let i = 1; i < notes.length; i++) {
        const delta = notes[i]! - notes[i - 1]!;
        out.push(out[i - 1]! - delta);
      }
      return { notes: out, rhythm: [...rhythm] };
    }
    case 'RETROGRADE':
      return { notes: [...notes].reverse(), rhythm: [...rhythm].reverse() };
    case 'AUGMENT': {
      const f = t.params['factor'] ?? 2;
      return { notes: [...notes], rhythm: rhythm.map((d) => d * f) };
    }
    case 'DIMINISH': {
      const f = t.params['factor'] ?? 2;
      return { notes: [...notes], rhythm: rhythm.map((d) => Math.max(0.25, d / f)) };
    }
    case 'TRUNCATE': {
      const k = Math.max(2, Math.min(notes.length, t.params['notes'] ?? notes.length - 1));
      return { notes: notes.slice(0, k), rhythm: rhythm.slice(0, k) };
    }
