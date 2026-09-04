# Changelog

## 9.3.0 - Groove styles + phrase transitions

- Groove styles: four (the classic, byte-stable default), fullon (driving
  8th kicks + accented 16th hats), rolling (offbeat open hat + 16th gallop).
- "Auto" groove: chosen deterministically per song from intent-curated pools,
  so each song gets its own feel instead of the same pattern.
- Phrase transitions: rising noise-sweep risers over the last bar of every
  8-bar phrase (opts.risers, on by default in the UI).
- Selected groove is reported in the render result and shown as a chip in
  the sound kit.
- Back-compat preserved: no opts = drum-free byte-stable default;
  drums 'on' with no groove = byte-identical 'four'.
- Tests: groove-style differences, auto determinism, back-compat byte
  stability, risers determinism.



## 9.2.0 - Groove engine (the commercial-trance backbone)

The missing element was the groove itself:

- Renderer-side drums (deterministic, zero samples): four-on-the-floor psy
  kick (sine pitch-drop + click transient) and offbeat high-passed hats.
- Sidechain: the whole mix ducks under every kick (classic psy pump),
  layered with the existing per-recipe beat pumps on pads/bass.
- Master stereo widener (mid/side) + reverb pre-delay for cleaner space.
- UI toggle "Trance groove" (on by default); render requests carry
  drums on/off; draft mode supports groove too.
- Tests: groove determinism, groove-vs-dry difference, drum-free default
  (byte-stable backwards compatibility), groove in draft mode.



## 9.1.0 - Visible sound kit + draft preview

- The chosen sound kit is now visible: render returns the selected sound
  names (lead/pad/pluck/bass) and the stage shows them as color-coded chips.
- New "Render quality" switch: Full (commercial) / Draft (fast preview).
  Draft caps unison at 2 voices, narrows spread, skips the reverb pass and
  shortens the tail - renders several times faster on weak machines while
  keeping the same selected sounds.
- Tests: default names, deterministic names+bytes with opts, cross-intent
  sound difference, seed-stability sweep, draft determinism and
  draft-vs-full difference.



## 9.0.0 - Sound library (25 sounds, deterministic per-song selection)

"Everything sounded the same" - fixed. The renderer now ships a curated
sound LIBRARY and picks sounds per song from the song's own seed + intent:

- 25 distinct sounds in 4 roles:
  - 8 leads: euphoric-saw, full-on-grit, acid-lead, dreamy-lead, pluck-lead,
    dark-rave, crystal-lead, uplifting-gate
  - 5 pads: lush-wide, dark-drift, airy-heaven, gated-rhythm, analog-warm
  - 6 plucks: acid-303, trance-gate, bell-stab, acid-squelch, arp-pluck,
    dark-stab
  - 6 basses: rolling-psy, offbeat-kbbb, acid-bass, sub-deep, gritty-neuro,
    forest-squelch
- Intent-curated pools: sounds chosen for a genre are curated to serve each
  other (dark-psy pairs squelch bass + acid pluck + dark pad; euphoric pairs
  supersaw + lush pad + gate pluck + rolling bass...).
- Deterministic: seed + intent -> the exact same sounds and byte-identical
  audio every time; different seeds explore different sounds.
- Commercial-trance DSP (v8): resonant filter envelopes, supersaw unison,
  303-style acid, driven psy bass with beat pump, ping-pong delay,
  Schroeder reverb, stereo spread, master glue.
- Protocol: render requests now carry opts { intent, seed }; worker passes
  them through; app.js sends them from the current config.
- Tests extended: default determinism, opts determinism, cross-intent sound
  variation, default-vs-selected variation, format, progress, empty input.



## 7.1.0 - Testable render core + deterministic-audio golden tests

- Renderer extracted to web/render-core.js (pure module, zero WebAudio).
  render-worker.js is now a thin module wrapper; app.js loads the worker
  with { type: 'module' }.
- New automatic fallback: if the Worker cannot run in a browser, app.js
  renders on the main thread via dynamic import of render-core.js - the
  product still produces audio everywhere.
- New tests/web/render-core.test.ts (golden-style):
  - valid stereo 16-bit WAV output + 900 waveform peaks
  - byte-identical determinism (same events + bpm -> same bytes)
  - bpm sensitivity, monotonic progress, empty-input rejection.
- pages.yml deploys render-core.js next to the worker.



## 7.0.0 - Professional Studio UI (single reliable path, zero stuck states)

Replaces the accumulated v3-v6 experiment layers with one clean product:

- Audio rendering moved to a **Web Worker** (web/render-worker.js): the main
  thread never blocks, the UI never freezes, nothing can "get stuck" during
  rendering. Progress is reported live.
- One reliable playback path: worker-rendered stereo WAV -> <audio> element
  (the path proven audible on the field machine). No live WebAudio, no
  experimental modes, no hidden players.
- Professional UI: transport (play/pause/stop/seek), waveform view with
  playhead, piano roll with playhead, live time readout, stats, WAV/MIDI
  export, keyboard shortcuts (Space/G), responsive layout.
- Clean state flow: compose -> render (progress %) -> ready -> play.



## 6.3.0 - Real synth sound (no more game-boy)

Field report: playback works but sounds like a toy (the old pure-JS
fallback was sine blips). The studio path (OfflineAudioContext) never
completed on the weak machine within the timeout.

- Standard renderer rewritten as a proper stereo wavetable synth in pure JS
  (still zero WebAudio, so it is guaranteed to work):
  - band-limited saw tables; lead = 3-voice detuned unison, harmony = soft
    pad stack with slow attack, counter = filtered pluck, bass = driven sine
  - per-channel ADSR/pluck envelopes, one-pole lowpass per voice,
    stereo panning per channel
  - tempo-synced cross-feedback delay (dotted 8th) + normalize + soft clip
  - renders in ~0.5-2s, stereo 16-bit WAV.
- Studio Render (full engine: supersaw/FM/granular/physical presets, reverb
  and all FX) moved to an explicit ✨ button with a 120s budget; upgrades the
  player when it completes. No background CPU is wasted on machines where it
  cannot finish.



## 6.2.0 - Generate never blocks again

Field report: "asks for Generate but won't let me generate." Diagnosis: the
full-quality offline render could hang for minutes on a weak machine while
holding the busy flag, leaving the Generate button permanently disabled.

- Fast path first: generation renders an instant pure-JS WAV (~0.1-0.3s),
  so the player is ready immediately and the button frees at once.
- The full-quality offline render now runs in the background with a 20s
  timeout; if it finishes, the player upgrades to HQ audio automatically
  (only when not mid-playback). It can never block or lock the UI.
- Status line reports every stage: Generating / Preparing / Ready /
  HQ upgraded / errors.



## 6.1.0 - Deployment fix + visible diagnostics

- pages.yml: web/midi-lite.mjs was missing from the deployed site (explicit
  copy list) - added. This is why parts of v6.0 silently failed.
- app.js: every stage now reports visibly and to the console
  ([PSY ANTHEM] load / render HQ or fallback / player ready / errors).
  The status line shows which render path succeeded and the audio duration,
  so a broken stage is readable on the page without devtools.
- index.html: no-cache meta + v6.1 cache busters.



## 6.0.0 - Clean rebuild (single proven playback path)

Full reset of the web UI after the experimental layers (v3.1-v5.5) were
scrapped per user directive. Everything documented in MEMORY.md.

Removed: test beeps, audio-check dialogs, diagnosis overlays, foreign-script
banners, FREEZE/BRIDGE/BOUNCE/LIVE/WAV-PLAY mode soup, visualizer, insight
panels - all of it.

New (clean build):
- One playback path, the proven one: generate -> WAV render -> visible
  <audio controls> player. Rendering tries the full-quality OfflineAudioContext
  engine first and falls back to the zero-WebAudio pure-JS synth, so audio
  always comes out.
- Rendering starts immediately after generation (in-page status shows
  progress), so the player is ready by the time the user presses play.
- Simple UI: seed/intent/energy/root/bars + Generate/Random, Play button,
  player, piano roll, stats, WAV/MIDI download.
- MEMORY.md added: field knowledge + do/don't rules + restore points.
- Restore point: tag `backup-before-v6` (= v5.5 experimental build).



## 5.5.0 - Bulletproof FREEZE: pre-render + visible player

Post-extension-removal field report: still no playback. Diagnosis of the
FREEZE path: rendering happened AFTER the PLAY click on very slow machines,
so the user-gesture expired before <audio>.play() ran (autoplay denied) and
the hidden player gave no way to start it.

- The bounce now pre-renders IMMEDIATELY after each generation, in the
  background with live status in the debug strip; PLAY becomes instant and
  always inside the gesture.
- FREEZE plays through a VISIBLE <audio controls> player (the media path
  proven audible on the user's machine); if autoplay is still denied, the
  user can press the player's own play button.
- BOUNCE button is now an alias of FREEZE playback; fallback chain
  freeze -> zero-WebAudio WAV stays intact.



## 5.4.0 - Foreign-script shield + on-page source exposure

The recurring main.js crash does not exist in this project (verified: web/
loads app.js only; all 32 account repos scanned - no matching file). It is
injected by the viewer's environment (extension). Two new defenses:

- index.html: strict Content-Security-Policy (script-src 'self' blob:) -
  blocks MAIN-world injected scripts from executing on this page while
  allowing everything the app uses (modules, blob worker, blob/media URLs,
  jsdelivr fonts/css).
- app.js: any crashing/inserted external script is now exposed ON THE PAGE
  in a red banner with its full source URL (chrome-extension://... naming
  the exact extension), plus console warnings. No more guessing.
- FREEZE fallback chain hardened: bounce -> zero-WebAudio WAV playback
  (instead of the heavy live path).



## 5.3.0 - FREEZE playback (full quality, zero live load)

Field report: "not playing, massive load." The full live graph is simply
too heavy for very weak/loaded machines in real time. The professional
answer is the DAW "freeze/consolidate" pattern - no sound reduction:

- ▶ PLAY now FREEZE-plays: renders the ENTIRE anthem with the full engine
  (all voices/presets/FX) in an OfflineAudioContext, then plays the result
  through a media element. Zero live WebAudio processing during playback;
  rendering is cached per take and re-rendered only on new takes.
- New ▶ LIVE button keeps the real-time WebAudio path available.
- Space triggers FREEZE playback; STOP stops it; progress/playhead track
  the media element while frozen.
- synth.js: offline render schedules notes in 24-note chunks (no ~1s
  main-thread block during the bounce render itself).



## 5.2.0 - Origin-hygiene guard

Investigation result: main.js does not exist anywhere in psy-anthem (web/
holds only app.js, engine.mjs, synth.js, presets.js, state.js; index.html
loads app.js?v=57 only). The recurring main.js/content.js/polyfill.js
errors match browser-extension content scripts, or stale service workers
from other Pages apps on the shared dudududi144-source.github.io origin.

- app.js: on load, unregisters every service worker whose scope covers this
  page (psy-anthem intentionally uses none) and clears psy-anthem-named
  caches, so no foreign/stale SW can intercept or serve broken bytes here.
  Other projects' path-scoped workers are untouched.



## 5.1.0 - Clean Pipeline (anti-glitch scheduling, field-tuned)

Symptoms solved (from field logs): noise blasts at playback start, playback
collapsing into crackle/silence after a few seconds, 2.1s click blocks,
lingering background sound after STOP.

- synth: lookahead window scheduler v5 - notes materialize in a moving 8s
  window ticked from a Web Worker (setInterval fallback); first fill capped
  at 48 notes in 12-note yielded chunks; 1.0s playback lead. The window was
  tuned 20s -> 8s after field testing: 20s grew the live graph to ~130
  notes and overloaded the audio thread after a few seconds on weak CPUs;
  8s still covers the measured ~2s main-thread stalls.
- synth: late-note policy - notes >80ms behind real time are dropped and
  counted instead of clamped into simultaneous noise blasts (mock clocks
  exempt). Telemetry: initial-fill timing, completion summary (played/
  dropped/max lag), live drop warnings, lateDropped getter.
- synth: audioBufferToWav is async/chunked (no multi-second click blocks);
  renderToWav awaits it.
- app: STOP pauses bounce/WAV/pure-WAV/bridge players (lingering sound);
  chain audit logged at synth creation; playback DOM writes every 5th
  frame; debug strip shows live sched + drops; viz half-rate while playing.

Sound untouched: full engine, all voices, presets and FX.



## 4.1.0 - Bridge & Bounce (differential-diagnosis playback paths)

Evidence from the user's console: pure <audio> beep audible (confirmed 5x),
AudioContext running, 38/176 notes window-scheduled - yet silence. The break
is therefore between the AudioContext's processed output and the speakers
(sink routing or an extension hijacking it), not in scheduling.

Four independent playback paths now isolate the broken layer:
- ▶ PLAY: WebAudio graph -> ctx.destination (direct)
- 🔀 BRIDGE: WebAudio graph -> MediaStreamDestination -> <audio> element
  (live sound through the provably-working media pipeline); also forces
  ctx.setSinkId('default') where supported
- 🧪 BOUNCE: full-engine offline render (OfflineAudioContext) -> WAV ->
  <audio> element (full quality, zero live-sink dependence)
- ◉ WAV PLAY: pure-JS synthesis -> WAV -> <audio> (zero WebAudio)

Whatever plays identifies the fault; BRIDGE/BOUNCE are also the workarounds.



## 4.0.0 - Titan scheduler (scale up, never down)

- synth: lookahead window scheduler - the full song graph is materialized in
  a moving 6-second window (250ms ticks, 16-note first-fill chunks) instead
  of one blocking burst of 1000+ oscillators at PLAY. The live audio graph
  stays bounded for any song length while every voice, preset and FX of the
  full engine remains untouched (nothing reduced, nothing removed).
- synth: sample-accurate absolute timestamps against t0 (+0.35s lead);
  pendingNotes/scheduledNotes/totalNotes telemetry; console reports for
  window fill and completion.
- web: piano roll cached to an offscreen layer; per-frame playback drawing
  is now a blit + playhead (kills 50ms+ rAF tasks on weak machines); debug
  strip shows live window-scheduling progress during playback.
- tests: new scheduler suite (window fill, clock-advance completion, stop
  cancellation); verify-playback pumps the mock clock to prove every note is
  scheduled by the lookahead.



## 0.3.0 - Hyperstage UI v3.1

- fix(pages): deploy state.js so the demo shell loads (the 404 that crashed
  the page with 'Cannot convert undefined or null to object').
- feat(web): Hyperstage redesign - neon glass UI, animated aurora backdrop,
  live visualizer, canvas piano roll with click-audition, transport with
  seek-to-bar, take history, keyboard shortcuts, toasts via appState.
- feat(web): insights panels on the Stage - Motif DNA chips, Harmonic
  Journey strip (root + quality, duration-proportional), Artistic Breakdown
  meters.
- fix(web): seeking during playback restarts from the target bar instead of
  stopping; status LED tracks playing / generating / error states.
- fix(web): roundRect fallback for older browsers; safer canvas sizing.



## 0.2.0 - Phase 14 (hardening)

- feat(validation): strict AnthemConfig schema validation with
  zod-compatible semantics (parseConfig / safeParseConfig, pathed issues).
  Zero runtime dependencies to keep the bundle under the 30KB CI gate.
  Error classes stay backwards compatible: pure range violations throw
  RangeError; type/shape/enum/refine violations throw TypeError. Seed
  accepts any 32-bit signed integer (established engine contract).
- fix(synth): voice lifecycle cleanup - scheduled sources now release their
  activeNodes references via onended and detach the per-note graph when the
  note ends, preventing node accumulation during long full-ahead plays
  (32+ bars x 4 voices). stop() behavior is unchanged.
- feat(web): minimal observable state store (web/state.js) and global error
  boundaries (window error / unhandledrejection) for the demo shell;
  showError/hideError mirror into appState.
- tests: config-schema suite, voice-lifecycle suite, state-store suite;
  MockNode.disconnect() tracking added to the mock audio context.

Note: the earlier handover analysis described a pre-Phase-9 snapshot
(FM/Granular/Physical/Wavetable reported missing). Those engines exist and
are covered by tests/audio/quality.test.ts and
tests/web/synth-presets.test.ts.
