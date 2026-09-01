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
  | ParamAckPayload;

// Spec-compat message shape (flat): normalized into envelopes by the adapter.
export interface SpecMessage {
  type: string;
  deviceId?: string;
  payload: Record<string, unknown>;
}
