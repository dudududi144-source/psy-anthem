// PSY ANTHEM - validation/melodic-analysis.ts
// Contour, leaps, stepwise balance, repetition, range use, motif presence.
import type { MusicalEvent, NoteData, NoteRange } from '../types';

export type ContourShape = 'arch' | 'ascent' | 'descent' | 'wave' | 'plateau' | 'irregular';

export interface LeapReport {
  count: number;
  recovered: number;
  unrecovered: number;
}

export interface MelodicAnalysis {
  contour: ContourShape;
  contourClarity: number;   // 0-1
  leaps: LeapReport;
  stepwiseRatio: number;    // 0-1
  repetitionScore: number;  // 0-1
  rangeUtilization: number; // 0-1
  motifPresence: number;    // 0-1
  issues: string[];
}

export interface MelodyAnalysisOptions {
  motifNotes?: number[];
  targetRange?: NoteRange;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function leadPitches(events: MusicalEvent[]): number[] {
  const lead = events.filter((e) => e.type === 'note' && e.channel === 0);
  const source = lead.length > 0 ? lead : events.filter((e) => e.type === 'note');
  source.sort((a, b) => a.timestamp - b.timestamp);
  return source.map((e) => (e.data as NoteData).pitch);
}

export function classifyContour(pitches: number[]): { shape: ContourShape; clarity: number } {
  if (pitches.length < 3) return { shape: 'irregular', clarity: 0 };

  const diffs: number[] = [];
  for (let i = 1; i < pitches.length; i++) {
    diffs.push(pitches[i]! - pitches[i - 1]!);
  }
  const zeros = diffs.filter((d) => d === 0).length;
  if (zeros >= diffs.length * 0.9) return { shape: 'plateau', clarity: zeros / diffs.length };

  let changes = 0;
  let prevSign = 0;
  for (const d of diffs) {
    const s = d > 0 ? 1 : d < 0 ? -1 : 0;
    if (s !== 0 && prevSign !== 0 && s !== prevSign) changes++;
    if (s !== 0) prevSign = s;
  }
  if (changes >= 4) {
    return { shape: 'wave', clarity: clamp01(changes / diffs.length) };
  }

  let peakIdx = 0;
  for (let i = 1; i < pitches.length; i++) {
    if (pitches[i]! > pitches[peakIdx]!) peakIdx = i;
  }
  const rel = peakIdx / (pitches.length - 1);

  let risingGood = 0;
  let risingCount = 0;
  for (let i = 0; i < peakIdx; i++) {
    if (diffs[i]! !== 0) {
      risingCount++;
      if (diffs[i]! > 0) risingGood++;
    }
  }
  let fallingGood = 0;
  let fallingCount = 0;
  for (let i = peakIdx; i < diffs.length; i++) {
    if (diffs[i]! !== 0) {
      fallingCount++;
      if (diffs[i]! < 0) fallingGood++;
    }
  }

  if (rel >= 0.75) {
    const clarity = risingCount === 0 ? 0.5 : risingGood / risingCount;
    return { shape: 'ascent', clarity };
  }
  if (rel <= 0.25) {
    const clarity = fallingCount === 0 ? 0.5 : fallingGood / fallingCount;
    return { shape: 'descent', clarity };
  }
  const upRatio = risingCount === 0 ? 1 : risingGood / risingCount;
  const downRatio = fallingCount === 0 ? 1 : fallingGood / fallingCount;
  const clarity = (upRatio + downRatio) / 2;
  if (clarity >= 0.6) return { shape: 'arch', clarity };
  return { shape: 'irregular', clarity };
}

export function analyzeLeaps(pitches: number[]): LeapReport {
  let count = 0;
  let recovered = 0;
  for (let i = 1; i < pitches.length; i++) {
    const leap = pitches[i]! - pitches[i - 1]!;
    if (Math.abs(leap) > 5) {
      count++;
      if (i + 1 < pitches.length) {
        const next = pitches[i + 1]! - pitches[i]!;
        if (next !== 0 && Math.sign(next) !== Math.sign(leap) && Math.abs(next) <= 2) {
          recovered++;
        }
      }
    }
  }
  return { count, recovered, unrecovered: count - recovered };
}

export function analyzeMelody(events: MusicalEvent[], options?: MelodyAnalysisOptions): MelodicAnalysis {
  const pitches = leadPitches(events);
  const issues: string[] = [];
  if (pitches.length === 0) {
    return {
      contour: 'irregular', contourClarity: 0,
      leaps: { count: 0, recovered: 0, unrecovered: 0 },
      stepwiseRatio: 0, repetitionScore: 0, rangeUtilization: 0, motifPresence: 0,
      issues: ['no notes to analyze'],
    };
  }

  const contour = classifyContour(pitches);
  const leaps = analyzeLeaps(pitches);

  // Stepwise ratio
  let steps = 0;
  for (let i = 1; i < pitches.length; i++) {
    if (Math.abs(pitches[i]! - pitches[i - 1]!) <= 2) steps++;
  }
  const stepwise = pitches.length > 1 ? steps / (pitches.length - 1) : 0;

  // Repetition: reward recurring 3-cells, penalize monotony
  let repetition = 0;
  if (pitches.length >= 6) {
    const cells = new Map<string, number>();
    for (let i = 0; i + 2 < pitches.length; i++) {
      const key = (pitches[i]! % 12) + ',' + (pitches[i + 1]! % 12) + ',' + (pitches[i + 2]! % 12);
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
    let maxCount = 0;
    for (const v of cells.values()) {
      if (v > maxCount) maxCount = v;
    }
    repetition = clamp01((maxCount - 1) / 3);
    let mono = 1;
    let monoMax = 1;
    for (let i = 1; i < pitches.length; i++) {
      if (pitches[i] === pitches[i - 1]) {
        mono++;
        if (mono > monoMax) monoMax = mono;
      } else {
        mono = 1;
      }
    }
    if (monoMax > 8) repetition = clamp01(repetition - (monoMax - 8) / 16);
  }

  // Range utilization vs target
  let lo = 127;
  let hi = 0;
  for (const p of pitches) {
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  const target = options && options.targetRange !== undefined ? options.targetRange : { min: 48, max: 84 };
  const targetSpan = Math.max(1, target.max - target.min);
  const usedRatio = (hi - lo) / targetSpan;
  let rangeUtil: number;
  if (usedRatio >= 0.4 && usedRatio <= 0.9) rangeUtil = 1;
  else if (usedRatio < 0.4) rangeUtil = usedRatio / 0.4;
  else rangeUtil = clamp01(1 - (usedRatio - 0.9) / 0.6);

  // Motif presence
  let motifPresence = 0;
  const motif = options ? options.motifNotes : undefined;
  if (motif && motif.length > 0) {
    const pcs = new Set(motif.map((n) => ((n % 12) + 12) % 12));
    let hits = 0;
    for (const p of pitches) {
      if (pcs.has(((p % 12) + 12) % 12)) hits++;
    }
    motifPresence = hits / pitches.length;
  }

  if (stepwise < 0.3) issues.push('low stepwise motion (' + Math.round(stepwise * 100) + '%) - melody may feel disjointed');
  if (leaps.unrecovered > 3) issues.push(leaps.unrecovered + ' unrecovered leaps > P4');
  if (contour.shape === 'irregular') issues.push('no clear melodic contour');
  if (motifPresence > 0 && motifPresence < 0.4) issues.push('weak motif presence (' + Math.round(motifPresence * 100) + '%)');

  return {
    contour: contour.shape,
    contourClarity: contour.clarity,
    leaps,
    stepwiseRatio: stepwise,
    repetitionScore: repetition,
    rangeUtilization: rangeUtil,
    motifPresence,
    issues,
  };
}
