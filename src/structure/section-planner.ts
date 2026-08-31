// PSY ANTHEM - structure/section-planner.ts
import { EnergyCurve } from '../types';
import type { AnthemConfig, NoteRange, SectionPlan, SectionRole, Transformation } from '../types';
import { getMacroForm } from './macro-form';

function energyRangeFor(role: SectionRole): NoteRange {
  switch (role) {
    case 'INTRO': return { min: 20, max: 45 };
    case 'BUILD': return { min: 45, max: 85 };
    case 'DROP': return { min: 80, max: 100 };
    case 'BREAKDOWN': return { min: 25, max: 55 };
    case 'OUTRO': return { min: 15, max: 40 };
    case 'VERSE': return { min: 35, max: 60 };
    case 'BRIDGE': return { min: 40, max: 70 };
  }
}

function harmonicRhythmFor(role: SectionRole): number {
  return role === 'BUILD' ? 2 : 1;
}

function densityFor(role: SectionRole): number {
  switch (role) {
    case 'DROP': return 0.85;
    case 'BUILD': return 0.65;
    case 'BREAKDOWN': return 0.35;
    case 'INTRO': return 0.3;
    case 'OUTRO': return 0.3;
    default: return 0.5;
  }
}

function transformsFor(role: SectionRole, curve: EnergyCurve): Transformation[] {
  switch (role) {
    case 'BUILD':
      return [
        { type: 'DIMINISH', params: { factor: 2 } },
        { type: 'SEQUENCE', params: { degree: 2 } },
      ];
    case 'DROP':
      return [{ type: 'TRANSPOSE', params: { degree: 0 } }];
    case 'BREAKDOWN':
      return [{ type: 'AUGMENT', params: { factor: 2 } }];
    case 'INTRO':
      return [{ type: 'TRUNCATE', params: { notes: 3 } }];
    case 'OUTRO':
      return [{ type: 'RETROGRADE', params: {} }];
    default: {
      if (curve === EnergyCurve.WAVE) {
        return [{ type: 'RHYTHMIC_SHIFT', params: { steps: 1 } }];
      }
      return [{ type: 'TRANSPOSE', params: { degree: 0 } }];
    }
  }
}

export function planSections(config: AnthemConfig): SectionPlan[] {
  const form = getMacroForm(config.energyCurve);
  const plans: SectionPlan[] = [];
  let startBar = 0;

  for (let i = 0; i < form.length; i++) {
    const seg = form[i]!;
    const isLast = i === form.length - 1;
    let bars: number;
    if (isLast) {
      bars = Math.max(1, config.bars - startBar);
    } else {
      bars = Math.max(1, Math.round(config.bars * seg.fraction));
    }
    if (startBar >= config.bars) break;
    bars = Math.min(bars, config.bars - startBar);
    plans.push({
      role: seg.role,
      startBar,
      bars,
      energyRange: energyRangeFor(seg.role),
      harmonicRhythm: harmonicRhythmFor(seg.role),
      densityTarget: densityFor(seg.role),
      motifTransforms: transformsFor(seg.role, config.energyCurve),
    });
    startBar += bars;
  }

  if (plans.length === 0) {
    plans.push({
      role: 'DROP',
      startBar: 0,
      bars: config.bars,
      energyRange: { min: 40, max: 80 },
      harmonicRhythm: 1,
      densityTarget: 0.6,
      motifTransforms: [],
    });
  }
  return plans;
}
