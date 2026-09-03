// PSY ANTHEM - validation/config-schema.ts
// Strict schema validation for AnthemConfig with zod-compatible semantics
// (safeParse / parse; issues carry path + message). Implemented with zero
// runtime dependencies to protect the 30KB browser bundle gate; consumers of
// parseConfig can swap to real zod later without changing call sites.
//
// Error contract (backwards compatible with the previous validateConfig):
//   - pure range violations                 -> RangeError
//   - type / shape / enum / refine failures -> TypeError

import { AnthemIntent, EnergyCurve } from '../types';
import type { AnthemConfig } from '../types';

export interface SchemaIssue {
  path: string;
  message: string;
  kind: 'type' | 'shape' | 'enum' | 'range' | 'refine';
  errorClass: 'range' | 'type';
}

export interface SchemaError {
  issues: SchemaIssue[];
  message: string;
}

export type ConfigParseResult =
  | { success: true; data: AnthemConfig }
  | { success: false; error: SchemaError };

export const ANTHEM_CONFIG_LIMITS = {
  seedMin: -2147483648,
  seedMax: 2147483647,
  barsMin: 8,
  barsMax: 128,
  voicesMin: 1,
  voicesMax: 4,
  bpmMin: 30,
  bpmMax: 300,
  midiMin: 0,
  midiMax: 127,
  rootMin: 0,
  rootMax: 11,
} as const;

const INTENTS: ReadonlySet<string> = new Set(Object.values(AnthemIntent) as string[]);
const CURVES: ReadonlySet<string> = new Set(Object.values(EnergyCurve) as string[]);
const MODES: ReadonlySet<string> = new Set([
  'minor', 'major', 'dorian', 'phrygian', 'lydian', 'mixolydian',
  'harmonicMinor', 'melodicMinor', 'hungarianMinor', 'doubleHarmonicMajor',
]);
const DENSITIES: ReadonlySet<string> = new Set(['sparse', 'medium', 'dense']);
const COMPLEXITIES: ReadonlySet<string> = new Set(['simple', 'standard', 'complex']);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function enumValues(set: ReadonlySet<string>): string {
  return Array.from(set).join(', ');
}

function intField(
  obj: Record<string, unknown>, key: string, path: string,
  min: number, max: number, issues: SchemaIssue[],
): void {
  const v = obj[key];
  if (!isFiniteNumber(v)) {
    issues.push({ path, message: 'expected a number, got ' + typeof v, kind: 'type', errorClass: 'type' });
    return;
  }
  if (!Number.isInteger(v)) {
    issues.push({ path, message: 'expected an integer, got ' + String(v), kind: 'type', errorClass: 'type' });
    return;
  }
  if (v < min || v > max) {
    issues.push({ path, message: 'must be ' + min + '-' + max + ', got ' + v, kind: 'range', errorClass: 'range' });
  }
}

function collectIssues(input: unknown, issues: SchemaIssue[]): boolean {
  if (!isPlainObject(input)) {
    issues.push({ path: '', message: 'config must be an object', kind: 'shape', errorClass: 'type' });
    return false;
  }
  const cfg = input;
  const L = ANTHEM_CONFIG_LIMITS;

  intField(cfg, 'seed', 'seed', L.seedMin, L.seedMax, issues);

  if (typeof cfg.intent !== 'string' || !INTENTS.has(cfg.intent)) {
    issues.push({ path: 'intent', message: 'must be one of: ' + enumValues(INTENTS), kind: 'enum', errorClass: 'type' });
  }

  const scale = cfg.scale;
  if (!isPlainObject(scale)) {
    issues.push({ path: 'scale', message: 'must be an object with root and mode', kind: 'shape', errorClass: 'type' });
  } else {
    intField(scale, 'root', 'scale.root', L.rootMin, L.rootMax, issues);
    if (typeof scale.mode !== 'string' || !MODES.has(scale.mode)) {
      issues.push({ path: 'scale.mode', message: 'must be one of: ' + enumValues(MODES), kind: 'enum', errorClass: 'type' });
    }
  }

  const curve = cfg.energyCurve;
  if (typeof curve !== 'string' || !CURVES.has(curve)) {
    issues.push({ path: 'energyCurve', message: 'must be one of: ' + enumValues(CURVES), kind: 'enum', errorClass: 'type' });
  }

  const range = cfg.targetRange;
  if (!isPlainObject(range)) {
    issues.push({ path: 'targetRange', message: 'must be an object with min and max', kind: 'shape', errorClass: 'type' });
  } else {
    intField(range, 'min', 'targetRange.min', L.midiMin, L.midiMax, issues);
    intField(range, 'max', 'targetRange.max', L.midiMin, L.midiMax, issues);
    if (isInt(range.min) && isInt(range.max) && range.min >= range.max) {
      issues.push({ path: 'targetRange', message: 'targetRange.min must be < targetRange.max', kind: 'refine', errorClass: 'range' });
    }
  }

  intField(cfg, 'voices', 'voices', L.voicesMin, L.voicesMax, issues);
  intField(cfg, 'bars', 'bars', L.barsMin, L.barsMax, issues);

  if (cfg.bpm !== undefined) {
    if (!isFiniteNumber(cfg.bpm)) {
      issues.push({ path: 'bpm', message: 'expected a number, got ' + typeof cfg.bpm, kind: 'type', errorClass: 'type' });
    } else if (cfg.bpm < L.bpmMin || cfg.bpm > L.bpmMax) {
      issues.push({ path: 'bpm', message: 'must be ' + L.bpmMin + '-' + L.bpmMax + ', got ' + cfg.bpm, kind: 'range', errorClass: 'range' });
    }
  }

  if (curve === EnergyCurve.CUSTOM && (!Array.isArray(cfg.customCurve) || cfg.customCurve.length === 0)) {
    issues.push({ path: 'customCurve', message: 'customCurve is required when energyCurve is CUSTOM', kind: 'refine', errorClass: 'type' });
  }
  if (cfg.customCurve !== undefined) {
    if (!Array.isArray(cfg.customCurve) || cfg.customCurve.length === 0) {
      if (curve !== EnergyCurve.CUSTOM) {
        issues.push({ path: 'customCurve', message: 'must be a non-empty array of points', kind: 'shape', errorClass: 'type' });
      }
    } else {
      const points = cfg.customCurve as unknown[];
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!isPlainObject(pt)) {
          issues.push({ path: 'customCurve[' + i + ']', message: 'must be an object with position and energy', kind: 'shape', errorClass: 'type' });
          continue;
        }
        if (!isFiniteNumber(pt.position) || pt.position < 0 || pt.position > 1) {
          issues.push({ path: 'customCurve[' + i + '].position', message: 'must be a number 0-1', kind: 'range', errorClass: 'range' });
        }
        if (!isFiniteNumber(pt.energy) || pt.energy < 0 || pt.energy > 1) {
          issues.push({ path: 'customCurve[' + i + '].energy', message: 'must be a number 0-1', kind: 'range', errorClass: 'range' });
        }
      }
    }
  }

  if (cfg.chromaticTension !== undefined && (!isFiniteNumber(cfg.chromaticTension) || cfg.chromaticTension < 0 || cfg.chromaticTension > 1)) {
    issues.push({ path: 'chromaticTension', message: 'must be a number 0-1', kind: 'range', errorClass: 'range' });
  }
  if (cfg.density !== undefined && (typeof cfg.density !== 'string' || !DENSITIES.has(cfg.density))) {
    issues.push({ path: 'density', message: 'must be one of: ' + enumValues(DENSITIES), kind: 'enum', errorClass: 'type' });
  }
  if (cfg.harmonyComplexity !== undefined && (typeof cfg.harmonyComplexity !== 'string' || !COMPLEXITIES.has(cfg.harmonyComplexity))) {
    issues.push({ path: 'harmonyComplexity', message: 'must be one of: ' + enumValues(COMPLEXITIES), kind: 'enum', errorClass: 'type' });
  }
  if (cfg.loopMode !== undefined && typeof cfg.loopMode !== 'boolean') {
    issues.push({ path: 'loopMode', message: 'must be a boolean', kind: 'type', errorClass: 'type' });
  }
  if (cfg.callResponse !== undefined && typeof cfg.callResponse !== 'boolean') {
    issues.push({ path: 'callResponse', message: 'must be a boolean', kind: 'type', errorClass: 'type' });
  }
  return true;
}

export function safeParseConfig(input: unknown): ConfigParseResult {
  const issues: SchemaIssue[] = [];
  const ok = collectIssues(input, issues);
  if (!ok || issues.length > 0) {
    const message = 'Invalid AnthemConfig: ' +
      issues.map((i) => (i.path ? i.path + ': ' + i.message : i.message)).join('; ');
    return { success: false, error: { issues, message } };
  }
  return { success: true, data: { ...(input as AnthemConfig) } };
}

export function parseConfig(input: unknown): AnthemConfig {
  const result = safeParseConfig(input);
  if (result.success) return result.data;
  const pureRange = result.error.issues.every((i) => i.errorClass === 'range');
  if (pureRange) throw new RangeError(result.error.message);
  throw new TypeError(result.error.message);
}
