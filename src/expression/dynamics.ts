// PSY ANTHEM - expression/dynamics.ts
import { EXPRESSION_CONFIG } from '../constants';
import type { InternalNoteEvent } from '../types';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Pull velocities toward the energy-derived target (50% blend keeps voice character).
export function velocityFromEnergy(events: InternalNoteEvent[], energy: number): InternalNoteEvent[] {
  const vmin = EXPRESSION_CONFIG.VELOCITY_MIN;
  const vmax = EXPRESSION_CONFIG.VELOCITY_MAX;
  const target = Math.round(vmin + energy * (vmax - vmin));
  return events.map((e) => {
    const blended = e.velocity + Math.round((target - e.velocity) * 0.5);
    return { ...e, velocity: clamp(blended, vmin, vmax) };
  });
}
