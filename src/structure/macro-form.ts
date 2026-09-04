// PSY ANTHEM - structure/macro-form.ts
import { EnergyCurve } from '../types';
import type { SectionRole } from '../types';

export interface FormSegment {
  role: SectionRole;
  fraction: number;
}

export function getMacroForm(curve: EnergyCurve): FormSegment[] {
  switch (curve) {
    case EnergyCurve.BUILD_DROP:
      return [
        { role: 'INTRO', fraction: 0.125 },
        { role: 'BUILD', fraction: 0.25 },
        { role: 'DROP', fraction: 0.375 },
        { role: 'OUTRO', fraction: 0.25 },
      ];
    case EnergyCurve.ARC:
      return [
        { role: 'INTRO', fraction: 0.15 },
        { role: 'BUILD', fraction: 0.25 },
        { role: 'DROP', fraction: 0.3 },
        { role: 'BREAKDOWN', fraction: 0.15 },
        { role: 'OUTRO', fraction: 0.15 },
      ];
    case EnergyCurve.WAVE:
      return [
        { role: 'VERSE', fraction: 0.25 },
        { role: 'BUILD', fraction: 0.25 },
        { role: 'DROP', fraction: 0.25 },
        { role: 'BREAKDOWN', fraction: 0.25 },
      ];
    case EnergyCurve.FLAT:
      return [{ role: 'DROP', fraction: 1 }];
    case EnergyCurve.EMOTIONAL_SWELL:
      return [
        { role: 'INTRO', fraction: 0.15 },
        { role: 'BUILD', fraction: 0.30 },
        { role: 'DROP', fraction: 0.25 },
        { role: 'BREAKDOWN', fraction: 0.15 },
        { role: 'OUTRO', fraction: 0.15 },
      ];
    case EnergyCurve.DOUBLE_DROP:
      return [
        { role: 'INTRO', fraction: 0.10 },
        { role: 'BUILD', fraction: 0.25 },
        { role: 'DROP', fraction: 0.18 },
        { role: 'VERSE', fraction: 0.12 },
        { role: 'BUILD', fraction: 0.20 },
        { role: 'DROP', fraction: 0.25 },
      ];
    case EnergyCurve.PROGRESSIVE_CLIMB:
      return [
        { role: 'INTRO', fraction: 0.125 },
        { role: 'VERSE', fraction: 0.25 },
        { role: 'BUILD', fraction: 0.375 },
        { role: 'DROP', fraction: 0.25 },
      ];
    case EnergyCurve.SUNRISE:
      return [
        { role: 'INTRO', fraction: 0.25 },
        { role: 'BUILD', fraction: 0.50 },
        { role: 'DROP', fraction: 0.25 },
      ];
    case EnergyCurve.PLATEAU_BREAK:
      return [
        { role: 'VERSE', fraction: 0.30 },
        { role: 'DROP', fraction: 0.15 },
        { role: 'BREAKDOWN', fraction: 0.20 },
        { role: 'BUILD', fraction: 0.15 },
        { role: 'DROP', fraction: 0.20 },
      ];
    case EnergyCurve.CUSTOM:
      return [
        { role: 'BUILD', fraction: 0.5 },
        { role: 'DROP', fraction: 0.5 },
      ];
  }
}
