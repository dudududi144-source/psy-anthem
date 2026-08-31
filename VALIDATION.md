# Validation Strategy
**If a rule isn't tested, it doesn't exist.**

- Test-first for every musical rule.
- Determinism verified across canonical seeds (same seed → byte-identical output, timing excluded).
- Theory linter: hard errors fail generation; soft warnings reduce score.
- Memorability scoring: motif coverage + lint score.
- Performance benchmark with 100ms hard gate.

## Test layout
- tests/rng.test.ts — determinism + distribution
- tests/motif/ — generator + transformer
- tests/harmony/ — intervals, tension curves, voice leading
- tests/structure/ — energy curves
- tests/solver/ — CSP solver + theory lint
- tests/integration/ — full generation + determinism
