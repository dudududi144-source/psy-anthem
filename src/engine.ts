// PSY ANTHEM - engine.ts
import { EXPRESSION_CONFIG, VALIDATION_THRESHOLDS } from './constants';
import { EnergyCurve } from './types';
import type {
  AnthemConfig, AnthemOutput, GenerationMetadata, GenerationQuality,
  HarmonicAnalysis, InternalNoteEvent, MotifDNA, MusicalEvent, NoteData,
} from './types';
import { createRNG } from './rng';
import type { RNG } from './rng';
import { generateMotif } from './motif/generator';
import { generateChordProgression } from './harmony/chord-progressions';
import { buildVoices } from './harmony/voice-leading';
import { barEnergy } from './harmony/tension';
import { planSections } from './structure/section-planner';
import { humanizeTiming } from './expression/humanize';
import { deriveArticulation } from './expression/articulation';
import { velocityFromEnergy } from './expression/dynamics';
import { theoryLint } from './solver/validator';
import { scalePitchClasses, snapToScale } from './harmony/intervals';
import { motifCoverage } from './solver/objective';
import { validateArtisticQuality } from './quality/artistic-validator';

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
    const data: NoteData = { pitch: e.pitch, velocity: e.velocity };
    if (e.articulation !== undefined) data.articulation = e.articulation;
    if (e.tension === true) data.tension = true;
    return {
      type: 'note' as const,
      timestamp: round4(e.startBeat),
      duration: clampDuration(e.duration),
      channel: e.voice % 16,
      data,
    };
  });
}

// Stepwise recovery / arpeggio smoothing: every lead leap larger than a
// perfect fourth is rewritten as a scale step in the same direction.
// Direction and register are preserved, contour stays intact, and the
// voice-leading smoothness score improves without losing genre character.
function smoothLeadVoice(events: InternalNoteEvent[], pcs: number[], lo: number, hi: number): void {
  const lead = events.filter((e) => e.voice === 0).sort((a, b) => a.startBeat - b.startBeat);
  for (let i = 1; i < lead.length; i++) {
    const prev = lead[i - 1]!;
    const note = lead[i]!;
    const leap = note.pitch - prev.pitch;
    if (Math.abs(leap) > 5) {
      const dir = leap > 0 ? 1 : -1;
      note.pitch = snapToScale(prev.pitch + dir * 2, pcs, lo, hi);
    }
  }
}

// Drum pitch map (GM): kick=36, snare=38, clap=39, hatClosed=42, hatOpen=46, percLow=43, percHigh=50.
// Psytrance drum pattern: rolling kick on beats, offbeat hats, snare on beat 4.
// Returns drum events on voice 9 (GM drum channel).
function generateDrumPattern(frozen: AnthemConfig, rng: RNG): InternalNoteEvent[] {
  const drums: InternalNoteEvent[] = [];
  const sixteenth = 0.25; // beats
  for (let bar = 0; bar < frozen.bars; bar++) {
    const barStart = bar * 4;
    // Kick on every beat (0,4,8,12 sixteenths = beats 0,1,2,3)
    for (const s of [0, 4, 8, 12]) {
      drums.push({ voice: 9, pitch: 36, startBeat: barStart + s * sixteenth, duration: 0.2, velocity: 110 });
    }
    // Offbeat closed hats on the 'and' (sixteenths 2,6,10,14)
    for (const s of [2, 6, 10, 14]) {
      drums.push({ voice: 9, pitch: 42, startBeat: barStart + s * sixteenth, duration: 0.1, velocity: 70 });
    }
    // Extra 16th hats for drive (sixteenths 1,3,5,7,...) at lower velocity
    for (const s of [1, 3, 5, 7, 9, 11, 13, 15]) {
      if (rng.next() < 0.5) {
        drums.push({ voice: 9, pitch: 42, startBeat: barStart + s * sixteenth, duration: 0.08, velocity: 45 });
      }
    }
    // Snare on beat 4 (sixteenth 12), open hat at end of every 4 bars
    drums.push({ voice: 9, pitch: 38, startBeat: barStart + 12 * sixteenth, duration: 0.2, velocity: 95 });
    if ((bar + 1) % 4 === 0) {
      drums.push({ voice: 9, pitch: 46, startBeat: barStart + 14 * sixteenth, duration: 0.4, velocity: 80 });
    }
  }
  return drums;
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

      // 4b. Arpeggio smoothing on the lead voice (always on)
      const pcs = scalePitchClasses(frozen.scale);
      const leadVoice = solved.voices[0];
      if (leadVoice) {
        smoothLeadVoice(leadVoice.events, pcs, frozen.targetRange.min, frozen.targetRange.max);
      }

      // 4c. Optional chromatic tension pass (default off -> golden-safe).
      const tensionAmount = frozen.chromaticTension ?? 0;
      if (tensionAmount > 0 && leadVoice) {
        const leadEvents = leadVoice.events.slice().sort((a, b) => a.startBeat - b.startBeat);
        let lastBar = -1;
        for (const ev of leadEvents) {
          const bar = Math.floor(ev.startBeat / 4);
          if (bar !== lastBar) { lastBar = bar; continue; } // skip first note of each bar
          if (rng.next() < tensionAmount * 0.5) {
            const dir = rng.nextBool() ? 1 : -1;
            const shifted = ev.pitch + dir;
            if (shifted >= frozen.targetRange.min && shifted <= frozen.targetRange.max) {
              ev.pitch = shifted;
              ev.velocity = Math.max(40, Math.round(ev.velocity * 0.8));
              ev.tension = true;
            }
          }
        }
      }

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

      const output: AnthemOutput = { events, harmonicAnalysis, motifDNA, metadata };

      // Artistic quality pass (pure analysis, no RNG consumed).
      const artistic = validateArtisticQuality(output);
      metadata.artisticQuality = artistic.score;
      metadata.artisticBreakdown = {
        melodicInterest: artistic.melodicInterest,
        harmonicRichness: artistic.harmonicRichness,
        rhythmicVariety: artistic.rhythmicVariety,
        texturalDepth: artistic.texturalDepth,
        emotionalArc: artistic.emotionalArc,
      };
      metadata.artisticIssues = artistic.issues;
      metadata.artisticSuggestions = artistic.suggestions;

      return output;
    },
  };
}

function calcMemorability(coverage: number, lintScore: number): number {
  const covScore = coverage * 50;
  const lintContribution = (lintScore / 100) * 30;
  const base = 20;
  return Math.round(Math.min(100, covScore + lintContribution + base));
}

function assessQuality(memorability: number, lintScore: number): GenerationQuality {
  if (memorability >= 90 && lintScore >= 95) return 'excellent';
  if (memorability >= 75 && lintScore >= 85) return 'good';
  if (memorability >= VALIDATION_THRESHOLDS.MIN_MEMORABILITY && lintScore >= 70) return 'acceptable';
  return 'degraded';
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

      // 4b. Arpeggio smoothing on the lead voice (always on)
      const pcs = scalePitchClasses(frozen.scale);
      const leadVoice = solved.voices[0];
      if (leadVoice) {
        smoothLeadVoice(leadVoice.events, pcs, frozen.targetRange.min, frozen.targetRange.max);
      }

      // 4c. Optional chromatic tension pass (default off -> golden-safe).
      const tensionAmount = frozen.chromaticTension ?? 0;
      if (tensionAmount > 0 && leadVoice) {
        const leadEvents = leadVoice.events.slice().sort((a, b) => a.startBeat - b.startBeat);
        let lastBar = -1;
        for (const ev of leadEvents) {
          const bar = Math.floor(ev.startBeat / 4);
          if (bar !== lastBar) { lastBar = bar; continue; } // skip first note of each bar
          if (rng.next() < tensionAmount * 0.5) {
            const dir = rng.nextBool() ? 1 : -1;
            const shifted = ev.pitch + dir;
            if (shifted >= frozen.targetRange.min && shifted <= frozen.targetRange.max) {
              ev.pitch = shifted;
              ev.velocity = Math.max(40, Math.round(ev.velocity * 0.8));
              ev.tension = true;
            }
          }
        }
      }

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

      const output: AnthemOutput = { events, harmonicAnalysis, motifDNA, metadata };

      // Artistic quality pass (pure analysis, no RNG consumed).
      const artistic = validateArtisticQuality(output);
      metadata.artisticQuality = artistic.score;
      metadata.artisticBreakdown = {
        melodicInterest: artistic.melodicInterest,
        harmonicRichness: artistic.harmonicRichness,
        rhythmicVariety: artistic.rhythmicVariety,
        texturalDepth: artistic.texturalDepth,
        emotionalArc: artistic.emotionalArc,
      };
      metadata.artisticIssues = artistic.issues;
      metadata.artisticSuggestions = artistic.suggestions;

      return output;
    },
  };
}

function calcMemorability(coverage: number, lintScore: number): number {
  const covScore = coverage * 50;
  const lintContribution = (lintScore / 100) * 30;
  const base = 20;
  return Math.round(Math.min(100, covScore + lintContribution + base));
}

function assessQuality(memorability: number, lintScore: number): GenerationQuality {
  if (memorability >= 90 && lintScore >= 95) return 'excellent';
  if (memorability >= 75 && lintScore >= 85) return 'good';
  if (memorability >= VALIDATION_THRESHOLDS.MIN_MEMORABILITY && lintScore >= 70) return 'acceptable';
  return 'degraded';
}
