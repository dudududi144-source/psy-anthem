# Foundation API Consumption
Foundation is NEVER imported at runtime. Contracts live in src/foundation-shim/ as **verbatim copies**.

**Pinned psy-foundation commit:** `0b1e77c085f1af9177e3e80e1f8aadf4ab5228ac`
(line `foundation-v2.0.0`, Task 17-a/17-b, 2026-09-05 — first real sync)

## Consumed (verbatim shim files)
- `psybus-v2-types.ts` ← psy-foundation `packages/protocol/src/v2/types.ts` — THE family wire (envelope + payloads + branded ids)
- `psybus-v2-envelope.ts` ← `packages/protocol/src/v2/envelope.ts` — build/validate/canonical-JSON codec (`validateEnvelope`, `canonicalJson`, `asTrackId`)
- `protocol.ts` ← `packages/protocol/src/events.ts` (v1 events — superseded by v2 on the wire, kept for reference)
- `transport-musical.ts` ← excerpts of `packages/transport/src/types.ts` (what protocol.ts references)

## Not Consumed
❌ dsp · scheduler · device-sdk · learning · analysis · music · web app

## The wire in one line
`anthemToWire(output, {bpm}) → BusEnvelope<NotePayload>[]` — validated by the
same codec foundation's `POST /api/render-notes` runs, so what passes here
passes there. Mapping and proof: `src/integration/wire.ts`,
`tests/integration/wire.test.ts`, `docs/SERVING_AUDIT_2026-09-05.md`.

## Sync Protocol
1. Update shim files verbatim. 2. Update the pinned commit hash here.
3. `bun test` (the wire conformance suite must pass).

## Compatibility Matrix
| psy-foundation | psy-anthem | Status |
|----------------|-----------|--------|
| `0b1e77c` (v2.0.0 line, render-notes wire) | 0.3.0 | **Current (first real sync — the `<TBD>` era is over)** |
| (TBD) | 0.1.0–0.2.0 | Historical — the shim was NOT verbatim; see docs/SERVING_AUDIT_2026-09-05.md §1 |
