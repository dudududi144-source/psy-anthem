// PSY ANTHEM — src/internal-events.ts
// The composition engine's INTERNAL event format. This is NOT the family
// wire and NOT the psy-foundation protocol — Task 17 proved the old
// "foundation-shim/protocol.ts" (this file's previous home) never matched
// the real foundation protocol (v1 or v2). It is kept under its honest name
// because the engine, the web renderer, and the tests all speak it.
// The family wire lives in foundation-shim/psybus-v2-*.ts (verbatim) and
// src/integration/wire.ts maps this format onto it.

export type Articulation = 'legato' | 'staccato' | 'accent' | 'normal' | 'ghost';

export interface NoteData {
  pitch: number;      // MIDI 0-127
  velocity: number;   // 0-127
  articulation?: Articulation;
  tension?: boolean;  // intentional chromatic tension note (exempt from scale lint)
}

export interface ControlData {
  controller: number; // CC number
  value: number;      // 0-127
}

export interface ProgramData {
  program: number;
}

export interface MusicalEvent {
  type: 'note' | 'control' | 'program';
  timestamp: number;  // beats (0.25 = 16th at 4/4)
  duration: number;   // beats
  channel: number;    // 0-15
  data: NoteData | ControlData | ProgramData;
}
