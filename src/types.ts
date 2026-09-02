// PSY ANTHEM — types.ts
import type { Articulation, MusicalEvent, NoteData, ControlData, ProgramData } from './foundation-shim/protocol';

// Re-export canonical protocol types so consumers import from one place.
export type { Articulation, MusicalEvent, NoteData, ControlData, ProgramData };

// ================= INPUT =================

export enum AnthemIntent {
  EUPHORIC_TRANCE = 'euphoric-trance',
  DARK_PSY = 'dark-psy',
  PROGRESSIVE = 'progressive',
  FULL_ON = 'full-on',
  EMOTIONAL_BREAKDOWN = 'emotional-breakdown',
  FOREST = 'forest',
  EMOTIONAL_LEAD = 'emotional-lead',
}

export type ScaleMode =
  | 'minor' | 'major' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian'
  | 'harmonicMinor' | 'melodicMinor' | 'hungarianMinor' | 'doubleHarmonicMajor';

export interface ScaleDefinition {
  root: number; // 0-11
  mode: ScaleMode;
}

export enum EnergyCurve {
  FLAT = 'flat',
  ARC = 'arc',
  BUILD_DROP = 'build-drop',
  WAVE = 'wave',
  CUSTOM = 'custom',
}

export interface NoteRange { min: number; max: number; }

export type DensityLevel = 'sparse' | 'medium' | 'dense';
export type HarmonyComplexity = 'simple' | 'standard' | 'complex';

export interface CustomCurvePoint { position: number; energy: number; }

export interface AnthemConfig {
  seed: number;
  intent: AnthemIntent;
  scale: ScaleDefinition;
  energyCurve: EnergyCurve;
  targetRange: NoteRange;
  voices: number; // 1-4
  bars: number;   // 8-128
  bpm?: number;   // default 140
  customCurve?: CustomCurvePoint[];
  // --- phase 9 expression controls (all optional, deterministic, default off) ---
  chromaticTension?: number;  // 0-1: probability weight for chromatic tension notes in the lead
  // --- advanced composition controls (all optional, all deterministic) ---
  density?: DensityLevel;                // note activity per bar (default medium)
  harmonyComplexity?: HarmonyComplexity; // progression language (default standard)
  loopMode?: boolean;                    // last bar connects back to the first
  callResponse?: boolean;                // alternating question/answer bars
}

// ================= OUTPUT =================

export type ChordQuality =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dominant7' | 'major7' | 'minor7' | 'sus2' | 'sus4'
  | 'major9' | 'minor9' | 'dominant9'
  | 'major11' | 'minor11' | 'dominant11'
  | 'major13' | 'minor13' | 'dominant13';

export interface ChordSymbol {
  root: number;
  quality: ChordQuality;
  extensions: number[];
  startBar: number;
  durationBars: number;
}

export interface CadencePoint {
  bar: number;
  type: 'authentic' | 'plagal' | 'half' | 'deceptive';
  strength: number;
}

export interface HarmonicAnalysis {
  chords: ChordSymbol[];
  key: ScaleDefinition;
  cadences: CadencePoint[];
  tensionCurve: number[];
}

export type TransformType =
  | 'TRANSPOSE' | 'SEQUENCE' | 'INVERT' | 'RETROGRADE' | 'AUGMENT'
  | 'DIMINISH' | 'TRUNCATE' | 'EXTEND' | 'RHYTHMIC_SHIFT' | 'ORNAMENT' | 'EVOLUTION';

export interface Transformation {
  type: TransformType;
  params: Record<string, number>;
}

export interface MotifOccurrence {
  bar: number;
  beat: number;
  transformChain: Transformation[];
  confidence: number;
}

export interface MotifDNA {
  coreNotes: number[];
  coreRhythm: number[];
  transformations: Transformation[];
  occurrences: MotifOccurrence[];
}

export type GenerationQuality = 'excellent' | 'good' | 'acceptable' | 'degraded';

export interface ArtisticBreakdown {
  melodicInterest: number;
  harmonicRichness: number;
  rhythmicVariety: number;
  texturalDepth: number;
  emotionalArc: number;
}

export interface GenerationMetadata {
  seed: number;
  intent: AnthemIntent;
  generationTimeMs: number;
  memorabilityScore: number;
  constraintsViolated: number;
  solverIterations: number;
  quality: GenerationQuality;
  bars: number;
  voices: number;
  artisticQuality?: number;
  artisticBreakdown?: ArtisticBreakdown;
  artisticIssues?: string[];
  artisticSuggestions?: string[];
}

export interface AnthemOutput {
  events: MusicalEvent[];
  harmonicAnalysis: HarmonicAnalysis;
  motifDNA: MotifDNA;
  metadata: GenerationMetadata;
}

// ================= INTERNAL =================

export type SectionRole = 'INTRO' | 'BUILD' | 'DROP' | 'BREAKDOWN' | 'OUTRO' | 'VERSE' | 'BRIDGE';

export interface SectionPlan {
  role: SectionRole;
  startBar: number;
  bars: number;
  energyRange: NoteRange;
  harmonicRhythm: number;
  densityTarget: number;
  motifTransforms: Transformation[];
}

export interface TensionWeights {
  harmonic: number; rhythmic: number; register: number; dynamic: number; density: number;
}

export interface BarTension {
  bar: number;
  harmonic: number; rhythmic: number; register: number; dynamic: number; density: number;
  composite: number;
}

export interface InternalNoteEvent {
  voice: number;
  pitch: number;
  startBeat: number;
  duration: number;
  velocity: number;
  articulation?: Articulation;
  tension?: boolean;
}

export interface VoiceOutput {
  voiceIndex: number;
  events: InternalNoteEvent[];
}

export interface SolverResult {
  voices: VoiceOutput[];
  complete: boolean;
  constraintsViolated: number;
  qualityScore: number;
  solverTimeMs: number;
  solverIterations: number;
}

export interface LintIssue { type: string; bar?: number; message?: string; }

export interface TheoryLintResult {
  valid: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
  score: number;
}
