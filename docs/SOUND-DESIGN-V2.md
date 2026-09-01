# Sound Design V2 (Phase 9)

Phase 8 imitated classic subtractive synths. Phase 9 replaces the palette with six
modern synthesis techniques, chromatic tension, extended harmony, and real counterpoint.

## The six techniques

| Preset | Technique | Character |
|--------|-----------|-----------|
| crystal-lead | FM | metallic, bright; inharmonic 3.5:1 sidebands that settle over the note |
| plasma-lead | Additive | 5 detuned partials with spectral morphing across the note |
| nebula-pad | Granular | jittered grain cloud, breathing texture |
| glitch-pluck | Glitch | stochastic stutter retriggers with pitch jitter |
| neuro-bass | Wavetable | crossfaded wave-pair morph + sub harmonic (-1 octave) |
| quantum-bass | Physical | noise-burst excitation into a resonant body + damped fundamental |

## Technique details

### FM (crystal-lead)
Carrier sine at note frequency; modulator sine at 3.5x the frequency drives
carrier.frequency through a gain of 800 Hz depth. The depth settles to 35% over
the note (setTargetAtTime) so the spectrum evolves instead of staying static.

### Additive (plasma-lead)
Five sine partials at ratios 1 / 2.01 / 3.03 / 5.07 / 7.11 (deliberately inharmonic).
Each partial gain linearRamps from morph.start to morph.end over 0.6s — the
timbre audibly morphs during the note.

### Granular (nebula-pad)
min(24, ceil(density * seconds)) grains; each a short sine/triangle with a
4ms attack, 100ms span, jittered start time and ±2% pitch spread.

### Glitch (glitch-pluck)
1-4 retriggers per note at even spacing; alternating saw/square with decaying
peaks and ±3% pitch jitter — deliberate digital damage.

### Wavetable (neuro-bass)
Two oscillators on different base waveforms crossfaded over position.duration
(sine->square by default), plus a sine sub one octave below at -1200 cents.

### Physical (quantum-bass)
A 20ms decaying noise burst through a resonant bandpass at 2x the note (the
pluck), plus a damped triangle fundamental (the string). Damping controls decay.

## Melodic tension (chromaticTension)
AnthemConfig.chromaticTension (0-1, default 0 = golden-safe): roughly half of the
non-bar-start lead notes shift ±1 semitone, flagged tension:true and exempt from
scale linting. Deterministic per seed.

## Extended harmony
harmonyComplexity 'complex' now includes EXTENDED_MAJOR/EXTENDED_MINOR banks:
major7/minor7/dominant7 progressions in addition to secondary dominants.

## Counterpoint
The counter voice (v2) picks the chord tone moving contrary to the lead's
direction (closest candidate wins); fallback keeps the legacy chord-tone walk.

## Generative melodies (src/melody/generative.ts)
- generateFractalMelody(rng, depth): midpoint displacement, 2^depth+1 notes
- generateChaosMelody(rng, length): logistic map r=3.9 mapped to a MIDI range

## Robustness & latency
playEvents validates every event up front (invalid pitch/velocity/duration are
dropped), isolates per-note scheduling errors with try/catch + console.warn, and
reports scheduling time via lastScheduleMs. Measured: 100 events < 5ms.
