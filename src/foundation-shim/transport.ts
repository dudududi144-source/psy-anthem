// PSY ANTHEM — foundation-shim/transport.ts
// VERBATIM shim of psy-foundation transport helpers (pinned).

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface TransportPosition {
  bar: number;
  beat: number;
  step: number;       // 16th within beat (0-3)
  totalSteps: number; // absolute 16th steps
}

export function stepsPerBar(ts: TimeSignature): number {
  return Math.round((ts.numerator * 16) / ts.denominator);
}

export function beatsToSteps(beats: number): number {
  return Math.round(beats * 4);
}

export function stepsToBeats(steps: number): number {
  return steps / 4;
}

export function barBeatStepToAbsolute(
  bar: number, beat: number, step: number, ts: TimeSignature,
): number {
  return bar * stepsPerBar(ts) + beat * 4 + step;
}
