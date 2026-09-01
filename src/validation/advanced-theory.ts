// PSY ANTHEM - validation/advanced-theory.ts
// Voice-leading quality + the unified AdvancedQualityReport.
import type { AnthemConfig, AnthemOutput, MusicalEvent, NoteData } from '../types';
import { sampleEnergyCurve } from '../harmony/tension';
import { analyzeSingability } from '../metrics/singability';
import type { SingabilityReport } from '../metrics/singability';
import { analyzeVariety } from '../metrics/variety';
import type { VarietyReport } from '../metrics/variety';
import { analyzeEmotionalArc } from '../metrics/emotional-arc';
import type { EmotionalArcReport } from '../metrics/emotional-arc';
import { analyzeMelody } from './melodic-analysis';
import type { MelodicAnalysis } from './melodic-analysis';
import { analyzeHarmony } from './harmonic-analysis';
import type { HarmonicAnalysisReport } from './harmonic-analysis';

export interface VoiceLeadingQuality {
  smoothness: number;     // 0-100
  independence: number;   // 0-100
  balance: number;        // 0-100
  contraryMotion: number; // 0-100
  issues: string[];
}

export type QualityGrade = 'masterpiece' | 'excellent' | 'good' | 'acceptable' | 'needs-work';

export interface ComponentScores {
  melodic: number;
  harmonic: number;
  voiceLeading: number;
  singability: number;
  variety: number;
  emotionalArc: number;
}

export interface AdvancedQualityReport {
  overall: number; // 0-100
  grade: QualityGrade;
  componentScores: ComponentScores;
  melodic: MelodicAnalysis;
  harmonic: HarmonicAnalysisReport;
  voiceLeading: VoiceLeadingQuality;
  singability: SingabilityReport;
  variety: VarietyReport;
  emotionalArc: EmotionalArcReport;
  summary: string[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function groupByChannel(events: MusicalEvent[]): Map<number, MusicalEvent[]> {
  const map = new Map<number, MusicalEvent[]>();
  for (const e of events) {
    if (e.type !== 'note') continue;
    const list = map.get(e.channel);
    if (list) list.push(e);
    else map.set(e.channel, [e]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }
  return map;
}

// Onset grid: 16th-note quantized start -> first pitch at that slot.
function onsetGrid(events: MusicalEvent[]): Map<number, number> {
  const grid = new Map<number, number>();
  for (const e of events) {
    const step = Math.round(e.timestamp * 4);
    if (!grid.has(step)) grid.set(step, (e.data as NoteData).pitch);
  }
  return grid;
}

export function analyzeVoiceLeadingFromEvents(events: MusicalEvent[], voiceCount: number): VoiceLeadingQuality {
  const issues: string[] = [];
  const byChannel = groupByChannel(events);
  const voices = Array.from(byChannel.keys()).sort((a, b) => a - b);

  // Smoothness: average consecutive interval per voice
  let smoothSum = 0;
  let smoothCount = 0;
  for (const v of voices) {
    const list = byChannel.get(v)!;
    if (list.length < 2) continue;
    let total = 0;
    for (let i = 1; i < list.length; i++) {
      const a = (list[i - 1]!.data as NoteData).pitch;
      const b = (list[i]!.data as NoteData).pitch;
      total += Math.abs(b - a);
    }
    const avg = total / (list.length - 1);
    smoothSum += clamp01(1 - (avg - 2) / 5);
    smoothCount++;
  }
  const smoothness = smoothCount > 0 ? Math.round((smoothSum / smoothCount) * 100) : 100;

  // Independence: parallel fifths/octaves between voice pairs on shared onsets
  let parallels = 0;
  const grids = new Map<number, Map<number, number>>();
  for (const v of voices) grids.set(v, onsetGrid(byChannel.get(v)!));
  for (let i = 0; i < voices.length; i++) {
    for (let j = i + 1; j < voices.length; j++) {
      const ga = grids.get(voices[i]!)!;
      const gb = grids.get(voices[j]!)!;
      const shared: number[] = [];
      for (const step of ga.keys()) {
        if (gb.has(step)) shared.push(step);
      }
      shared.sort((a, b) => a - b);
      let prevInterval = -1;
      for (const step of shared) {
        const interval = Math.abs(ga.get(step)! - gb.get(step)!) % 12;
        if (prevInterval === 7 && interval === 7) parallels++;
        if (prevInterval === 0 && interval === 0) parallels++;
        prevInterval = interval;
      }
    }
  }
  const independence = Math.max(0, 100 - parallels * 15);
  if (parallels > 0) issues.push(parallels + ' parallel fifth/octave movements between voices');

  // Balance: lead should carry ~half the notes in multi-voice textures
  let balance = 100;
  if (voiceCount > 1 && events.length > 0) {
    const leadCount = (byChannel.get(0) ?? []).length;
    const frac = leadCount / events.filter((e) => e.type === 'note').length;
    balance = Math.round(100 * (1 - clamp01(Math.abs(frac - 0.5) / 0.35)));
    if (frac > 0.85) issues.push('lead dominates the texture (' + Math.round(frac * 100) + '% of notes)');
  }

  // Contrary motion: lead vs each other voice over shared onset steps
  let contrarySum = 0;
  let contraryCount = 0;
  const leadGrid = grids.get(0);
  if (leadGrid && voices.length > 1) {
    for (const v of voices) {
      if (v === 0) continue;
      const other = grids.get(v)!;
      const shared: number[] = [];
      for (const step of leadGrid.keys()) {
        if (other.has(step)) shared.push(step);
      }
      shared.sort((a, b) => a - b);
      if (shared.length < 3) continue;
      let contrary = 0;
      let pairs = 0;
      for (let k = 1; k < shared.length; k++) {
        const prev = shared[k - 1]!;
        const cur = shared[k]!;
        const dl = leadGrid.get(cur)! - leadGrid.get(prev)!;
        const dv = other.get(cur)! - other.get(prev)!;
        if (dl === 0 || dv === 0) continue;
        pairs++;
        if (Math.sign(dl) !== Math.sign(dv)) contrary++;
      }
      if (pairs > 0) {
        contrarySum += contrary / pairs;
        contraryCount++;
      }
    }
  }
  const contraryMotion = contraryCount > 0 ? Math.round((contrarySum / contraryCount) * 100) : 50;

  return { smoothness, independence, balance, contraryMotion, issues };
}

function gradeFor(overall: number): QualityGrade {
  if (overall >= 90) return 'masterpiece';
  if (overall >= 80) return 'excellent';
  if (overall >= 65) return 'good';
  if (overall >= 50) return 'acceptable';
  return 'needs-work';
}

export function calculateAdvancedQualityScore(output: AnthemOutput, config: AnthemConfig): AdvancedQualityReport {
  // Target energy curve sampled per bar (for harmonic tension match + arc)
  const bars = output.harmonicAnalysis.tensionCurve.length;
  const targetCurve: number[] = [];
  for (let b = 0; b < bars; b++) {
    const t = bars <= 1 ? 0 : b / (bars - 1);
    targetCurve.push(sampleEnergyCurve(config.energyCurve, t, config.customCurve));
  }

  const melodic = analyzeMelody(output.events, {
    motifNotes: output.motifDNA.coreNotes,
    targetRange: config.targetRange,
  });
  const harmonic = analyzeHarmony(
    output.harmonicAnalysis.chords,
    output.harmonicAnalysis.tensionCurve,
    output.harmonicAnalysis.key,
    targetCurve,
  );
  const voiceLeading = analyzeVoiceLeadingFromEvents(output.events, config.voices);
  const singability = analyzeSingability(output);
  const variety = analyzeVariety(output);
  const emotionalArc = analyzeEmotionalArc(output, config);

  const melodicScore = Math.round(100 * (
    0.3 * melodic.contourClarity +
    0.3 * melodic.stepwiseRatio +
    0.2 * melodic.repetitionScore +
    0.2 * melodic.rangeUtilization
  ));
  const voiceAvg = (voiceLeading.smoothness + voiceLeading.independence + voiceLeading.balance + voiceLeading.contraryMotion) / 4;
  const harmonicAvg = (harmonic.functionalScore + harmonic.varietyScore) / 2;

  const overall = Math.round(
    0.20 * singability.score +
    0.15 * variety.score +
    0.20 * emotionalArc.score +
    0.15 * voiceAvg +
    0.15 * harmonicAvg +
    0.15 * melodicScore
  );

  const componentScores: ComponentScores = {
    melodic: melodicScore,
    harmonic: Math.round(harmonicAvg),
    voiceLeading: Math.round(voiceAvg),
    singability: singability.score,
    variety: variety.score,
    emotionalArc: emotionalArc.score,
  };

  // Summary: strongest + weakest component, plus validator issues
  const entries = Object.entries(componentScores).sort((a, b) => b[1] - a[1]);
  const best = entries[0]!;
  const worst = entries[entries.length - 1]!;
  const summary: string[] = [
    'overall ' + overall + '/100 -> ' + gradeFor(overall),
    'strongest: ' + best[0] + ' (' + best[1] + ')',
    'weakest: ' + worst[0] + ' (' + worst[1] + ')',
  ];
  for (const issue of melodic.issues) summary.push('melodic: ' + issue);
  for (const issue of harmonic.issues) summary.push('harmonic: ' + issue);
  for (const issue of voiceLeading.issues) summary.push('voice-leading: ' + issue);

  return {
    overall,
    grade: gradeFor(overall),
    componentScores,
    melodic,
    harmonic,
    voiceLeading,
    singability,
    variety,
    emotionalArc,
    summary,
  };
}
