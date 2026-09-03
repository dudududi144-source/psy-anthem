// PSY ANTHEM - index.ts (public API)
export { parseConfig, safeParseConfig, ANTHEM_CONFIG_LIMITS } from './validation/config-schema';
export type { SchemaIssue, SchemaError, ConfigParseResult } from './validation/config-schema';

export { createAnthemEngine } from './engine';
export type { AnthemEngine } from './engine';

export { AnthemIntent, EnergyCurve } from './types';
export type {
  AnthemConfig, AnthemOutput, GenerationMetadata, GenerationQuality,
  HarmonicAnalysis, ChordSymbol, ChordQuality, CadencePoint,
  MotifDNA, MotifOccurrence, Transformation, TransformType,
  ScaleDefinition, ScaleMode, NoteRange, CustomCurvePoint,
  MusicalEvent, NoteData, ControlData, ProgramData, Articulation,
  SectionPlan, SectionRole, BarTension, TensionWeights,
  InternalNoteEvent, VoiceOutput, SolverResult,
  TheoryLintResult, LintIssue,
} from './types';

export { createRNG, deriveSeeds } from './rng';
export type { RNG, WeightedChoice } from './rng';

export { generateMotif, rhythmicCharacterFor } from './motif/generator';
export { applyTransform, transformMotifForSection } from './motif/transformer';
export { scoreMotif } from './motif/scorer';

export { generateChordProgression, chordTones } from './harmony/chord-progressions';
export type { ChordProgression } from './harmony/chord-progressions';
export { buildVoices, detectParallelFifths, detectParallelOctaves } from './harmony/voice-leading';
export { sampleEnergyCurve, barEnergy, compositeTension } from './harmony/tension';
export { scalePitchClasses, isInScale, intervalClass, isConsonant, isDissonant, snapToScale } from './harmony/intervals';

export { planSections } from './structure/section-planner';
export { getMacroForm } from './structure/macro-form';

export { humanizeTiming } from './expression/humanize';
export { deriveArticulation } from './expression/articulation';
export { velocityFromEnergy } from './expression/dynamics';

export { solveCSP } from './solver/constraint-solver';
export type { CSPVariable, CSPResult, Constraint } from './solver/constraint-solver';
export { theoryLint } from './solver/validator';
export {
  validateArtisticQuality,
  analyzeMelodicInterest,
  analyzeHarmonicRichness,
  analyzeRhythmicVariety,
  analyzeTexturalDepth,
  analyzeEmotionalArc,
  calculateMaxSimultaneous,
} from './quality/artistic-validator';
export type { ArtisticReport } from './quality/artistic-validator';
export { scoreStepwise, scoreContour, scoreRhythmicVariety, motifCoverage } from './solver/objective';

// Phase 11 - PSYBUS integration is intentionally NOT re-exported here.
// The core bundle (this entry) stays lean for the browser demo; hosts import
// the adapter via its own entry point:
//   import { PsyAnthemAdapter, InMemoryPSYBUS } from 'psy-anthem/src/integration';
