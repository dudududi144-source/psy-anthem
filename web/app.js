// PSY ANTHEM — clean build v6.0
// One playback path only (the proven one — see MEMORY.md):
//   generate -> render WAV (offline full-quality, pure-JS fallback)
//   -> visible <audio controls> player.
// No live WebAudio playback. No test beeps. No experimental modes.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';
import { PsySynthBrowser, audioBufferToWav } from './synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from './presets.js';

const $ = (id) => document.getElementById(id);
console.info('[PSY ANTHEM] clean build v6.0 loaded');

// ---------- state ----------
let synth = null;
let anthem = null;   // AnthemOutput
let anthemCfg = null;
let wavUrl = null;
let busy = false;

// ---------- offline synth (rendering only) ----------
function ensureSynth() {
  if (synth) return synth;
  const AC = window.AudioContext || window.webkitAudioContext;
  synth = new PsySynthBrowser(new AC(), { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return synth;
}

// ---------- pure-JS WAV synth (zero WebAudio - guaranteed fallback) ----------
function floatToWav16(data, sr) {
  const n = data.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    o += 2;
  }
  return new Uint8Array(ab);
}
function eventsToWav(events, bpm) {
  const sr = 44100;
  const spb = 60 / Math.max(1, bpm);
  let endSec = 0;
  const notes = [];
  for (const e of events) {
    if (e.type !== 'note') continue;
    const start = e.timestamp * spb;
    const dur = Math.max(0.05, e.duration * spb);
    notes.push({ start: start, dur: dur, freq: 440 * Math.pow(2, (e.data.pitch - 69) / 12), vel: (e.data.velocity || 100) / 127 });
    if (start + dur > endSec) endSec = start + dur;
  }
  if (notes.length === 0) return null;
  const total = Math.ceil((endSec + 0.5) * sr);
  const buf = new Float32Array(total);
  for (const n of notes) {
    const s0 = Math.floor(n.start * sr);
    const len = Math.floor(n.dur * sr);
    const amp = 0.25 * n.vel;
    const a = 0.008, r = Math.min(0.06, n.dur * 0.4);
    for (let i = 0; i < len && s0 + i < total; i++) {
      const t = i / sr;
      let env;
      if (t < a) env = t / a;
      else if (t > n.dur - r) env = Math.max(0, (n.dur - t) / r);
      else env = 1;
      const w = 2 * Math.PI * n.freq * t;
      buf[s0 + i] += (Math.sin(w) * 0.7 + Math.sin(2 * w) * 0.2 + Math.sin(3 * w) * 0.1) * env * amp;
    }
  }
  for (let i = 0; i < total; i++) buf[i] = Math.tanh(buf[i] * 1.4) * 0.9;
  return floatToWav16(buf, sr);
}

// ---------- config ----------
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

// ---------- render (offline full quality, pure-JS fallback) ----------
function toUrl(bytes) {
  if (wavUrl) { try { URL.revokeObjectURL(wavUrl); } catch (e) { /* ignore */ } }
  wavUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  return wavUrl;
}
async function renderWav(events, bpm) {
  // 1) full-quality offline render
  try {
    const s = ensureSynth();
    const buffer = await s.renderOffline(events, bpm, 0);
    if (buffer) {
      const bytes = await audioBufferToWav(buffer);
      if (bytes) return toUrl(bytes);
    }
  } catch (e) { /* fall through to the guaranteed path */ }
  // 2) guaranteed pure-JS fallback
  const bytes = eventsToWav(events, bpm);
  return bytes ? toUrl(bytes) : null;
}

// ---------- status ----------
function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg;
}

// ---------- generate + render ----------
async function generate() {
  if (busy) return;
  busy = true;
  const btn = $('generate');
  if (btn) btn.disabled = true;
  try {
    const cfg = readConfig();
    setStatus('Generating…');
    const out = createAnthemEngine(cfg).generate();
    if (!out) { setStatus('Generation failed — try another seed'); return; }
    anthem = out;
    anthemCfg = cfg;
    renderRoll(out, cfg);
    renderStats(out);
    setStatus('Rendering audio… (this can take a few seconds)');
    await new Promise((r) => setTimeout(r, 30)); // let the status paint
    const url = await renderWav(out.events, cfg.bpm);
    if (!url) { setStatus('Audio render failed — try again'); return; }
    const player = $('player');
    player.src = url;
    player.load();
    setStatus('Ready — press play ▶');
  } catch (e) {
    setStatus('Error: ' + (e && e.message ? e.message : String(e)));
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
}

// ---------- playback ----------
function play() {
  const player = $('player');
  if (!player || !player.src) { setStatus('Generate first'); return; }
  player.play().then(() => setStatus('Playing…')).catch(() => setStatus('Press ▶ on the player below'));
}

// ---------- piano roll (simple, cached draw) ----------
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
    ['notes', out.events.length],
    ['bars', meta.bars || '—'],
    ['time', (meta.generationTimeMs || 0) + 'ms'],
    ['quality', meta.quality || '—'],
  ];
  for (const it of items) {
    const d = document.createElement('span');
    d.className = 'stat';
    d.innerHTML = '<b>' + it[1] + '</b>' + it[0];
    el.appendChild(d);
  }
}

// ---------- exports ----------
function downloadWav() {
  if (!wavUrl) { setStatus('Generate first'); return; }
  const a = document.createElement('a');
  a.href = wavUrl;
  a.download = 'psy-anthem-seed' + (anthemCfg ? anthemCfg.seed : 0) + '.wav';
  document.body.appendChild(a); a.click(); a.remove();
}
function downloadMidi() {
  if (!anthem || !anthemCfg) { setStatus('Generate first'); return; }
  import('./midi-lite.mjs').then((m) => m.downloadMidi(anthem, anthemCfg)).catch(() => setStatus('MIDI export unavailable'));
}

// ---------- controls ----------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
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
  fill('bars', [8, 16, 24, 32].map((b) => ({ v: String(b), t: String(b) })));
  const bs = $('bars'); if (bs) bs.value = '16';
  $('generate').addEventListener('click', generate);
  $('play').addEventListener('click', play);
  $('random').addEventListener('click', () => { $('seed').value = String(Math.floor(Math.random() * 2147483647)); generate(); });
  $('dlWav').addEventListener('click', downloadWav);
  $('dlMidi').addEventListener('click', downloadMidi);
  window.addEventListener('keydown', (ev) => {
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (ev.code === 'Space') { ev.preventDefault(); play(); }
    else if (ev.key === 'g' || ev.key === 'G') generate();
  });
}

// ---------- init ----------
buildControls();
setStatus('Loading…');
generate();
