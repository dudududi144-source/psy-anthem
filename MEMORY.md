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
