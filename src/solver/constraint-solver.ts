// PSY ANTHEM - solver/constraint-solver.ts
import { SOLVER_CONFIG } from '../constants';
import type { RNG } from '../rng';

export interface CSPVariable {
  id: string;
  domain: number[];
}

export interface CSPResult {
  assignment: Record<string, number> | null;
  complete: boolean;
  iterations: number;
  timeMs: number;
}

export type Constraint = (assignment: Record<string, number>, id: string, value: number) => boolean;

function nowMs(): number {
  return Date.now();
}

// Generic backtracking CSP solver with a time budget.
export function solveCSP(
  variables: CSPVariable[],
  constraints: Constraint[],
  rng: RNG,
  timeBudgetMs: number = SOLVER_CONFIG.TIME_BUDGET_MS,
): CSPResult {
  const start = nowMs();
  let iterations = 0;
  const best: Record<string, number> = {};
  // Smallest-domain-first ordering prunes faster.
  const ordered = variables.slice().sort((a, b) => a.domain.length - b.domain.length);

  function allowed(id: string, value: number): boolean {
    for (const c of constraints) {
      if (!c(best, id, value)) return false;
    }
    return true;
  }

  function backtrack(idx: number): boolean {
    if (nowMs() - start > timeBudgetMs) return false;
    if (idx === ordered.length) return true;
    const v = ordered[idx]!;
    const values = rng.shuffle(v.domain);
    for (const value of values) {
      iterations++;
      if (allowed(v.id, value)) {
        best[v.id] = value;
        if (backtrack(idx + 1)) return true;
        delete best[v.id];
      }
    }
    return false;
  }

  const complete = backtrack(0);
  return {
    assignment: complete ? { ...best } : null,
    complete,
    iterations,
    timeMs: nowMs() - start,
  };
}
