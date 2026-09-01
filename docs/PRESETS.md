# Presets Reference (Phase 9)

The phase-8 retro presets were removed. web/presets.js now ships six modern
technique-based presets (also exported as PRESETS_V2).

## The library

| Preset | Voice | Technique | Signature elements |
|--------|-------|-----------|--------------------|
| crystal-lead | Lead | FM | 3.5:1 modulator, depth 800 -> settling, shimmer send |
| plasma-lead | Lead | Additive | 5 inharmonic partials + spectral morph (0.6s) |
| nebula-pad | Harmony | Granular | density 12, grain 100ms, reverb 0.8 |
| glitch-pluck | Counter | Glitch | rate 4 stutter, stochastic 0.4, delay 0.5 |
| neuro-bass | Bass | Wavetable | sine->square morph, sub -1200 cents, drive 0.6 |
| quantum-bass | Bass | Physical | pluck 0.9, damping 0.3, resonant body |

## Defaults per channel

```javascript
export const DEFAULT_VOICE_PRESETS = {
  0: 'crystal-lead',   // Lead
  1: 'nebula-pad',     // Harmony
  2: 'glitch-pluck',   // Counter
  3: 'neuro-bass',     // Bass
};
F

## UI categories
- lead: crystal-lead, plasma-lead
- harmony: nebula-pad
- counter: glitch-pluck
- bass: neuro-bass, quantum-bass

## Adding a custom preset

```javascript
'my-voice': {
  name: 'My Voice',
  technique: 'FM',            // FM | Additive | Granular | Wavetable | Physical | Glitch
  fm: { modulator: { ratio: 2.5, depth: 500, decay: 0.2 } },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
  fx: { distortion: 0.2, reverbSend: 0.3, delaySend: 0.2 },
},
F

Then add its id to the right PRESET_CATEGORIES list and it appears in the demo dropdowns.

Technique parameter schemas are documented in docs/SOUND-DESIGN-V2.md.
