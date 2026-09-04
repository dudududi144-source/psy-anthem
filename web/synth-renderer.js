// PSY ANTHEM - web/synth-renderer.js  (v9 "commercial trance")
// Offline renderer using STANDARD Web Audio nodes (reliable in
// OfflineAudioContext). Learned from psyreason: standard nodes, not a worklet.
//
// v9 turns the output from "RPG/gamelan" into modern emotional trance by
// adding the things that actually define the genre:
//   - four-on-the-floor KICK (pitch-drop sine, every beat)
//   - ROLLING offbeat BASSLINE (the K-B-B-B psy groove)
//   - SIDECHAIN-style PUMPING on the pads (duck on every kick)
//   - a lusher SUPERSAW lead (more unison + chorus)
// Silence detection falls back to render-core if the render comes out empty.

export function synthSupported() {
  return typeof OfflineAudioContext !== 'undefined';
}

// Per-voice patches. ch 0=lead 1=pad 2=pluck/arp 3=bass.
const VOICE_PATCHES = [
  { osc:'sawtooth', unison:6, detuneCents:14, sub:0,
    cutoff:6000, res:2.5, filterEnv:3200, fDecay:0.28,
    attack:0.006, decay:0.22, sustain:0.82, release:0.45,
    level:0.20, reverb:0.42, delay:0.26, chorus:0.5 },
  { osc:'sawtooth', unison:3, detuneCents:9, sub:0,
    cutoff:1700, res:1.4, filterEnv:700, fDecay:0.5,
    attack:0.45, decay:0.5, sustain:0.85, release:1.3,
    level:0.13, reverb:0.6, delay:0.1, chorus:0.4, pump:true },
  { osc:'sawtooth', unison:2, detuneCents:7, sub:0,
    cutoff:3400, res:5, filterEnv:3000, fDecay:0.14,
    attack:0.002, decay:0.17, sustain:0.22, release:0.22,
    level:0.16, reverb:0.3, delay:0.32, chorus:0.25 },
  { osc:'sawtooth', unison:1, detuneCents:0, sub:12,
    cutoff:850, res:3, filterEnv:450, fDecay:0.1,
    attack:0.003, decay:0.12, sustain:0.55, release:0.12,
    level:0.3, reverb:0.05, delay:0.03, chorus:0, rolling:true },
];
export const VOICE_LEVELS = [1.0, 0.8, 0.7, 0.95];

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
    for (let i = 0; i < len; i++) chd[i] = (rand()*2-1) * Math.pow(1 - i/len, decay*3);
  }
  const conv = octx.createConvolver(); conv.buffer = impulse;
  const input = octx.createGain(); input.connect(conv);
  return { input, output: conv };
}
function createDelay(octx, delayTime, feedback) {
  const delay = octx.createDelay(2.0); delay.delayTime.value = Math.min(1.9, delayTime);
  const fb = octx.createGain(); fb.gain.value = feedback;
  delay.connect(fb); fb.connect(delay);
  const input = octx.createGain(); input.connect(delay);
  return { input, output: delay };
}
function createChorus(octx, rate, depth) {
  const delay = octx.createDelay(0.05); delay.delayTime.value = 0.02;
  const lfo = octx.createOscillator(); lfo.frequency.value = rate;
  const lfoGain = octx.createGain(); lfoGain.gain.value = depth;
  lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start(0);
  const input = octx.createGain(); input.connect(delay);
  return { input, output: delay };
}

// Kick: pitch-drop sine, four on the floor.
function scheduleKick(octx, bus, t) {
  const osc = octx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  const env = octx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1.0, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(env); env.connect(bus);
  osc.start(t); osc.stop(t + 0.25);
  // click transient
  const click = octx.createOscillator(); click.type = 'square';
  click.frequency.value = 900;
  const cEnv = octx.createGain();
  cEnv.gain.setValueAtTime(0.25, t);
  cEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  click.connect(cEnv); cEnv.connect(bus);
  click.start(t); click.stop(t + 0.03);
}

function scheduleNote(octx, bus, patch, midi, startSec, dur, vel) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const endSec = startSec + dur;
  for (let u = 0; u < patch.unison; u++) {
    const detune = patch.unison > 1 ? (u/(patch.unison-1) - 0.5) * 2 * patch.detuneCents : 0;
    const osc = octx.createOscillator(); osc.type = patch.osc;
    osc.frequency.value = freq; osc.detune.value = detune;
    const filt = octx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = patch.res;
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
    osc.start(startSec); osc.stop(endSec + patch.release + 0.05);
  }
  if (patch.sub > 0) {
    const subFreq = freq * Math.pow(2, -patch.sub/12);
    const osc = octx.createOscillator(); osc.type = 'sine'; osc.frequency.value = subFreq;
    const env = octx.createGain();
    env.gain.setValueAtTime(0, startSec);
    env.gain.linearRampToValueAtTime(vel*0.7, startSec + patch.attack);
    env.gain.setValueAtTime(vel*0.7*patch.sustain, endSec);
    env.gain.linearRampToValueAtTime(0.0001, endSec + patch.release);
    osc.connect(env); env.connect(bus);
    osc.start(startSec); osc.stop(endSec + patch.release + 0.05);
  }
}

// Rolling offbeat bassline (K-B-B-B psy groove).
function scheduleRollingBass(octx, bus, midi, startSec, dur, vel, spb) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const subFreq = freq * 0.5;
  const step = spb / 2;               // 8th notes
  let t = startSec + step;             // start on the offbeat (the "and")
  while (t < startSec + dur - 0.02) {
    const noteDur = step * 0.72;
    // main bass note
    const osc = octx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
    const filt = octx.createBiquadFilter(); filt.type='lowpass'; filt.Q.value=3;
    filt.frequency.setValueAtTime(1200, t);
    filt.frequency.exponentialRampToValueAtTime(500, t + noteDur);
    const env = octx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel*0.85, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
    osc.connect(filt); filt.connect(env); env.connect(bus);
    osc.start(t); osc.stop(t + noteDur + 0.02);
    // sub layer
    const sub = octx.createOscillator(); sub.type='sine'; sub.frequency.value=subFreq;
    const sEnv = octx.createGain();
    sEnv.gain.setValueAtTime(0, t);
    sEnv.gain.linearRampToValueAtTime(vel*0.6, t + 0.004);
    sEnv.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
    sub.connect(sEnv); sEnv.connect(bus);
    sub.start(t); sub.stop(t + noteDur + 0.02);
    t += step;
  }
}

// Sidechain-style pump: duck the pad bus on every beat.
function applyPump(octx, bus, spb, totalSec) {
  const g = bus.gain;
  const base = g.value;
  let t = 0;
  while (t < totalSec) {
    g.setValueAtTime(base, t);
    g.linearRampToValueAtTime(base * 0.35, t + 0.02);          // duck on the kick
    g.exponentialRampToValueAtTime(base, t + spb * 0.55);      // recover
    t += spb;
  }
}

export async function renderWithSynth(events, bpm) {
  if (!synthSupported()) throw new Error('OfflineAudioContext not supported');
  const spb = 60 / Math.max(1, bpm);
  let maxEnd = 0;
  for (const e of events) { if (e.type!=='note') continue; const end=(e.timestamp+e.duration)*spb; if(end>maxEnd)maxEnd=end; }
  if (maxEnd <= 0) throw new Error('no notes');
  const sr = 44100;
  const leadIn = 0.1, tail = 2.5;
  const totalSec = maxEnd + leadIn + tail;
  const octx = new OfflineAudioContext(2, Math.ceil(totalSec*sr), sr);

  const master = octx.createGain(); master.gain.value = 0.8;
  const limiter = octx.createDynamicsCompressor();
  limiter.threshold.value=-8; limiter.knee.value=3; limiter.ratio.value=14;
  limiter.attack.value=0.002; limiter.release.value=0.18;
  master.connect(limiter); limiter.connect(octx.destination);

  const reverb = createReverb(octx, 2.4, 0.3); reverb.output.connect(master);
  const delay = createDelay(octx, 0.375*spb*2, 0.3); delay.output.connect(master);

  const voiceBus = [];
  for (let ch=0; ch<4; ch++) {
    const patch = VOICE_PATCHES[ch];
    const g = octx.createGain(); g.gain.value = VOICE_LEVELS[ch]*patch.level;
    let busOut = g;
    if (patch.chorus > 0) {
      const chor = createChorus(octx, 0.6 + ch*0.13, 0.004);
      g.connect(chor.input); chor.output.connect(master);
    }
    g.connect(master);
    const rSend = octx.createGain(); rSend.gain.value = patch.reverb; g.connect(rSend); rSend.connect(reverb.input);
    const dSend = octx.createGain(); dSend.gain.value = patch.delay; g.connect(dSend); dSend.connect(delay.input);
    voiceBus.push(g);
  }

  // KICK bus (four on the floor)
  const kickBus = octx.createGain(); kickBus.gain.value = 0.9;
  kickBus.connect(master);
  const kickRev = octx.createGain(); kickRev.gain.value = 0.06; kickBus.connect(kickRev); kickRev.connect(reverb.input);

  const t0 = leadIn;
  // schedule kicks every beat across the whole track
  const totalBeats = Math.ceil(maxEnd / spb);
  for (let b=0; b<totalBeats; b++) scheduleKick(octx, kickBus, t0 + b*spb);

  for (const e of events) {
    if (e.type!=='note') continue;
    const ch = e.channel % 4;
    const patch = VOICE_PATCHES[ch];
    const startSec = t0 + e.timestamp*spb;
    const dur = e.duration*spb;
    const vel = Math.max(0.05, Math.min(1, e.data.velocity/127));
    if (patch.rolling) {
      scheduleRollingBass(octx, voiceBus[ch], e.data.pitch, startSec, dur, vel, spb);
    } else {
      scheduleNote(octx, voiceBus[ch], patch, e.data.pitch, startSec, dur, vel);
    }
  }

  // sidechain pump on the pad (ch1)
  applyPump(octx, voiceBus[1], spb, totalSec);

  const buf = await octx.startRendering();
  let mx=0;
  for(let c=0;c<buf.numberOfChannels && mx<0.001;c++){
    const chd=buf.getChannelData(c);
    for(let i=0;i<chd.length;i+=200){ const v=Math.abs(chd[i]); if(v>mx){mx=v; if(mx>=0.001)break;} }
  }
  if(mx<0.001) throw new Error('synth render produced silence');
  return buf;
}

export function audioBufferToWav(buffer) {
  const nCh = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const blockAlign = nCh*2, dataSize = len*blockAlign;
  const ab = new ArrayBuffer(44+dataSize); const dv = new DataView(ab);
  const ws=(o,s)=>{ for(let i=0;i<s.length;i++) dv.setUint8(o+i,s.charCodeAt(i)); };
  ws(0,'RIFF'); dv.setUint32(4,36+dataSize,true); ws(8,'WAVE'); ws(12,'fmt ');
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,nCh,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*blockAlign,true);
  dv.setUint16(32,blockAlign,true); dv.setUint16(34,16,true);
  ws(36,'data'); dv.setUint32(40,dataSize,true);
  const chans=[]; for(let c=0;c<nCh;c++) chans.push(buffer.getChannelData(c));
  let o=44;
  for(let i=0;i<len;i++){ for(let c=0;c<nCh;c++){ let s=chans[c][i]; s=Math.max(-1,Math.min(1,s)); dv.setInt16(o, s<0?s*0x8000:s*0x7FFF, true); o+=2; } }
  return new Uint8Array(ab);
}
