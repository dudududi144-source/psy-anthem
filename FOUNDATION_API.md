# Foundation API Consumption
Foundation is NEVER imported directly. Contracts live in src/foundation-shim/.

**Pinned psy-foundation commit:** `<TBD — set on first shim sync>`

## Consumed
- protocol: MusicalEvent, NoteData, ControlData, ProgramData, Articulation
- transport: TransportPosition, TimeSignature, step/beat math

## Not Consumed
❌ dsp · scheduler · device-sdk · learning · analysis

## Sync Protocol
1. Update shim files verbatim. 2. Update pinned commit hash here. 3. `bun test` (byte-equivalence must pass).

## Compatibility Matrix
| psy-foundation | psy-anthem | Status |
|----------------|-----------|--------|
| (TBD) | 0.1.0 | Current |
