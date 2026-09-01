// PSY ANTHEM - web/app.js (demo v2: generation + playback + downloads)
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';
import { PsySynthBrowser, midiToFreq } from './synth.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VOICE_COLORS = ['#ff2ec4', '#2ee6ff', '#a06bff', '#ffb02e'];
const VOICE_NAMES = ['Lead', 'Harmony', 'Counter', 'Bass'];
const MODES = ['minor', 'major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'harmonicMinor', 'melodicMinor', 'hungarianMinor', 'doubleHarmonicMajor'];
const MIDI_PROGRAMS = [0, 80, 24, 33];
const MIDI_DIVISION = 480;

const pitchName = (p) => NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);

// ---------- state ----------
const history = [];      // last 10 generations: { config, out }
let historyIndex = -1;
let synth = null;
let isPlaying = false;

// ---------- SMF encoder (browser port of src/export/midi.ts) ----------
function varLen(value) {
  const stack = [value & 0x7f];
  let v = value >>> 7;
  while (v > 0) {
    stack.push((v & 0x7f) | 0x80);
    v = v >>> 7;
  }
  return stack.reverse();
}

function pushU32(arr, v) { arr.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); }
function pushU16(arr, v) { arr.push((v >>> 8) & 0xff, v & 0xff); }

export function midiFromOutput(out, bpm) {
  const byChannel = new Map();
  for (const e of out.events) {
    if (e.type !== 'note') continue;
    if (!byChannel.has(e.channel)) byChannel.set(e.channel, []);
    byChannel.get(e.channel).push(e);
  }
  const channels = Array.from(byChannel.keys()).sort((a, b) => a - b);

  const tracks = [];
  for (const ch of channels) {
    const evs = byChannel.get(ch);
    const items = [];
    if (ch === channels[0]) {
      const uspq = Math.round(60000000 / Math.max(1, bpm));
      items.push({ tick: 0, order: -2, bytes: [0xff, 0x51, 0x03, (uspq >>> 16) & 0xff, (uspq >>> 8) & 0xff, uspq & 0xff] });
      items.push({ tick: 0, order: -1, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });
    }
    items.push({ tick: 0, order: 0, bytes: [0xc0 | (ch & 0x0f), MIDI_PROGRAMS[ch] ?? 0] });
    for (const e of evs) {
      const tickOn = Math.max(0, Math.round(e.timestamp * MIDI_DIVISION));
      const tickOff = tickOn + Math.max(1, Math.round(e.duration * MIDI_DIVISION));
      items.push({ tick: tickOff, order: 0, bytes: [0x80 | (ch & 0x0f), e.data.pitch & 0x7f, 0] });
      items.push({ tick: tickOn, order: 1, bytes: [0x90 | (ch & 0x0f), e.data.pitch & 0x7f, e.data.velocity & 0x7f] });
    }
    items.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const body = [];
    let last = 0;
    for (const it of items) {
      for (const b of varLen(it.tick - last)) body.push(b);
      for (const b of it.bytes) body.push(b);
      last = it.tick;
    }
    for (const b of varLen(0)) body.push(b);
    body.push(0xff, 0x2f, 0x00);
    const chunk = [0x4d, 0x54, 0x72, 0x6b];
    pushU32(chunk, body.length);
    for (const b of body) chunk.push(b);
    tracks.push(chunk);
  }

  const all = [0x4d, 0x54, 0x68, 0x64];
  pushU32(all, 6);
  pushU16(all, 1);
  pushU16(all, tracks.length);
  pushU16(all, MIDI_DIVISION);
  for (const t of tracks) for (const b of t) all.push(b);
  return Uint8Array.from(all);
}

function downloadBlob(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- controls ----------
function fillSelect(id, values, labels) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  for (let i = 0; i < values.length; i++) {
    const opt = document.createElement('option');
    opt.value = values[i];
    opt.textContent = labels ? labels[i] : values[i];
    el.appendChild(opt);
  }
}

function initControls() {
  const intents = Object.values(AnthemIntent);
  fillSelect('intent', intents, intents.map((s) => s.replace(/-/g, ' ')));
  document.getElementById('intent').value = AnthemIntent.EUPHORIC_TRANCE;
  const curves = [EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.FLAT];
  fillSelect('curve', curves);
  document.getElementById('curve').value = EnergyCurve.ARC;
  fillSelect('root', NOTE_NAMES.map((_, i) => String(i)), NOTE_NAMES);
  fillSelect('mode', MODES);
  fillSelect('density', ['sparse', 'medium', 'dense']);
  document.getElementById('density').value = 'medium';
  fillSelect('harmony', ['simple', 'standard', 'complex']);
  document.getElementById('harmony').value = 'standard';
  fillSelect('playFrom', ['0']);
}

function readConfig() {
  const cfg = {
    seed: parseInt(document.getElementById('seed').value, 10) || 0,
    intent: document.getElementById('intent').value,
    scale: {
      root: parseInt(document.getElementById('root').value, 10) || 0,
      mode: document.getElementById('mode').value,
    },
    energyCurve: document.getElementById('curve').value,
    targetRange: { min: 48, max: 84 },
    voices: parseInt(document.getElementById('voices').value, 10),
    bars: parseInt(document.getElementById('bars').value, 10),
    bpm: 140,
    density: document.getElementById('density').value,
    harmonyComplexity: document.getElementById('harmony').value,
    loopMode: document.getElementById('loopMode').checked,
    callResponse: document.getElementById('callResponse').checked,
  };
  if (cfg.energyCurve === EnergyCurve.CUSTOM) {
    cfg.customCurve = [
      { position: 0.0, energy: 0.25 }, { position: 0.2, energy: 0.9 },
      { position: 0.5, energy: 0.3 }, { position: 0.8, energy: 1.0 },
      { position: 1.0, energy: 0.2 },
    ];
  }
  return cfg;
}

function applyConfigToControls(cfg) {
  document.getElementById('seed').value = String(cfg.seed);
  document.getElementById('intent').value = cfg.intent;
  document.getElementById('root').value = String(cfg.scale.root);
  document.getElementById('mode').value = cfg.scale.mode;
  document.getElementById('curve').value = cfg.energyCurve;
  document.getElementById('voices').value = String(cfg.voices);
  document.getElementById('bars').value = String(cfg.bars);
  document.getElementById('density').value = cfg.density ?? 'medium';
  document.getElementById('harmony').value = cfg.harmonyComplexity ?? 'standard';
  document.getElementById('loopMode').checked = Boolean(cfg.loopMode);
  document.getElementById('callResponse').checked = Boolean(cfg.callResponse);
}

// ---------- generation + history ----------
function currentEntry() {
  return historyIndex >= 0 ? history[historyIndex] : null;
}

function generate() {
  hideError();
  const config = readConfig();
  let out = null;
  try {
    out = createAnthemEngine(config).generate();
  } catch (e) {
    showError('Config error: ' + e.message);
    return;
  }
  if (!out) {
    showError('Solver failed for this config. Try another seed.');
    return;
  }
  history.push({ config, out });
  if (history.length > 10) history.shift();
  historyIndex = history.length - 1;
  renderCurrent();
}

function navigate(delta) {
  const next = historyIndex + delta;
  if (next < 0 || next >= history.length) return;
  historyIndex = next;
  renderCurrent();
}

function renderCurrent() {
  const entry = currentEntry();
  if (!entry) return;
  stopPlayback();
  applyConfigToControls(entry.config);
  renderRoll(entry.out, entry.config);
  renderTension(entry.out, entry.config);
  renderChords(entry.out);
  renderMotif(entry.out);
  renderStats(entry.out, entry.config);
  renderPlayFrom(entry.config);
  updateNavButtons();
}

function updateNavButtons() {
  document.getElementById('prev').disabled = historyIndex <= 0;
  document.getElementById('next').disabled = historyIndex >= history.length - 1;
  document.getElementById('posLabel').textContent = history.length === 0 ? '' : (historyIndex + 1) + '/' + history.length;
}

function renderPlayFrom(config) {
  const sel = document.getElementById('playFrom');
  const cur = sel.value;
  sel.innerHTML = '';
  for (let b = 0; b < config.bars; b += 4) {
    const opt = document.createElement('option');
    opt.value = String(b);
    opt.textContent = 'bar ' + (b + 1);
    sel.appendChild(opt);
  }
  if (cur && parseInt(cur, 10) < config.bars) sel.value = cur;
}
