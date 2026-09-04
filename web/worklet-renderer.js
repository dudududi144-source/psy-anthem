// PSY ANTHEM - web/worklet-renderer.js
// Offline renderer that uses the professional PSY synth AudioWorklet
// (copied from PsySynthPro into this repo as psysynth-worklet.js) to render
// psy-anthem events to a WAV, one worklet node per voice channel so each of
// the four voices (lead/pad/pluck/bass) gets its own professional patch.
// Falls back gracefully: callers catch the rejection and use render-core.

export const VOICE_PATCHES = [
  { wave: 0, detune: 8, unison: 5, spread: 22, sub: 0, noise: 0,
    fmRatio: 2, fmDepth: 0, fm2Ratio: 3, fm2Depth: 0, fm3Ratio: 4, fm3Depth: 0,
    fm4Ratio: 5, fm4Depth: 0, fm5Ratio: 6, fm5Depth: 0, fm6Ratio: 7, fm6Depth: 0,
    filterType: 0, cutoff: 5200, res: 3, filterEnv: 40, wtPos: 0,
    attack: 5, decay: 220, sustain: 78, release: 420,
    fAttack: 4, fDecay: 260, fSustain: 55, fRelease: 380, fEnvAmt: 45,
    lfo2Rate: 5, lfo2Wave: 0, lfoTarget: 0, lfoRate: 2.2, lfoDepth: 0, lfoWave: 0,
    lfoCutoff: 0, lfoPitch: 0, lfoAmp: 0, lfoFM: 0, envPitch: 0, envFM: 0,
    modLC:0,modLP:0,modLA:0,modLF:0,modLR:0,modEC:0,modEP:0,modEA:0,modEF:0,modER:0,
    modVC:0,modVP:0,modVA:0,modVF:0,modVR:0,
    glideTime: 0, width: 70, master: 82, reverb: 32, delay: 24,
    fxDist: 8, fxChorus: 20, fxCrush: 0, chRate: 0.8 },
  { wave: 4, detune: 7, unison: 3, spread: 16, sub: 12, noise: 4,
    fmRatio: 2, fmDepth: 0, fm2Ratio: 3, fm2Depth: 0, fm3Ratio: 4, fm3Depth: 0,
    fm4Ratio: 5, fm4Depth: 0, fm5Ratio: 6, fm5Depth: 0, fm6Ratio: 7, fm6Depth: 0,
    filterType: 0, cutoff: 1900, res: 1.6, filterEnv: 22, wtPos: 40,
    attack: 420, decay: 520, sustain: 86, release: 1300,
    fAttack: 220, fDecay: 420, fSustain: 62, fRelease: 850, fEnvAmt: 26,
    lfo2Rate: 5, lfo2Wave: 0, lfoTarget: 0, lfoRate: 0.4, lfoDepth: 12, lfoWave: 0,
    lfoCutoff: 18, lfoPitch: 0, lfoAmp: 8, lfoFM: 0, envPitch: 0, envFM: 0,
    modLC:0,modLP:0,modLA:0,modLF:0,modLR:0,modEC:0,modEP:0,modEA:0,modEF:0,modER:0,
    modVC:0,modVP:0,modVA:0,modVF:0,modVR:0,
    glideTime: 0, width: 92, master: 62, reverb: 58, delay: 14,
    fxDist: 0, fxChorus: 34, fxCrush: 0, chRate: 0.5 },
  { wave: 0, detune: 5, unison: 2, spread: 11, sub: 0, noise: 0,
    fmRatio: 2, fmDepth: 0, fm2Ratio: 3, fm2Depth: 0, fm3Ratio: 4, fm3Depth: 0,
    fm4Ratio: 5, fm4Depth: 0, fm5Ratio: 6, fm5Depth: 0, fm6Ratio: 7, fm6Depth: 0,
    filterType: 0, cutoff: 3400, res: 6, filterEnv: 68, wtPos: 0,
    attack: 2, decay: 190, sustain: 22, release: 260,
    fAttack: 2, fDecay: 160, fSustain: 22, fRelease: 220, fEnvAmt: 72,
    lfo2Rate: 5, lfo2Wave: 0, lfoTarget: 0, lfoRate: 2.2, lfoDepth: 0, lfoWave: 0,
    lfoCutoff: 0, lfoPitch: 0, lfoAmp: 0, lfoFM: 0, envPitch: 0, envFM: 0,
    modLC:0,modLP:0,modLA:0,modLF:0,modLR:0,modEC:0,modEP:0,modEA:0,modEF:0,modER:0,
    modVC:0,modVP:0,modVA:0,modVF:0,modVR:0,
    glideTime: 0, width: 55, master: 70, reverb: 26, delay: 34,
    fxDist: 6, fxChorus: 12, fxCrush: 0, chRate: 0.8 },
  { wave: 0, detune: 0, unison: 1, spread: 0, sub: 62, noise: 0,
    fmRatio: 0.5, fmDepth: 0, fm2Ratio: 3, fm2Depth: 0, fm3Ratio: 4, fm3Depth: 0,
    fm4Ratio: 5, fm4Depth: 0, fm5Ratio: 6, fm5Depth: 0, fm6Ratio: 7, fm6Depth: 0,
    filterType: 0, cutoff: 950, res: 4, filterEnv: 38, wtPos: 0,
    attack: 3, decay: 160, sustain: 62, release: 160,
    fAttack: 2, fDecay: 130, fSustain: 42, fRelease: 160, fEnvAmt: 42,
    lfo2Rate: 5, lfo2Wave: 0, lfoTarget: 0, lfoRate: 2.2, lfoDepth: 0, lfoWave: 0,
    lfoCutoff: 0, lfoPitch: 0, lfoAmp: 0, lfoFM: 0, envPitch: 0, envFM: 0,
    modLC:0,modLP:0,modLA:0,modLF:0,modLR:0,modEC:0,modEP:0,modEA:0,modEF:0,modER:0,
    modVC:0,modVP:0,modVA:0,modVF:0,modVR:0,
    glideTime: 0, width: 20, master: 88, reverb: 10, delay: 6,
    fxDist: 14, fxChorus: 0, fxCrush: 0, chRate: 0.8 },
];

export const VOICE_LEVELS = [1.0, 0.8, 0.72, 0.95];

export function workletSupported() {
  return typeof OfflineAudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    !!(typeof OfflineAudioContext === 'function' && OfflineAudioContext.prototype &&
       'audioWorklet' in OfflineAudioContext.prototype);
}

export async function renderWithWorklet(events, bpm) {
  if (!workletSupported()) throw new Error('worklet not supported');
  const spb = 60 / Math.max(1, bpm);
  let maxEnd = 0;
  for (const e of events) {
    if (e.type !== 'note') continue;
    const end = (e.timestamp + e.duration) * spb;
    if (end > maxEnd) maxEnd = end;
  }
  if (maxEnd <= 0) throw new Error('no notes');
  const leadIn = 0.12, tail = 2.6;
  const totalSec = maxEnd + leadIn + tail;
  const sr = 44100;
  const octx = new OfflineAudioContext(2, Math.ceil(totalSec * sr), sr);
  await octx.audioWorklet.addModule('psysynth-worklet.js');
  const master = octx.createGain();
  master.gain.value = 0.8;
  master.connect(octx.destination);
  const nodes = [];
  for (let ch = 0; ch < 4; ch++) {
    const node = new AudioWorkletNode(octx, 'psysynth-processor', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });
    const g = octx.createGain();
    g.gain.value = VOICE_LEVELS[ch];
    node.connect(g);
    g.connect(master);
    node.port.postMessage({ type: 'params', values: VOICE_PATCHES[ch] });
    nodes.push(node);
  }
  const t0 = leadIn;
  for (const e of events) {
    if (e.type !== 'note') continue;
    const ch = e.channel % 4;
    const node = nodes[ch];
    if (!node) continue;
    const startSec = e.timestamp * spb;
    const endSec = (e.timestamp + e.duration) * spb;
    const vel = Math.max(1, Math.min(127, Math.round((e.data.velocity / 127) * 100)));
    node.port.postMessage({ type: 'noteOnAt', when: t0 + startSec, note: e.data.pitch, vel });
    node.port.postMessage({ type: 'noteOffAt', when: t0 + endSec, note: e.data.pitch });
  }
  const buf = await octx.startRendering();
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
