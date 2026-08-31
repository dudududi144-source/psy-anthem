// PSY ANTHEM - demo app (browser)
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VOICE_COLORS = ['#ff2ec4', '#2ee6ff', '#a06bff', '#ffb02e'];
const VOICE_NAMES = ['Lead', 'Harmony', 'Counter', 'Bass'];
const MODES = ['minor', 'major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'harmonicMinor', 'melodicMinor', 'hungarianMinor', 'doubleHarmonicMajor'];

const QUALITY_SUFFIX = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
  dominant7: '7',
  major7: 'maj7',
  minor7: 'm7',
  sus2: 'sus2',
  sus4: 'sus4',
};

function pitchName(p) {
  return NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
}

function chordName(c) {
  const suffix = QUALITY_SUFFIX[c.quality] ?? '';
  return NOTE_NAMES[((c.root % 12) + 12) % 12] + suffix;
}

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
  const curves = [EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.FLAT];
  fillSelect('curve', curves);
  document.getElementById('curve').value = EnergyCurve.ARC;
  fillSelect('root', NOTE_NAMES.map((_, i) => String(i)), NOTE_NAMES);
  fillSelect('mode', MODES);
}

function readConfig() {
  return {
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
  };
}

function svgEl(name, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const k of Object.keys(attrs)) {
    el.setAttribute(k, attrs[k]);
  }
  return el;
}

function renderRoll(out, config) {
  const host = document.getElementById('roll');
  host.innerHTML = '';
  const events = out.events.filter((e) => e.type === 'note');
  if (events.length === 0) {
    host.textContent = 'No events.';
    return;
  }
  let lo = 127;
  let hi = 0;
  for (const e of events) {
    const p = e.data.pitch;
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  lo = Math.max(0, lo - 2);
  hi = Math.min(127, hi + 2);

  const totalBeats = config.bars * 4;
  const pxPerBeat = 26;
  const rowH = 12;
  const rows = hi - lo + 1;
  const W = totalBeats * pxPerBeat + 46;
  const H = rows * rowH + 8;

  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H });

  // Pitch grid + labels
  for (let p = lo; p <= hi; p++) {
    const y = H - 4 - (p - lo) * rowH;
    const isBlack = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
    if (isBlack) {
      svg.appendChild(svgEl('rect', { x: 44, y: y - rowH, width: W - 46, height: rowH, fill: '#0d0a1a' }));
    }
    if (((p % 12) + 12) % 12 === 0) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', 6);
      t.setAttribute('y', y - 3);
      t.setAttribute('fill', '#6f689c');
      t.setAttribute('font-size', '9');
      t.setAttribute('font-family', 'monospace');
      t.textContent = pitchName(p);
      svg.appendChild(t);
      svg.appendChild(svgEl('line', { x1: 44, y1: y, x2: W, y2: y, stroke: '#241f3d', 'stroke-width': 1 }));
    }
  }

  // Bar lines
  for (let b = 0; b <= config.bars; b++) {
    const x = 44 + b * 4 * pxPerBeat;
    svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, stroke: b % 4 === 0 ? '#3a3163' : '#241f3d', 'stroke-width': b % 4 === 0 ? 1.4 : 1 }));
  }

  // Notes
  for (const e of events) {
    const x = 44 + e.timestamp * pxPerBeat;
    const w = Math.max(2, e.duration * pxPerBeat - 1.5);
    const y = H - 4 - (e.data.pitch - lo) * rowH - rowH + 1.5;
    const color = VOICE_COLORS[e.channel % 4] ?? '#ffffff';
    const rect = svgEl('rect', { x: x, y: y, width: w, height: rowH - 3, rx: 2.5, fill: color });
    rect.setAttribute('opacity', String(0.45 + (e.data.velocity / 127) * 0.55));
    svg.appendChild(rect);
  }

  host.appendChild(svg);

  // Legend
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  for (let v = 0; v < config.voices; v++) {
    const s = document.createElement('span');
    const d = document.createElement('i');
    d.className = 'dot';
    d.style.background = VOICE_COLORS[v];
    s.appendChild(d);
    s.appendChild(document.createTextNode(VOICE_NAMES[v] + ' (ch ' + v + ')'));
    legend.appendChild(s);
  }
}

function renderTension(out, config) {
  const host = document.getElementById('tension');
  host.innerHTML = '';
  const curve = out.harmonicAnalysis.tensionCurve;
  const W = 800;
  const H = 90;
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
    const area = svgEl('polygon', {
      points: '5,' + (H - 8) + ' ' + pts + (W - 5) + ',' + (H - 8),
      fill: 'rgba(160,107,255,0.18)',
    });
    svg.appendChild(area);
    svg.appendChild(svgEl('polyline', { points: pts, fill: 'none', stroke: '#a06bff', 'stroke-width': 2 }));
  }
  host.appendChild(svg);
}

function renderChords(out) {
  const host = document.getElementById('chords');
  host.innerHTML = '';
  const chords = out.harmonicAnalysis.chords;
  const totalBars = chords.reduce((s, c) => s + c.durationBars, 0) || 1;
  const W = 800;
  const H = 54;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
  let x = 4;
  const colors = ['#ff2ec4', '#2ee6ff', '#a06bff', '#ffb02e', '#3dffa0'];
  for (let i = 0; i < chords.length; i++) {
    const c = chords[i];
    const w = (c.durationBars / totalBars) * (W - 8) - 4;
    const color = colors[i % colors.length];
    svg.appendChild(svgEl('rect', { x: x, y: 8, width: Math.max(24, w), height: 30, rx: 6, fill: 'rgba(20,17,38,1)', stroke: color, 'stroke-width': 1.2 }));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', String(x + Math.max(24, w) / 2));
    t.setAttribute('y', '27');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', color);
    t.setAttribute('font-size', '12');
    t.setAttribute('font-weight', 'bold');
    t.setAttribute('font-family', 'monospace');
    t.textContent = chordName(c);
    svg.appendChild(t);
    const b = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    b.setAttribute('x', String(x + Math.max(24, w) / 2));
    b.setAttribute('y', '46');
    b.setAttribute('text-anchor', 'middle');
    b.setAttribute('fill', '#6f689c');
    b.setAttribute('font-size', '9');
    b.setAttribute('font-family', 'monospace');
    b.textContent = c.durationBars + ' bar' + (c.durationBars > 1 ? 's' : '');
    svg.appendChild(b);
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
    const p = document.createElement('div');
    p.className = 'p';
    p.textContent = pitchName(dna.coreNotes[i]);
    const d = document.createElement('div');
    d.className = 'd';
    d.textContent = (dna.coreRhythm[i] || 0) + ' beats';
    chip.appendChild(p);
    chip.appendChild(d);
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
  for (const it of items) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (it[2] ? ' hot' : '');
    const key = document.createElement('b');
    key.textContent = it[0] + ': ';
    chip.appendChild(key);
    chip.appendChild(document.createTextNode(String(it[1])));
    host.appendChild(chip);
  }
}

function showError(msg) {
  const el = document.getElementById('err');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('err').style.display = 'none';
}

function generate() {
  hideError();
  const config = readConfig();
  let out = null;
  try {
    const engine = createAnthemEngine(config);
    out = engine.generate();
  } catch (e) {
    showError('Config error: ' + e.message);
    return;
  }
  if (!out) {
    showError('Solver failed to satisfy hard constraints. Try another seed.');
    return;
  }
  renderRoll(out, config);
  renderTension(out, config);
  renderChords(out);
  renderMotif(out);
  renderStats(out, config);
}

function init() {
  initControls();
  document.getElementById('generate').addEventListener('click', generate);
  document.getElementById('random').addEventListener('click', () => {
    document.getElementById('seed').value = String(Math.floor(Math.random() * 1000000));
    generate();
  });
  for (const id of ['seed', 'intent', 'curve', 'root', 'mode', 'voices', 'bars']) {
    document.getElementById(id).addEventListener('change', generate);
  }
  generate();
}

init();
