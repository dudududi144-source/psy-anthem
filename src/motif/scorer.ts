// PSY ANTHEM - motif/scorer.ts
import type { MotifDNA } from '../types';

// Score motif quality 0-100: singability + contour clarity + interval variety + length.
export function scoreMotif(motif: MotifDNA): number {
  const notes = motif.coreNotes;
  if (notes.length < 2) return 0;

  let stepwise = 0;
  for (let i = 1; i < notes.length; i++) {
    if (Math.abs(notes[i]! - notes[i - 1]!) <= 2) stepwise++;
  }
  const stepRatio = stepwise / (notes.length - 1);

  const maxNote = Math.max(...notes);
  const peakIdx = notes.indexOf(maxNote);
  const risingPart = notes.slice(0, peakIdx + 1);
  const fallingPart = notes.slice(peakIdx);
  let rising = true;
  for (let i = 1; i < risingPart.length; i++) {
    if (risingPart[i]! < risingPart[i - 1]!) rising = false;
  }
  let falling = true;
  for (let i = 1; i < fallingPart.length; i++) {
    if (fallingPart[i]! > fallingPart[i - 1]!) falling = false;
  }
  const contourClarity = (rising && falling) ? 1 : 0.4;

  const intervals = new Set<number>();
  for (let i = 1; i < notes.length; i++) {
    intervals.add(Math.abs(notes[i]! - notes[i - 1]!));
  }
  const variety = Math.min(1, intervals.size / Math.max(1, notes.length - 1));

  let lengthScore = 0.5;
  if (notes.length === 4) lengthScore = 1;
  else if (notes.length === 3 || notes.length === 5) lengthScore = 0.8;

  return Math.round((stepRatio * 30) + (contourClarity * 25) + (variety * 25) + (lengthScore * 20));
}
