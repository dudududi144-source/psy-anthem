// PSY ANTHEM - tests/motif/transformer.test.ts
import { describe, it, expect } from 'bun:test';
import { applyTransform } from '../../src/motif/transformer';

describe('Motif Transformer', () => {
  const notes = [60, 62, 64, 67];
  const rhythm = [0.5, 0.5, 0.5, 1];

  it('TRANSPOSE shifts pitches', () => {
    const r = applyTransform(notes, rhythm, { type: 'TRANSPOSE', params: { degree: 3 } });
    expect(r.notes).toEqual([63, 65, 67, 70]);
    expect(r.rhythm).toEqual(rhythm);
  });

  it('RETROGRADE reverses', () => {
    const r = applyTransform(notes, rhythm, { type: 'RETROGRADE', params: {} });
    expect(r.notes).toEqual([67, 64, 62, 60]);
  });

  it('INVERT mirrors intervals', () => {
    const r = applyTransform(notes, rhythm, { type: 'INVERT', params: {} });
    expect(r.notes[0]).toBe(60);
    expect(r.notes[1]).toBe(58);
    expect(r.notes[2]).toBe(56);
    expect(r.notes[3]).toBe(53);
  });

  it('AUGMENT doubles durations', () => {
    const r = applyTransform(notes, rhythm, { type: 'AUGMENT', params: { factor: 2 } });
    expect(r.rhythm).toEqual([1, 1, 1, 2]);
  });

  it('DIMINISH halves durations with 0.25 floor', () => {
    const r = applyTransform(notes, rhythm, { type: 'DIMINISH', params: { factor: 2 } });
    expect(r.rhythm).toEqual([0.25, 0.25, 0.25, 0.5]);
  });

  it('TRUNCATE shortens', () => {
    const r = applyTransform(notes, rhythm, { type: 'TRUNCATE', params: { notes: 3 } });
    expect(r.notes.length).toBe(3);
    expect(r.notes).toEqual([60, 62, 64]);
  });

  it('EXTEND lengthens', () => {
    const r = applyTransform(notes, rhythm, { type: 'EXTEND', params: { notes: 2 } });
    expect(r.notes.length).toBe(notes.length + 2);
  });

  it('RHYTHMIC_SHIFT rotates durations', () => {
    const r = applyTransform(notes, rhythm, { type: 'RHYTHMIC_SHIFT', params: { steps: 1 } });
    expect(r.rhythm).toEqual([0.5, 0.5, 1, 0.5]);
    expect(r.notes).toEqual(notes);
  });

  it('ORNAMENT adds passing notes', () => {
    const r = applyTransform(notes, rhythm, { type: 'ORNAMENT', params: {} });
    expect(r.notes.length).toBe(notes.length + (notes.length - 1));
  });
});
