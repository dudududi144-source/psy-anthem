// PSY ANTHEM — render-worker.js (v7.0)
// Offline stereo wavetable renderer running in a Web Worker, so the UI
// thread NEVER blocks during audio rendering. Pure math — no WebAudio.
const TABLE_LEN = 2048;
function makeTable(kind) {
  const t = new Float32Array(TABLE_LEN + 1);
  for (let i = 0; i <= TABLE_LEN; i++) {
    const ph = (i / TABLE_LEN) * 2 * Math.PI;
    let v = 0;
    if (kind === 'saw') {
      for (let h = 1; h <= 24; h++) v += Math.sin(h * ph) / h;
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
const TABLE_SAW = makeTable('saw');
const TABLE_PAD = makeTable('pad');
const TABLE_SINE = makeTable('sine');
function tableAt(table, phase) {
  const i0 = phase | 0;
  const f = phase - i0;
  return table[i0] * (1 - f) + table[i0 + 1] * f;
}
const VOICE_RECIPES = {
  0: { table: 'saw', unison: 3, detune: 0.0045, attack: 0.006, decay: 0.08, sustain: 0.75, release: 0.18, amp: 0.34, pan: 0.0, cutoff: 5200, kind: 'adsr' },
  1: { table: 'pad', unison: 2, detune: 0.0025, attack: 0.5, decay: 0.3, sustain: 0.85, release: 1.4, amp: 0.17, pan: -0.3, cutoff: 3800, kind: 'adsr' },
  2: { table: 'saw', unison: 1, detune: 0.0, attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.1, amp: 0.3, pan: 0.3, cutoff: 4200, kind: 'pluck' },
  3: { table: 'sine', unison: 1, detune: 0.0, attack: 0.004, decay: 0.05, sustain: 0.8, release: 0.08, amp: 0.5, pan: 0.0, cutoff: 8000, kind: 'bass' },
};
function tableFor(name) { return name === 'saw' ? TABLE_SAW : (name === 'pad' ? TABLE_PAD : TABLE_SINE); }

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

function render(events, bpm, id) {
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
  if (notes.length === 0) throw new Error('no notes');
  const total = Math.ceil((endSec + 2.0) * sr);
  const L = new Float32Array(total);
  const R = new Float32Array(total);

  for (let ni = 0; ni < notes.length; ni++) {
    const n = notes[ni];
    const rec = VOICE_RECIPES[n.ch] || VOICE_RECIPES[0];
    const table = tableFor(rec.table);
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
    if ((ni % 24) === 23) {
      self.postMessage({ type: 'progress', id: id, percent: Math.round((ni / notes.length) * 90) });
    }
  }

  // Tempo-synced cross-feedback delay (dotted 8th).
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

  // Normalize + soft clip.
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

  // Waveform peaks for the UI (900 buckets).
  const BUCKETS = 900;
  const peaks = new Float32Array(BUCKETS);
  const per = total / BUCKETS;
  for (let b = 0; b < BUCKETS; b++) {
    const s = Math.floor(b * per), e2 = Math.min(total, Math.floor((b + 1) * per));
    let m = 0;
    for (let i = s; i < e2; i += 8) {
      const a = Math.abs(L[i]), a2 = Math.abs(R[i]);
      if (a > m) m = a;
      if (a2 > m) m = a2;
    }
    peaks[b] = m;
  }

  const wav = stereoToWav16([L, R], sr);
  self.postMessage({ type: 'done', id: id, seconds: endSec, peaks: peaks, buffer: wav.buffer }, [wav.buffer, peaks.buffer]);
}

self.onmessage = (msg) => {
  const d = msg.data;
  if (!d || d.type !== 'render') return;
  try {
    render(d.events, d.bpm, d.id);
  } catch (e) {
    self.postMessage({ type: 'error', id: d.id, message: String(e && e.message ? e.message : e) });
  }
};
