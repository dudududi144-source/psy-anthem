
---
Task ID: 17-b (The serving fix: real PSYBUS v2 wire + first end-to-end family pipeline proof)
Agent: Z.ai Code (lead engineer, authorized by owner to write this repo)

Task:
- Owner mandate (Hebrew): "קוד טוב מאוד אבל הוא לא מוגש נכון צריך להבין איך הוא משרת אותנו בוא נעשה ניסוי גם יעילות עבורנו. כתוב לריפו שלו הכל... תחשוב בגדול שנוכל לראות את גבולות המערכת והאיכות קצה" — write access granted; audit how the repo serves the family, run a limits/efficiency experiment, write everything here.

Work Log:
- AUDIT (evidence in docs/SERVING_AUDIT_2026-09-05.md §1): 352 tests pass and the engine is fast/deterministic, BUT the serving layer was fiction — shim claimed "VERBATIM… pinned" with pin `<TBD>`, types matched neither foundation v1 nor PSYBUS v2, and shim transport helpers described APIs foundation never had. The web/ private renderer fails the family sound contract (DC offset −0.07…−0.09 BOTH channels + LUFS −12.6…−13.2, acceptance-check evidence).
- SHIM SYNC (first real one): verbatim copies of psy-foundation@0b1e77c packages/protocol/src/v2/types.ts + envelope.ts (psybus-v2-types.ts / psybus-v2-envelope.ts), real v1 events (protocol.ts, marked superseded), real transport excerpts (transport-musical.ts). Internal event format moved to src/internal-events.ts under its honest name. FOUNDATION_API.md records the pin + the honest history. tsconfig gained allowImportingTsExtensions (foundation shim verbatimness).
- WIRE: src/integration/wire.ts — anthemToWire() (voice map lead/harmony→pad/counter/bass, ts=beats×60/bpm, vel=/127, monotonic rev, seed carried; every envelope validated by the vendored foundation codec, rejection throws), wireToRenderNotesBody(), wireSize(). Exported from src/integration/index.ts.
- TESTS: tests/integration/wire.test.ts — 10 conformance claims (1:1 mapping, bounds, time math, voice map, byte-identical canonical wire per seed, monotonic rev, size bound, 11-intent × 4-voice × 4-curve grid). Suite: 362/0.
- EXPERIMENT: scripts/e2e-pipeline.ts + scripts/acceptance-check.mjs (copied one-file gate from psy-foundation). Runs compose grid (bars 8–128, all 11 intents, voices 1–4, 6 curves, seed edges 0/2^31−1), contract error edges, wire mapping/validation/size, HTTP renders against psy-foundation's NEW POST /api/render-notes (Task 17-a there), acceptance-check on every WAV, determinism across the HTTP boundary, plus comparison against this repo's own renderer. RESULT: 53 claims PASS, 0 failures — docs/E2E_PIPELINE_REPORT.md. First end-to-end family pipeline proof: anthem composition → PSYBUS v2 → foundation's voices/ChannelFX/bus-glue/master chain → WAV → gates.
- LIMITS FOUND (the experiment's purpose): (1) loudness is density-bound — melody+groove ≈ −12.4 LUFS vs [−11,−7] club gate; iterative gain→limit pumping measured to LOSE loudness (foundation reverted it); density is the lever. (2) 2000-note POST cap → the wire is per-section; halves-with-rebased-ts workaround proven. (3) FIR true-peak safety enforced on consumer renders. (4) web/render-core DC bug documented in MEMORY.md.
- DOCS: CONTRACT.md v0.3.0 (honest serving story: events = internal format, wire = PSYBUS v2), README (wire + audit links), FOUNDATION_API.md (real pin), MEMORY.md (facts 12–16), package.json 0.3.0.

Stage Summary:
- The repo's code was always good; its CLAIMS weren't. It now serves the family for real: a conformance-gated PSYBUS v2 wire, validated by the same codec on both ends, proven end-to-end with the family's own sound chain and gate tool. Version 0.3.0. Foundation-side counterpart: Task 17-a (the render-notes endpoint + FIR true-peak meter).
