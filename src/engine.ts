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

export function createAnthemEngine(config: AnthemConfig): AnthemEngine {
  validateConfig(config);
  const frozen: AnthemConfig = config.bpm !== undefined ? { ...config } : { ...config, bpm: 140 };

  return {
    getConfig(): Readonly<AnthemConfig> {
      return { ...frozen };
    },

    generate(): AnthemOutput | null {
      const start = nowMs();
      const rng = createRNG(frozen.seed);

      // 1. Structure planning
      const sections = planSections(frozen);

      // 2. Motif DNA
      const motif: MotifDNA = generateMotif(frozen, rng);

      // 3. Harmonic framework
      const progression = generateChordProgression(frozen, sections, rng);

      // 4. Voice leading (constructive deterministic path)
      const solved = buildVoices({ motif, sections, progression, config: frozen }, rng);
      if (!solved.complete) return null;

      // 5. Tension + expression per voice, per bar
      const expressed: InternalNoteEvent[] = [];
      for (const voice of solved.voices) {
        const byBar = new Map<number, InternalNoteEvent[]>();
        for (const e of voice.events) {
          const bar = Math.floor(e.startBeat / 4);
          const list = byBar.get(bar);
          if (list) list.push(e);
          else byBar.set(bar, [e]);
        }
        const bars = Array.from(byBar.keys()).sort((a, b) => a - b);
        for (const bar of bars) {
          const list = byBar.get(bar)!;
          const energy = barEnergy(bar, frozen);
          let stage = velocityFromEnergy(list, energy);
          stage = deriveArticulation(stage, energy);
          stage = humanizeTiming(stage, rng);
          for (const e of stage) expressed.push(e);
        }
      }

      // 6. Canonical events
      const events = toMusicalEvents(expressed);

      // 7. Theory lint gate
      const lint = theoryLint(events, frozen);
      if (!lint.valid) return null;

      // 8. Metadata + output
      const generationTimeMs = nowMs() - start;
      const leadEvents = expressed.filter((e) => e.voice === 0);
      const coverageSource = leadEvents.length > 0 ? leadEvents : expressed;
      const coverage = motifCoverage(motif.coreNotes, coverageSource);
      const memorabilityScore = calcMemorability(coverage, lint.score);
      const quality = assessQuality(memorabilityScore, lint.score);

      const metadata: GenerationMetadata = {
        seed: frozen.seed,
        intent: frozen.intent,
        generationTimeMs,
        memorabilityScore,
        constraintsViolated: lint.warnings.length,
        solverIterations: solved.solverIterations,
        quality,
        bars: frozen.bars,
        voices: frozen.voices,
      };

      const occurrences = sections.map((s) => ({
        bar: s.startBar,
        beat: 0,
        transformChain: s.motifTransforms,
        confidence: 0.8,
      }));
      const motifDNA: MotifDNA = {
        coreNotes: motif.coreNotes,
        coreRhythm: motif.coreRhythm,
        transformations: motif.transformations,
        occurrences,
      };

      const tensionCurve: number[] = [];
      for (let b = 0; b < frozen.bars; b++) tensionCurve.push(barEnergy(b, frozen));
      const harmonicAnalysis: HarmonicAnalysis = {
        chords: progression.chords,
        key: progression.key,
        cadences: [],
        tensionCurve,
      };

      return { events, harmonicAnalysis, motifDNA, metadata };
    },
  };
}
