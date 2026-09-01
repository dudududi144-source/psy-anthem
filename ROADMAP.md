# Roadmap
Every phase ends green. No phase starts until the previous phase is fully validated.

- **Phase 0 — Foundation & Contracts** ✅ (docs, types, RNG, pipeline orchestrator, CI)
- **Phase 1 — Motif Engine** 🔲 (generator hardening, scorer, 10 transforms, occurrence tracking)
- **Phase 2 — Harmony & Voice Leading** 🔲 (progressions, CSP solver as default path, parallel detection)
- **Phase 3 — Structure & Tension** 🔲 (energy curves shaping density/register, section planner)
- **Phase 4 — Expression** 🔲 (humanize, articulation, dynamics A/B tests)
- **Phase 5 — Integration** 🔲 (golden files, memorability thresholds, benchmark baselines)
- **Phase 6 — Productionization** 🔲 (bundle gate, family integration with PSY6-ULTIMATE / psystar)

## Phase 7 — Playback & Advanced Controls (complete)
- Browser playback (web/synth.js): per-voice Web Audio timbres, ADSR, articulation, click-to-audition
- Demo features: PLAY/STOP, play-from-bar, PREV/NEXT history, COPY CONFIG, DOWNLOAD MIDI/JSON
- Engine: EMOTIONAL_LEAD intent, density, harmonyComplexity, loopMode, callResponse
- Engine: arpeggio smoothing (lead leaps > P4 become scale steps) + ARCH contour bias
- Golden MIDI collection regenerated for the new engine output

## Phase 9 — Modern Sound Design (complete)
- Six synthesis techniques: FM, Additive (+spectral morph), Granular, Wavetable (+sub), Physical, Glitch
- Old retro presets removed; six V2 presets shipped (crystal/plasma/nebula/glitch/neuro/quantum)
- Chromatic tension pass (chromaticTension, default off, tension-flagged notes exempt from scale lint)
- Extended harmony: major7/minor7/dom7 banks in harmonyComplexity 'complex'
- Counter voice with contrary motion vs the lead
- Generative melodies: fractal (midpoint displacement) + chaos (logistic map)
- Robust playback: event validation, per-note error isolation, latency reporting
- Golden MIDI collection regenerated for the new counter voice

## Phase 10 — Final Polish (complete)
- Extended chords: major9/minor9/dom9/major11/minor11/dom11/major13/minor13/dom13 + progression banks
- 15-preset arsenal (9 new, layered techniques 'A+B' + modifiers)
- Artistic quality validator: 5 dimensions, issues + suggestions, surfaced in metadata + demo UI
- Examples 14-15 (extended chords, preset arsenal)
