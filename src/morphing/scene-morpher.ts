// PSY ANTHEM - src/morphing/scene-morpher.ts
// Scene morphing (phase 12): crossfade between two generated compositions.
// Deterministic: both scenes are generated up front from their own seeds; the
// morph itself is pure interpolation over a progress value driven by the host
// clock (no internal timers).

import { createAnthemEngine } from '../engine';
import type { AnthemConfig, AnthemOutput, MusicalEvent, NoteData } from '../types';
import type { MorphCurve } from '../integration/psybus-types';

export interface MorphConfig {
  fromScene: AnthemConfig;
  toScene: AnthemConfig;
  /** Morph length in bars (host maps bars -> beats -> progress). */
  durationBars: number;
  curve: MorphCurve;
}

export interface MorphState {
  progress: number; // curved progress 0-1
  currentConfig: AnthemConfig | null;
  isTransitioning: boolean;
  completed: boolean;
}

export class SceneMorpher {
  private fromOutput: AnthemOutput | null = null;
  private toOutput: AnthemOutput | null = null;
  private morphConfig: MorphConfig | null = null;
  private state: MorphState = {
    progress: 0,
    currentConfig: null,
    isTransitioning: false,
    completed: false,
  };

  /** Generate both scenes and arm the morph. Throws if either fails. */
  loadScenes(config: MorphConfig): void {
    this.morphConfig = config;
    const fromOutput = createAnthemEngine(config.fromScene).generate();
    const toOutput = createAnthemEngine(config.toScene).generate();
    if (!fromOutput || !toOutput) {
      throw new Error('Failed to generate scenes for morphing');
    }
    this.fromOutput = fromOutput;
    this.toOutput = toOutput;
    this.state = {
      progress: 0,
      currentConfig: { ...config.fromScene },
      isTransitioning: true,
      completed: false,
    };
  }

  /** Advance the morph. progress is linear 0-1; the curve is applied here. */
  updateProgress(progress: number): void {
    if (!this.morphConfig) return;
    const p = Math.max(0, Math.min(1, progress));
    const curved = this.applyCurve(p, this.morphConfig.curve);
    this.state.progress = curved;
    this.state.currentConfig = this.interpolateConfig(
      this.morphConfig.fromScene,
      this.morphConfig.toScene,
      curved,
    );
    if (p >= 1) {
      this.state.isTransitioning = false;
      this.state.completed = true;
    } else {
      this.state.isTransitioning = true;
    }
  }

  /**
   * Blended events in [position, position + windowBeats).
   * Before/after the morph window the appropriate scene plays in full.
   */
  getEventsAtPosition(position: number, windowBeats = 1): MusicalEvent[] {
    const from = this.fromOutput;
    const to = this.toOutput;
    if (!from || !to) return [];
    if (!this.state.isTransitioning) {
      // Morph finished (or never started progressing): play the target scene.
      const active = this.state.completed ? to : from;
      return this.window(active.events, position, windowBeats);
    }
    const fromEvents = this.window(from.events, position, windowBeats);
    const toEvents = this.window(to.events, position, windowBeats);
    return this.blendEvents(fromEvents, toEvents, this.state.progress);
  }

  getState(): MorphState {
    return { ...this.state, currentConfig: this.state.currentConfig ? { ...this.state.currentConfig } : null };
  }

  // ---- internals ----

  private window(events: MusicalEvent[], position: number, windowBeats: number): MusicalEvent[] {
    return events.filter((e) => e.timestamp >= position && e.timestamp < position + windowBeats);
  }

  applyCurve(progress: number, curve: MorphCurve): number {
    switch (curve) {
      case 'linear':
        return progress;
      case 'exponential':
        return progress * progress;
      case 'bezier':
        // Smoothstep: gentle acceleration in, deceleration out.
        return progress * progress * (3 - 2 * progress);
    }
  }

  interpolateConfig(from: AnthemConfig, to: AnthemConfig, progress: number): AnthemConfig {
    const switchPoint = progress < 0.5;
    const bpm =
      from.bpm !== undefined && to.bpm !== undefined
        ? Math.round(from.bpm + (to.bpm - from.bpm) * progress)
        : (from.bpm ?? to.bpm);
    const cfg: AnthemConfig = {
      seed: switchPoint ? from.seed : to.seed,
      intent: switchPoint ? from.intent : to.intent,
      scale: {
        root: Math.round(from.scale.root + (to.scale.root - from.scale.root) * progress),
        mode: switchPoint ? from.scale.mode : to.scale.mode,
      },
      energyCurve: switchPoint ? from.energyCurve : to.energyCurve,
      targetRange: {
        min: Math.round(from.targetRange.min + (to.targetRange.min - from.targetRange.min) * progress),
        max: Math.round(from.targetRange.max + (to.targetRange.max - from.targetRange.max) * progress),
      },
      voices: Math.round(from.voices + (to.voices - from.voices) * progress),
      bars: Math.round(from.bars + (to.bars - from.bars) * progress),
    };
    if (bpm !== undefined) cfg.bpm = bpm;
    return cfg;
  }

  blendEvents(fromEvents: MusicalEvent[], toEvents: MusicalEvent[], progress: number): MusicalEvent[] {
    const blended: MusicalEvent[] = [];
    // Fade the source scene out.
    for (const event of fromEvents) {
      if (event.type !== 'note') continue;
      const data = event.data as NoteData;
      const velocity = Math.round(data.velocity * (1 - progress));
      if (velocity <= 0) continue;
      const faded: NoteData = { ...data, velocity };
      blended.push({ ...event, data: faded });
    }
    // Fade the target scene in.
    for (const event of toEvents) {
      if (event.type !== 'note') continue;
      const data = event.data as NoteData;
      const velocity = Math.round(data.velocity * progress);
      if (velocity <= 0) continue;
      const faded: NoteData = { ...data, velocity };
      blended.push({ ...event, data: faded });
    }
    return blended;
  }
}
