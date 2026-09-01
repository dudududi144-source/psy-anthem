// PSY ANTHEM — foundation-shim/protocol.ts
// VERBATIM shim of psy-foundation protocol types (pinned). DO NOT EDIT freely.

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
