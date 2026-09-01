// PSY ANTHEM - tests/integration/psybus-automation.test.ts
import { describe, it, expect } from 'bun:test';
import { PsyAnthemAdapter } from '../../src/integration';
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

function loadAndPlay(adapter: PsyAnthemAdapter): void {
  adapter.handleMessage({
    type: 'scene.load',
    deviceId: 'test-anthem',
    payload: { sceneId: 'scene-001', config: sceneConfig },
  });
  adapter.handleMessage({ type: 'transport.play', deviceId: 'test-anthem', payload: { position: 0 } });
}

function batchAt(messages: PsyBusEnvelope[], position: number) {
  return messages.find(
    (m) => m.payload.kind === 'composition.events' && (m.payload as { position: number }).position === position,
  );
}

describe('PSYBUS Automation', () => {
  it('starts automation', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({
      type: 'automation.start',
      deviceId: 'test-anthem',
      payload: { param: 'velocity', startValue: 1.0, endValue: 0.5, duration: 8, curve: 'linear' },
    });

    const started = messages.find((m) => m.payload.kind === 'automation.started');
    expect(started).toBeDefined();
    expect((started!.payload as { param: string }).param).toBe('velocity');
    expect(adapter.isAutomationActive('velocity')).toBe(true);
  });

  it('applies velocity automation over time', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);

    // Baseline emission at beat 4 with no automation.
    adapter.handleMessage({ type: 'transport.position', deviceId: 'test-anthem', payload: { position: 4 } });
    const baseline = batchAt(messages, 4);
    expect(baseline).toBeDefined();
    const baselineMax = Math.max(
      ...(baseline!.payload as { events: Array<{ type: string; data: { velocity: number } }> }).events
        .filter((e) => e.type === 'note')
        .map((e) => e.data.velocity),
    );

    // Velocity automation 1.0 -> 0.5 over 8 beats, started at position 4.
    adapter.handleMessage({
      type: 'automation.start',
      deviceId: 'test-anthem',
      payload: { param: 'velocity', startValue: 1.0, endValue: 0.5, duration: 8, curve: 'linear' },
    });
    // Midpoint of the automation.
    adapter.handleMessage({ type: 'transport.position', deviceId: 'test-anthem', payload: { position: 8 } });
    const mid = messages.filter(
      (m) => m.payload.kind === 'composition.events' && (m.payload as { position: number }).position === 8,
    ).pop();
    expect(mid).toBeDefined();
    const midEvents = (mid!.payload as { events: Array<{ type: string; data: { velocity: number } }> }).events
      .filter((e) => e.type === 'note');
    expect(midEvents.length).toBeGreaterThan(0);
    const duckedMax = Math.max(...midEvents.map((e) => e.data.velocity));
    // ~0.75 scale at the midpoint -> clearly below the baseline peak.
    expect(duckedMax).toBeLessThan(baselineMax);
    expect(duckedMax).toBeLessThanOrEqual(Math.round(baselineMax * 0.75) + 1);
  });

  it('applies pitch automation (transpose)', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);

    adapter.handleMessage({
      type: 'automation.start',
      deviceId: 'test-anthem',
      payload: { param: 'pitch', startValue: 0, endValue: 1, duration: 8, curve: 'linear' },
    });
    // 4 beats into an 8-beat automation -> +0.5 octave -> +6 semitones.
    adapter.handleMessage({ type: 'transport.position', deviceId: 'test-anthem', payload: { position: 4 } });
    const batch = messages.filter(
      (m) => m.payload.kind === 'composition.events' && (m.payload as { position: number }).position === 4,
    ).pop();
    expect(batch).toBeDefined();
    const notes = (batch!.payload as { events: Array<{ type: string; data: { pitch: number } }> }).events
      .filter((e) => e.type === 'note');
    expect(notes.length).toBeGreaterThan(0);
    // All pitches shifted by +6 semitones (clamped to 127).
    for (const n of notes) {
      expect(n.data.pitch).toBeGreaterThanOrEqual(6);
    }
  });

  it('stops automation manually', () => {
    const { adapter, messages } = makeAdapter();
    adapter.handleMessage({
      type: 'automation.start',
      deviceId: 'test-anthem',
      payload: { param: 'velocity', startValue: 1.0, endValue: 0.5, duration: 8, curve: 'linear' },
    });
    adapter.handleMessage({ type: 'automation.stop', deviceId: 'test-anthem', payload: { param: 'velocity' } });

    const stopped = messages.find((m) => m.payload.kind === 'automation.stopped');
    expect(stopped).toBeDefined();
    expect((stopped!.payload as { param: string }).param).toBe('velocity');
    expect(adapter.isAutomationActive('velocity')).toBe(false);
  });

  it('completes automation automatically after its duration', () => {
    const { adapter, messages } = makeAdapter();
    loadAndPlay(adapter);
    adapter.handleMessage({
      type: 'automation.start',
      deviceId: 'test-anthem',
      payload: { param: 'velocity', startValue: 1.0, endValue: 0.5, duration: 8, curve: 'linear' },
    });

    // Move past the automation duration.
    adapter.handleMessage({ type: 'transport.position', deviceId: 'test-anthem', payload: { position: 9 } });

    const stopped = messages.find((m) => m.payload.kind === 'automation.stopped');
    expect(stopped).toBeDefined();
    expect(adapter.isAutomationActive('velocity')).toBe(false);
  });
});
