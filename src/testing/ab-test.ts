// PSY ANTHEM - testing/ab-test.ts
// Compare composition algorithms and measure parameter sensitivity.
import { createAnthemEngine } from '../index';
import type { AnthemConfig, AnthemOutput, MusicalEvent, NoteData } from '../types';
import { scalePitchClasses, snapToScale } from '../harmony/intervals';
import { calculateAdvancedQualityScore } from '../validation/advanced-theory';
import type { AdvancedQualityReport, ComponentScores } from '../validation/advanced-theory';

export type AlgorithmFn = (config: AnthemConfig) => AnthemOutput | null;

export interface ComparisonReport {
  nameA: string;
  nameB: string;
  reportA: AdvancedQualityReport;
  reportB: AdvancedQualityReport;
  deltas: Record<string, number>; // B minus A
  winner: 'A' | 'B' | 'tie';
  narrative: string[];
}

export interface SensitivityRow {
  value: number;
  overall: number;
  singability: number;
  variety: number;
  emotionalArc: number;
}

export interface SensitivityReport {
  param: string;
  rows: SensitivityRow[];
  mostSensitiveMetric: string;
  ranges: Record<string, number>;
}

// Algorithm A: the standard engine, untouched.
export function standardAlgorithm(config: AnthemConfig): AnthemOutput | null {
  return createAnthemEngine(config).generate();
}

// Algorithm B: engine + strict leap-recovery enforcement on the lead voice.
// Every leap > P4 must be answered by a step in the opposite direction;
// non-recovered leaps are rewritten into stepwise motion (in-scale).
export function strictLeapRecoveryAlgorithm(config: AnthemConfig): AnthemOutput | null {
  const out = createAnthemEngine(config).generate();
  if (!out) return null;

  const pcs = scalePitchClasses(config.scale);
  const lead = out.events
    .filter((e) => e.type === 'note' && e.channel === 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 1; i < lead.length; i++) {
    const prevData = lead[i - 1]!.data as NoteData;
    const curData = lead[i]!.data as NoteData;
    const leap = curData.pitch - prevData.pitch;
    if (Math.abs(leap) <= 5) continue;

    let recovered = false;
    if (i + 1 < lead.length) {
      const nextData = lead[i + 1]!.data as NoteData;
      const next = nextData.pitch - curData.pitch;
      if (next !== 0 && Math.sign(next) !== Math.sign(leap) && Math.abs(next) <= 2) {
        recovered = true;
      }
    }
    if (!recovered) {
      // Rewrite as a step in the leap direction, snapped to the scale.
      const target = prevData.pitch + (leap > 0 ? 2 : -2);
      const snapped = snapToScale(target, pcs, config.targetRange.min, config.targetRange.max);
      (lead[i]!.data as NoteData).pitch = snapped;
    }
  }

  return out;
}

export function compareAlgorithms(
  config: AnthemConfig,
  algoA: AlgorithmFn,
  algoB: AlgorithmFn,
  nameA: string = 'algorithm A',
  nameB: string = 'algorithm B',
): ComparisonReport | null {
  const outA = algoA(config);
  const outB = algoB(config);
  if (!outA || !outB) return null;

  const reportA = calculateAdvancedQualityScore(outA, config);
  const reportB = calculateAdvancedQualityScore(outB, config);

  const deltas: Record<string, number> = {};
  const keys = Object.keys(reportA.componentScores) as Array<keyof ComponentScores>;
  for (const k of keys) {
    deltas[k] = reportB.componentScores[k] - reportA.componentScores[k];
  }
  deltas['overall'] = reportB.overall - reportA.overall;

  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (reportA.overall > reportB.overall) winner = 'A';
  if (reportB.overall > reportA.overall) winner = 'B';

  const narrative: string[] = [];
  narrative.push(nameA + ': overall ' + reportA.overall + '/100 (' + reportA.grade + ')');
  narrative.push(nameB + ': overall ' + reportB.overall + '/100 (' + reportB.grade + ')');
  for (const k of keys) {
    const d = deltas[k]!;
    if (d === 0) continue;
    const dir = d > 0 ? nameB + ' improves' : nameA + ' leads';
    narrative.push(k + ': ' + (d > 0 ? '+' : '') + d + ' -> ' + dir);
  }
  narrative.push('winner: ' + (winner === 'tie' ? 'tie' : winner === 'A' ? nameA : nameB));

  return { nameA, nameB, reportA, reportB, deltas, winner, narrative };
}
