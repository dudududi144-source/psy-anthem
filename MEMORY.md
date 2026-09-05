# PSY ANTHEM — MEMORY (field knowledge)

Read this before touching playback. It is the accumulated, hard-won knowledge
from many rounds of live debugging on the target machine.

## The one rule that matters
On the target machine, audio is ONLY reliably audible through an `<audio>`
media element. Live WebAudio (`AudioContext -> destination`) overloads and
dies. **Never route playback through live WebAudio on this machine.**

## Playback architecture that actually works (v7.0+)
1. `createAnthemEngine(config).generate()` -> MusicalEvent[] (fast, works).
2. Rendering runs in a **Web Worker** (web/render-worker.js): a pure-JS
   stereo wavetable synth (zero WebAudio) - detuned unison lead / pad
   stack / filtered pluck / driven bass, ADSR, per-voice lowpass, stereo
   pans, tempo-synced delay, normalize + soft clip. The main thread never
   blocks, so the UI can never freeze or get stuck during rendering.
3. WAV -> Blob URL -> single <audio> element -> play(). The media-element
   path is the one proven audible on the target machine.
4. Keep it this way: ONE playback path, no experimental modes, no hidden
   players, no OfflineAudioContext on the hot path (it hung on the weak
   field machine - the reason it was removed from the default flow).
5. v7.1+: the renderer lives in web/render-core.js (pure module). The
   worker is a thin wrapper; app.js falls back to main-thread rendering if
   a browser cannot run module workers. tests/web/render-core.test.ts is
   the golden test: rendering MUST stay byte-identical for the same input.
6. v9.0+: render-core.js ships a 25-sound LIBRARY (lead/pad/pluck/bass).
   Sounds are chosen per song from INTENT_POOLS via hash(seed, intent) -
   deterministic. Rules: keep pools genre-coherent (sounds must serve each
   other), never break determinism, keep renderSong(events, bpm,
   onProgress, opts) backwards compatible (no opts = default sounds).
7. v9.2+: groove engine - renderer-side deterministic drums (kick + offbeat
   hats, hashNoise only, NEVER Math.random), sidechain duck + stereo
   widener. opts.drums 'on'/'off' (no opts = drums off = byte-stable old
   behavior). The UI sends drums 'on' by default.
8. v9.3+: groove styles (four/fullon/rolling) + auto (intent-curated pools,
   hash(seed,99)) + phrase risers every 8 bars (opts.risers). Back-compat:
   drums 'on' + no groove = byte-identical 'four'; no opts = drum-free.
   Do NOT change renderDrumsFour bytes without a golden-test decision.

## Facts learned the hard way
- Pure `<audio>` beep: HEARD repeatedly => media path is fine.
- Live WebAudio full graph: crackles then dies => audio-thread overload.
- `main.js` / `content.js` / `polyfill.js` console errors: a browser
  EXTENSION, not this project. Confirmed via ID
  `gldgimochijdaacphemijjkhbaicmodp`. Resolved by removing the extension.
- The machine is very weak/loaded: click handlers measured 500ms-2.1s.
  Always chunk heavy work; never block the main thread for >50ms.

## What NOT to do (these broke it before)
- Do NOT build the whole live audio graph up front (1000+ nodes => overload).
- Do NOT render AFTER the play click on a slow machine: the user gesture
  expires, autoplay is denied, and a hidden player gives no manual start.
  Always pre-render right after generation.
- Do NOT use hidden `<audio>` elements. Keep the player visible so the user
  can always press play manually.
- Do NOT layer experimental playback modes (FREEZE/BRIDGE/BOUNCE/LIVE/WAV).
  One proven path only.

## Restore points
- tag `backup-before-v6` = last experimental build (v5.5, commit 4363453).
- v6.0 = clean single-path playback build (this one).

## Files
- web/engine.mjs  WHAT layer (composition engine), bundled from src/.
- web/synth.js    HOW layer (PsySynthBrowser, incl. renderOffline).
- web/presets.js  15 voice presets.
- web/app.js      UI + playback orchestration (keep it simple).

9. v10.0+: PSY ANTHEM = emotional melodies & anthems, NOT rhythm/drums.
   Drums default OFF (groove toggle optional). Synth quality is the focus:
   lush 7-voice anthem lead, lush wide pad, lush reverb. Keep investing in
   synth + melody quality, not peripheral drums/groove.
10. v10.1+: piano roll is real-time and synced to audio (notes glow as they
   play). Intent library expanded (11 intents). To add a new intent you MUST
   update: types.ts enum, constants.ts INTENT_INTERVAL_POOLS +
   INTENT_TENSION_WEIGHTS, generator.ts rhythmicCharacterFor, app.js
   selector, render-core.js INTENT_POOLS - TS enforces exhaustiveness.
11. v10.2+: energy curves expanded (flat/arc/build-drop/wave/custom +
   emotional-swell/double-drop/progressive-climb/sunrise/plateau-break).
   Adding an EnergyCurve requires updating: types.ts enum, tension.ts
   sampleEnergyCurve switch, macro-form.ts getMacroForm switch. Intents now
   14; emotional intents (nostalgic-longing, triumphant-rise, tender-lullaby)
   favor stepwise/bittersweet intervals + sparse-flowing rhythm.
12. v10.3+: render-core renders each voice (lead/pad/pluck/bass) to its own
   buffer and applies per-voice character (chorus on lead/pad/pluck,
   high-cut+saturation on bass) before mixing with per-role levels. Fix for
   "everything sounds the same". Render-core is a preview renderer; for pro
   sound use the HOW-layer synth (psysynth/PsySynthPro).
13. v8.0+: psy-anthem connects to the professional PSY synth AudioWorklet for
   pro sound. psysynth-worklet.js is COPIED INTO this repo (never write to
   PsySynthPro or any other repo). worklet-renderer.js offline-renders events
   with one worklet node per voice. app.js uses the worklet as primary
   renderer with render-core fallback.
14. v8.1+: IMPORTANT LESSON (learned from psyreason/foundation/core/render.mjs):
   AudioWorklet nodes do NOT render reliably in an OfflineAudioContext (they
   render silence). Offline bounce MUST use STANDARD Web Audio nodes
   (createOscillator/BiquadFilter/Gain/Convolver/Delay), like psyreason does.
   web/synth-renderer.js implements this. It includes silence detection and
   falls back to render-core. Do NOT use AudioWorklet for offline bounce.
15. v9.0+: what actually makes it sound like modern trance (not RPG/gamelan):
   four-on-the-floor kick + rolling offbeat bassline + sidechain-style pump on
   the pads + lush supersaw lead. All added in web/synth-renderer.js (offline,
   standard Web Audio nodes). If it still sounds "game-like", the next levers
   are the MELODY/HARMONY content in src/ (not the synth).
16. v11.1+: the pro-synth offline render can hang on slow machines if the
   rolling bass creates too many oscillators. Fixes: rolling bass capped at 24
   steps/note, lead unison 5, and renderWithSynth wrapped in a 20s timeout
   that falls back to render-core. If the pro sound still doesn't render on a
   machine, the 20s timeout guarantees it falls back instead of hanging.
17. v12.0+: THIS PROJECT IS MELODIES & ANTHEMS, NOT DRUMS. Do NOT add kick,
   drums, rolling bass, or sidechain pump unless explicitly asked. The user
   rejected drums. The synth-renderer renders only the 4 melodic voices
   (lead/pad/pluck/bass) with lush supersaw/chorus/reverb/delay.
18. v12.1+: stuck-render root cause was often a CACHED old synth-renderer/
   render-worker/render-core file. Always keep cache-busting query params on
   the dynamic imports (synth-renderer import, render-worker Worker, and the
   render-core import inside render-worker). Bump ?v= together with the
   index.html ?v= when these files change.
19. v12.2+: render-core (Web Worker) is the PRIMARY renderer because the
   OfflineAudioContext renderer hangs on slow machines. Do not make the
   OfflineAudioContext renderer primary again unless it is proven fast on the
   target machine. render-core shows progress every 8 notes and uses a 1.5s tail.
20. v12.4+: mix balance lesson - harmony must not overload. Pads sit under the
   lead (lower level + more pump), bass owns the lows (lower filter). When
   adding voices/layers, always balance levels and carve frequency space so
   the voices blend instead of clashing.

## Task 17 facts (2026-09-05 — the serving fix, measured)
21. The old `foundation-shim/protocol.ts` was NEVER verbatim and the pin was `<TBD>` — the internal event format was being passed off as the foundation protocol. It now lives honestly in `src/internal-events.ts`; the shim carries verbatim psy-foundation v2 types + codec pinned at `0b1e77c`.
22. THE WIRE: `anthemToWire()` (src/integration/wire.ts) is the only place composition becomes wire bytes. Voice map: lead→lead, harmony→pad, counter→counter, bass→bass. ts = beats × 60/bpm; vel = velocity/127. Every envelope must pass the vendored foundation validator or the mapper throws.
23. psy-foundation's `POST /api/render-notes` renders the wire FAITHFULLY (no internal composition, no re-humanization) — the e2e proved determinism across the HTTP boundary (same POST → same WAV md5). Cap: 2000 notes/POST → think per-section (≤ ~44 dense bars per POST; halves with rebased ts work).
24. Loudness is density-bound: melody+groove streams master ≈ −12.4 LUFS vs the [−11,−7] club gate. Iterative gain→limit cycles make it QUIETER (pumping) — never chase loudness with gain; add arrangement density (sub-bass 8ths, pads).
25. The web/ render-core had a real DC-offset bug (−0.085/−0.087 both channels — measured on v12.3 AND v13.9.1, every version so far) and mastered quiet (−12.6 → −15.5 LUFS). ROOT CAUSE FOUND + FIXED in v13.9.2: the per-voice Chamberlin SVF accumulates DC drift at high cutoffs, the comb/chorus loops amplify it (~×4 DC gain), the old master left ~2.4 dB headroom unused. Fix: 2-pole 10 Hz DC blockers on every voice bus + master, saturate-then-normalize master (drive 1.5, true peak −0.7 dBFS). Measured after: DC ≤ 0.0007, LUFS −10.4…−10.7, LRA 4.7–4.8 — ALL 10 acceptance gates PASS (melody + groove paths). The preview path now meets the family sound contract.

