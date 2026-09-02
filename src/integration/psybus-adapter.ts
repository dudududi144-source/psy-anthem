// PSY ANTHEM - src/integration/psybus-adapter.ts
// PsyAnthemAdapter: exposes the composition engine as a PSYBUS participant.
// Bus-facing: handleEnvelope() consumes transport/param/sidechain/choke envelopes
// and publishes `note` envelopes (+ control acks). Control-plane: loadScene/play/
// stop/seek. Deterministic composition path; envelope metadata (ts) is transport-level.

import { createAnthemEngine } from '../engine';
import type { AnthemConfig, AnthemOutput, ChordSymbol, MusicalEvent, NoteData } from '../types';
import { SceneMorpher } from '../morphing/scene-morpher';
import { MotifEvolver } from '../evolution/motif-evolver';
import { HarmonicEvolver } from '../evolution/harmonic-evolver';
import type {
  AutomationParam,
  BusNotePayload,
  CompositionEventsPayload,
  MorphCurve,
  PsyBusEnvelope,
  PsyBusPayload,
  RealtimeGenerationConfig,
  SpecMessage,
} from './psybus-types';

interface ActiveAutomation {
  startValue: number;
  endValue: number;
  startBeat: number;
  durationBeats: number;
  curve: MorphCurve;
}

interface RealtimeState {
  config: RealtimeGenerationConfig;
  motifEvolver: MotifEvolver;
  harmonicEvolver: HarmonicEvolver;
  originalCoreNotes: number[];
  originalChords: ChordSymbol[];
  chordDeltas: Map<number, number>; // chord index -> transpose delta (semitones)
  lastEvolutionBar: number;
}

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
  private morpher: SceneMorpher | null = null;
  private automations = new Map<AutomationParam, ActiveAutomation>();
  private realtime: RealtimeState | null = null;

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

  // ---- observable state ----

  getBpm(): number {
    return this.bpm;
  }

  getCurrentSceneId(): string | null {
    return this.currentSceneId;
  }

  getCurrentConfig(): AnthemConfig | null {
    return this.currentConfig;
  }

  isDucked(): boolean {
    return this.duck !== null;
  }

  isPlayingNow(): boolean {
    return this.isPlaying;
  }

  getTransportPosition(): number {
    return this.transportPosition;
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
      this.morpher = null; // a fresh scene supersedes any active morph
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
      case 'morph.start':
        this.handleMorphStart(p.fromScene, p.toScene, p.durationBars, p.curve);
        break;
      case 'morph.update':
        this.handleMorphUpdate(p.progress);
        break;
      case 'automation.start':
        this.handleAutomationStart(p.param, p.startValue, p.endValue, p.durationBeats, p.curve);
        break;
      case 'automation.stop':
        this.handleAutomationStop(p.param);
        break;
      case 'realtime.enable':
        this.handleRealtimeEnable(p.config);
        break;
      case 'realtime.disable':
        this.handleRealtimeDisable();
        break;
      case 'realtime.evolve':
        this.handleRealtimeEvolve(p.force === true);
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
      case 'morph.start':
        this.handleMorphStart(
          pl.fromScene as AnthemConfig,
          pl.toScene as AnthemConfig,
          Number(pl.durationBars ?? pl.duration ?? 8),
          String(pl.curve ?? 'linear') as MorphCurve,
        );
        break;
      case 'morph.update':
        this.handleMorphUpdate(Number(pl.progress ?? 0));
        break;
      case 'automation.start':
        this.handleAutomationStart(
          String(pl.param ?? 'velocity') as AutomationParam,
          Number(pl.startValue ?? 1),
          Number(pl.endValue ?? 1),
          Number(pl.durationBeats ?? pl.duration ?? 8),
          String(pl.curve ?? 'linear') as MorphCurve,
        );
        break;
      case 'automation.stop':
        this.handleAutomationStop(String(pl.param ?? 'velocity') as AutomationParam);
        break;
      case 'realtime.enable':
        this.handleRealtimeEnable(pl.config as RealtimeGenerationConfig);
        break;
      case 'realtime.disable':
        this.handleRealtimeDisable();
        break;
      case 'realtime.evolve':
        this.handleRealtimeEvolve(pl.force === true);
        break;
      default:
        break;
    }
  }

  // ---- phase 12: morphing + automation ----

  isMorphing(): boolean {
    return this.morpher !== null && this.morpher.getState().isTransitioning;
  }

  getMorphProgress(): number {
    return this.morpher ? this.morpher.getState().progress : 0;
  }

  isAutomationActive(param: AutomationParam): boolean {
    return this.automations.has(param);
  }

  private handleMorphStart(
    fromScene: AnthemConfig,
    toScene: AnthemConfig,
    durationBars: number,
    curve: MorphCurve,
  ): void {
    const morpher = new SceneMorpher();
    try {
      morpher.loadScenes({ fromScene, toScene, durationBars, curve });
    } catch (err) {
      this.emit({ kind: 'error', device: this.deviceId, code: 'morph-load-failed', message: String(err) });
      return;
    }
    this.morpher = morpher;
    this.emit({ kind: 'morph.started', durationBars, curve });
  }

  private handleMorphUpdate(progress: number): void {
    if (!this.morpher) return;
    this.morpher.updateProgress(progress);
    const state = this.morpher.getState();
    this.emit({
      kind: 'morph.progress',
      progress: state.progress,
      isTransitioning: state.isTransitioning,
      completed: state.completed,
    });
  }

  private handleAutomationStart(
    param: AutomationParam,
    startValue: number,
    endValue: number,
    durationBeats: number,
    curve: MorphCurve,
  ): void {
    this.automations.set(param, {
      startValue,
      endValue,
      startBeat: this.transportPosition,
      durationBeats: Math.max(0.001, durationBeats),
      curve,
    });
    this.emit({ kind: 'automation.started', param, durationBeats });
  }

  private handleAutomationStop(param: AutomationParam): void {
    if (!this.automations.has(param)) return;
    this.automations.delete(param);
    this.emit({ kind: 'automation.stopped', param });
  }

  private automationCurve(progress: number, curve: MorphCurve): number {
    switch (curve) {
      case 'linear':
        return progress;
      case 'exponential':
        return progress * progress;
      case 'bezier':
        return progress * progress * (3 - 2 * progress);
    }
  }

  private automationValue(param: AutomationParam): number | null {
    const a = this.automations.get(param);
    if (!a) return null;
    const elapsed = this.transportPosition - a.startBeat;
    if (elapsed <= 0) return a.startValue;
    const progress = Math.min(1, elapsed / a.durationBeats);
    const curved = this.automationCurve(progress, a.curve);
    return a.startValue + (a.endValue - a.startValue) * curved;
  }

  private tickAutomations(): void {
    for (const [param, a] of Array.from(this.automations.entries())) {
      const elapsed = this.transportPosition - a.startBeat;
      if (elapsed >= a.durationBeats) {
        this.automations.delete(param);
        this.emit({ kind: 'automation.stopped', param });
      }
    }
  }

  // ---- phase 13: real-time generative evolution ----

  isRealtimeEnabled(): boolean {
    return this.realtime !== null && this.realtime.config.enabled;
  }

  private handleRealtimeEnable(config: RealtimeGenerationConfig): void {
    const out = this.currentOutput;
    if (!out) {
      this.emit({ kind: 'error', device: this.deviceId, code: 'realtime-no-scene', message: 'Cannot enable realtime generation without a loaded composition' });
      return;
    }
    const motifEvolver = new MotifEvolver(out.motifDNA, createRNG(this.seed + 1), config.motifEvolution);
    const harmonicEvolver = new HarmonicEvolver(out.harmonicAnalysis.chords, createRNG(this.seed + 2), config.harmonicEvolution);
    this.realtime = {
      config,
      motifEvolver,
      harmonicEvolver,
      originalCoreNotes: [...out.motifDNA.coreNotes],
      originalChords: out.harmonicAnalysis.chords.map((c) => ({ ...c })),
      chordDeltas: new Map(),
      lastEvolutionBar: -1,
    };
    this.emit({ kind: 'realtime.enabled' });
  }

  private handleRealtimeDisable(): void {
    if (!this.realtime) return;
    this.realtime = null;
    this.emit({ kind: 'realtime.disabled' });
  }

  private handleRealtimeEvolve(force: boolean): void {
    const rt = this.realtime;
    if (!rt || !rt.config.enabled) return;
    const bar = Math.floor(this.transportPosition / 4);
    const interval = Math.max(1, rt.config.regenerationIntervalBars);
    if (!force && bar - rt.lastEvolutionBar < interval) return;

    const evolvedMotif = rt.motifEvolver.evolve(bar);
    const evolvedChords = rt.harmonicEvolver.evolve();

    // Chord-root deltas transpose the non-lead voices inside each chord window.
    rt.chordDeltas = new Map();
    for (let i = 0; i < evolvedChords.length && i < rt.originalChords.length; i++) {
      const delta = evolvedChords[i]!.root - rt.originalChords[i]!.root;
      if (delta !== 0) rt.chordDeltas.set(i, delta);
    }
    rt.lastEvolutionBar = bar;

    const history = rt.motifEvolver.getEvolutionHistory();
    const lastEvent = history.length > 0 ? history[history.length - 1]! : null;
    this.emit({
      kind: 'realtime.evolved',
      bar,
      motifMutations: lastEvent ? lastEvent.mutations.length : 0,
      harmonicSubstitutions: rt.chordDeltas.size,
    });
  }

  /**
   * Apply the evolved motif + harmony to emission-window events.
   * Lead (channel 0): pitch classes remapped through the evolved motif.
   * Other voices: transposed by the substituted chord-root deltas.
   */
  private applyEvolutionToEvents(events: MusicalEvent[]): MusicalEvent[] {
    const rt = this.realtime;
    if (!rt) return events;
    const evolved = rt.motifEvolver.getCurrentMotif();

    const pcMap = new Map<number, number>();
    const n = Math.min(rt.originalCoreNotes.length, evolved.coreNotes.length);
    for (let i = 0; i < n; i++) {
      pcMap.set(((rt.originalCoreNotes[i]! % 12) + 12) % 12, ((evolved.coreNotes[i]! % 12) + 12) % 12);
    }

    return events.map((e) => {
      if (e.type !== 'note') return e;
      const data = e.data as NoteData;
      if (e.channel === 0) {
        const pc = ((data.pitch % 12) + 12) % 12;
        const newPc = pcMap.get(pc);
        if (newPc === undefined || newPc === pc) return e;
        let newPitch = data.pitch - pc + newPc;
        if (newPitch > 127) newPitch -= 12;
        if (newPitch < 0) newPitch += 12;
        return { ...e, data: { ...data, pitch: newPitch } };
      }
      // Non-lead voices follow chord-root substitutions by window.
      const bar = Math.floor(e.timestamp / 4);
      const chordIdx = rt.originalChords.findIndex(
        (c) => bar >= c.startBar && bar < c.startBar + c.durationBars,
      );
      if (chordIdx < 0) return e;
      const delta = rt.chordDeltas.get(chordIdx);
      if (!delta) return e;
      const newPitch = Math.max(0, Math.min(127, data.pitch + delta));
      return { ...e, data: { ...data, pitch: newPitch } };
    });
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
    this.transportPosition = position;
    this.tickAutomations();

    // Event source: morpher (during/after a morph) or the current scene.
    let events: MusicalEvent[];
    if (this.morpher) {
      events = this.morpher.getEventsAtPosition(position, this.emitWindowBeats);
    } else {
      const out = this.currentOutput;
      if (!out) return;
      const end = position + this.emitWindowBeats;
      events = out.events.filter((e) => e.timestamp >= position && e.timestamp < end);
    }
    if (events.length === 0) return;

    // Live modifiers: sidechain duck + parameter automations.
    const duckState = this.duck;
    const duckDepth = duckState ? Math.max(0, Math.min(1, duckState.depth)) : 0;
    const velocityScale = this.automationValue('velocity');
    const durationScale = this.automationValue('duration');
    const pitchValue = this.automationValue('pitch');
    const transpose = pitchValue !== null ? Math.round(pitchValue * 12) : 0;

    const scaledEvents: MusicalEvent[] = [];
    for (const e of events) {
      if (e.type !== 'note') continue;
      const data = e.data as NoteData;
      let vel = data.velocity;
      if (duckDepth > 0) vel = Math.round(vel * (1 - duckDepth));
      if (velocityScale !== null) vel = Math.round(vel * velocityScale);
      vel = Math.max(0, Math.min(127, vel));
      let dur = e.duration;
      if (durationScale !== null) dur = Math.max(0.0625, dur * durationScale);
      const pitch = transpose !== 0 ? Math.max(0, Math.min(127, data.pitch + transpose)) : data.pitch;
      scaledEvents.push({ ...e, duration: dur, data: { ...data, pitch, velocity: vel } });
    }

    // Real PSYBUS note envelopes (consumed directly by synth/drum adapters)...
    for (const e of scaledEvents) {
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
    const batch: CompositionEventsPayload = duckDepth > 0
      ? { kind: 'composition.events', events: scaledEvents, position, ducked: true }
      : { kind: 'composition.events', events: scaledEvents, position };
    this.emit(batch);
    if (duckState) this.duck = null; // duck consumed by this emission window
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
