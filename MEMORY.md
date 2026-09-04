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