// PSY ANTHEM - web/app.js (demo v2: generation + playback + downloads)
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';
import { PsySynthBrowser, midiToFreq } from './synth.js';
import { PRESETS, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from './presets.js';

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
let playDurationSec = 0;   // total duration of current playback (seconds)
let playStartCtxTime = 0;  // ctx.currentTime when playback started
let progressRaf = 0;      // requestAnimationFrame id

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
    drums: document.getElementById('drums').checked,
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
  renderArtisticQuality(entry.out);
  renderPlayFrom(entry.config);
  updateNavButtons();
}

function renderArtisticQuality(out) {
  const el = document.getElementById('artisticPanel');
  if (!el) return;
  const meta = out.metadata;
  const score = meta.artisticQuality;
  if (score === undefined) { el.innerHTML = ''; return; }
  const bd = meta.artisticBreakdown || {};
  const issues = meta.artisticIssues || [];
  const suggestions = meta.artisticSuggestions || [];
  const pct = (v) => Math.round((v || 0) * 100);

  let html = '<div class="aq-score">' + score + '<span>/100</span></div>';
  html += '<div class="aq-grid">';
  html += '<div>Melodic Interest<div class="bar"><i style="width:' + pct(bd.melodicInterest) + '%"></i></div></div>';
  html += '<div>Harmonic Richness<div class="bar"><i style="width:' + pct(bd.harmonicRichness) + '%"></i></div></div>';
  html += '<div>Rhythmic Variety<div class="bar"><i style="width:' + pct(bd.rhythmicVariety) + '%"></i></div></div>';
  html += '<div>Textural Depth<div class="bar"><i style="width:' + pct(bd.texturalDepth) + '%"></i></div></div>';
  html += '<div>Emotional Arc<div class="bar"><i style="width:' + pct(bd.emotionalArc) + '%"></i></div></div>';
  html += '</div>';
  if (issues.length > 0) {
    html += '<div class="aq-issues">' + issues.map((i) => '! ' + i).join('<br>') + '</div>';
  }
  if (suggestions.length > 0) {
    html += '<div class="aq-suggest">' + suggestions.map((s) => '> ' + s).join('<br>') + '</div>';
  }
  el.innerHTML = html;
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

// ---------- rendering ----------
function svgEl(name, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
  return el;
}

function renderRoll(out, config) {
  const host = document.getElementById('roll');
  host.innerHTML = '';
  const events = out.events.filter((e) => e.type === 'note');
  if (events.length === 0) { host.textContent = 'No events.'; return; }
  let lo = 127, hi = 0;
  for (const e of events) { const p = e.data.pitch; if (p < lo) lo = p; if (p > hi) hi = p; }
  lo = Math.max(0, lo - 2); hi = Math.min(127, hi + 2);

  const totalBeats = config.bars * 4;
  const pxPerBeat = 26, rowH = 12;
  const rows = hi - lo + 1;
  const W = totalBeats * pxPerBeat + 46, H = rows * rowH + 8;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H });

  for (let p = lo; p <= hi; p++) {
    const y = H - 4 - (p - lo) * rowH;
    const isBlack = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
    if (isBlack) svg.appendChild(svgEl('rect', { x: 44, y: y - rowH, width: W - 46, height: rowH, fill: '#0d0a1a' }));
    if (((p % 12) + 12) % 12 === 0) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', 6); t.setAttribute('y', y - 3);
      t.setAttribute('fill', '#6f689c'); t.setAttribute('font-size', '9'); t.setAttribute('font-family', 'monospace');
      t.textContent = pitchName(p);
      svg.appendChild(t);
      svg.appendChild(svgEl('line', { x1: 44, y1: y, x2: W, y2: y, stroke: '#241f3d', 'stroke-width': 1 }));
    }
  }
  // Section markers: bar lines (strong every 4 bars)
  for (let b = 0; b <= config.bars; b++) {
    const x = 44 + b * 4 * pxPerBeat;
    svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, stroke: b % 4 === 0 ? '#3a3163' : '#241f3d', 'stroke-width': b % 4 === 0 ? 1.4 : 1 }));
  }
  // Notes: color=voice, width=duration, opacity=velocity, click=audition
  for (const e of events) {
    const x = 44 + e.timestamp * pxPerBeat;
    const w = Math.max(2, e.duration * pxPerBeat - 1.5);
    const y = H - 4 - (e.data.pitch - lo) * rowH - rowH + 1.5;
    const color = VOICE_COLORS[e.channel % 4] ?? '#ffffff';
    const rect = svgEl('rect', { x: x, y: y, width: w, height: rowH - 3, rx: 2.5, fill: color });
    rect.setAttribute('opacity', String(0.45 + (e.data.velocity / 127) * 0.55));
    rect.style.cursor = 'pointer';
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = pitchName(e.data.pitch) + ' | ' + VOICE_NAMES[e.channel % 4] + ' | vel ' + e.data.velocity;
    rect.appendChild(title);
    rect.addEventListener('click', () => auditionNote(e.data.pitch, e.data.velocity));
    svg.appendChild(rect);
  }
  host.appendChild(svg);

  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  for (let v = 0; v < config.voices; v++) {
    const s = document.createElement('span');
    const d = document.createElement('i');
    d.className = 'dot'; d.style.background = VOICE_COLORS[v];
    s.appendChild(d);
    s.appendChild(document.createTextNode(VOICE_NAMES[v] + ' (ch ' + v + ')'));
    legend.appendChild(s);
  }
}

function renderTension(out, config) {
  const host = document.getElementById('tension');
  host.innerHTML = '';
  const curve = out.harmonicAnalysis.tensionCurve;
  const W = 800, H = 90;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#0a0815' }));
  for (let g = 0; g <= 4; g++) {
    const y = 6 + (H - 12) * (g / 4);
    svg.appendChild(svgEl('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#1a1630', 'stroke-width': 1 }));
  }
  if (curve.length > 1) {
    let pts = '';
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * (W - 10) + 5;
      const y = H - 8 - curve[i] * (H - 16);
      pts += x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    svg.appendChild(svgEl('polygon', { points: '5,' + (H - 8) + ' ' + pts + (W - 5) + ',' + (H - 8), fill: 'rgba(160,107,255,0.18)' }));
    svg.appendChild(svgEl('polyline', { points: pts, fill: 'none', stroke: '#a06bff', 'stroke-width': 2 }));
  }
  host.appendChild(svg);
}

function renderChords(out) {
  const host = document.getElementById('chords');
  host.innerHTML = '';
  const chords = out.harmonicAnalysis.chords;
  const totalBars = chords.reduce((s, c) => s + c.durationBars, 0) || 1;
  const W = 800, H = 54;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
  let x = 4;
  const colors = ['#ff2ec4', '#2ee6ff', '#a06bff', '#ffb02e', '#3dffa0'];
  for (let i = 0; i < chords.length; i++) {
    const c = chords[i];
    const w = (c.durationBars / totalBars) * (W - 8) - 4;
    const color = colors[i % colors.length];
    svg.appendChild(svgEl('rect', { x: x, y: 8, width: Math.max(24, w), height: 30, rx: 6, fill: 'rgba(20,17,38,1)', stroke: color, 'stroke-width': 1.2 }));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', String(x + Math.max(24, w) / 2)); t.setAttribute('y', '27');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', color);
    t.setAttribute('font-size', '12'); t.setAttribute('font-weight', 'bold'); t.setAttribute('font-family', 'monospace');
    t.textContent = NOTE_NAMES[((c.root % 12) + 12) % 12] + (c.quality === 'minor' ? 'm' : c.quality === 'dominant7' ? '7' : '');
    svg.appendChild(t);
    x += Math.max(24, w) + 4;
  }
  host.appendChild(svg);
}

function renderMotif(out) {
  const host = document.getElementById('motif');
  host.innerHTML = '';
  const dna = out.motifDNA;
  for (let i = 0; i < dna.coreNotes.length; i++) {
    const chip = document.createElement('div');
    chip.className = 'note-chip';
    const p = document.createElement('div'); p.className = 'p'; p.textContent = pitchName(dna.coreNotes[i]);
    const d = document.createElement('div'); d.className = 'd'; d.textContent = (dna.coreRhythm[i] || 0) + ' beats';
    chip.appendChild(p); chip.appendChild(d);
    host.appendChild(chip);
  }
}

function renderStats(out, config) {
  const host = document.getElementById('stats');
  host.innerHTML = '';
  const items = [
    ['seed', String(out.metadata.seed), true],
    ['intent', out.metadata.intent, false],
    ['bars', String(out.metadata.bars), false],
    ['voices', String(out.metadata.voices), false],
    ['events', String(out.events.length), false],
    ['chords', String(out.harmonicAnalysis.chords.length), false],
    ['memorability', out.metadata.memorabilityScore + '/100', true],
    ['quality', out.metadata.quality, out.metadata.quality === 'excellent' || out.metadata.quality === 'good'],
    ['time', out.metadata.generationTimeMs + 'ms', false],
  ];
  if (config.density) items.push(['density', config.density, false]);
  if (config.harmonyComplexity) items.push(['harmony', config.harmonyComplexity, false]);
  if (config.loopMode) items.push(['loop', 'on', true]);
  if (config.callResponse) items.push(['call/resp', 'on', true]);
  for (const it of items) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (it[2] ? ' hot' : '');
    const key = document.createElement('b'); key.textContent = it[0] + ': ';
    chip.appendChild(key);
    chip.appendChild(document.createTextNode(String(it[1])));
    host.appendChild(chip);
  }

  // Extended info panel
  const info = document.getElementById('infoPanel');
  info.innerHTML = '';
  const harmonicRhythm = (out.harmonicAnalysis.chords.length / Math.max(1, out.metadata.bars)).toFixed(2);
  const occurrences = out.motifDNA.occurrences.map((o) => 'bar ' + (o.bar + 1)).join(', ') || '-';
  const lines = [
    'harmonic rhythm: ' + harmonicRhythm + ' chords/bar',
    'motif occurrences: ' + occurrences,
    'tension peak: bar ' + (out.harmonicAnalysis.tensionCurve.indexOf(Math.max(...out.harmonicAnalysis.tensionCurve)) + 1),
  ];
  for (const ln of lines) {
    const div = document.createElement('div');
    div.textContent = ln;
    info.appendChild(div);
  }
}

// ---------- audio playback ----------
function ensureSynth() {
  if (!synth) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    synth = new PsySynthBrowser(new Ctx(), { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
    synth.onFinish = () => setPlaying(false);
    applyMacros();
  }
  return synth;
}

// ---------- presets & global macros ----------
const VOICE_TO_SELECT = { 0: 'preset-lead', 1: 'preset-harmony', 2: 'preset-counter', 3: 'preset-bass' };

function initPresetDropdowns() {
  const categoryByVoice = { 0: 'lead', 1: 'harmony', 2: 'counter', 3: 'bass' };
  for (const voiceStr of Object.keys(VOICE_TO_SELECT)) {
    const voice = parseInt(voiceStr, 10);
    const select = document.getElementById(VOICE_TO_SELECT[voice]);
    if (!select) continue;
    select.innerHTML = '';
    const category = PRESET_CATEGORIES[categoryByVoice[voice]];
    for (const presetId of category) {
      const opt = document.createElement('option');
      opt.value = presetId;
      opt.textContent = PRESETS[presetId].name;
      if (presetId === DEFAULT_VOICE_PRESETS[voice]) opt.selected = true;
      select.appendChild(opt);
    }
  }
}

function getCurrentPresets() {
  const out = {};
  for (const voiceStr of Object.keys(VOICE_TO_SELECT)) {
    const voice = parseInt(voiceStr, 10);
    const select = document.getElementById(VOICE_TO_SELECT[voice]);
    if (select) out[voice] = select.value;
  }
  return out;
}

function sliderValue(id, fallback) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) : fallback;
}

function applyMacros() {
  if (!synth) return;
  synth.setMasterCutoff(sliderValue('masterCutoff', 8000));
  synth.setReverbSend(sliderValue('reverbSend', 30) / 100);
  synth.setDelaySend(sliderValue('delaySend', 20) / 100);
  synth.setMasterDrive(sliderValue('masterDrive', 10) / 100);
  for (let ch = 0; ch < 4; ch++) {
    synth.setTrackVolume(ch, sliderValue('trackVol' + ch, 100) / 100);
  }
}

function setPlaying(state) {
  isPlaying = state;
  const btn = document.getElementById('play');
  btn.textContent = isPlaying ? 'PLAYING...' : 'PLAY';
  btn.disabled = isPlaying;
}

function setStatus(msg) {
  const el = document.getElementById('playStatus');
  if (el) el.textContent = msg;
}

async function play() {
  const entry = currentEntry();
  if (!entry) {
    showError('Generate an anthem first.');
    return;
  }
  try {
    setStatus('unlocking audio...');
    const s = ensureSynth();
    s.setPresets(getCurrentPresets());
    applyMacros();
    const fromBeat = parseInt(document.getElementById('playFrom').value, 10) || 0;
    const duration = await s.playEvents(entry.out.events, entry.config.bpm ?? 140, fromBeat);
    if (s.ctx.state !== 'running') {
      setStatus('AUDIO BLOCKED by the browser. Click TEST SOUND once, then PLAY again.');
      return;
    }
    setPlaying(true);
    setStatus('playing ' + duration.toFixed(1) + 's (' + entry.out.events.length + ' events)');
  } catch (e) {
    setStatus('AUDIO BLOCKED by browser - click TEST SOUND to unlock');
    showError('Playback error: ' + e.message);
    console.error(e);
  }
}

function stopPlayback() {
  if (synth) synth.stop();
  setPlaying(false);
  setStatus('stopped');
}

function auditionNote(pitch, velocity) {
  const s = ensureSynth();
  s.playNote(pitch, velocity);
  setStatus('audition: ' + pitchName(pitch) + (s.ctx.state === 'running' ? '' : ' (audio blocked!)'));
}

// Quick audibility check: C major triad via synth.testSound(), independent of any generation.
async function testSound() {
  try {
    setStatus('unlocking audio...');
    const s = ensureSynth();
    setStatus('playing test tones...');
    const duration = await s.testSound();
    setStatus(s.ctx.state === 'running'
      ? 'audio OK - 3 test tones (' + duration.toFixed(1) + 's)'
      : 'audio BLOCKED by browser autoplay policy - click again');
  } catch (e) {
    setStatus('AUDIO BLOCKED - click again to unlock');
    console.error(e);
  }
}

// ---------- export actions ----------
function copyConfig() {
  const entry = currentEntry();
  if (!entry) return;
  const text = JSON.stringify(entry.config, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flash('copyConfig', 'COPIED'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    flash('copyConfig', 'COPIED');
  }
}

function flash(id, label) {
  const el = document.getElementById(id);
  const original = el.dataset.label || el.textContent;
  el.dataset.label = original;
  el.textContent = label;
  setTimeout(() => { el.textContent = original; }, 1200);
}

function midiFileName(config) {
  return 'psy-anthem-' + config.seed + '-' + config.intent + '.mid';
}

function downloadMidi() {
  const entry = currentEntry();
  if (!entry) return;
  const bytes = midiFromOutput(entry.out, entry.config.bpm ?? 140);
  downloadBlob(bytes, midiFileName(entry.config), 'audio/midi');
  flash('downloadMidi', 'SAVED');
}

function downloadJson() {
  const entry = currentEntry();
  if (!entry) return;
  const text = JSON.stringify(entry.out, null, 2);
  downloadBlob(new TextEncoder().encode(text), 'psy-anthem-' + entry.config.seed + '.json', 'application/json');
  flash('downloadJson', 'SAVED');
}

// Offline-render the anthem to a WAV file and download it.
async function downloadWav() {
  const entry = currentEntry();
  if (!entry) { showError('Generate an anthem first.'); return; }
  try {
    setStatus('rendering audio offline...');
    const s = ensureSynth();
    s.setPresets(getCurrentPresets());
    applyMacros();
    const wav = await s.renderToWav(entry.out.events, entry.config.bpm ?? 140, 0);
    if (!wav) { showError('Offline rendering not supported in this browser.'); return; }
    downloadBlob(wav, 'psy-anthem-' + entry.config.seed + '.wav', 'audio/wav');
    setStatus('WAV exported (' + Math.round(wav.length / 1024) + ' KB)');
  } catch (e) {
    showError('WAV render error: ' + e.message);
  }
}

// Pause / resume the live audio context.
function pausePlayback() {
  if (!synth) return;
  if (synth.ctx.state === 'running') {
    synth.ctx.suspend();
    setStatus('paused');
  } else if (synth.ctx.state === 'suspended') {
    synth.ctx.resume();
    setStatus('resumed');
  }
}

// ---------- errors ----------
function showError(msg) {
  const el = document.getElementById('err');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('err').style.display = 'none';
}

// ---------- init ----------
function init() {
  initControls();
  document.getElementById('generate').addEventListener('click', generate);
  document.getElementById('random').addEventListener('click', () => {
    document.getElementById('seed').value = String(Math.floor(Math.random() * 1000000));
    generate();
  });
  initPresetDropdowns();
  for (const id of ['masterCutoff', 'reverbSend', 'delaySend', 'masterDrive']) {
    document.getElementById(id).addEventListener('input', applyMacros);
  }
  document.getElementById('play').addEventListener('click', play);
  document.getElementById('stop').addEventListener('click', stopPlayback);
  document.getElementById('testSound').addEventListener('click', testSound);
  document.getElementById('prev').addEventListener('click', () => navigate(-1));
  document.getElementById('next').addEventListener('click', () => navigate(1));
  document.getElementById('copyConfig').addEventListener('click', copyConfig);
  document.getElementById('downloadMidi').addEventListener('click', downloadMidi);
  document.getElementById('downloadJson').addEventListener('click', downloadJson);
  document.getElementById('downloadWav').addEventListener('click', downloadWav);
  document.getElementById('pause').addEventListener('click', pausePlayback);
  for (const id of ['seed', 'intent', 'curve', 'root', 'mode', 'voices', 'bars', 'density', 'harmony', 'loopMode', 'callResponse']) {
    document.getElementById(id).addEventListener('change', generate);
  }
  for (let ch = 0; ch < 4; ch++) {
    document.getElementById('trackVol' + ch).addEventListener('input', applyMacros);
  }
  setStatus('ready - GENERATE then PLAY (or TEST SOUND to check your speakers)');
  generate();
}

init();
