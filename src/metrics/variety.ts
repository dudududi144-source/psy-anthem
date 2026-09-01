// PSY ANTHEM - metrics/variety.ts
// Rhythmic / interval / dynamic / articulation variety. (0-100)
import type { AnthemOutput, MusicalEvent, NoteData } from '../types';

export interface VarietyReport {
  score: number;
  rhythmicVariety: number;
  intervalVariety: number;
  dynamicVariety: number;
  articulationVariety: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function noteEvents(output: AnthemOutput): MusicalEvent[] {
  return output.events.filter((e) => e.type === 'note');
}

// Distinct durations, penalizing long monotone runs.
export function rhythmicVarietyOf(events: MusicalEvent[]): number {
  if (events.length === 0) return 0;
  const distinct = new Set<number>();
  let maxRun = 1;
  let run = 1;
  for (let i = 0; i < events.length; i++) {
    distinct.add(events[i]!.duration);
    if (i > 0 && events[i]!.duration === events[i - 1]!.duration) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 1;
    }
  }
  const base = clamp01(distinct.size / 4);
  const penalty = maxRun > 8 ? clamp01((maxRun - 8) / 16) : 0;
  return clamp01(base - penalty * 0.5);
}

// Distinct melodic interval classes across all voices.
export function intervalVarietyOf(events: MusicalEvent[]): number {
  const byChannel = new Map<number, MusicalEvent[]>();
  for (const e of events) {
    const list = byChannel.get(e.channel);
    if (list) list.push(e);
    else byChannel.set(e.channel, [e]);
  }
  const classes = new Set<number>();
  for (const list of byChannel.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 1; i < list.length; i++) {
      const a = (list[i - 1]!.data as NoteData).pitch;
      const b = (list[i]!.data as NoteData).pitch;
      classes.add(Math.abs(b - a) % 12);
    }
  }
  return clamp01(classes.size / 6);
}

// Velocity spread: std deviation normalized (velocity space 40-127).
export function dynamicVarietyOf(events: MusicalEvent[]): number {
  if (events.length < 2) return 0;
  const vs = events.map((e) => (e.data as NoteData).velocity);
  const mean = vs.reduce((s, v) => s + v, 0) / vs.length;
  let sq = 0;
  for (const v of vs) sq += (v - mean) * (v - mean);
  const std = Math.sqrt(sq / vs.length);
  return clamp01(std / 15);
}

// Distinct articulations used.
export function articulationVarietyOf(events: MusicalEvent[]): number {
  const arts = new Set<string>();
  for (const e of events) {
    const d = e.data as NoteData;
    arts.add(d.articulation ?? 'normal');
  }
  return clamp01(arts.size / 4);
}

export function analyzeVariety(output: AnthemOutput): VarietyReport {
  const events = noteEvents(output);
  const rhythmic = rhythmicVarietyOf(events);
  const interval = intervalVarietyOf(events);
  const dynamic = dynamicVarietyOf(events);
  const articulation = articulationVarietyOf(events);
  const score = Math.round(25 * rhythmic + 25 * interval + 25 * dynamic + 25 * articulation);
  return { score, rhythmicVariety: rhythmic, intervalVariety: interval, dynamicVariety: dynamic, articulationVariety: articulation };
}
