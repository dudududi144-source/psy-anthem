# Tension Model
Per-bar composite tension (0-1) = weighted(harmonic, rhythmic, register, dynamic, density); weights per intent.

## Energy Curves
FLAT · ARC (sin) · BUILD_DROP (exp rise → peak) · WAVE (oscillation) · CUSTOM (points, linearly interpolated).

## Application to events
- Velocity scales with energy (40-127).
- Register rises with energy.
- Duration shortens with energy.
- Articulation: legato → normal → accent.

## Validation
Correlation(generated tension, target curve) ≥ 0.8; peak near expected position; no jumps > 0.3/bar unless intentional.
