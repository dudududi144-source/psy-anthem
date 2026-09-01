// PSY ANTHEM - src/quality/artistic-validator.ts
// Artistic quality validation (phase 10): five aesthetic dimensions, each 0-1,
// weighted into a 0-100 score with human-readable issues and suggestions.
// Pure analysis - no RNG, no audio.

import type { AnthemOutput, HarmonicAnalysis, MusicalEvent, NoteData } from '../types';

export interface ArtisticReport {
  score: number;              // 0-100
  melodicInterest: number;    // 0-1
  harmonicRichness: number;   // 0-1
  rhythmicVariety: number;    // 0-1
  texturalDepth: number;      // 0-1
  emotionalArc: number;       // 0-1
  issues: string[];
  suggestions: string[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function noteEvents(events: MusicalEvent[]): MusicalEvent[] {
  return events.filter((e) => e.type === 'note').sort((a, b) => a.timestamp - b.timestamp);
}

function leadEvents(events: MusicalEvent[]): MusicalEvent[] {
  const lead = events.filter((e) => e.type === 'note' && e.channel === 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return lead.length > 0 ? lead : noteEvents(events);
}

/** Interval variety + duration variety of the lead line. */
export function analyzeMelodicInterest(events: MusicalEvent[]): number {
  const lead = leadEvents(events);
  if (lead.length < 2) return 0;

  const intervals: number[] = [];
  const durations: number[] = [];
  for (let i = 1; i < lead.length; i++) {
    const a = (lead[i - 1]!.data as NoteData).pitch;
    const b = (lead[i]!.data as NoteData).pitch;
    intervals.push(Math.abs(b - a) % 12);
    durations.push(lead[i]!.duration);
  }
  durations.push(lead[0]!.duration);

  const intervalVariety = clamp01(new Set(intervals).size / 8);
  const durationVariety = clamp01(new Set(durations).size / 4);
  return clamp01(intervalVariety * 0.6 + durationVariety * 0.4);
}

/** Share of extended chords (9/11/13) plus 7th-chord color and root variety. */
export function analyzeHarmonicRichness(analysis: HarmonicAnalysis): number {
  const chords = analysis.chords;
  if (chords.length === 0) return 0;

  let extended = 0;
  let sevenths = 0;
  const roots = new Set<number>();
  for (const c of chords) {
    roots.add(c.root);
    if (c.quality.includes('9') || c.quality.includes('11') || c.quality.includes('13')) extended++;
    else if (c.quality.includes('7')) sevenths++;
  }
  const extendedRatio = extended / chords.length;
  const seventhRatio = sevenths / chords.length;
  const rootVariety = clamp01(roots.size / Math.min(6, chords.length));
  return clamp01(extendedRatio * 0.55 + seventhRatio * 0.3 + rootVariety * 0.15);
}

/** Syncopation (off-beat ratio) + duration variety. */
export function analyzeRhythmicVariety(events: MusicalEvent[]): number {
  const notes = noteEvents(events);
  if (notes.length === 0) return 0;

  let offBeats = 0;
  const durations = new Set<number>();
  for (const e of notes) {
    if (e.timestamp % 1 !== 0) offBeats++;
    durations.add(e.duration);
  }
  const syncopation = clamp01((offBeats / notes.length) * 2);
  const durationVariety = clamp01(durations.size / 5);
  return clamp01(syncopation * 0.6 + durationVariety * 0.4);
}

/** Simultaneous-note density + distinct voice count. */
export function analyzeTexturalDepth(events: MusicalEvent[]): number {
  const notes = noteEvents(events);
  if (notes.length === 0) return 0;

  const maxSimultaneous = calculateMaxSimultaneous(notes);
  const channels = new Set(notes.map((e) => e.channel));
  const density = clamp01(maxSimultaneous / 8);
  const voiceSpread = clamp01(channels.size / 4);
  return clamp01(density * 0.5 + voiceSpread * 0.5);
}

/** Tension range across the piece (build-up / release strength). */
export function analyzeEmotionalArc(output: AnthemOutput): number {
  const tension = output.harmonicAnalysis.tensionCurve;
  if (tension.length < 2) return 0;
  const maxTension = Math.max(...tension);
  const minTension = Math.min(...tension);
  const range = maxTension - minTension;
  return clamp01(range * 1.2);
}

export function calculateMaxSimultaneous(events: MusicalEvent[]): number {
  if (events.length === 0) return 0;
  const lastEnd = events.reduce((m, e) => Math.max(m, e.timestamp + e.duration), 0);
  let maxSimultaneous = 0;
  for (let time = 0; time <= lastEnd; time += 0.25) {
    let simultaneous = 0;
    for (const e of events) {
      if (e.timestamp <= time && e.timestamp + e.duration > time) simultaneous++;
    }
    if (simultaneous > maxSimultaneous) maxSimultaneous = simultaneous;
  }
  return maxSimultaneous;
}

export function validateArtisticQuality(output: AnthemOutput): ArtisticReport {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const melodicInterest = analyzeMelodicInterest(output.events);
  if (melodicInterest < 0.6) {
    issues.push('Melody is too repetitive and predictable');
    suggestions.push('Add more interval variety and rhythmic syncopation');
  }

  const harmonicRichness = analyzeHarmonicRichness(output.harmonicAnalysis);
  if (harmonicRichness < 0.5) {
    issues.push('Harmony is too simple - only triads and 7ths');
    suggestions.push('Use extended chords (9ths, 11ths, 13ths) via harmonyComplexity: complex');
  }

  const rhythmicVariety = analyzeRhythmicVariety(output.events);
  if (rhythmicVariety < 0.6) {
    issues.push('Rhythm is monotonous');
    suggestions.push('Add syncopation, polyrhythms, or metric modulation');
  }

  const texturalDepth = analyzeTexturalDepth(output.events);
  if (texturalDepth < 0.5) {
    issues.push('Texture is too thin');
    suggestions.push('Add more voices or counterpoint layers');
  }

  const emotionalArc = analyzeEmotionalArc(output);
  if (emotionalArc < 0.6) {
    issues.push('No clear emotional journey');
    suggestions.push('Create stronger tension/release cycles (ARC or BUILD_DROP curves)');
  }

  const score = Math.round(
    melodicInterest * 25 +
    harmonicRichness * 25 +
    rhythmicVariety * 20 +
    texturalDepth * 15 +
    emotionalArc * 15,
  );

  return {
    score,
    melodicInterest,
    harmonicRichness,
    rhythmicVariety,
    texturalDepth,
    emotionalArc,
    issues,
    suggestions,
  };
}
