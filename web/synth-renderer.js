// PSY ANTHEM - web/synth-renderer.js
// Offline synth renderer using STANDARD Web Audio nodes (oscillators, filters,
// envelopes, reverb, delay). Standard nodes render reliably in an
// OfflineAudioContext (an AudioWorklet does not), which is what makes the
// sound actually audible. One patch per voice channel, each with its own
// character so the four voices sound distinct.

export function synthSupported() {
  return typeof OfflineAudioContext !== 'undefined';
}

// Per-voice patches (Web Audio node based). ch 0=lead 1=pad 2=pluck 3=bass.
const VOICE_PATCHES = [
  { osc:'sawtooth', unison:4, detuneCents:10, sub:0,
    cutoff:5200, res:3, filterEnv:2600, fDecay:0.25,
    attack:0.005, decay:0.2, sustain:0.8, release:0.4,
    level:0.22, reverb:0.35, delay:0.22 },
  { osc:'sawtooth', unison:3, detuneCents:8, sub:0,
    cutoff:1800, res:1.5, filterEnv:800, fDecay:0.5,
    attack:0.4, decay:0.5, sustain:0.85, release:1.2,
    level:0.14, reverb:0.55, delay:0.12 },
  { osc:'sawtooth', unison:2, detuneCents:6, sub:0,
    cutoff:3200, res:5, filterEnv:2800, fDecay:0.15,
    attack:0.002, decay:0.18, sustain:0.25, release:0.25,
    level:0.2, reverb:0.28, delay:0.3 },
  { osc:'sawtooth', unison:1, detuneCents:0, sub:12,
    cutoff:900, res:3, filterEnv:500, fDecay:0.12,
    attack:0.003, decay:0.15, sustain:0.6, release:0.15,
    level:0.3, reverb:0.08, delay:0.05 },
];
export const VOICE_LEVELS = [1.0, 0.8, 0.72, 0.95];

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createReverb(octx, duration, decay) {
  const sr = octx.sampleRate;
  const len = Math.max(1, Math.floor(duration * sr));
  const impulse = octx.createBuffer(2, len, sr);
  const rand = mulberry32(12345);
  for (let c = 0; c < 2; c++) {
    const chd = impulse.getChannelData(c);
    for (let i = 0; i < len; i++) {
      chd[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, decay * 3);
    }
  }
  const conv = octx.createConvolver();
  conv.buffer = impulse;
  const input = octx.createGain();
  input.connect(conv);
  return { input, output: conv };
}

function createDelay(octx, delayTime, feedback) {
  const delay = octx.createDelay(2.0);
  delay.delayTime.value = Math.min(1.9, delayTime);
  const fb = octx.createGain();
  fb.gain.value = feedback;
  delay.connect(fb); fb.connect(delay);
  const input = octx.createGain();
  input.connect(delay);
  return { input, output: delay };
}

function scheduleNote(octx, bus, patch, midi, startSec, dur, vel) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const endSec = startSec + dur;
  for (let u = 0; u < patch.unison; u++) {
    const detune = patch.unison > 1 ? (u / (patch.unison - 1) - 0.5) * 2 * patch.detuneCents : 0;
    const osc = octx.createOscillator();
    osc.type = patch.osc;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const filt = octx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = patch.res;
    const openFc = Math.min(16000, patch.cutoff + patch.filterEnv);
    filt.frequency.setValueAtTime(openFc, startSec);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, patch.cutoff), startSec + patch.attack + patch.fDecay);
    const env = octx.createGain();
    env.gain.setValueAtTime(0, startSec);
    env.gain.linearRampToValueAtTime(vel, startSec + patch.attack);
    env.gain.linearRampToValueAtTime(vel * patch.sustain, startSec + patch.attack + patch.decay);
    env.gain.setValueAtTime(vel * patch.sustain, endSec);
    env.gain.linearRampToValueAtTime(0.0001, endSec + patch.release);
    osc.connect(filt); filt.connect(env); env.connect(bus);
    osc.start(startSec);
    osc.stop(endSec + patch.release + 0.05);
  }
  if (patch.sub > 0) {
    const subFreq = freq * Math.pow(2, -patch.sub / 12);
    const osc = octx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = subFreq;
    const env = octx.createGain();
    env.gain.setValueAtTime(0, startSec);
    env.gain.linearRampToValueAtTime(vel * 0.7, startSec + patch.attack);
    env.gain.setValueAtTime(vel * 0.7 * patch.sustain, endSec);
    env.gain.linearRampToValueAtTime(0.0001, endSec + patch.release);
    osc.connect(env); env.connect(bus);
    osc.start(startSec);
    osc.stop(endSec + patch.release + 0.05);
  }
}

export async function renderWithSynth(events, bpm) {
  if (!synthSupported()) throw new Error('OfflineAudioContext not supported');
  const spb = 60 / Math.max(1, bpm);
  let maxEnd = 0;
  for (const e of events) {
    if (e.type !== 'note') continue;
    const end = (e.timestamp + e.duration) * spb;
    if (end > maxEnd) maxEnd = end;
  }
  if (maxEnd <= 0) throw new Error('no notes');
  const sr = 44100;
  const leadIn = 0.1, tail = 2.5;
  const octx = new OfflineAudioContext(2, Math.ceil((maxEnd + leadIn + tail) * sr), sr);

  const master = octx.createGain();
  master.gain.value = 0.85;
  const limiter = octx.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.2;
  master.connect(limiter); limiter.connect(octx.destination);

  const reverb = createReverb(octx, 2.2, 0.3);
  reverb.output.connect(master);
  const delay = createDelay(octx, 0.375 * spb * 2, 0.3);
  delay.output.connect(master);

  const voiceBus = [];
  for (let ch = 0; ch < 4; ch++) {
    const patch = VOICE_PATCHES[ch];
    const g = octx.createGain();
    g.gain.value = VOICE_LEVELS[ch] * patch.level;
    g.connect(master);
    const rSend = octx.createGain(); rSend.gain.value = patch.reverb;
    g.connect(rSend); rSend.connect(reverb.input);
    const dSend = octx.createGain(); dSend.gain.value = patch.delay;
    g.connect(dSend); dSend.connect(delay.input);
    voiceBus.push(g);
  }

  const t0 = leadIn;
  for (const e of events) {
    if (e.type !== 'note') continue;
    const ch = e.channel % 4;
    const patch = VOICE_PATCHES[ch];
    const startSec = t0 + e.timestamp * spb;
    const dur = e.duration * spb;
    const vel = Math.max(0.05, Math.min(1, e.data.velocity / 127));
    scheduleNote(octx, voiceBus[ch], patch, e.data.pitch, startSec, dur, vel);
  }

  const buf = await octx.startRendering();
  // Silence detection: if silent, throw so the caller falls back to render-core.
  let mx = 0;
  for (let c = 0; c < buf.numberOfChannels && mx < 0.001; c++) {
    const chd = buf.getChannelData(c);
    for (let i = 0; i < chd.length; i += 200) {
      const v = Math.abs(chd[i]);
      if (v > mx) { mx = v; if (mx >= 0.001) break; }
    }
  }
  if (mx < 0.001) throw new Error('synth render produced silence');
  return buf;
}

export function audioBufferToWav(buffer) {
  const nCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const blockAlign = nCh * 2;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true);
  dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, dataSize, true);
  const chans = [];
  for (let c = 0; c < nCh; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      let s = chans[c][i];
      s = Math.max(-1, Math.min(1, s));
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return new Uint8Array(ab);
}
