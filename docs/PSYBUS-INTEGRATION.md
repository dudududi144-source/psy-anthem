# PSYBUS Integration Guide (Phase 11)

psy-anthem participates in PSYBUS (psyboss's typed bidirectional bus) through `PsyAnthemAdapter`.
The bus payload kinds mirror psyboss's `src/psybus/types.ts` (kept as a local shim - family pattern).

## Architecture

```
psy-anthem (composition engine, WHAT layer)
    |
PsyAnthemAdapter (bus participant)
    |  publishes: note / note.off / voice.count / error / control acks
    v
PSYBUS (psyboss host: transport clock, routing, provenance gate)
    |
    v
PsySynthPro / PsyDrum / MIDI / WebRTC adapters (sound)
```

## Inbound (to psy-anthem)

| Envelope payload | Effect |
|------------------|--------|
| transport | clock tick: bpm/beat/bar/phase/playing -> emit events at the new position |
| transport.start / transport.stop | play / stop (+ notes off on stop) |
| transport.seek | jump position (beats) |
| scene.load | generate a composition from AnthemConfig (control plane) |
| param.set | store param + param.ack |
| sidechain.duck | re-emit current events with ducked velocities |
| choke | notes off + composition.choke |

## Outbound (from psy-anthem)

| Payload | Meaning |
|---------|---------|
| note | real PSYBUS note envelope (track/note/vel/durBeats/channel) - consumed directly by synth/drum adapters |
| note.off | choke/stop note release |
| voice.count | telemetry (active notes) |
| error | generation / scene-load failures |
| scene.loaded / composition.events / device.status / device.telemetry / param.ack | control-plane acks (adapter-level) |

## Usage

```ts
import { PsyAnthemAdapter, InMemoryPSYBUS } from 'psy-anthem';

const bus = new InMemoryPSYBUS(42);
const anthem = new PsyAnthemAdapter({
  deviceId: 'anthem-001',
  seed: 42,
  send: (msg) => bus.publish(msg),
});
bus.register('anthem-001');

// Control plane:
anthem.loadScene('scene-001', config);
anthem.play(0);

// Bus plane (psyboss clock ticks):
anthem.handleEnvelope({
  rev: 1, seed: 42, src: 'boss', dst: 'broadcast', ts: 0,
  payload: { kind: 'transport', bpm: 140, beat: 0, bar: 0, phase: 0, playing: true, audioTime: 0 },
});
```

## Inside psyboss

`psyboss/src/psyboss/adapters/psy-anthem-adapter.ts` wraps a PsyAnthemAdapter behind psyboss's
`DeviceAdapter` base class (transport/param/choke subscriptions, telemetry publishing), and
`psyboss/src/psyboss/clock/anthem-clock-sync.ts` feeds the AudioWorklet clock position into it.

## Sidechain ducking

psy-anthem is WHAT-layer (no audio), so ducking is applied to the event stream: velocities of the
current composition are scaled by (1 - depth) and re-emitted as a ducked composition.events batch.
Audio devices interpret ducking on their side as well (psyboss sidechain envelopes).

## Testing

```bash
bun test tests/integration/psybus-adapter.test.ts   # 11 tests
bun run examples/16-psybus-integration.ts           # full headless loop
```
