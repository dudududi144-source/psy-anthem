# Validation

Two validation layers protect the engine:

## 1. Input schema - src/validation/config-schema.ts

Strict AnthemConfig validation with **zod-compatible semantics**
(safeParseConfig / parseConfig; issues carry path + message + kind).
Implemented with **zero runtime dependencies** to protect the 30KB browser
bundle gate; call sites can swap to real zod later without changes.

Error contract (backwards compatible with the previous validateConfig):

| Violation kind                    | Thrown by parseConfig |
| --------------------------------- | --------------------- |
| pure range (min/max)              | RangeError            |
| type / shape / enum / refinement  | TypeError             |

Usage:

    import { parseConfig, safeParseConfig } from 'psy-anthem';

    const cfg = parseConfig(hostPayload);       // throws on invalid input
    const res = safeParseConfig(hostPayload);   // { success, data | error }

Validated fields: seed (any 32-bit signed integer), intent (enum),
scale.root (0-11), scale.mode (enum), energyCurve (enum), targetRange
(MIDI 0-127, min < max), voices (1-4), bars (8-128), optional bpm (30-300),
customCurve (required for the custom curve; points within 0-1),
chromaticTension (0-1), density, harmonyComplexity, loopMode, callResponse.

## 2. Theory lint - src/solver/validator.ts

Musical-rule gate over generated events (parallel fifths/octaves, range,
repetitions...). Runs inside generate(); see solver tests.
