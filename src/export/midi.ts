// PSY ANTHEM - export/midi.ts
// Standard MIDI File (SMF) encoder - format 1, one track per voice.
// This module is Node/bun-side only (writeMidiFile uses node:fs).
// It is intentionally NOT re-exported from src/index.ts, so the browser
// bundle stays under the 20KB gate.

import type { AnthemOutput, MusicalEvent } from '../types';

export interface MidiEncodeOptions {
  bpm: number;
  division: number;      // ticks per quarter note
  programs: number[];    // GM program per voice channel
  trackNames: string[];  // track name per voice channel
}

export const DEFAULT_DIVISION = 480;
export const DEFAULT_PROGRAMS = [0, 80, 24, 33];
export const DEFAULT_TRACK_NAMES = ['Lead', 'Harmony', 'Counter', 'Bass'];

interface TrackEvent {
  tick: number;
  order: number;   // lower first at same tick (meta < off < on)
  bytes: number[];
}

function pushU32(out: number[], v: number): void {
  out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

function pushU16(out: number[], v: number): void {
  out.push((v >>> 8) & 0xff, v & 0xff);
}

// MIDI variable-length quantity.
export function encodeVarLen(value: number): number[] {
  const stack: number[] = [value & 0x7f];
  let v = value >>> 7;
  while (v > 0) {
    stack.push((v & 0x7f) | 0x80);
    v = v >>> 7;
  }
  const out: number[] = [];
  for (let i = stack.length - 1; i >= 0; i--) {
    out.push(stack[i]!);
  }
  return out;
}

function metaTempoEvent(bpm: number): number[] {
  const uspq = Math.round(60000000 / Math.max(1, bpm));
  return [0xff, 0x51, 0x03, (uspq >>> 16) & 0xff, (uspq >>> 8) & 0xff, uspq & 0xff];
}

function metaTimeSigEvent(): number[] {
  // 4/4: numerator 4, denominator 2^2, 24 clocks/metronome, 8 32nds per quarter
  return [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08];
}

function metaTrackNameEvent(name: string): number[] {
  const bytes: number[] = [0xff, 0x03];
  const nameBytes: number[] = [];
  for (let i = 0; i < name.length; i++) {
    nameBytes.push(name.charCodeAt(i) & 0x7f);
  }
  for (const b of encodeVarLen(nameBytes.length)) bytes.push(b);
  for (const b of nameBytes) bytes.push(b);
  return bytes;
}

function encodeTrackChunk(events: TrackEvent[]): number[] {
  const sorted = events.slice().sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let lastTick = 0;
  for (const ev of sorted) {
    const delta = ev.tick - lastTick;
    for (const b of encodeVarLen(delta)) body.push(b);
    for (const b of ev.bytes) body.push(b);
    lastTick = ev.tick;
  }
  // End of track
  for (const b of encodeVarLen(0)) body.push(b);
  body.push(0xff, 0x2f, 0x00);

  const chunk: number[] = [0x4d, 0x54, 0x72, 0x6b]; // 'MTrk'
  pushU32(chunk, body.length);
  for (const b of body) chunk.push(b);
  return chunk;
}
