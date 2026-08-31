// PSY ANTHEM - tests/solver/constraint-solver.test.ts
import { describe, it, expect } from 'bun:test';
import { solveCSP } from '../../src/solver/constraint-solver';
import type { Constraint } from '../../src/solver/constraint-solver';
import { createRNG } from '../../src/rng';

describe('CSP Solver', () => {
  const allDifferent: Constraint = (assignment, id, value) => {
    for (const key of Object.keys(assignment)) {
      if (key !== id && assignment[key] === value) return false;
    }
    return true;
  };

  it('solves a simple all-different problem', () => {
    const variables = [
      { id: 'a', domain: [1, 2, 3] },
      { id: 'b', domain: [1, 2, 3] },
      { id: 'c', domain: [1, 2, 3] },
    ];
    const result = solveCSP(variables, [allDifferent], createRNG(1), 1000);
    expect(result.complete).toBe(true);
    expect(result.assignment).not.toBeNull();
    const vals = Object.values(result.assignment!);
    expect(new Set(vals).size).toBe(3);
  });

  it('returns incomplete for impossible constraints', () => {
    const variables = [
      { id: 'a', domain: [1] },
      { id: 'b', domain: [1] },
    ];
    const result = solveCSP(variables, [allDifferent], createRNG(1), 1000);
    expect(result.complete).toBe(false);
    expect(result.assignment).toBeNull();
  });

  it('is deterministic', () => {
    const variables = [
      { id: 'a', domain: [1, 2, 3, 4] },
      { id: 'b', domain: [1, 2, 3, 4] },
      { id: 'c', domain: [1, 2, 3, 4] },
    ];
    const r1 = solveCSP(variables, [allDifferent], createRNG(9), 1000);
    const r2 = solveCSP(variables, [allDifferent], createRNG(9), 1000);
    expect(JSON.stringify(r1.assignment)).toBe(JSON.stringify(r2.assignment));
  });
});
