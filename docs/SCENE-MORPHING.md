# Scene Morphing & Live Automation (Phase 12)

psy-anthem becomes a live performance instrument: crossfade between two generated
compositions and automate parameters in real time over the PSYBUS.

## Scene Morphing

```ts
import { SceneMorpher } from 'psy-anthem/src/morphing';

const morpher = new SceneMorpher();
morpher.loadScenes({ fromScene, toScene, durationBars: 8, curve: 'bezier' });
morpher.updateProgress(0.5);                 // driven by the host clock
const events = morpher.getEventsAtPosition(positionBeats, 0.25); // emit window
```

### Transition curves
- **linear** - constant change rate
- **exponential** - slow start, fast end (progress^2)
- **bezier** - smoothstep: gentle acceleration in, deceleration out

### What gets interpolated
| Parameter | Interpolation |
|-----------|---------------|
| BPM | linear (rounded) |
| Voices | linear (rounded) |
| Target range | linear (rounded) |
| Bars | linear (rounded) |
| Scale root | linear (rounded) |
| Intent / scale mode / energy curve | discrete switch at 0.5 |

### Event blending
Inside the morph window both scenes play together: source-scene velocities are
scaled by (1 - progress), target-scene velocities by progress, zero-velocity
notes are dropped. After completion the morpher plays the target scene only.

## Live Parameter Automation

Automations run on the adapter and scale emitted events (never mutate the
stored composition - fully reversible):
- **velocity** - velocity multiplier (startValue..endValue)
- **duration** - duration multiplier
- **pitch** - transpose: value in [-1, 1] octaves, rounded semitones

```ts
adapter.handleMessage({
  type: 'automation.start',
  deviceId: 'anthem-001',
  payload: { param: 'velocity', startValue: 1.0, endValue: 0.3, duration: 8, curve: 'exponential' },
});
```

Automations auto-complete when the transport passes startBeat + duration
(an automation.stopped envelope is emitted), or stop manually via automation.stop.

### Morphing over the bus
```ts
adapter.handleMessage({
  type: 'morph.start',
  deviceId: 'anthem-001',
  payload: { fromScene, toScene, durationBars: 8, curve: 'bezier' },
});
adapter.handleMessage({ type: 'morph.update', deviceId: 'anthem-001', payload: { progress: 0.5 } });
```

Emitted envelopes: morph.started, morph.progress, automation.started, automation.stopped.

## With psyboss
PsyBossAnthemAdapter exposes startMorph / updateMorph / startAutomation /
stopAutomation that forward envelopes to the hosted engine.

## Examples & tests
- examples/17-scene-morphing.ts - bezier morph over 8 bars
- examples/18-live-automation.ts - exponential velocity fade with auto-completion
- tests/morphing/scene-morpher.test.ts - curves, blending, config interpolation
- tests/integration/psybus-automation.test.ts - velocity/pitch automation, auto-stop
