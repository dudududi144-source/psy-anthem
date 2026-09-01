// PSY ANTHEM - src/integration/psybus-adapter.ts
// PsyAnthemAdapter: exposes the composition engine as a PSYBUS participant.
// Bus-facing: handleEnvelope() consumes transport/param/sidechain/choke envelopes
// and publishes `note` envelopes (+ control acks). Control-plane: loadScene/play/
// stop/seek. Deterministic composition path; envelope metadata (ts) is transport-level.

import { createAnthemEngine } from '../engine';
import type { AnthemConfig, AnthemOutput, MusicalEvent, NoteData } from '../types';
import type {
  BusNotePayload,
  CompositionEventsPayload,
  PsyBusEnvelope,
  PsyBusPayload,
  SpecMessage,
} from './psybus-types';

export interface PsyAnthemAdapterConfig {
  deviceId: string;
  seed: number;
  send: (msg: PsyBusEnvelope) => void;
  trackId?: string;
  emitWindowBeats?: number; // emission window per transport tick (default 0.25 beat)
}

export class PsyAnthemAdapter {
  readonly deviceId: string;
  private seed: number;
  private send: (msg: PsyBusEnvelope) => void;
  private trackId: string;
  private emitWindowBeats: number;
  private rev = 0;

  private currentOutput: AnthemOutput | null = null;
  private currentConfig: AnthemConfig | null = null;
  private currentSceneId: string | null = null;
  private isPlaying = false;
  private transportPosition = 0; // beats
  private bpm = 140;
  private params = new Map<string, number>();
  private duck: { depth: number; releaseMs: number } | null = null;
  private activeNotes = new Set<number>();

  constructor(config: PsyAnthemAdapterConfig) {
    this.deviceId = config.deviceId;
    this.seed = config.seed;
    this.send = config.send;
    this.trackId = config.trackId ?? 'anthem';
    this.emitWindowBeats = config.emitWindowBeats ?? 0.25;
  }

  // ---- identity ----

  getDeviceId(): string {
    return this.deviceId;
  }

  getDeviceType(): string {
    return 'composition-engine';
  }

  setSend(send: (msg: PsyBusEnvelope) => void): void {
    this.send = send;
  }

  // ---- control plane ----

  loadScene(sceneId: string, config: AnthemConfig): void {
    try {
      const engine = createAnthemEngine(config);
      const out = engine.generate();
      if (!out) {
        this.emit({ kind: 'error', device: this.deviceId, code: 'generation-failed', message: 'Engine returned null' });
        return;
      }
      this.currentOutput = out;
      this.currentConfig = config;
      this.currentSceneId = sceneId;
      this.transportPosition = 0;
      this.activeNotes.clear();
      this.emit({ kind: 'scene.loaded', sceneId, config, metadata: out.metadata });
    } catch (err) {
      this.emit({ kind: 'error', device: this.deviceId, code: 'scene-load-error', message: String(err) });
    }
  }

  play(positionBeats = 0): void {
    this.isPlaying = true;
    this.transportPosition = positionBeats;
    this.emit({ kind: 'device.status', state: 'playing', position: this.transportPosition });
    this.emitEventsAtPosition(this.transportPosition);
  }

  stop(): void {
    this.isPlaying = false;
    this.emitAllNotesOff();
    this.emit({ kind: 'device.status', state: 'stopped', position: this.transportPosition });
  }

  seek(positionBeats: number): void {
    this.transportPosition = Math.max(0, positionBeats);
    if (this.isPlaying) this.emitEventsAtPosition(this.transportPosition);
  }

  reportTelemetry(): void {
    const out = this.currentOutput;
    if (!out) return;
    this.emit({ kind: 'voice.count', device: this.deviceId, active: this.activeNotes.size, stolen: 0 });
    this.emit({
      kind: 'device.telemetry',
      events: out.events.length,
      quality: out.metadata.artisticQuality,
      memorability: out.metadata.memorabilityScore,
      generationTime: out.metadata.generationTimeMs,
    });
  }

  // ---- bus-facing ----

  handleEnvelope(envelope: PsyBusEnvelope): void {
    const p = envelope.payload;
    switch (p.kind) {
      case 'transport':
        this.bpm = p.bpm;
        this.isPlaying = p.playing;
        const posBeats = p.bar * 4 + p.beat + p.phase;
        if (p.playing && posBeats >= this.transportPosition) {
          this.transportPosition = posBeats;
          this.emitEventsAtPosition(this.transportPosition);
        }
        break;
      case 'transport.start':
        this.play(this.transportPosition);
        break;
      case 'transport.stop':
        this.stop();
        break;
      case 'transport.seek':
        this.seek(p.beat);
        break;
      case 'param.set':
        this.params.set(p.param, p.value);
        this.emit({ kind: 'param.ack', param: p.param, value: p.value });
        break;
      case 'sidechain.duck':
        this.handleSidechainDuck(p.depth, p.releaseMs);
        break;
      case 'choke':
        if (!p.except || p.except !== this.deviceId) this.handleChoke();
        break;
      case 'scene.load':
        this.loadScene(p.sceneId, p.config);
        break;
      default:
        break;
    }
  }

  // Spec-compat flat-message dispatcher.
  handleMessage(msg: SpecMessage): void {
    const pl = msg.payload ?? {};
    switch (msg.type) {
      case 'scene.load':
        this.loadScene(String(pl.sceneId ?? 'scene'), pl.config as AnthemConfig);
        break;
      case 'transport.play':
        this.play(Number(pl.position ?? 0));
        break;
      case 'transport.stop':
        this.stop();
        break;
      case 'transport.position':
        this.seek(Number(pl.position ?? 0));
        break;
      case 'param.set':
        this.params.set(String(pl.param ?? ''), Number(pl.value ?? 0));
        this.emit({ kind: 'param.ack', param: String(pl.param ?? ''), value: Number(pl.value ?? 0) });
        break;
      case 'sidechain.duck':
        this.handleSidechainDuck(Number(pl.amount ?? pl.depth ?? 0), Number(pl.duration ?? pl.releaseMs ?? 100));
        break;
      case 'choke':
        this.handleChoke();
        break;
      default:
        break;
    }
  }

  // ---- internals ----

  private handleSidechainDuck(depth: number, releaseMs: number): void {
    this.duck = { depth, releaseMs };
    const out = this.currentOutput;
    if (!out) return;
    const amount = Math.max(0, Math.min(1, depth));
    const duckedEvents: MusicalEvent[] = out.events.map((event) => {
      if (event.type !== 'note') return event;
      const data = event.data as NoteData;
      const duckedVelocity = Math.max(0, Math.round(data.velocity * (1 - amount)));
      return { ...event, data: { ...data, velocity: duckedVelocity } };
    });
    const payload: CompositionEventsPayload = {
      kind: 'composition.events',
      events: duckedEvents,
      position: this.transportPosition,
      ducked: true,
    };
    this.emit(payload);
  }

  private handleChoke(): void {
    this.isPlaying = false;
    this.emitAllNotesOff();
    this.emit({ kind: 'composition.choke' });
  }

  private emitEventsAtPosition(position: number): void {
    const out = this.currentOutput;
    if (!out) return;
    const end = position + this.emitWindowBeats;
    const events = out.events.filter((e) => e.timestamp >= position && e.timestamp < end);
    if (events.length === 0) return;

    // Real PSYBUS note envelopes (consumed directly by synth/drum adapters)...
    for (const e of events) {
      if (e.type !== 'note') continue;
      const data = e.data as NoteData;
      const payload: BusNotePayload = {
        kind: 'note',
        track: this.trackId,
        note: data.pitch,
        vel: data.velocity,
        durBeats: e.duration,
        channel: e.channel,
      };
      this.emit(payload);
      this.activeNotes.add(data.pitch);
    }
    // ...plus the control-plane batch message (spec compat).
    this.emit({ kind: 'composition.events', events, position });
  }

  private emitAllNotesOff(): void {
    for (const note of this.activeNotes) {
      this.emit({ kind: 'note.off', track: this.trackId, note });
    }
    this.activeNotes.clear();
  }

  private emit(payload: PsyBusPayload): void {
    this.rev += 1;
    this.send({
      rev: this.rev,
      seed: this.seed,
      src: this.deviceId,
      dst: 'broadcast',
      ts: Date.now(),
      payload,
    });
  }
}
