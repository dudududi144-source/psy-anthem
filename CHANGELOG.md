# Changelog

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
