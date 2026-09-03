// PSY ANTHEM - tests/web/state.test.ts
import { describe, it, expect } from 'bun:test';
import { createStateStore } from '../../web/state.js';

describe('createStateStore', () => {
  it('reads initial state', () => {
    const s = createStateStore({ status: 'ready', error: null });
    expect(s.get('status')).toBe('ready');
    expect(s.get('error')).toBeNull();
  });

  it('notifies subscribers on real changes only', () => {
    const s = createStateStore({ status: 'ready', error: null });
    let calls = 0;
    let lastChanged: string[] = [];
    s.subscribe((_state: Record<string, unknown>, changed: string[]) => { calls++; lastChanged = changed; });
    s.set({ status: 'playing' });
    expect(calls).toBe(1);
    expect(lastChanged).toEqual(['status']);
    s.set({ status: 'playing' }); // no-op
    expect(calls).toBe(1);
    expect(s.get('status')).toBe('playing');
  });

  it('unsubscribe stops notifications', () => {
    const s = createStateStore({ v: 1 });
    let calls = 0;
    const off = s.subscribe(() => { calls++; });
    off();
    s.set({ v: 2 });
    expect(calls).toBe(0);
    expect(s.get('v')).toBe(2);
  });

  it('snapshot is a defensive copy', () => {
    const s = createStateStore({ v: 1 });
    const snap = s.snapshot();
    s.set({ v: 2 });
    expect(snap.v).toBe(1);
  });

  it('a throwing listener does not break other listeners', () => {
    const s = createStateStore({ v: 1 });
    let second = 0;
    s.subscribe(() => { throw new Error('bad listener'); });
    s.subscribe(() => { second++; });
    expect(() => s.set({ v: 5 })).not.toThrow();
    expect(second).toBe(1);
  });
});
