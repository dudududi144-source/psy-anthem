// PSY ANTHEM — clean build v6.3
// Playback model (MEMORY.md):
//   generate -> standard renderer (pure-JS stereo wavetable synth, no WebAudio)
//   -> visible <audio> player. Optional on-demand studio render (full engine
//   via OfflineAudioContext) upgrades the player if the machine completes it.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';
import { PsySynthBrowser, audioBufferToWav } from './synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from './presets.js';

const $ = (id) => document.getElementById(id);
console.info('[PSY ANTHEM] clean build v6.3 loaded');

// ---------- state ----------
let synth = null;
let anthem = null;
let anthemCfg = null;
let anthemKey = '';
let wavUrl = null;
let busy = false;

function ensureSynth() {
  if (synth) return synth;
  const AC = window.AudioContext || window.webkitAudioContext;
  synth = new PsySynthBrowser(new AC(), { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return synth;
}

// ============================================================
// Standard renderer: pure-JS stereo wavetable synth.
// Zero WebAudio involvement -> guaranteed on any machine.
// ============================================================
const TABLE_LEN = 2048;
function makeTable(kind) {
  const t = new Float32Array(TABLE_LEN + 1);
  for (let i = 0; i <= TABLE_LEN; i++) {
    const ph = (i / TABLE_LEN) * 2 * Math.PI;
    let v = 0;
    if (kind === 'saw') {
      for (let h = 1; h <= 24; h++) v += Math.sin(h * ph) / h; // band-limited saw
      v *= 0.55;
    } else if (kind === 'pad') {
      v = Math.sin(ph) + Math.sin(2 * ph) * 0.35 + Math.sin(3 * ph) * 0.15 + Math.sin(4 * ph) * 0.08;
      v *= 0.5;
    } else {
      v = Math.sin(ph);
    }
    t[i] = v;
  }
  return t;
}
let TABLE_SAW = null, TABLE_PAD = null, TABLE_SINE = null;
function ensureTables() {
  if (!TABLE_SAW) TABLE_SAW = makeTable('saw');
  if (!TABLE_PAD) TABLE_PAD = makeTable('pad');
  if (!TABLE_SINE) TABLE_SINE = makeTable('sine');
}
function tableAt(table, phase) {
  const i0 = phase | 0;
  const f = phase - i0;
  return table[i0] * (1 - f) + table[i0 + 1] * f;
}

// Per-channel voice recipes (psy-trance roles).
const VOICE_RECIPES = {
  0: { table: 'saw', unison: 3, detune: 0.0045, attack: 0.006, decay: 0.08, sustain: 0.75, release: 0.18, amp: 0.34, pan: 0.0, cutoff: 5200, kind: 'adsr' },
  1: { table: 'pad', unison: 2, detune: 0.0025, attack: 0.5, decay: 0.3, sustain: 0.85, release: 1.4, amp: 0.17, pan: -0.3, cutoff: 3800, kind: 'adsr' },
  2: { table: 'saw', unison: 1, detune: 0.0, attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.1, amp: 0.3, pan: 0.3, cutoff: 4200, kind: 'pluck' },
  3: { table: 'sine', unison: 1, detune: 0.0, attack: 0.004, decay: 0.05, sustain: 0.8, release: 0.08, amp: 0.5, pan: 0.0, cutoff: 8000, kind: 'bass' },
};

function stereoToWav16(channels, sr) {
  const ch = channels.length;
  const n = channels[0].length;
  const ab = new ArrayBuffer(44 + n * 2 * ch);
  const dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2 * ch, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2 * ch, true); dv.setUint16(32, 2 * ch, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2 * ch, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return new Uint8Array(ab);
}

function renderAnthemWav(events, bpm) {
  ensureTables();
  const sr = 44100;
  const spb = 60 / Math.max(1, bpm);
  let endSec = 0;
  const notes = [];
  for (const e of events) {
    if (e.type !== 'note') continue;
    const start = e.timestamp * spb;
    const dur = Math.max(0.05, e.duration * spb);
    notes.push({ start: start, dur: dur, freq: 440 * Math.pow(2, (e.data.pitch - 69) / 12), vel: (e.data.velocity || 100) / 127, ch: e.channel % 4 });
    if (start + dur > endSec) endSec = start + dur;
  }
  if (notes.length === 0) return null;
  const total = Math.ceil((endSec + 2.0) * sr); // tail for release + delay
  const L = new Float32Array(total);
  const R = new Float32Array(total);

  for (const n of notes) {
    const rec = VOICE_RECIPES[n.ch] || VOICE_RECIPES[0];
    const table = rec.table === 'saw' ? TABLE_SAW : (rec.table === 'pad' ? TABLE_PAD : TABLE_SINE);
    const s0 = Math.floor(n.start * sr);
    const len = Math.floor(n.dur * sr);
    const relLen = Math.floor(rec.release * sr);
    const amp = rec.amp * (0.5 + 0.5 * n.vel);
    const panL = Math.cos((rec.pan + 1) * Math.PI / 4);
    const panR = Math.sin((rec.pan + 1) * Math.PI / 4);
    const aLp = 1 - Math.exp(-2 * Math.PI * rec.cutoff / sr);

    for (let u = 0; u < rec.unison; u++) {
      const det = rec.unison > 1 ? (u / (rec.unison - 1) - 0.5) * 2 * rec.detune : 0;
      const inc = (n.freq * (1 + det)) * TABLE_LEN / sr;
      let phase = (u * 0.37 * TABLE_LEN) % TABLE_LEN;
      let lp = 0;
      const span = rec.kind === 'pluck' ? len : len + relLen;
      for (let i = 0; i < span && s0 + i < total; i++) {
        const t = i / sr;
        let env;
        if (rec.kind === 'pluck') {
          env = t < rec.attack ? t / rec.attack : Math.exp(-(t - rec.attack) / rec.decay);
        } else if (i < len) {
          if (t < rec.attack) env = t / rec.attack;
          else if (t < rec.attack + rec.decay) env = 1 - (1 - rec.sustain) * ((t - rec.attack) / rec.decay);
          else env = rec.sustain;
        } else {
          const tr = (i - len) / sr;
          env = rec.sustain * Math.max(0, 1 - tr / rec.release);
        }
        if (env <= 0.001) { phase += inc; if (phase >= TABLE_LEN) phase -= TABLE_LEN; continue; }
        const v = tableAt(table, phase) * env * amp / rec.unison;
        phase += inc;
        if (phase >= TABLE_LEN) phase -= TABLE_LEN;
        lp += aLp * (v - lp);
        const o = s0 + i;
        L[o] += lp * panL;
        R[o] += lp * panR;
      }
    }
  }

  // Tempo-synced cross-feedback delay (dotted 8th) for space/width.
  const dSamples = Math.max(1, Math.floor(0.75 * spb * sr));
  const bufL = new Float32Array(dSamples), bufR = new Float32Array(dSamples);
  const fb = 0.32, wet = 0.22;
  let w = 0;
  for (let i = 0; i < total; i++) {
    const inL = L[i], inR = R[i];
    const outL = bufL[w], outR = bufR[w];
    bufL[w] = inL + outL * fb;
    bufR[w] = inR + outR * fb;
    w = (w + 1) % dSamples;
    L[i] = inL + outR * wet;
    R[i] = inR + outL * wet;
  }

  // Normalize to a safe peak, then soft-clip for glue.
  let peak = 0.0001;
  for (let i = 0; i < total; i++) {
    const al = Math.abs(L[i]), ar = Math.abs(R[i]);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  const g = 0.88 / peak;
  for (let i = 0; i < total; i++) {
    L[i] = Math.tanh(L[i] * g * 1.15);
    R[i] = Math.tanh(R[i] * g * 1.15);
  }

  return stereoToWav16([L, R], sr);
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
function cfgKey(cfg) {
  return cfg.seed + ':' + cfg.bars + ':' + cfg.intent + ':' + cfg.energyCurve + ':' + cfg.scale.root;
}

// ---------- status ----------
function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg;
}

// ---------- URL helper ----------
function toUrl(bytes) {
  if (wavUrl) { try { URL.revokeObjectURL(wavUrl); } catch (e) { /* ignore */ } }
  wavUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  return wavUrl;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// ---------- generate (fast, never blocks) ----------
async function generate() {
  if (busy) return;
  busy = true;
  const btn = $('generate');
  if (btn) btn.disabled = true;
  try {
    const cfg = readConfig();
    setStatus('Generating…');
    await new Promise((r) => setTimeout(r, 0));
    const out = createAnthemEngine(cfg).generate();
    if (!out) { setStatus('Generation failed — try another seed'); return; }
    anthem = out;
    anthemCfg = cfg;
    anthemKey = cfgKey(cfg);
    renderRoll(out, cfg);
    renderStats(out);
    setStatus('Rendering audio…');
    await new Promise((r) => setTimeout(r, 0));
    const bytes = renderAnthemWav(out.events, cfg.bpm);
    if (!bytes) { setStatus('Audio render failed'); return; }
    const url = toUrl(bytes);
    const player = $('player');
    player.src = url;
    player.load();
    setStatus('Ready — press play ▶  (✨ Studio Render = full-engine version)');
    console.info('[PSY ANTHEM] standard stereo render ready:', out.events.length, 'events');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    setStatus('Error: ' + msg);
    console.error('[PSY ANTHEM] generate error:', e);
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
}

// ---------- studio render (full engine, on demand) ----------
async function hqRenderNow() {
  if (!anthem) { setStatus('Generate first'); return; }
  const btn = $('hqRender');
  if (btn) btn.disabled = true;
  const key = anthemKey;
  setStatus('Studio render running… (full engine — can take a while on this machine)');
  try {
    const s = ensureSynth();
    const buffer = await withTimeout(s.renderOffline(anthem.events, anthemCfg.bpm, 0), 120000);
    if (!buffer) { setStatus('Studio render unavailable here — standard audio stays'); return; }
    if (anthemKey !== key) { setStatus('Song changed — press ✨ again'); return; }
    const bytes = await audioBufferToWav(buffer);
    if (!bytes) { setStatus('Studio render encoding failed'); return; }
    const el = $('player');
    const wasPlaying = !el.paused;
    const t = el.currentTime || 0;
    el.src = toUrl(bytes);
    el.load();
    if (wasPlaying && t > 0.25) {
      el.currentTime = Math.min(t, el.duration || t);
      el.play().catch(() => {});
    }
    setStatus('Ready — STUDIO render (' + Math.round(buffer.duration) + 's) · press play ▶');
    console.info('[PSY ANTHEM] studio render complete:', Math.round(buffer.duration) + 's');
  } catch (e) {
    setStatus('Studio render failed — standard audio stays');
    console.warn('[PSY ANTHEM] studio render failed:', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- playback ----------
function play() {
  const player = $('player');
  if (!player || !player.src) { setStatus('Generate first'); return; }
  player.play().then(() => setStatus('Playing…')).catch(() => setStatus('Press ▶ on the player below'));
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
  $('hqRender').addEventListener('click', hqRenderNow);
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
try {
  buildControls();
  setStatus('Loading…');
  generate();
} catch (e) {
  const el = $('status');
  if (el) el.textContent = 'Startup error: ' + (e && e.message ? e.message : String(e));
  console.error('[PSY ANTHEM] startup error:', e);
}
