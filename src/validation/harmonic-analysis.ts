// PSY ANTHEM - validation/harmonic-analysis.ts
// Functional root motion, cadence detection, progression variety, tension shape.
import type { ChordSymbol, ScaleDefinition } from '../types';
import { pearson } from '../metrics/emotional-arc';

export type CadenceType = 'authentic' | 'plagal' | 'half' | 'deceptive';

export interface CadenceFinding {
  bar: number;
  type: CadenceType;
  strength: number; // 0-1
}

export interface HarmonicAnalysisReport {
  functionalScore: number;  // 0-100 root-motion quality
  cadences: CadenceFinding[];
  varietyScore: number;     // 0-100 distinct-vs-repetitive balance
  tensionArcMatch: number;  // 0-1 vs target curve (or shape heuristic)
  issues: string[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Root motion quality between consecutive chords.
function motionScore(prevRoot: number, nextRoot: number): number {
  const up = ((nextRoot - prevRoot) % 12 + 12) % 12;
  // Strong: down a fifth (up 7) or down a second relative motion; good: up/down 4th/5th
  if (up === 7 || up === 5) return 1;     // circle-of-fifths motion
  if (up === 2 || up === 10) return 0.8;  // step motion
  if (up === 3 || up === 9 || up === 4 || up === 8) return 0.7; // third relations
  return 0.4;                              // tritone / unison
}

function chordDegree(chord: ChordSymbol, key: ScaleDefinition): number {
  return ((chord.root - key.root) % 12 + 12) % 12;
}

export function detectCadences(chords: ChordSymbol[], key: ScaleDefinition): CadenceFinding[] {
  const findings: CadenceFinding[] = [];
  if (chords.length < 2) return findings;

  for (let i = 1; i < chords.length; i++) {
    const prevDeg = chordDegree(chords[i - 1]!, key);
    const curDeg = chordDegree(chords[i]!, key);
    const bar = chords[i]!.startBar;
    const isFinal = i === chords.length - 1;
    const atPhrase = chords[i]!.startBar % 4 === 0 || isFinal;
    if (!atPhrase) continue;

    const strength = isFinal ? 1 : 0.6;
    if (prevDeg === 7 && curDeg === 0) {
      findings.push({ bar, type: 'authentic', strength });
    } else if (prevDeg === 5 && curDeg === 0) {
      findings.push({ bar, type: 'plagal', strength });
    } else if (prevDeg === 7 && curDeg === ((7 + 2) % 12)) {
      findings.push({ bar, type: 'deceptive', strength: strength * 0.8 });
    } else if (curDeg === 7 && !isFinal) {
      findings.push({ bar, type: 'half', strength: strength * 0.5 });
    }
  }
  return findings;
}

export function analyzeHarmony(
  chords: ChordSymbol[],
  tensionCurve: number[],
  key: ScaleDefinition,
  targetCurve?: number[],
): HarmonicAnalysisReport {
  const issues: string[] = [];

  if (chords.length === 0) {
    return { functionalScore: 0, cadences: [], varietyScore: 0, tensionArcMatch: 0, issues: ['no chords'] };
  }

  // Functional root motion
  let total = 0;
  for (let i = 1; i < chords.length; i++) {
    total += motionScore(chords[i - 1]!.root, chords[i]!.root);
  }
  const functionalScore = chords.length > 1 ? Math.round((total / (chords.length - 1)) * 100) : 50;

  // Cadences
  const cadences = detectCadences(chords, key);
  if (cadences.length === 0) {
    issues.push('no cadences detected at phrase boundaries');
  }

  // Variety: distinct chords vs total
  const distinct = new Set(chords.map((c) => c.root + ':' + c.quality));
  const ratio = distinct.size / chords.length;
  let varietyScore: number;
  if (ratio >= 0.25 && ratio <= 0.7) varietyScore = 100;
  else if (ratio < 0.25) varietyScore = Math.round((ratio / 0.25) * 100);
  else varietyScore = Math.round(100 - ((ratio - 0.7) / 0.3) * 60);

  // Tension arc match
  let tensionArcMatch = 0;
  if (targetCurve && targetCurve.length > 1) {
    tensionArcMatch = clamp01(pearson(tensionCurve, targetCurve));
  } else {
    // Heuristic: some movement is healthy
    if (tensionCurve.length > 1) {
      const mean = tensionCurve.reduce((s, v) => s + v, 0) / tensionCurve.length;
      let sq = 0;
      for (const v of tensionCurve) sq += (v - mean) * (v - mean);
      const std = Math.sqrt(sq / tensionCurve.length);
      tensionArcMatch = clamp01(std / 0.2);
    }
  }

  if (functionalScore < 60) issues.push('weak functional root motion (' + functionalScore + '/100)');
  if (varietyScore < 50) issues.push('progression variety is low (' + varietyScore + '/100)');

  return { functionalScore, cadences, varietyScore, tensionArcMatch, issues };
}
