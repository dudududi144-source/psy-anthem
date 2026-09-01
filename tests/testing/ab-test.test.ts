// PSY ANTHEM - tests/testing/ab-test.test.ts
import { describe, it, expect } from 'bun:test';
import { AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import {
  standardAlgorithm,
  strictLeapRecoveryAlgorithm,
  compareAlgorithms,
  analyzeParameterSensitivity,
} from '../../src/testing';
import { analyzeMelody } from '../../src/validation';

const config: AnthemConfig = {
  seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 16, bpm: 140,
};

describe('compareAlgorithms', () => {
  it('produces a full comparison report', () => {
    const report = compareAlgorithms(config, standardAlgorithm, strictLeapRecoveryAlgorithm, 'standard', 'strict');
    expect(report).not.toBeNull();
    expect(report!.nameA).toBe('standard');
    expect(report!.nameB).toBe('strict');
    expect(['A', 'B', 'tie']).toContain(report!.winner);
    expect(report!.deltas['overall']).toBeDefined();
    expect(report!.narrative.length).toBeGreaterThan(0);
    expect(report!.reportA.overall).toBeGreaterThanOrEqual(0);
    expect(report!.reportB.overall).toBeGreaterThanOrEqual(0);
  });

  it('strict leap recovery does not increase leap count', () => {
    const outA = standardAlgorithm(config)!;
    const outB = strictLeapRecoveryAlgorithm(config)!;
    const leapsA = analyzeMelody(outA.events).leaps.count;
    const leapsB = analyzeMelody(outB.events).leaps.count;
    expect(leapsB).toBeLessThanOrEqual(leapsA);
  });

  it('is deterministic', () => {
    const r1 = compareAlgorithms(config, standardAlgorithm, strictLeapRecoveryAlgorithm);
    const r2 = compareAlgorithms(config, standardAlgorithm, strictLeapRecoveryAlgorithm);
    expect(r1!.reportA.overall).toBe(r2!.reportA.overall);
    expect(r1!.reportB.overall).toBe(r2!.reportB.overall);
  });
});

describe('analyzeParameterSensitivity', () => {
  it('sweeps voices 2..4 and reports sensitivity', () => {
    const report = analyzeParameterSensitivity(config, 'voices', [2, 3, 4]);
    expect(report.param).toBe('voices');
    expect(report.rows.length).toBe(3);
    for (const row of report.rows) {
      expect(row.overall).toBeGreaterThanOrEqual(0);
      expect(row.overall).toBeLessThanOrEqual(100);
    }
    expect(['overall', 'singability', 'variety', 'emotionalArc']).toContain(report.mostSensitiveMetric);
  });

  it('sweeps bars', () => {
    const report = analyzeParameterSensitivity(config, 'bars', [8, 16]);
    expect(report.rows.length).toBe(2);
  });
});
