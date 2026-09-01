// PSY ANTHEM - tests/integration/psybus-adapter.test.ts
import { describe, it, expect } from 'bun:test';
import { PsyAnthemAdapter, InMemoryPSYBUS } from '../../src/integration';
import type { PsyBusEnvelope } from '../../src/integration';
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

function makeAdapter() {
  const messages: PsyBusEnvelope[] = [];
  const adapter = new PsyAnthemAdapter({
    deviceId: 'test-anthem',
    seed: 42,
    send: (msg) => messages.push(msg),
  });
  return { adapter, messages };
}

function loadDefaultScene(adapter: PsyAnthemAdapter): void {
  adapter.handleMessage({
    type: 'scene.load',
    deviceId: 'test-anthem',
    payload: { sceneId: 'scene-001', config: sceneConfig },
  });
}

describe('PsyAnthemAdapter', () => {
  it('responds to scene.load', () => {
    const { adapter, messages } = makeAdapter();
    loadDefaultScene(adapter);

    const loaded = messages.find((m) => m.payload.kind === 'scene.loaded');
    expect(loaded).toBeDefined();
    const payload = loaded!.payload as { sceneId: string; metadata: { quality: string } };
    expect(payload.sceneId).toBe('scene-001');
    expect(payload.metadata.quality).toBeDefined();
  });

  it('responds to transport.play', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({ type: 'transport.play', deviceId: 'test-anthem', payload: { position: 0 } });

    const status = messages.find((m) => m.payload.kind === 'device.status');
    expect(status).toBeDefined();
    expect((status!.payload as { state: string }).state).toBe('playing');
  });

  it('responds to transport.stop', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({ type: 'transport.stop', deviceId: 'test-anthem', payload: {} });

    const status = messages.find((m) => m.payload.kind === 'device.status');
    expect(status).toBeDefined();
    expect((status!.payload as { state: string }).state).toBe('stopped');
  });

  it('emits events at position (note envelopes + composition.events)', () => {
    const { adapter, messages } = makeAdapter();
    loadDefaultScene(adapter);
    adapter.handleMessage({ type: 'transport.play', deviceId: 'test-anthem', payload: { position: 0 } });
    adapter.handleMessage({ type: 'transport.position', deviceId: 'test-anthem', payload: { position: 0 } });

    const batch = messages.find((m) => m.payload.kind === 'composition.events');
    expect(batch).toBeDefined();
    const events = (batch!.payload as { events: unknown[] }).events;
    expect(events.length).toBeGreaterThan(0);

    const notes = messages.filter((m) => m.payload.kind === 'note');
    expect(notes.length).toBeGreaterThan(0);
  });

  it('handles sidechain.duck (velocities reduced)', () => {
    const { adapter, messages } = makeAdapter();
    loadDefaultScene(adapter);
    adapter.handleMessage({
      type: 'sidechain.duck',
      deviceId: 'test-anthem',
      payload: { amount: 0.5, duration: 1 },
    });

    const batch = messages.find(
      (m) => m.payload.kind === 'composition.events' && (m.payload as { ducked?: boolean }).ducked === true,
    );
    expect(batch).toBeDefined();
    const events = (batch!.payload as { events: Array<{ type: string; data: { velocity: number } }> }).events;
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      if (event.type === 'note') {
        expect(event.data.velocity).toBeLessThanOrEqual(64);
      }
    }
  });

  it('handles choke', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({ type: 'choke', deviceId: 'test-anthem', payload: {} });

    const choke = messages.find((m) => m.payload.kind === 'composition.choke');
    expect(choke).toBeDefined();
  });

  it('reports telemetry', () => {
    const { adapter, messages } = makeAdapter();
    loadDefaultScene(adapter);
    adapter.reportTelemetry();

    const telemetry = messages.find((m) => m.payload.kind === 'device.telemetry');
    expect(telemetry).toBeDefined();
    const payload = telemetry!.payload as { quality: number | undefined; memorability: number; events: number };
    expect(payload.memorability).toBeDefined();
    expect(payload.events).toBeGreaterThan(0);
  });
});

describe('PsyAnthemAdapter - real bus envelopes', () => {
  it('transport envelopes drive event emission', () => {
    const { adapter, messages } = makeAdapter();
    loadDefaultScene(adapter);

    adapter.handleEnvelope({
      rev: 1, seed: 42, src: 'boss', dst: 'broadcast', ts: 0,
      payload: { kind: 'transport.start' },
    });
    adapter.handleEnvelope({
      rev: 2, seed: 42, src: 'boss', dst: 'broadcast', ts: 0,
      payload: { kind: 'transport', bpm: 140, beat: 0, bar: 0, phase: 0, playing: true, audioTime: 0 },
    });

    const notes = messages.filter((m) => m.payload.kind === 'note');
    expect(notes.length).toBeGreaterThan(0);
  });

  it('param.set is acknowledged', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleEnvelope({
      rev: 1, seed: 42, src: 'boss', dst: 'broadcast', ts: 0,
      payload: { kind: 'param.set', track: 'anthem', param: 'density', value: 0.8 },
    });
    const ack = messages.find((m) => m.payload.kind === 'param.ack');
    expect(ack).toBeDefined();
    expect((ack!.payload as { param: string; value: number }).param).toBe('density');
  });

  it('works over the InMemoryPSYBUS', () => {
    const bus = new InMemoryPSYBUS(42);
    const received: PsyBusEnvelope[] = [];
    const adapter = new PsyAnthemAdapter({
      deviceId: 'anthem-001',
      seed: 42,
      send: (msg) => bus.publish(msg),
    });
    bus.register('anthem-001');
    bus.subscribe('listener', (e) => e.payload.kind === 'note', (e) => received.push(e));

    adapter.loadScene('scene-001', sceneConfig);
    adapter.play(0);

    expect(received.length).toBeGreaterThan(0);
    expect(bus.delivered.some((e) => e.payload.kind === 'scene.loaded')).toBe(true);
  });

  it('emission is deterministic for the same scene', () => {
    const a = makeAdapter();
    const b = makeAdapter();
    loadDefaultScene(a.adapter);
    loadDefaultScene(b.adapter);
    a.adapter.play(0);
    b.adapter.play(0);

    const notesOf = (msgs: PsyBusEnvelope[]) =>
      msgs.filter((m) => m.payload.kind === 'note')
        .map((m) => {
          const p = m.payload as { note: number; vel: number; durBeats: number };
          return p.note + ':' + p.vel + ':' + p.durBeats;
        })
        .join('|');
    expect(notesOf(a.messages)).toBe(notesOf(b.messages));
  });
});
