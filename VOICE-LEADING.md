# Voice Leading (CSP)
Variables = note positions; domains = scale pitches within per-voice ranges.

## Voice Ranges (default, MIDI)
| Voice | Min | Max | Role |
|-------|-----|-----|------|
| Lead | C4 (60) | C6 (84) | Main melody |
| Harmony | G3 (55) | G5 (79) | 3rds/6ths support |
| Counter | E3 (52) | E5 (76) | Fills, contrary motion |
| Bass | C2 (36) | G3 (55) | Root motion foundation |

## Hard Constraints
Scale membership · range limits · no parallel P5/P8 · leading-tone resolution · no voice crossing · chord tone on downbeat.

## Soft Constraints
Stepwise preference · leap recovery · consonance on strong beats · motif alignment · arch contour · rhythmic variety.

## Solver
Backtracking + heuristic value ordering + 50ms budget → best-so-far with quality flag. The Phase-0 engine uses a constructive generator that satisfies hard constraints by design; the CSP solver is exercised by its own tests and becomes the default path in Phase 2.
