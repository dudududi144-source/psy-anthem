// PSY ANTHEM — render-core.js (v10.0 "anthem synth quality")
// Commercial-trance offline renderer with a deterministic SOUND LIBRARY:
// 25 distinct sounds across lead/pad/pluck/bass roles. Each song picks its
// sounds from intent-curated pools using the song seed - same seed+intent
// always renders byte-identical audio, different seeds explore different
// sounds, and every pool is curated so the chosen sounds serve each other.
// Pure JS, zero WebAudio, fully deterministic.

const TABLE_LEN = 2048;
function makeTable(kind) {
  const t = new Float32Array(TABLE_LEN + 1);
  for (let i = 0; i <= TABLE_LEN; i++) {
    const ph = (i / TABLE_LEN) * 2 * Math.PI;
    let v = 0;
    if (kind === 'saw') {
      for (let h = 1; h <= 32; h++) v += Math.sin(h * ph) / h;
      v *= 0.5;
    } else if (kind === 'square') {
      for (let h = 1; h <= 31; h += 2) v += Math.sin(h * ph) / h;
      v *= 0.55;
    } else {
      v = Math.sin(ph);
    }
    t[i] = v;
  }
  return t;
}
const SAW = makeTable('saw');
const SQUARE = makeTable('square');
const SINE = makeTable('sine');
function tableAt(table, phase) {
  const i0 = phase | 0;
  const f = phase - i0;
  return table[i0] * (1 - f) + table[i0 + 1] * f;
}
function tableFor(name) { return name === 'square' ? SQUARE : (name === 'sine' ? SINE : SAW); }

// ============================================================
// SOUND LIBRARY — 25 sounds, 4 roles.
// ============================================================
function R(o) {
  return Object.assign({ table: 'saw', unison: 1, detune: 0, sub: false, pan: 0, spread: 0, drive: 0, pump: 0 }, o);
}
const LIB = {
  lead: [
    R({ unison: 7, detune: 0.0075, filtBase: 850, filtEnv: 7200, filtAtk: 0.006, filtDec: 0.28, filtSus: 0.45, Q: 4.0, atk: 0.004, dec: 0.10, sus: 0.85, rel: 0.30, amp: 0.22, spread: 0.90, drive: 0.25 }), // 0 euphoric-saw (lush anthem lead)
    R({ unison: 6, detune: 0.0090, filtBase: 700, filtEnv: 7000, filtAtk: 0.004, filtDec: 0.22, filtSus: 0.30, Q: 5.0, atk: 0.003, dec: 0.09, sus: 0.80, rel: 0.20, amp: 0.22, spread: 0.85, drive: 0.45 }), // 1 full-on-grit
    R({ unison: 2, detune: 0.0030, filtBase: 190, filtEnv: 5600, filtAtk: 0.001, filtDec: 0.14, filtSus: 0.05, Q: 9.0, atk: 0.001, dec: 0.16, sus: 0.10, rel: 0.10, amp: 0.30, spread: 0.30, drive: 0.40 }), // 2 acid-lead
    R({ unison: 3, detune: 0.0040, filtBase: 1400, filtEnv: 2600, filtAtk: 0.250, filtDec: 0.80, filtSus: 0.60, Q: 1.6, atk: 0.220, dec: 0.30, sus: 0.80, rel: 0.60, amp: 0.20, spread: 0.90, drive: 0.10 }), // 3 dreamy-lead
    R({ unison: 2, detune: 0.0050, filtBase: 420, filtEnv: 3600, filtAtk: 0.001, filtDec: 0.12, filtSus: 0.00, Q: 6.0, atk: 0.001, dec: 0.14, sus: 0.00, rel: 0.12, amp: 0.30, spread: 0.40, drive: 0.25 }), // 4 pluck-lead
    R({ table: 'square', unison: 4, detune: 0.0070, filtBase: 380, filtEnv: 2200, filtAtk: 0.005, filtDec: 0.30, filtSus: 0.40, Q: 3.0, atk: 0.004, dec: 0.12, sus: 0.75, rel: 0.22, amp: 0.24, spread: 0.60, drive: 0.55 }), // 5 dark-rave
    R({ table: 'square', unison: 2, detune: 0.0020, filtBase: 900, filtEnv: 4200, filtAtk: 0.010, filtDec: 0.35, filtSus: 0.45, Q: 2.2, atk: 0.010, dec: 0.18, sus: 0.70, rel: 0.35, amp: 0.22, spread: 0.50, drive: 0.20 }), // 6 crystal-lead
    R({ unison: 5, detune: 0.0060, filtBase: 750, filtEnv: 5200, filtAtk: 0.004, filtDec: 0.20, filtSus: 0.25, Q: 4.6, atk: 0.003, dec: 0.08, sus: 0.55, rel: 0.16, amp: 0.23, spread: 0.80, drive: 0.35, pump: 0.30 }), // 7 uplifting-gate
  ],
  pad: [
    R({ unison: 3, detune: 0.0055, filtBase: 1250, filtEnv: 1900, filtAtk: 0.60, filtDec: 1.20, filtSus: 0.75, Q: 1.0, atk: 0.60, dec: 0.40, sus: 0.88, rel: 1.80, amp: 0.12, spread: 1.00, pump: 0.16 }), // 0 lush-wide (lusher)
    R({ unison: 2, detune: 0.0050, filtBase: 520, filtEnv: 900, filtAtk: 0.70, filtDec: 1.40, filtSus: 0.65, Q: 1.4, atk: 0.65, dec: 0.50, sus: 0.85, rel: 1.80, amp: 0.14, spread: 0.90, drive: 0.15, pump: 0.18 }), // 1 dark-drift
    R({ unison: 3, detune: 0.0060, filtBase: 2200, filtEnv: 2400, filtAtk: 0.80, filtDec: 1.60, filtSus: 0.75, Q: 0.9, atk: 0.75, dec: 0.60, sus: 0.90, rel: 2.00, amp: 0.11, spread: 1.00, pump: 0.15 }), // 2 airy-heaven
    R({ unison: 2, detune: 0.0040, filtBase: 900, filtEnv: 1500, filtAtk: 0.30, filtDec: 0.90, filtSus: 0.60, Q: 1.8, atk: 0.30, dec: 0.30, sus: 0.80, rel: 1.00, amp: 0.13, spread: 0.85, pump: 0.42 }), // 3 gated-rhythm
    R({ unison: 3, detune: 0.0055, filtBase: 1000, filtEnv: 1200, filtAtk: 0.45, filtDec: 1.00, filtSus: 0.70, Q: 1.3, atk: 0.45, dec: 0.40, sus: 0.85, rel: 1.40, amp: 0.12, spread: 0.90, drive: 0.12, pump: 0.22 }), // 4 analog-warm
  ],
  pluck: [
    R({ filtBase: 190, filtEnv: 5400, filtAtk: 0.001, filtDec: 0.15, filtSus: 0.00, Q: 9.5, atk: 0.001, dec: 0.20, sus: 0.00, rel: 0.09, amp: 0.26, pan: 0.25, drive: 0.40 }), // 0 acid-303
    R({ unison: 2, detune: 0.0040, filtBase: 350, filtEnv: 4200, filtAtk: 0.001, filtDec: 0.12, filtSus: 0.00, Q: 6.5, atk: 0.001, dec: 0.12, sus: 0.00, rel: 0.08, amp: 0.24, pan: 0.25, spread: 0.50, drive: 0.25, pump: 0.35 }), // 1 trance-gate
    R({ table: 'sine', sub: true, filtBase: 2500, filtEnv: 3000, filtAtk: 0.001, filtDec: 0.30, filtSus: 0.00, Q: 2.0, atk: 0.001, dec: 0.35, sus: 0.00, rel: 0.30, amp: 0.24, pan: 0.20, drive: 0.05 }), // 2 bell-stab
    R({ filtBase: 240, filtEnv: 6800, filtAtk: 0.001, filtDec: 0.11, filtSus: 0.00, Q: 11.0, atk: 0.001, dec: 0.13, sus: 0.00, rel: 0.07, amp: 0.25, pan: 0.30, drive: 0.45 }), // 3 acid-squelch
    R({ unison: 2, detune: 0.0050, filtBase: 600, filtEnv: 5200, filtAtk: 0.001, filtDec: 0.10, filtSus: 0.00, Q: 5.0, atk: 0.001, dec: 0.10, sus: 0.00, rel: 0.08, amp: 0.26, pan: 0.20, spread: 0.60, drive: 0.30 }), // 4 arp-pluck
    R({ table: 'square', filtBase: 160, filtEnv: 2600, filtAtk: 0.001, filtDec: 0.18, filtSus: 0.00, Q: 7.0, atk: 0.001, dec: 0.20, sus: 0.00, rel: 0.10, amp: 0.26, pan: 0.25, drive: 0.50 }), // 5 dark-stab
  ],
  bass: [
    R({ sub: true, filtBase: 330, filtEnv: 900, filtAtk: 0.002, filtDec: 0.12, filtSus: 0.30, Q: 3.2, atk: 0.002, dec: 0.15, sus: 0.35, rel: 0.09, amp: 0.34, drive: 0.50, pump: 0.16 }), // 0 rolling-psy
    R({ sub: true, filtBase: 280, filtEnv: 1200, filtAtk: 0.002, filtDec: 0.10, filtSus: 0.25, Q: 4.0, atk: 0.002, dec: 0.12, sus: 0.30, rel: 0.08, amp: 0.36, drive: 0.55, pump: 0.28 }), // 1 offbeat-kbbb
    R({ filtBase: 180, filtEnv: 3800, filtAtk: 0.001, filtDec: 0.13, filtSus: 0.10, Q: 8.5, atk: 0.001, dec: 0.16, sus: 0.15, rel: 0.08, amp: 0.32, drive: 0.45, pump: 0.12 }), // 2 acid-bass
    R({ table: 'sine', sub: true, filtBase: 600, filtEnv: 500, filtAtk: 0.003, filtDec: 0.10, filtSus: 0.50, Q: 1.5, atk: 0.003, dec: 0.10, sus: 0.60, rel: 0.10, amp: 0.38, drive: 0.20, pump: 0.14 }), // 3 sub-deep
    R({ filtBase: 240, filtEnv: 1600, filtAtk: 0.002, filtDec: 0.11, filtSus: 0.30, Q: 5.0, atk: 0.002, dec: 0.13, sus: 0.35, rel: 0.08, amp: 0.34, drive: 0.70, pump: 0.20 }), // 4 gritty-neuro
    R({ filtBase: 210, filtEnv: 2900, filtAtk: 0.001, filtDec: 0.09, filtSus: 0.15, Q: 9.0, atk: 0.001, dec: 0.10, sus: 0.20, rel: 0.07, amp: 0.33, drive: 0.50, pump: 0.22 }), // 5 forest-squelch
  ],
};

// Intent-curated pools: the sounds chosen for a genre are curated to serve
// each other (e.g. dark-psy pairs squelch bass + acid pluck + dark pad).
const SOUND_NAMES = {
  lead: ['euphoric-saw', 'full-on-grit', 'acid-lead', 'dreamy-lead', 'pluck-lead', 'dark-rave', 'crystal-lead', 'uplifting-gate'],
  pad: ['lush-wide', 'dark-drift', 'airy-heaven', 'gated-rhythm', 'analog-warm'],
  pluck: ['acid-303', 'trance-gate', 'bell-stab', 'acid-squelch', 'arp-pluck', 'dark-stab'],
  bass: ['rolling-psy', 'offbeat-kbbb', 'acid-bass', 'sub-deep', 'gritty-neuro', 'forest-squelch'],
};
for (const role of Object.keys(LIB)) {
  for (let i = 0; i < LIB[role].length; i++) LIB[role][i].name = SOUND_NAMES[role][i];
}

const INTENT_POOLS = {
  'euphoric-trance':     { lead: [0, 1, 3], pad: [0, 2], pluck: [1, 4], bass: [0, 1] },
  'progressive':         { lead: [3, 4],    pad: [4, 0], pluck: [1],    bass: [0, 3] },
  'dark-psy':            { lead: [5, 2],    pad: [1],    pluck: [3, 5], bass: [5, 2] },
  'full-on':             { lead: [1, 0],    pad: [3, 0], pluck: [0, 4], bass: [1, 4] },
  'emotional-breakdown': { lead: [3, 6],    pad: [2, 0], pluck: [2],    bass: [3, 0] },
  'forest':              { lead: [2, 5],    pad: [1],    pluck: [3],    bass: [5, 2] },
};

function hashSeed(a, b) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
function selectSounds(intent, seed) {
  const pool = INTENT_POOLS[intent] || INTENT_POOLS['euphoric-trance'];
  const pick = (arr, salt) => arr[hashSeed(seed, salt) % arr.length];
  return {
    lead: LIB.lead[pick(pool.lead, 11)],
    pad: LIB.pad[pick(pool.pad, 22)],
    pluck: LIB.pluck[pick(pool.pluck, 33)],
    bass: LIB.bass[pick(pool.bass, 44)],
  };
}
function defaultSounds() {
  return { lead: LIB.lead[0], pad: LIB.pad[0], pluck: LIB.pluck[0], bass: LIB.bass[0] };
}
const ROLE = ['lead', 'pad', 'pluck', 'bass']; // engine channels 0..3

// ============================================================
// DSP
// ============================================================
function ampEnv(t, dur, rec) {
  if (t < rec.atk) return t / rec.atk;
  if (t < rec.atk + rec.dec) return 1 - (1 - rec.sus) * ((t - rec.atk) / rec.dec);
  if (t < dur) return rec.sus;
  const tr = (t - dur) / rec.rel;
  return rec.sus * Math.max(0, 1 - tr);
}
function filtShape(t, rec) {
  if (t < rec.filtAtk) return t / rec.filtAtk;
  const d = (t - rec.filtAtk) / Math.max(0.01, rec.filtDec);
  return rec.filtSus + (1 - rec.filtSus) * Math.exp(-3.2 * d);
}
function pumpVal(t, beatDur, depth) {
  const ph = (t % beatDur) / beatDur;
  return 1 - depth * Math.exp(-ph * 5.5);
}

// ---------- groove layer (renderer-side drums, fully deterministic) ----------
function hashNoise(i, salt) {
  let h = Math.imul((i | 0) ^ (salt | 0), 0x9e3779b9);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
function renderDrumsFour(L, R, sr, spb, bars, total) {
  // Four-on-the-floor psy kick: sine pitch-drop + click transient.
  const kickLen = Math.floor(0.30 * sr);
  for (let b = 0; b < bars; b++) {
    const s0 = Math.floor(b * spb * sr);
    let phase = 0;
    for (let i = 0; i < kickLen && s0 + i < total; i++) {
      const t = i / sr;
      const f0 = 46 + (150 - 46) * Math.exp(-t / 0.030);
      phase += 2 * Math.PI * f0 / sr;
      const atk = t < 0.002 ? t / 0.002 : 1;
      const env = atk * Math.exp(-t / 0.085);
      const click = t < 0.0025 ? (1 - t / 0.0025) * 0.5 * hashNoise(i, b * 7919 + 17) : 0;
      const val = (Math.sin(phase) * 0.85 + Math.sin(phase * 0.5) * 0.25) * env * 0.5 + click * 0.25;
      L[s0 + i] += val;
      R[s0 + i] += val;
    }
  }
  // Offbeat hats: high-passed deterministic noise burst.
  const hatLen = Math.floor(0.12 * sr);
  for (let b = 0; b < bars; b++) {
    const s0 = Math.floor((b * spb + spb / 2) * sr);
    let prev = 0, prev2 = 0;
    for (let i = 0; i < hatLen && s0 + i < total; i++) {
      const t = i / sr;
      const n = hashNoise(i, b * 104729 + 31);
      const hp = n - 2 * prev + prev2;
      prev2 = prev; prev = n;
      const env = Math.exp(-t / 0.035);
      const val = hp * env * 0.16;
      L[s0 + i] += val * 0.9;
      R[s0 + i] += val * 1.1;
    }
  }
}
// ---- groove variants + helpers (deterministic, salt-based) ----
function kickAt(L, R, sr, s0, total, salt, gainMul) {
  const kickLen = Math.floor(0.30 * sr);
  let phase = 0;
  for (let i = 0; i < kickLen && s0 + i < total; i++) {
    const t = i / sr;
    const f0 = 46 + (150 - 46) * Math.exp(-t / 0.030);
    phase += 2 * Math.PI * f0 / sr;
    const atk = t < 0.002 ? t / 0.002 : 1;
    const env = atk * Math.exp(-t / 0.085);
    const click = t < 0.0025 ? (1 - t / 0.0025) * 0.5 * hashNoise(i, salt) : 0;
    const val = ((Math.sin(phase) * 0.85 + Math.sin(phase * 0.5) * 0.25) * env * 0.5 + click * 0.25) * gainMul;
    L[s0 + i] += val;
    R[s0 + i] += val;
  }
}
function hatAt(L, R, sr, s0, total, salt, gainMul, decay) {
  const hatLen = Math.floor(0.12 * sr);
  let prev = 0, prev2 = 0;
  for (let i = 0; i < hatLen && s0 + i < total; i++) {
    const t = i / sr;
    const n = hashNoise(i, salt);
    const hp = n - 2 * prev + prev2;
    prev2 = prev; prev = n;
    const env = Math.exp(-t / decay);
    const val = hp * env * gainMul;
    L[s0 + i] += val * 0.9;
    R[s0 + i] += val * 1.1;
  }
}
function renderDrumsFullon(L, R, sr, spb, bars, total) {
  const sixteenth = spb / 4;
  for (let b = 0; b < bars; b++) {
    const beatStart = b * spb;
    kickAt(L, R, sr, Math.floor(beatStart * sr), total, b * 7919 + 17, 1.0);
    kickAt(L, R, sr, Math.floor((beatStart + spb / 2) * sr), total, b * 7919 + 113, 0.6);
    for (let s = 0; s < 4; s++) {
      const pos = beatStart + s * sixteenth;
      const accented = (s % 2 === 1);
      hatAt(L, R, sr, Math.floor(pos * sr), total, b * 104729 + s * 517 + 31, accented ? 0.14 : 0.065, accented ? 0.05 : 0.026);
    }
  }
}
function renderDrumsRolling(L, R, sr, spb, bars, total) {
  const sixteenth = spb / 4;
  for (let b = 0; b < bars; b++) {
    const beatStart = b * spb;
    kickAt(L, R, sr, Math.floor(beatStart * sr), total, b * 7919 + 17, 1.0);
    hatAt(L, R, sr, Math.floor((beatStart + spb / 2) * sr), total, b * 104729 + 31, 0.17, 0.09);
    hatAt(L, R, sr, Math.floor((beatStart + sixteenth) * sr), total, b * 104729 + 517 + 31, 0.06, 0.03);
    hatAt(L, R, sr, Math.floor((beatStart + 3 * sixteenth) * sr), total, b * 104729 + 1031 + 31, 0.06, 0.03);
  }
}
function renderRisers(L, R, sr, spb, bars, total) {
  const phrase = 8;
  const len = Math.floor(spb * 4 * sr);
  for (let p = phrase; p <= bars; p += phrase) {
    const s0 = Math.floor((p - 1) * 4 * spb * sr);
    let prev = 0;
    for (let i = 0; i < len && s0 + i < total; i++) {
      const t = i / sr;
      const prog = i / len;
      const n = hashNoise(i, p * 991 + 7);
      const hp = n - prev; prev = n;
      const bright = 0.3 + prog * 0.7;
      const env = prog * prog * 0.15 * bright;
      const val = hp * env;
      L[s0 + i] += val;
      R[s0 + i] += val;
    }
  }
}
function selectGroove(intent, seed) {
  const pools = {
    'euphoric-trance': ['four', 'fullon'],
    'progressive': ['four', 'rolling'],
    'dark-psy': ['rolling', 'fullon'],
    'full-on': ['fullon', 'four'],
    'emotional-breakdown': ['four', 'rolling'],
    'forest': ['rolling', 'fullon'],
  };
  const pool = pools[intent] || ['four', 'fullon', 'rolling'];
  return pool[hashSeed(seed, 99) % pool.length];
}
function applySidechain(L, R, sr, spb, total, depth) {
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const ph = (t % spb) / spb;
    const duck = 1 - depth * Math.exp(-ph * 7.5);
    L[i] *= duck;
    R[i] *= duck;
  }
}
function widenStereo(L, R, total, amount) {
  for (let i = 0; i < total; i++) {
    const mid = (L[i] + R[i]) * 0.5;
    const side = (L[i] - R[i]) * 0.5 * amount;
    L[i] = mid + side;
    R[i] = mid - side;
  }
}

function renderNote(n, rec, s0, len, total, L, R, sr, spb) {
  const table = tableFor(rec.table);
  const span = rec.sus <= 0.01 ? len : len + Math.floor(rec.rel * sr);
  const unison = rec.unison;
  for (let u = 0; u < unison; u++) {
    const spreadPos = unison > 1 ? (2 * u / (unison - 1) - 1) : 0;
    const det = 1 + rec.detune * spreadPos;
    const voicePan = rec.pan + rec.spread * spreadPos;
    const gL = Math.cos((voicePan + 1) * Math.PI / 4);
    const gR = Math.sin((voicePan + 1) * Math.PI / 4);
    const inc = (n.freq * det) * TABLE_LEN / sr;
    let phase = (u * 0.37 * TABLE_LEN) % TABLE_LEN;
    let low = 0, band = 0;
    for (let i = 0; i < span && s0 + i < total; i++) {
      const t = i / sr;
      const env = ampEnv(t, len / sr, rec);
      if (env <= 0.0008) { phase += inc; if (phase >= TABLE_LEN) phase -= TABLE_LEN; continue; }
      let fc = rec.filtBase + rec.filtEnv * filtShape(t, rec);
      if (fc > 16000) fc = 16000; if (fc < 60) fc = 60;
      const f = 2 * Math.sin(Math.PI * fc / sr);
      const q = 1 / rec.Q;
      const smp = tableAt(table, phase);
      low += f * band;
      const high = smp - low - q * band;
      band += f * high;
      let out = low;
      if (rec.drive > 0) out = Math.tanh(out * (1 + rec.drive * 5));
      let val = out * env * rec.amp;
      if (rec.pump > 0) val *= pumpVal(n.start + t, spb, rec.pump);
      const o = s0 + i;
      L[o] += val * gL;
      R[o] += val * gR;
      phase += inc;
      if (phase >= TABLE_LEN) phase -= TABLE_LEN;
    }
  }
  if (rec.sub) {
    const inc = (n.freq * 0.5) * TABLE_LEN / sr;
    let phase = 0;
    const subAmp = rec.amp * 0.55;
    for (let i = 0; i < len && s0 + i < total; i++) {
      const t = i / sr;
      const env = ampEnv(t, len / sr, rec);
      if (env > 0.0008) {
        const val = tableAt(SINE, phase) * env * subAmp;
        const o = s0 + i;
        L[o] += val;
        R[o] += val;
      }
      phase += inc;
      if (phase >= TABLE_LEN) phase -= TABLE_LEN;
    }
  }
}

function pingpong(L, R, sr, spb, total) {
  const dSamples = Math.max(1, Math.floor(0.75 * spb * sr));
  const fb = 0.36, wet = 0.26;
  const dL = new Float32Array(dSamples), dR = new Float32Array(dSamples);
  let w = 0;
  const wetL = new Float32Array(total), wetR = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const dl = dL[w], dr = dR[w];
    dL[w] = L[i] + fb * dr;
    dR[w] = R[i] + fb * dl;
    wetL[i] = dl; wetR[i] = dr;
    w = (w + 1) % dSamples;
  }
  for (let i = 0; i < total; i++) { L[i] += wetL[i] * wet; R[i] += wetR[i] * wet; }
}

function reverb(L, R, sr, total) {
  const combTimes = [0.0297, 0.0371, 0.0411, 0.0461];
  const combFb = [0.77, 0.74, 0.72, 0.70];
  const apTimes = [0.005, 0.0017];
  const apG = 0.5;
  function processChan(x, detuneMul) {
    const sum = new Float32Array(total);
    for (let c = 0; c < 4; c++) {
      const M = Math.max(1, Math.floor(combTimes[c] * detuneMul * sr));
      const buf = new Float32Array(M);
      const g = combFb[c];
      let w = 0;
      const pre = Math.floor(0.012 * sr);
      for (let i = 0; i < total; i++) {
        const xi = i >= pre ? x[i - pre] : 0;
        const delayed = buf[w];
        buf[w] = xi + g * delayed;
        sum[i] += delayed;
        w = (w + 1) % M;
      }
    }
    let cur = sum;
    for (let a = 0; a < 2; a++) {
      const M = Math.max(1, Math.floor(apTimes[a] * sr));
      const buf = new Float32Array(M);
      const nxt = new Float32Array(total);
      let w = 0;
      for (let i = 0; i < total; i++) {
        const delayed = buf[w];
        buf[w] = cur[i] + apG * delayed;
        nxt[i] = delayed - apG * cur[i];
        w = (w + 1) % M;
      }
      cur = nxt;
    }
    return cur;
  }
  const wetL = processChan(L, 1.0);
  const wetR = processChan(R, 1.045);
  const wet = 0.36;
  for (let i = 0; i < total; i++) { L[i] += wetL[i] * wet; R[i] += wetR[i] * wet; }
}

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

function render(events, bpm, onProgress, opts) {
  const sr = 44100;
  const spb = 60 / Math.max(1, bpm);
  let sounds = (opts && opts.intent) ? selectSounds(opts.intent, (opts.seed | 0)) : defaultSounds();
  const draft = !!(opts && opts.quality === 'draft');
  const drumsOn = !!(opts && opts.drums === 'on');
  if (draft) {
    const draftify = (rec) => {
      const d = Object.assign({}, rec);
      d.unison = Math.min(d.unison, 2);
      d.spread = Math.min(d.spread, 0.5);
      return d;
    };
    sounds = { lead: draftify(sounds.lead), pad: draftify(sounds.pad), pluck: draftify(sounds.pluck), bass: draftify(sounds.bass) };
  }
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
  const total = Math.ceil((endSec + (draft ? 1.5 : 3.0)) * sr);
  const L = new Float32Array(total);
  const R = new Float32Array(total);

  for (let ni = 0; ni < notes.length; ni++) {
    const n = notes[ni];
    const rec = sounds[ROLE[n.ch]] || sounds.lead;
    const s0 = Math.floor(n.start * sr);
    const len = Math.floor(n.dur * sr);
    const velAmp = 0.55 + 0.45 * n.vel;
    const savedAmp = rec.amp;
    rec.amp = savedAmp * velAmp;
    renderNote(n, rec, s0, len, total, L, R, sr, spb);
    rec.amp = savedAmp;
    if ((ni % 24) === 23 && onProgress) onProgress(Math.round((ni / notes.length) * 70));
  }

  if (onProgress) onProgress(75);
  pingpong(L, R, sr, spb, total);
  if (onProgress) onProgress(82);
  if (!draft) reverb(L, R, sr, total);
  // Groove selection: opts.groove = auto|four|fullon|rolling|off.
  // Back-compat: no groove + drums 'on' => 'four' (byte-identical).
  let grooveStyle = (opts && opts.groove) || null;
  let doDrums = false;
  if (grooveStyle === 'off') {
    doDrums = false;
  } else if (grooveStyle) {
    if (grooveStyle === 'auto') grooveStyle = selectGroove((opts && opts.intent) || '', (opts && opts.seed) | 0);
    doDrums = true;
  } else if (drumsOn) {
    grooveStyle = 'four';
    doDrums = true;
  }
  if (doDrums) {
    const barsTotal = Math.max(1, Math.ceil(endSec / (4 * spb)));
    applySidechain(L, R, sr, spb, total, 0.3);
    if (grooveStyle === 'fullon') renderDrumsFullon(L, R, sr, spb, barsTotal, total);
    else if (grooveStyle === 'rolling') renderDrumsRolling(L, R, sr, spb, barsTotal, total);
    else renderDrumsFour(L, R, sr, spb, barsTotal, total);
    if (opts && opts.risers === 'on') renderRisers(L, R, sr, spb, barsTotal, total);
  }
  widenStereo(L, R, total, 1.22);
  if (onProgress) onProgress(90);

  let peak = 0.0001;
  for (let i = 0; i < total; i++) {
    const al = Math.abs(L[i]), ar = Math.abs(R[i]);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  const g = 0.9 / peak;
  for (let i = 0; i < total; i++) {
    L[i] = Math.tanh(L[i] * g * 1.1);
    R[i] = Math.tanh(R[i] * g * 1.1);
  }

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
  return {
    wav: wav,
    peaks: peaks,
    seconds: endSec,
    names: { lead: sounds.lead.name, pad: sounds.pad.name, pluck: sounds.pluck.name, bass: sounds.bass.name },
    groove: doDrums ? grooveStyle : 'off',
  };
}

export function renderSong(events, bpm, onProgress, opts) {
  return render(events, bpm, onProgress, opts);
}
