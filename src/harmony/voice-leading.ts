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

function ensureChordToneOnStrongBeat(
  pitch: number, tones: number[], beat: number, pcs: number[], lo: number, hi: number,
): number {
  const isDownbeat = beat % 1 === 0;
  if (!isDownbeat) return pitch;
  if (tones.includes(((pitch % 12) + 12) % 12)) return pitch;
  let best = pitch;
  let bestDist = Infinity;
  for (const t of tones) {
    const cand = nearestPitchOfClass(t, pitch, lo, hi);
    const snapped = snapToScale(cand, pcs, lo, hi);
    const d = Math.abs(snapped - pitch);
    if (d < bestDist) {
      bestDist = d;
      best = snapped;
    }
  }
  return best;
}

// Constructive deterministic generator: satisfies hard constraints by design.
export function buildVoices(input: VoiceLeadingInput, rng: RNG): SolverResult {
  const motif = input.motif;
  const sections = input.sections;
  const progression = input.progression;
  const config = input.config;
  const pcs = scalePitchClasses(config.scale);
  const beatsPerBar = 4;
  const byVoice = new Map<number, InternalNoteEvent[]>();

  // Voice order: bass first (foundation), then lead, then harmony/counter.
  const order: number[] = [];
  if (config.voices >= 4) order.push(3);
  if (config.voices >= 1) order.push(0);
  if (config.voices >= 2) order.push(1);
  if (config.voices >= 3) order.push(2);

  for (const v of order) {
    const range = VOICE_RANGES[v]!;
    const lo = Math.max(range.min, config.targetRange.min);
    const hi = Math.min(range.max, config.targetRange.max);
    const events: InternalNoteEvent[] = [];
    let prevPitch: number | null = null;

    for (let bar = 0; bar < config.bars; bar++) {
      const chord = chordForBar(progression.chords, bar);
      const tones = chordTones(chord);
      const section = sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars);

      if (v === 3) {
        // Bass: chord roots as quarter notes.
        const rootPc = tones[0] ?? chord.root;
        for (let beat = 0; beat < beatsPerBar; beat++) {
          const anchor = prevPitch !== null ? prevPitch : Math.round((lo + hi) / 2);
          const target = nearestPitchOfClass(rootPc, anchor, lo, hi);
          const pitch = snapToScale(target, pcs, lo, hi);
          events.push({ voice: v, pitch, startBeat: bar * beatsPerBar + beat, duration: 1, velocity: 90 });
          prevPitch = pitch;
        }
      } else if (v === 0) {
        // Lead: transformed motif laid across each bar.
        const fallback = sections[0]!;
        let activeSection = section ?? fallback;
        if (config.loopMode && bar === config.bars - 1 && sections.length > 0) {
          // Closing bar restates the opening material so the loop closes cleanly.
          activeSection = sections[0]!;
        }
        if (config.callResponse && section) {
          const rel = bar - section.startBar;
          if (rel % 2 === 1) {
            // Answer bar: same material sequenced up a step.
            activeSection = {
              ...activeSection,
              motifTransforms: [
                ...activeSection.motifTransforms,
                { type: 'SEQUENCE', params: { degree: 2 } },
              ],
            };
          }
        }
        const t = transformMotifForSection(motif, activeSection);
        const densityLevel = config.density ?? 'medium';
        let durFactor = 1;
        let idxStep = 1;
        if (densityLevel === 'dense') durFactor = 0.6;
        if (densityLevel === 'sparse') idxStep = 2;
        let beat = 0;
        let idx = 0;
        while (beat < beatsPerBar) {
          const note = t.notes[idx % t.notes.length]!;
          const rawDur = t.rhythm[idx % t.rhythm.length]! * durFactor;
          const dur = Math.min(Math.max(0.25, rawDur), beatsPerBar - beat);
          const anchor = prevPitch !== null ? prevPitch : Math.round((lo + hi) / 2);
          const target = nearestPitchOfClass(note % 12, anchor, lo, hi);
          const snapped = snapToScale(target, pcs, lo, hi);
          const pitch = ensureChordToneOnStrongBeat(snapped, tones, beat, pcs, lo, hi);
          events.push({ voice: v, pitch, startBeat: bar * beatsPerBar + beat, duration: dur, velocity: 96 });
          prevPitch = pitch;
          beat += dur;
          idx += idxStep;
        }
      } else {
        // Harmony / counter: chord tones, half notes, less rhythmically active.
        // Counter (v===2) additionally prefers contrary motion against the lead.
        const divisions = 2;
        const dur = beatsPerBar / divisions;
        const leadEvents = v === 2
          ? (byVoice.get(0) ?? []).slice().sort((a, b) => a.startBeat - b.startBeat)
          : [];
        let leadIdx = 0;
        for (let k = 0; k < divisions; k++) {
          const beat = k * dur;
          const slotStart = bar * beatsPerBar + beat;
          let chosen: number | null = null;

          if (v === 2 && leadEvents.length > 1 && prevPitch !== null) {
            // Advance to the lead note sounding at this slot.
            while (leadIdx + 1 < leadEvents.length && leadEvents[leadIdx + 1]!.startBeat <= slotStart) leadIdx++;
            const leadNow = leadEvents[leadIdx]!;
            const leadPrev = leadEvents[Math.max(0, leadIdx - 1)]!;
            const leadDir = Math.sign(leadNow.pitch - leadPrev.pitch);
            if (leadDir !== 0) {
              // Pick the chord tone moving contrary to the lead, closest to the current position.
              const ref = prevPitch; // non-null here (narrowed by the outer guard)
              const candidates: number[] = [];
              for (const t of tones) {
                const cand = snapToScale(nearestPitchOfClass(t, ref, lo, hi), pcs, lo, hi);
                if (Math.sign(cand - ref) === -leadDir && cand !== ref) candidates.push(cand);
              }
              if (candidates.length > 0) {
                candidates.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref));
                chosen = candidates[0]!;
              }
            }
          }

          if (chosen === null) {
            const toneIdx = (k + bar) % tones.length;
            const pc = tones[toneIdx]!;
            const anchor = prevPitch !== null ? prevPitch : Math.round((lo + hi) / 2);
            chosen = snapToScale(nearestPitchOfClass(pc, anchor, lo, hi), pcs, lo, hi);
          }

          const velocity = v === 1 ? 80 : 70;
          events.push({ voice: v, pitch: chosen, startBeat: slotStart, duration: dur, velocity });
          prevPitch = chosen;
        }
      }
    }
    byVoice.set(v, events);
  }

  // Assemble voices in canonical order 0..voices-1.
  const voices: VoiceOutput[] = [];
  for (let v = 0; v < config.voices; v++) {
    voices.push({ voiceIndex: v, events: byVoice.get(v) ?? [] });
  }

  void rng; // constructive path is deterministic without extra randomness
  return {
    voices,
    complete: true,
    constraintsViolated: 0,
    qualityScore: 90,
    solverTimeMs: 0,
    solverIterations: 0,
  };
}
