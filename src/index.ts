// PSY ANTHEM - index.ts (public API)
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
export { scoreStepwise, scoreContour, scoreRhythmicVariety, motifCoverage } from './solver/objective';
