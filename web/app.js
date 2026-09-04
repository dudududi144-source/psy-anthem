// PSY ANTHEM — v7.1 professional UI
// Architecture (see MEMORY.md):
//   compose (engine, main thread, <100ms) -> render (Web Worker, never blocks
//   the UI) -> <audio> element playback (the proven path on every machine).
// One reliable path. No experimental modes. No stuck states.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';

const $ = (id) => document.getElementById(id);
console.info('[PSY ANTHEM] v7.1 professional build loaded');

// ---------- state ----------
let anthem = null;       // AnthemOutput
let anthemCfg = null;
let audioUrl = null;
let peaks = null;        // Float32Array waveform buckets
let musicalSeconds = 0;  // song length (without render tail)
let renderId = 0;
let worker = null;
let generating = false;
let workerBroken = false;

const audio = $('audio');
const playBtn = $('playBtn');
const seek = $('seek');

// ---------- status ----------
function setStatus(msg, mode) {
  const el = $('statusLine');
  if (el) el.textContent = msg;
  const chip = $('statusChip');
  if (chip) chip.className = 'chip ' + (mode || 'idle');
}

// ---------- worker ----------
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker('./render-worker.js', { type: 'module' });
  worker.onmessage = (msg) => {
    const d = msg.data;
    if (!d || d.id !== renderId) return; // stale render
    if (d.type === 'progress') {
      setStatus('Rendering audio… ' + d.percent + '%', 'busy');
    } else if (d.type === 'done') {
      finishRender(d);
    } else if (d.type === 'error') {
      setStatus('Render failed: ' + d.message, 'err');
      console.error('[PSY ANTHEM] worker render error:', d.message);
    }
  };
  worker.onerror = (e) => {
    console.error('[PSY ANTHEM] worker error:', e.message);
    workerBroken = true;
    if (anthem) renderOnMain(); // automatic fallback, never leave the user stuck
  };
  return worker;
}

function requestRender() {
  if (!anthem) return;
  stopPlayback();
  if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch (e) { /* ignore */ } audioUrl = null; }
  renderId++;
  setStatus('Rendering audio… 0%', 'busy');
  setTransportEnabled(false);
  if (workerBroken) { renderOnMain(); return; }
  ensureWorker().postMessage({ type: 'render', id: renderId, events: anthem.events, bpm: anthemCfg.bpm });
}

// Fallback: render on the main thread if the Worker cannot run in this
// browser. Slightly blocking, but the product never fails to produce audio.
async function renderOnMain() {
  const myId = renderId;
  try {
    const mod = await import('./render-core.js');
    if (myId !== renderId) return; // stale
    const out = mod.renderSong(anthem.events, anthemCfg.bpm, (p) => {
      if (myId === renderId) setStatus('Rendering audio… ' + p + '%', 'busy');
    });
    if (myId !== renderId) return;
    finishRender({ buffer: out.wav.buffer, peaks: out.peaks, seconds: out.seconds });
  } catch (e) {
    setStatus('Render failed: ' + (e && e.message ? e.message : String(e)), 'err');
    console.error('[PSY ANTHEM] main-thread render error:', e);
  }
}

function finishRender(d) {
  const bytes = new Uint8Array(d.buffer);
  audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  peaks = d.peaks;
  musicalSeconds = d.seconds;
  audio.src = audioUrl;
  audio.load();
  drawWaveform();
  setTransportEnabled(true);
  setStatus('Ready — press play', 'ready');
  console.info('[PSY ANTHEM] render complete:', Math.round(musicalSeconds) + 's');
}

function setTransportEnabled(on) {
  playBtn.disabled = !on;
  seek.disabled = !on;
  $('stopBtn').disabled = !on;
}

// ---------- generate ----------
async function generate() {
  if (generating) return;
  generating = true;
  const btn = $('generate');
  btn.disabled = true;
  try {
    const cfg = readConfig();
    setStatus('Composing…', 'busy');
    await new Promise((r) => setTimeout(r, 0));
    const out = createAnthemEngine(cfg).generate();
    if (!out) { setStatus('Composition failed — try another seed', 'err'); return; }
    anthem = out;
    anthemCfg = cfg;
    renderRoll(out, cfg);
    renderStats(out);
    requestRender();
  } catch (e) {
    setStatus('Error: ' + (e && e.message ? e.message : String(e)), 'err');
    console.error('[PSY ANTHEM] generate error:', e);
  } finally {
    generating = false;
    btn.disabled = false;
  }
}

// ---------- transport ----------
function togglePlay() {
  if (!audioUrl) return;
  if (audio.paused) {
    audio.play().then(() => {}).catch(() => setStatus('Playback blocked — press play again', 'err'));
  } else {
    audio.pause();
  }
}
function stopPlayback() {
  if (!audio.paused) audio.pause();
  audio.currentTime = 0;
  updatePlayhead();
}

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

function updatePlayhead() {
  const dur = audio.duration && isFinite(audio.duration) ? audio.duration : (musicalSeconds || 1);
  const frac = Math.min(1, (audio.currentTime || 0) / dur);
  const wh = $('waveHead'); if (wh) wh.style.left = (frac * 100) + '%';
  const rh = $('rollHead'); if (rh) rh.style.left = (frac * 100) + '%';
  $('timeRead').textContent = fmt(audio.currentTime || 0) + ' / ' + fmt(Math.min(dur, musicalSeconds || dur));
  if (document.activeElement !== seek) seek.value = String(Math.round(frac * 1000));
}

let rafId = 0;
function startLoop() {
  cancelAnimationFrame(rafId);
  const step = () => {
    updatePlayhead();
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}
audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; playBtn.title = 'Pause'; startLoop(); });
audio.addEventListener('pause', () => { playBtn.textContent = '▶'; playBtn.title = 'Play'; updatePlayhead(); });
audio.addEventListener('ended', () => { playBtn.textContent = '▶'; updatePlayhead(); });

// ---------- waveform ----------
function drawWaveform() {
  const cv = $('wave');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = cv.getBoundingClientRect();
  const W = Math.max(50, Math.floor(rect.width)), H = Math.max(40, Math.floor(rect.height));
  cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!peaks) return;
  const mid = H / 2;
  const n = peaks.length;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    const h = Math.max(1, peaks[i] * (H * 0.46));
    const t = i / n;
    const hue = 190 + t * 120;
    g.fillStyle = 'hsla(' + hue + ', 90%, 62%, 0.9)';
    g.fillRect(i * bw, mid - h, Math.max(1, bw - 0.6), h * 2);
  }
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
}

// ---------- piano roll ----------
const VOICE_COLORS = ['#ff2ec4', '#2ee6ff', '#a06bff', '#ffb02e'];
function renderRoll(out, cfg) {
  const cv = $('roll');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = cv.getBoundingClientRect();
  const W = Math.max(50, Math.floor(rect.width)), H = Math.max(50, Math.floor(rect.height));
  cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#070a14'; g.fillRect(0, 0, W, H);
  const notes = out.events.filter((e) => e.type === 'note');
  const beats = Math.max(1, cfg.bars * 4);
  if (notes.length === 0) return;
  let minP = 127, maxP = 0;
  for (const n of notes) { if (n.data.pitch < minP) minP = n.data.pitch; if (n.data.pitch > maxP) maxP = n.data.pitch; }
  minP = Math.max(0, minP - 2); maxP = Math.min(127, maxP + 2);
  const rows = maxP - minP + 1, rowH = H / rows;
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (let b = 0; b <= cfg.bars; b++) { const x = (b * 4 / beats) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (const n of notes) {
    const x = (n.timestamp / beats) * W;
    const w = Math.max(3, (n.duration / beats) * W - 1.5);
    const y = H - (n.data.pitch - minP + 1) * rowH + 0.5;
    const h = Math.max(2.5, rowH - 1.5);
    g.fillStyle = VOICE_COLORS[n.channel % 4];
    g.globalAlpha = 0.35 + (n.data.velocity / 127) * 0.6;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
}

// ---------- stats ----------
function renderStats(out) {
  const meta = out.metadata || {};
  const el = $('stats');
  if (!el) return;
  el.innerHTML = '';
  const items = [
    ['Notes', out.events.length],
    ['Bars', meta.bars || '—'],
    ['Compose', (meta.generationTimeMs || 0) + 'ms'],
    ['Quality', meta.quality || '—'],
  ];
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = '<b>' + it[1] + '</b><span>' + it[0] + '</span>';
    el.appendChild(d);
  }
}

// ---------- config ----------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function readConfig() {
  return {
    seed: parseInt($('seed').value, 10) || 0,
    intent: $('intent').value,
    scale: { root: parseInt($('root').value, 10) || 0, mode: 'minor' },
    energyCurve: $('curve').value,
    targetRange: { min: 48, max: 84 },
    voices: 3,
    bars: parseInt($('bars').value, 10) || 16,
    bpm: 140,
  };
}
function fill(id, list) {
  const sel = $(id);
  if (!sel) return;
  sel.innerHTML = '';
  for (const it of list) {
    const o = document.createElement('option');
    o.value = it.v; o.textContent = it.t;
    sel.appendChild(o);
  }
}
function buildControls() {
  fill('intent', [
    { v: AnthemIntent.EUPHORIC_TRANCE, t: 'Euphoric Trance' },
    { v: AnthemIntent.PROGRESSIVE, t: 'Progressive' },
    { v: AnthemIntent.DARK_PSY, t: 'Dark Psy' },
    { v: AnthemIntent.FULL_ON, t: 'Full-On' },
    { v: AnthemIntent.EMOTIONAL_BREAKDOWN, t: 'Emotional' },
    { v: AnthemIntent.FOREST, t: 'Forest' },
  ]);
  fill('curve', [
    { v: EnergyCurve.ARC, t: 'Arc' },
    { v: EnergyCurve.BUILD_DROP, t: 'Build → Drop' },
    { v: EnergyCurve.WAVE, t: 'Wave' },
    { v: EnergyCurve.FLAT, t: 'Flat' },
  ]);
  fill('root', NOTE_NAMES.map((n, i) => ({ v: String(i), t: n })));
  fill('bars', [8, 16, 24, 32].map((b) => ({ v: String(b), t: String(b) + ' bars' })));
  $('bars').value = '16';
}

// ---------- exports ----------
function downloadWav() {
  if (!audioUrl) { setStatus('Generate first', 'err'); return; }
  const a = document.createElement('a');
  a.href = audioUrl;
  a.download = 'psy-anthem-seed' + (anthemCfg ? anthemCfg.seed : 0) + '.wav';
  document.body.appendChild(a); a.click(); a.remove();
}
function downloadMidi() {
  if (!anthem || !anthemCfg) { setStatus('Generate first', 'err'); return; }
  import('./midi-lite.mjs').then((m) => m.downloadMidi(anthem, anthemCfg)).catch(() => setStatus('MIDI export unavailable', 'err'));
}

// ---------- init ----------
try {
  buildControls();
  $('generate').addEventListener('click', generate);
  $('random').addEventListener('click', () => { $('seed').value = String(Math.floor(Math.random() * 2147483647)); generate(); });
  playBtn.addEventListener('click', togglePlay);
  $('stopBtn').addEventListener('click', stopPlayback);
  $('dlWav').addEventListener('click', downloadWav);
  $('dlMidi').addEventListener('click', downloadMidi);
  seek.addEventListener('input', () => {
    const dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
    if (dur > 0) audio.currentTime = (parseInt(seek.value, 10) / 1000) * dur;
    updatePlayhead();
  });
  window.addEventListener('keydown', (ev) => {
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (ev.code === 'Space') { ev.preventDefault(); togglePlay(); }
    else if (ev.key === 'g' || ev.key === 'G') generate();
  });
  window.addEventListener('resize', () => { if (anthem && anthemCfg) { renderRoll(anthem, anthemCfg); drawWaveform(); } });
  setTransportEnabled(false);
  setStatus('Loading…', 'idle');
  generate();
} catch (e) {
  setStatus('Startup error: ' + (e && e.message ? e.message : String(e)), 'err');
  console.error('[PSY ANTHEM] startup error:', e);
}
