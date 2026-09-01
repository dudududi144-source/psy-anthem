// PSY ANTHEM - tests/morphing/scene-morpher.test.ts
import { describe, it, expect } from 'bun:test';
import { SceneMorpher } from '../../src/morphing/scene-morpher';
import type { MorphConfig } from '../../src/morphing/scene-morpher';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';

const fromScene: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

const toScene: AnthemConfig = {
  seed: 137,
  intent: AnthemIntent.DARK_PSY,
  scale: { root: 3, mode: 'phrygian' },
  energyCurve: EnergyCurve.BUILD_DROP,
  targetRange: { min: 36, max: 96 },
  voices: 4,
  bars: 16,
  bpm: 145,
};

function morphConfig(curve: MorphConfig['curve']): MorphConfig {
  return { fromScene, toScene, durationBars: 8, curve };
}

describe('SceneMorpher', () => {
  it('loads two scenes successfully', () => {
    const morpher = new SceneMorpher();
    expect(() => morpher.loadScenes(morphConfig('linear'))).not.toThrow();
    const state = morpher.getState();
    expect(state.isTransitioning).toBe(true);
    expect(state.completed).toBe(false);
    expect(state.progress).toBe(0);
    expect(state.currentConfig).not.toBeNull();
  });

  it('updates progress correctly (linear)', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('linear'));

    morpher.updateProgress(0.5);
    expect(morpher.getState().progress).toBeCloseTo(0.5, 2);

    morpher.updateProgress(1.0);
    expect(morpher.getState().progress).toBe(1.0);
    expect(morpher.getState().isTransitioning).toBe(false);
    expect(morpher.getState().completed).toBe(true);
  });

  it('applies the exponential curve (0.5 -> 0.25)', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('exponential'));
    morpher.updateProgress(0.5);
    expect(morpher.getState().progress).toBeCloseTo(0.25, 2);
  });

  it('applies the bezier (smoothstep) curve', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('bezier'));
    morpher.updateProgress(0.5);
    expect(morpher.getState().progress).toBeCloseTo(0.5, 2); // smoothstep(0.5) = 0.5
    morpher.updateProgress(0.25);
    expect(morpher.getState().progress).toBeCloseTo(0.15625, 3); // 0.25^2 * (3 - 0.5)
  });

  it('blends events during morph', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('linear'));
    morpher.updateProgress(0.5);

    const events = morpher.getEventsAtPosition(0);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      if (event.type !== 'note') continue;
      const data = event.data as { velocity: number };
      expect(data.velocity).toBeGreaterThan(0);
      expect(data.velocity).toBeLessThanOrEqual(127);
    }
  });

  it('after completion plays only the target scene', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('linear'));
    morpher.updateProgress(1.0);
    const events = morpher.getEventsAtPosition(0);
    expect(events.length).toBeGreaterThan(0);
    expect(morpher.getState().completed).toBe(true);
  });

  it('interpolates config during morph', () => {
    const morpher = new SceneMorpher();
    morpher.loadScenes(morphConfig('linear'));
    morpher.updateProgress(0.5);

    const config = morpher.getState().currentConfig;
    expect(config).not.toBeNull();
    expect(config!.bpm).toBe(143); // (140 + 145) / 2 = 142.5 -> 143
    expect(config!.voices).toBe(4); // (3 + 4) / 2 = 3.5 -> 4
    expect(config!.intent).toBe(AnthemIntent.DARK_PSY); // discrete switch at 0.5
  });
});
