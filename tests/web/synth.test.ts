// PSY ANTHEM - tests/web/synth.test.ts
// The browser synth's pure scheduling math (no AudioContext needed).
import { describe, it, expect } from 'bun:test';
import { scheduleEvents, midiToFreq } from '../../web/synth.js';

function note(pitch, timestamp, duration, velocity = 90, articulation) {
  const data = articulation !== undefined ? { pitch, velocity, articulation } : { pitch, velocity };
  return { type: 'note', timestamp, duration, channel: 0, data };
}

describe('midiToFreq', () => {
  it('A4 (69) is 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
  });
  it('octave doubles frequency', () => {
    expect(midiToFreq(81) / midiToFreq(69)).toBeCloseTo(2, 5);
  });
});

describe('scheduleEvents', () => {
  const events = [
    note(60, 0, 1),
    note(64, 1, 1),
    note(67, 2, 2),
  ];

  it('converts beats to seconds using bpm', () => {
    const plan = scheduleEvents(events, 120, 0); // 0.5 sec/beat
    expect(plan.notes.length).toBe(3);
    expect(plan.notes[0].startAt).toBeCloseTo(0, 5);
    expect(plan.notes[1].startAt).toBeCloseTo(0.5, 5);
    expect(plan.notes[2].startAt).toBeCloseTo(1.0, 5);
    expect(plan.notes[0].duration).toBeCloseTo(0.5, 5);
    expect(plan.totalSeconds).toBeCloseTo(2.0, 5); // ends at beat 4
  });

  it('skips notes that end before the start beat and offsets the rest', () => {
    const plan = scheduleEvents(events, 120, 2.5);
    expect(plan.notes.length).toBe(1); // only the note spanning beats 2..4 survives
    expect(plan.notes[0].startBeat).toBe(2.5); // clipped to the start point
    expect(plan.notes[0].startAt).toBeCloseTo(0, 5); // plays immediately
    expect(plan.notes[0].duration).toBeCloseTo(0.75, 5); // 2 beats minus 0.5 already elapsed
  });

  it('passes velocity and articulation through', () => {
    const evs = [note(60, 0, 1, 127, 'staccato')];
    const plan = scheduleEvents(evs, 120, 0);
    expect(plan.notes[0].velocity).toBeCloseTo(1, 5);
    expect(plan.notes[0].articulation).toBe('staccato');
  });

  it('sorts notes by start time', () => {
    const evs = [note(64, 1, 1), note(60, 0, 1)];
    const plan = scheduleEvents(evs, 120, 0);
    expect(plan.notes[0].pitch).toBe(60);
    expect(plan.notes[1].pitch).toBe(64);
  });
});
