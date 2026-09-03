# Changelog

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
