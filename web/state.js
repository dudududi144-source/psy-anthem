// PSY ANTHEM - web/state.js
// Minimal observable state store: a single source of truth for shell-level
// status/error. Deliberately tiny and dependency-free (the web demo ships as
// static files with no build step).

export function createStateStore(initial) {
  let state = Object.assign({}, initial);
  const listeners = new Set();
  return {
    get(key) {
      return state[key];
    },
    snapshot() {
      return Object.assign({}, state);
    },
    set(patch) {
      const changed = [];
      for (const key of Object.keys(patch)) {
        if (state[key] !== patch[key]) changed.push(key);
      }
      if (changed.length === 0) return;
      state = Object.assign({}, state, patch);
      for (const fn of Array.from(listeners)) {
        try { fn(state, changed); } catch (e) { /* one bad listener must not break the rest */ }
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
