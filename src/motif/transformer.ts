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
    case 'EXTEND': {
      const k = t.params['notes'] ?? 1;
      const last = notes[notes.length - 1] ?? 60;
      const extraNotes: number[] = [];
      const extraRhythm: number[] = [];
      for (let i = 0; i < k; i++) {
        extraNotes.push(last + (i % 2 === 0 ? 2 : -2));
        extraRhythm.push(0.5);
      }
      return { notes: [...notes, ...extraNotes], rhythm: [...rhythm, ...extraRhythm] };
    }
    case 'RHYTHMIC_SHIFT': {
      const s = t.params['steps'] ?? 1;
      const r = [...rhythm];
      const times = r.length > 0 ? s % r.length : 0;
      for (let i = 0; i < times; i++) {
        const first = r.shift();
        if (first !== undefined) r.push(first);
      }
      return { notes: [...notes], rhythm: r };
    }
    case 'EVOLUTION':
      // Evolution is applied by the MotifEvolver; the transformer passes through.
      return { notes: [...notes], rhythm: [...rhythm] };
    case 'ORNAMENT': {
      const out: number[] = [];
      const or: number[] = [];
      for (let i = 0; i < notes.length; i++) {
        out.push(notes[i]!);
        or.push(rhythm[i]! * 0.5);
        if (i < notes.length - 1) {
          out.push(notes[i]! + 1);
          or.push(rhythm[i]! * 0.5);
        }
      }
      return { notes: out, rhythm: or };
    }
  }
}

export function transformMotifForSection(
  motif: MotifDNA,
  section: SectionPlan,
): { notes: number[]; rhythm: number[]; chain: Transformation[] } {
  let notes = [...motif.coreNotes];
  let rhythm = [...motif.coreRhythm];
  const chain: Transformation[] = [];
  for (const t of section.motifTransforms) {
    const r = applyTransform(notes, rhythm, t);
    notes = r.notes;
    rhythm = r.rhythm;
    chain.push(t);
  }
  return { notes, rhythm, chain };
}
