// PSY ANTHEM - tests/integration/psybus-realtime.test.ts
import { describe, it, expect } from 'bun:test';
import { PsyAnthemAdapter } from '../../src/integration/psybus-adapter';
import type { PsyBusEnvelope, RealtimeGenerationConfig } from '../../src/integration/psybus-types';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';

const sceneConfig: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

const realtimeConfig: RealtimeGenerationConfig = {
  enabled: true,
  motifEvolution: {
    mutationRate: 1.0,
    evolutionDepth: 'medium',
    constraints: { preserveRhythm: true, preserveContour: false, maxIntervalChange: 5 },
  },
  harmonicEvolution: { substitutionRate: 0.5, allowedSubstitutions: ['tritone', 'relative', 'parallel'] },
  regenerationIntervalBars: 1,
};

function makeAdapter() {
  const messages: PsyBusEnvelope[] = [];
  const adapter = new PsyAnthemAdapter({
    deviceId: 'test-anthem',
    seed: 42,
    send: (msg) => messages.push(msg),
  });
  return { adapter, messages };
}

function loadAndPlay(adapter: PsyAnthemAdapter): void {
  adapter.handleMessage({
    type: 'scene.load',
    deviceId: 'test-anthem',
    payload: { sceneId: 'scene-001', config: sceneConfig },
  });
  adapter.handleMessage({ type: 'transport.play', deviceId: 'test-anthem', payload: { position: 0 } });
}

describe('Real-time generative evolution', () => {
  it('refuses to enable without a loaded scene', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
    const err = messages.find((m) => m.payload.kind === 'error');
    expect(err).toBeDefined();
    expect(adapter.isRealtimeEnabled()).toBe(false);
  });

  it('enables after scene load and emits realtime.enabled', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
    expect(adapter.isRealtimeEnabled()).toBe(true);
    expect(messages.some((m) => m.payload.kind === 'realtime.enabled')).toBe(true);
  });

  it('emits realtime.evolved during transport ticks', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });

    // Tick through 4 bars (interval = 1 bar -> evolution every bar).
    for (let bar = 0; bar < 4; bar++) {
      adapter.handleMessage({
        type: 'transport.position',
        deviceId: 'test-anthem',
        payload: { position: bar * 4 },
      });
    }
    const evolved = messages.filter((m) => m.payload.kind === 'realtime.evolved');
    expect(evolved.length).toBeGreaterThanOrEqual(1);
    const payload = evolved[0]!.payload as { bar: number; motifMutations: number };
    expect(payload.motifMutations).toBeGreaterThan(0);
  });

  it('evolved motif audibly changes lead pitches', () => {
    const run = (realtime: boolean) => {
      const { adapter, messages } = makeAdapter();
      loadAndPlay(adapter);
      if (realtime) {
        adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
      }
      // Collect every emission window across the first bar (full motif pass).
      for (let step = 0; step < 16; step++) {
        adapter.handleMessage({
          type: 'transport.position',
          deviceId: 'test-anthem',
          payload: { position: step * 0.25 },
        });
      }
      const batches = messages.filter((m) => m.payload.kind === 'composition.events');
      const pitches: number[] = [];
      for (const batch of batches) {
        const events = (batch.payload as { events: Array<{ type: string; channel: number; data: { pitch: number } }> }).events;
        for (const e of events) {
          if (e.type === 'note' && e.channel === 0) pitches.push(e.data.pitch);
        }
      }
      return pitches.join(',');
    };
    const plain = run(false);
    const evolved = run(true);
    expect(plain.length).toBeGreaterThan(0);
    expect(evolved).not.toBe(plain);
  });

  it('force evolve ignores the interval gate', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
    adapter.handleMessage({ type: 'realtime.evolve', deviceId: 'test-anthem', payload: { force: true } });
    expect(messages.some((m) => m.payload.kind === 'realtime.evolved')).toBe(true);
  });

  it('disable stops evolution', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
    adapter.handleMessage({ type: 'realtime.disable', deviceId: 'test-anthem', payload: {} });
    expect(adapter.isRealtimeEnabled()).toBe(false);
    expect(messages.some((m) => m.payload.kind === 'realtime.disabled')).toBe(true);

    adapter.handleMessage({ type: 'realtime.evolve', deviceId: 'test-anthem', payload: { force: true } });
    expect(messages.some((m) => m.payload.kind === 'realtime.evolved')).toBe(false);
  });

  it('loadScene clears evolution state', () => {
    const { adapter } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({ type: 'realtime.enable', deviceId: 'test-anthem', payload: { config: realtimeConfig } });
    expect(adapter.isRealtimeEnabled()).toBe(true);
    adapter.handleMessage({
      type: 'scene.load',
      deviceId: 'test-anthem',
      payload: { sceneId: 'scene-002', config: sceneConfig },
    });
    expect(adapter.isRealtimeEnabled()).toBe(false);
  });
});
