// PSY ANTHEM — foundation-shim/transport-musical.ts
// VERBATIM excerpts from psy-foundation packages/transport/src/types.ts
// (pinned eb3c663f) — exactly the types protocol.ts (v1) references.

export type AudioTime = number
export type ObservedBeatTime = number
export type EstimatedBeatTime = number
export type PredictedBeatTime = number

export interface BeatObservation {
  observedAt: AudioTime
  strength: number
  source?: string
}

export interface MusicalTransport {
  bpm: number
  beat: number
  bar: number
  beatsPerBar: number
  beatTime: EstimatedBeatTime
  barTime: number
  phase: number
  barPhase: number
  confidence: number
  locked: boolean
  revision: number
  origin: { audioTime: AudioTime; beatIndex: number; bpm: number }
  lastObservationAgo: number
  observationCount: number
}
