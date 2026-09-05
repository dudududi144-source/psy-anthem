// PSY ANTHEM — foundation-shim/protocol.ts
// VERBATIM copy of psy-foundation packages/protocol/src/events.ts (v1 events).
// Pinned: psy-foundation@eb3c663f (foundation-v2.0.0 line, Task 17-a).
//
// HONESTY NOTE (Task 17): this v1 shape is SUPERSEDED on the family wire by
// PSYBUS v2 (psybus-v2-types.ts / psybus-v2-envelope.ts, also verbatim).
// The composition engine's internal event format does NOT match this file —
// it lives in src/internal-events.ts under its honest name. Mapping to the
// wire: src/integration/wire.ts.

import type { MusicalTransport } from './transport-musical.ts'

export type EventTime = number

export interface BeatEvent {
  type: 'beat'
  beat: number
  bar: number
  transport: MusicalTransport
  at: EventTime
}
export interface SectionEvent {
  type: 'section'
  section: string
  bar: number
  at: EventTime
}
export interface EnergyEvent {
  type: 'energy'
  energy: number
  at: EventTime
}
export interface DropEvent {
  type: 'drop'
  intensity: number
  at: EventTime
}
export interface NoteEvent {
  type: 'note'
  note: number
  velocity: number
  duration: number
  channel: string
  at: EventTime
}
export interface PatternEvent {
  type: 'pattern'
  patternId: string
  trackId: string
  at: EventTime
}

export type MusicalEvent =
  | BeatEvent
  | SectionEvent
  | EnergyEvent
  | DropEvent
  | NoteEvent
  | PatternEvent
export type EventOfType<T extends MusicalEvent['type']> = Extract<MusicalEvent, { type: T }>
