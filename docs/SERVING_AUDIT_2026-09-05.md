# SERVING AUDIT — how psy-anthem serves the PSY family (2026-09-05, Task 17)

> **Mandate.** The owner granted write access to this repo for a limits-and-
> efficiency experiment: *"קוד טוב מאוד אבל הוא לא מוגש נכון — צריך להבין איך
> הוא משרת אותנו"* (very good code, but not served correctly — we need to
> understand how it serves us). This document is that understanding, with
> every claim carrying a number and every number reproducible.

## 0. Verdict in one paragraph

The composition engine is genuinely good: 352 tests pass, generation is
deterministic and fast (0.1–0.8 ms/bar, byte-identical double-generates), the
CSP/voice-leading constraints hold across the whole 11-intent × 4-voice ×
6-curve grid, and every documented contract edge (bars 7/129, voices 0/5,
CUSTOM without curve) throws exactly as CONTRACT.md says. **What was broken
was the serving layer**: the repo claimed to emit "canonical
`MusicalEvent[]` (psy-foundation protocol v1)" but the shape matched
NEITHER the real foundation v1 protocol NOR PSYBUS v2, the foundation-shim
pin said `<TBD — set on first shim sync>`, and the shim's "transport"
helpers describe APIs foundation has never had. The composition could not
reach the family sound because the wire was a fiction. Task 17 replaced the
fiction with a working, tested wire.

## 1. Evidence — what the audit found

| # | Finding | Evidence | Status after Task 17 |
|---|---|---|---|
| 1 | Shim claims `VERBATIM … pinned` but the pin is `<TBD>` and the types are a third dialect: `MusicalEvent {timestamp, channel: number 0-15, data: {pitch, velocity}}` | `src/foundation-shim/protocol.ts` (old), FOUNDATION_API.md | **FIXED** — `foundation-shim/psybus-v2-types.ts` + `psybus-v2-envelope.ts` are verbatim copies of psy-foundation@`0b1e77c` `packages/protocol/src/v2/`; pin recorded in FOUNDATION_API.md |
| 2 | Real foundation v1 `MusicalEvent` is a discriminated union (`BeatEvent…PatternEvent`), `NoteEvent = {type:'note', note, velocity, duration, channel: string, at}` — nothing like the shim | psy-foundation `packages/protocol/src/events.ts` | **FIXED** — real v1 events now vendored verbatim in `foundation-shim/protocol.ts`, marked superseded-by-v2 |
| 3 | The old shim's `transport.ts` (`TimeSignature`, `TransportPosition`, `stepsPerBar`, `barBeatStepToAbsolute`) describes APIs that exist NOWHERE in psy-foundation's transport package | repo-wide grep of psy-foundation `packages/transport` | **REMOVED** — honest replacement `foundation-shim/transport-musical.ts` carries only real foundation types |
| 4 | The engine's internal event format is composition-internal, not a wire format — but it lived in a file claiming to be the foundation protocol | `src/types.ts` imported the fiction | **RENAMED HONESTLY** — `src/internal-events.ts`, header states exactly what it is |
| 5 | `web/` vendors a 4th private HOW-layer (25-sound wavetable renderer). Measured against the family sound contract it **fails** (re-measured on the agent's LATEST v13.9.1 renderer after rebase): I = −15.5 LUFS (gate [−11,−7]; was −12.6 on v12.3 — the "simplify the mix" iterations made it QUIETER), **DC offset −0.085/−0.087 on BOTH channels** (9% of full scale — real DSP bug, present in every version measured) | `node scripts/acceptance-check.mjs` on render-core output (see §3) | **FIXED (v13.9.2, Task 20 — see Addendum)** — all 10 gates now PASS |
| 6 | No path existed for a family HOW-layer to render anthem's notes at all | psy-foundation docs/CONSUMER_SUPPORT.md ladder (pre-Task-17) | **FIXED** — psy-foundation added `POST /api/render-notes` (Task 17-a); this repo maps onto it |

## 2. The fix — the WHAT→HOW wire (one tested place)

`src/integration/wire.ts` is now the ONLY place where composition events
become wire bytes:

- `anthemToWire(out, {bpm, deviceId})` maps internal events → PSYBUS v2
  `note` envelopes: `ts = beats × 60/bpm` (seconds), `vel = velocity/127`,
  `track` per voice map (lead→lead, harmony→pad, counter→counter, bass→bass),
  `rev` monotonic, `seed` carried from the composition. Every envelope passes
  the verbatim foundation validator (`validateEnvelope`) — a rejection throws.
- `wireToRenderNotesBody(...)` produces the exact POST body foundation's
  `/api/render-notes` consumes — and that endpoint validates with the SAME
  codec, so conformance is enforced on both ends by one set of rules.
- 10 conformance tests in `tests/integration/wire.test.ts` pin: 1:1 mapping,
  bounds (note 0-127, vel 0..1, known track), time math, voice mapping,
  byte-identical canonical wire for a seed, monotonic rev, wire size, and the
  11-intent × 4-voice × 4-curve grid.

## 3. The experiment — first end-to-end family pipeline proof

`scripts/e2e-pipeline.ts` runs the full chain
**compose → wire → HTTP POST → foundation's voices/ChannelFX/bus-glue/master
chain → WAV → acceptance-check**, plus comparison against this repo's own
private renderer. Full matrix: `docs/E2E_PIPELINE_REPORT.md` (53 claims PASS).
Headlines (foundation `localhost:3123`, bpm 140, seed 42):

| Stage | Result |
|---|---|
| Compose bars 8→128 | 93→1485 events, 0.1–0.8 ms/bar, double-generate byte-identical |
| All 11 intents / voices 1–4 / 6 curves | all compose, all deterministic |
| Contract edges | bars 7/129 → RangeError, voices 0/5 → RangeError, min>max → RangeError, CUSTOM w/o curve → TypeError — exactly as documented |
| Wire | 0 rejected, 0 unmapped; ~2.08 KB/bar (≈9 KB/s of music) |
| Foundation render (melody-only) | 8/32/88 bars: hard gates ALL PASS (format, TP, DC, alive, stereo); LUFS −12.5…−14.8 (sparse-melody finding, below) |
| Foundation render (+host groove) | hard gates ALL PASS; LUFS −12.4…−13.9 |
| Determinism across the HTTP boundary | two identical POSTs → identical WAV md5 |
| Own renderer (comparison, v13.9.1) | fails DC + LUFS gates (§1 finding 5) |

### Limits found (the point of the experiment)

1. **Loudness is density-bound.** A melody+groove stream masters to
   ≈ −12.4 LUFS vs the club gate [−11,−7]; foundation's own full arrangement
   (16th bass, shakers, pads) reaches −10.7. The limiter ceiling is the same
   in both cases — the difference is midrange density. Measured at
   psy-foundation: iterative gain→limit convergence PUMPS and LOSES gated
   loudness (−12.4 → −14.6) — more gain is NOT the lever; arrangement
   density is. Sparse streams are quiet because the arrangement is quiet.
2. **The wire is a per-section wire.** `POST /api/render-notes` caps at
   2000 notes/POST (DoS bound): an 88-bar full arrangement (2605 notes) is
   honestly refused (`400`); the halves workaround (rebased ts) renders
   both halves fine. Hosts should think in ≤ ~44-bar dense sections.
3. **True-peak safety is enforced by an FIR meter** on consumer renders
   (foundation Task 17-a): the internal Catmull-Rom detector undershoots
   inter-sample peaks on hard-pushed sparse material (measured +1.3 dBTP
   by ffmpeg vs −0.34 internally); the faithful path converges FIR TP to
   −2.0 dBTP (ffmpeg-verified −1.4…−3.2 on this repo's streams).
4. **This repo's own renderer had a DC-offset bug** (−0.07…−0.09 both
   channels) and mastered quiet (−12.6…−13.2 LUFS). **FIXED in v13.9.2 —
   see the Addendum below** (root cause, fix, and measured after-numbers).
   The family sound continues to come from foundation's chain for wire
   renders; the preview path now also passes the family gates.

## 4. How this repo serves the family NOW

- **Composition-as-a-service (the role CONTRACT.md always claimed):**
  generate → `anthemToWire` → POST to any foundation instance → mastered
  deterministic WAV. Worked end-to-end today, 53 claims, zero failures.
- **PSYBUS v2 participant:** `src/integration/psybus-adapter.ts` (live
  morphing/evolution control-plane) now shares the same verbatim v2 type
  basis; the note payloads it emits match the validated wire.
- **The browser demo stays**: `web/` remains the zero-dependency preview
  path; its renderer quirks are documented (§3, limit 4).

## 5. Reproduce

```bash
bun install && bun test                     # 362 tests (352 + 10 wire)
bun run scripts/e2e-pipeline.ts             # needs a foundation dev server:
#   cd psy-foundation/apps/web && PORT=3123 bun run dev
bun run scripts/cli.ts --seed 42 --intent euphoric-trance --bars 32 --output anthem.mid
```

## 6. Addendum — Task 20 (2026-09-05): the render-core DC bug is FIXED

The out-of-scope item from §1 finding 5 / §3 limit 4 was root-caused and
fixed in the same day it was documented, under the owner's family-quality
mandate. Every number below is reproducible with
`scripts/acceptance-check.mjs` on a real engine composition
(seed 42, euphoric-trance, 32 bars, bpm 140).

**Bisection (render variants, DC measured on decoded output):**

| Variant | DC (L/R) |
|---|---|
| groove=four alone (kick path) | 0.0004 / 0.0005 — drums CLEAN |
| voice solo, draft (no wet FX) | −0.006…−0.040 — voices generate DC |
| voice solo, full | −0.03…−0.22 — wet FX amplify ~6× |
| 32-bar full mix | −0.255 / −0.268 |

**Root cause.** The per-voice Chamberlin SVF accumulates a DC drift at
high cutoff settings; the tanh drive preserves it; `pingpong` (DC gain
1/(1−0.36) ≈ 1.6) and the Schroeder reverb combs (DC gain up to ~4.3)
amplify it; and the old master stage (`0.9/peak` then `tanh(×1.1)`) both
left ~2.4 dB of headroom unused and kept the bias in the output.

**Fix (web/render-core.js v13.9.2, ~40 lines):**
1. `dcBlock()` — two cascaded one-pole 10 Hz highpass poles — applied to
   EVERY voice bus before the wet stages (source), plus once at the master
   (defense in depth). Kick fundamental (46 Hz) loses 0.4 dB — inaudible.
2. Saturate-then-normalize master: pre-tanh peak target `MASTER_DRIVE =
   1.5` (the same honest density lever as foundation's gain→limit stage),
   then true-peak normalize to −0.7 dBFS so the family gates
   (samplePeakMax −0.5, lufsMin −11) are reachable at all.

**Measured after (all three render paths, real composition):**

| Path | I (LUFS) | LRA (LU) | DC | TP (dBTP) | Gates |
|---|---|---|---|---|---|
| melody (full) | −10.4 | 4.8 | 0.00023 | −0.7 | **10/10 PASS** |
| +groove (full) | −10.7 | 4.7 | 0.00021 | −0.7 | **10/10 PASS** |
| draft | −9.1 | 4.6 | −0.00072 | −0.7 | 9 PASS / 1 WARN (stereo stats — draft spreads are clamped ≤0.5) |

Before → after: DC −0.27 → 0.0002 (the dcMax 0.001 gate now holds with
3–5× margin), LUFS −15.5 → −10.4 (mid-gate, no pumping), LRA 4.8
(dynamics preserved — drive 2.2 was tested and rejected: LRA collapsed to
0.1). Determinism preserved: double render is byte-identical. Suite:
362/0. Cache-busters bumped ?v=200 → ?v=201 (app.js, render-worker.js,
render-core.js import) per the 13.9.0 lesson.
