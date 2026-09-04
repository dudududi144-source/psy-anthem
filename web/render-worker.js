// PSY ANTHEM — render-worker.js (v7.1)
// Thin Web Worker wrapper around render-core.js: keeps the heavy rendering
// off the main thread. Loaded as a module worker from app.js.
import { renderSong } from './render-core.js';

self.onmessage = (msg) => {
  const d = msg.data;
  if (!d || d.type !== 'render') return;
  try {
    const out = renderSong(d.events, d.bpm, (percent) => {
      self.postMessage({ type: 'progress', id: d.id, percent: percent });
    }, d.opts || null);
    self.postMessage(
      { type: 'done', id: d.id, seconds: out.seconds, peaks: out.peaks, names: out.names, buffer: out.wav.buffer },
      [out.wav.buffer, out.peaks.buffer]
    );
  } catch (e) {
    self.postMessage({ type: 'error', id: d.id, message: String(e && e.message ? e.message : e) });
  }
};
