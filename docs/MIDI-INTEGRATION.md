# PSY ANTHEM — MIDI Integration

How the engine's output becomes sound in the real world.

## File format

toMidi() produces a Standard MIDI File:

- Format: 1 (multi-track, synchronous)
- Division: 480 ticks per quarter note
- Tracks: one per voice channel present in the output
- Track 0 carries the meta events: track name, tempo (FF 51 03), time signature 4/4 (FF 58 04)
- Every track: program change at tick 0, then note on/off pairs, then End-Of-Track (FF 2F 00)
- No running status; every message carries its status byte (maximum DAW compatibility)
- Note-off is a real 0x80 message (velocity 0), with off-before-on ordering at identical ticks

## Channel / voice mapping

| Channel | Voice | GM Program | Suggested device |
|---------|-------|-----------|------------------|
| 0 | Lead | 0 (Acoustic Grand — swap for your lead synth) | psysynth supersaw patch |
| 1 | Harmony | 80 (Lead 1 square) | psysynth softer cutoff |
| 2 | Counter | 24 (Nylon Guitar) | psysynth pluck/wavetable |
| 3 | Bass | 33 (Electric Bass finger) | psysynth sub patch, sidechained |

Override with toMidi(out, { programs: [0, 80, 24, 33] }) or any GM mapping you prefer.

## Importing into a DAW

1. Ableton Live: File → Import → choose the .mid. Each track becomes a MIDI clip; assign instruments per channel.
2. FL Studio: drag the .mid into the playlist or channel rack.
3. Logic Pro: File → Import → MIDI file.
4. Reaper: drag into the arrange view; choose import as multichannel (one item per track).
5. Hardware: send via a USB-MIDI host or a DAW's MIDI out — the file is tempo-embedded (default 140 BPM).

## Tempo and timing

- BPM comes from config.bpm (default 140) and is written as a meta tempo event (microseconds per quarter).
- Timestamps are in beats (quarter notes); the encoder multiplies by the division (480) and rounds to ticks.
- Humanized micro-timing from the expression engine is preserved at tick resolution.

## Programmatic use

```ts
import { toMidi, writeMidiFile } from 'psy-anthem/src/export';

const bytes = toMidi(output, { bpm: 140 });        // Uint8Array
writeMidiFile(output, 'anthem.mid', { bpm: 140 }); // disk
```

## Why the export module is not in the browser bundle

src/index.ts (the browser entry) intentionally does not import src/export — writeMidiFile depends on node:fs. The browser demo visualizes; the Node/bun side exports. This keeps the bundle under the 20KB gate.
