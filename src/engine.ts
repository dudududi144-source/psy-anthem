// PSY ANTHEM - engine.ts
import { EXPRESSION_CONFIG, VALIDATION_THRESHOLDS } from './constants';
import { EnergyCurve } from './types';
import type {
  AnthemConfig, AnthemOutput, GenerationMetadata, GenerationQuality,
  HarmonicAnalysis, InternalNoteEvent, MotifDNA, MusicalEvent, NoteData,
} from './types';
import { createRNG } from './rng';
import { generateMotif } from './motif/generator';
import { generateChordProgression } from './harmony/chord-progressions';
import { buildVoices } from './harmony/voice-leading';
import { barEnergy } from './harmony/tension';
import { planSections } from './structure/section-planner';
import { humanizeTiming } from './expression/humanize';
import { deriveArticulation } from './expression/articulation';
import { velocityFromEnergy } from './expression/dynamics';
import { theoryLint } from './solver/validator';
import { motifCoverage } from './solver/objective';

export interface AnthemEngine {
  generate(): AnthemOutput | null;
  getConfig(): Readonly<AnthemConfig>;
}

function nowMs(): number {
  return Date.now();
}

function validateConfig(config: AnthemConfig): void {
  if (config.bars < 8 || config.bars > 128) {
    throw new RangeError('bars must be 8-128, got ' + config.bars);
  }
  if (config.voices < 1 || config.voices > 4) {
    throw new RangeError('voices must be 1-4, got ' + config.voices);
  }
  if (config.targetRange.min < 0 || config.targetRange.max > 127) {
    throw new RangeError('targetRange must be within MIDI 0-127');
  }
  if (config.targetRange.min >= config.targetRange.max) {
    throw new RangeError('targetRange.min must be < targetRange.max');
  }
  if (config.energyCurve === EnergyCurve.CUSTOM) {
    if (!config.customCurve || config.customCurve.length === 0) {
      throw new TypeError('customCurve is required when energyCurve is CUSTOM');
    }
  }
  if (config.scale.root < 0 || config.scale.root > 11) {
    throw new RangeError('scale.root must be 0-11, got ' + config.scale.root);
  }
}

function clampDuration(d: number): number {
  const min = EXPRESSION_CONFIG.MIN_DURATION;
  const max = EXPRESSION_CONFIG.MAX_DURATION;
  const clamped = Math.max(min, Math.min(max, d));
  const allowed = [0.25, 0.5, 1, 2, 4];
  let best = 1;
  let bd = Infinity;
  for (const a of allowed) {
    const dist = Math.abs(a - clamped);
    if (dist < bd) {
      bd = dist;
      best = a;
    }
  }
  return best;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toMusicalEvents(events: InternalNoteEvent[]): MusicalEvent[] {
  const sorted = events.slice().sort((a, b) => a.startBeat - b.startBeat || a.voice - b.voice);
  return sorted.map((e) => {
    const data: NoteData = e.articulation !== undefined
      ? { pitch: e.pitch, velocity: e.velocity, articulation: e.articulation }
      : { pitch: e.pitch, velocity: e.velocity };
    return {
      type: 'note' as const,
      timestamp: round4(e.startBeat),
      duration: clampDuration(e.duration),
      channel: e.voice % 16,
      data,
    };
  });
}
