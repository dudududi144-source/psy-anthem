// PSY ANTHEM - src/integration/psybus-types.ts
// Local mirror of the PSYBUS protocol (psyboss/src/psybus/types.ts) plus the
// anthem control-plane kinds. Kept local so psy-anthem stays dependency-free
// (family shim pattern). Keep in sync with psyboss.

import type { AnthemConfig, GenerationMetadata, MusicalEvent } from '../types';

// ---- Bus envelope (mirrors psyboss BusEnvelope) ----

export interface PsyBusEnvelope<P extends PsyBusPayload = PsyBusPayload> {
  rev: number;
  seed: number;
  src: string;
  dst: string | 'broadcast';
  ts: number;
  payload: P;
}

// ---- Bus payloads: the real PSYBUS kinds psy-anthem participates in ----

export type BusTransportPayload = {
  kind: 'transport';
  bpm: number;
  beat: number;
  bar: number;
  phase: number;
  playing: boolean;
  audioTime: number;
};

export type BusNotePayload = {
  kind: 'note';
  track: string;
  note: number;
  vel: number;
  durBeats: number;
  channel: number;
};

export type BusTransportStartPayload = { kind: 'transport.start' };
export type BusTransportStopPayload = { kind: 'transport.stop' };
export type BusTransportSeekPayload = { kind: 'transport.seek'; beat: number };
export type BusNoteOffPayload = { kind: 'note.off'; track: string; note: number };
export type BusSidechainPayload = { kind: 'sidechain.duck'; target: string; depth: number; releaseMs: number };
export type BusChokePayload = { kind: 'choke'; group: string; except?: string };
export type BusParamSetPayload = { kind: 'param.set'; track: string; param: string; value: number };
export type BusVoiceCountPayload = { kind: 'voice.count'; device: string; active: number; stolen: number };
export type BusErrorPayload = { kind: 'error'; device: string; code: string; message: string };
export type BusContextPayload = {
  kind: 'context';
  key: string;
  scale: string;
  energy: number;
  section: string;
};

// ---- Anthem control-plane kinds (adapter-level, not on the shared bus) ----

export type SceneLoadPayload = { kind: 'scene.load'; sceneId: string; config: AnthemConfig };
export type SceneLoadedPayload = {
  kind: 'scene.loaded';
  sceneId: string;
  config: AnthemConfig;
  metadata: GenerationMetadata;
};
export type CompositionEventsPayload = {
  kind: 'composition.events';
  events: MusicalEvent[];
  position: number;
  ducked?: boolean;
};
export type CompositionChokePayload = { kind: 'composition.choke' };
export type DeviceStatusPayload = { kind: 'device.status'; state: 'playing' | 'stopped'; position: number };
export type DeviceTelemetryPayload = {
  kind: 'device.telemetry';
  events: number;
  quality: number | undefined;
  memorability: number;
  generationTime: number;
};
export type ParamAckPayload = { kind: 'param.ack'; param: string; value: number };

// ---- Phase 12: scene morphing + live automation ----

export type MorphCurve = 'linear' | 'exponential' | 'bezier';
export type AutomationParam = 'velocity' | 'duration' | 'pitch';

export type MorphStartPayload = {
  kind: 'morph.start';
  fromScene: AnthemConfig;
  toScene: AnthemConfig;
  durationBars: number;
  curve: MorphCurve;
};
export type MorphUpdatePayload = { kind: 'morph.update'; progress: number };
export type MorphStartedPayload = { kind: 'morph.started'; durationBars: number; curve: MorphCurve };
export type MorphProgressPayload = {
  kind: 'morph.progress';
  progress: number;
  isTransitioning: boolean;
  completed: boolean;
};
export type AutomationStartPayload = {
  kind: 'automation.start';
  param: AutomationParam;
  startValue: number;
  endValue: number;
  durationBeats: number;
  curve: MorphCurve;
};
export type AutomationStopPayload = { kind: 'automation.stop'; param: AutomationParam };
export type AutomationStartedPayload = {
  kind: 'automation.started';
  param: AutomationParam;
  durationBeats: number;
};
export type AutomationStoppedPayload = { kind: 'automation.stopped'; param: AutomationParam };

// ---- Phase 13: real-time generative evolution ----

export type EvolutionDepth = 'shallow' | 'medium' | 'deep';
export type HarmonicSubstitution = 'tritone' | 'relative' | 'parallel' | 'chromatic';

export type EvolutionConstraintsConfig = {
  preserveRhythm: boolean;
  preserveContour: boolean;
  maxIntervalChange: number; // semitones
};

export type MotifEvolutionConfig = {
  mutationRate: number; // 0-1 per regeneration
  evolutionDepth: EvolutionDepth;
  constraints: EvolutionConstraintsConfig;
};

export type HarmonicEvolutionConfig = {
  substitutionRate: number; // 0-1 per chord
  allowedSubstitutions: HarmonicSubstitution[];
};

export type RealtimeGenerationConfig = {
  enabled: boolean;
  motifEvolution: MotifEvolutionConfig;
  harmonicEvolution: HarmonicEvolutionConfig;
  regenerationIntervalBars: number;
};

export type RealtimeEnablePayload = { kind: 'realtime.enable'; config: RealtimeGenerationConfig };
export type RealtimeDisablePayload = { kind: 'realtime.disable' };
export type RealtimeEvolvePayload = { kind: 'realtime.evolve'; force?: boolean };
export type RealtimeEnabledPayload = { kind: 'realtime.enabled' };
export type RealtimeDisabledPayload = { kind: 'realtime.disabled' };
export type RealtimeEvolvedPayload = {
  kind: 'realtime.evolved';
  bar: number;
  motifMutations: number;
  harmonicSubstitutions: number;
};

export type PsyBusPayload =
  | BusTransportPayload
  | BusTransportStartPayload
  | BusTransportStopPayload
  | BusTransportSeekPayload
  | BusNotePayload
  | BusNoteOffPayload
  | BusSidechainPayload
  | BusChokePayload
  | BusParamSetPayload
  | BusVoiceCountPayload
  | BusErrorPayload
  | BusContextPayload
  | SceneLoadPayload
  | SceneLoadedPayload
  | CompositionEventsPayload
  | CompositionChokePayload
  | DeviceStatusPayload
  | DeviceTelemetryPayload
  | ParamAckPayload
  | MorphStartPayload
  | MorphUpdatePayload
  | MorphStartedPayload
  | MorphProgressPayload
  | AutomationStartPayload
  | AutomationStopPayload
  | AutomationStartedPayload
  | AutomationStoppedPayload
  | RealtimeEnablePayload
  | RealtimeDisablePayload
  | RealtimeEvolvePayload
  | RealtimeEnabledPayload
  | RealtimeDisabledPayload
  | RealtimeEvolvedPayload;

// Spec-compat message shape (flat): normalized into envelopes by the adapter.
export interface SpecMessage {
  type: string;
  deviceId?: string;
  payload: Record<string, unknown>;
}
