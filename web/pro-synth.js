// PSY ANTHEM - pro-synth.js
// Professional psy-trance synth engine adapted for psy-anthem.
// Wraps the PsySynthPro AudioWorklet (psysynth-worklet.js) and renders a full
// anthem offline to a WAV. Each psy-anthem voice (lead/pad/pluck/bass) gets a
// professional PsySynthPro preset.

// ---- Professional presets adapted from PsySynthPro ----
export const PRO_PRESETS = {
  lead: { wave:0, detune:0, unison:5, spread:14, sub:0, noise:0,
    fmRatio:2, fmDepth:0, filterType:0, cutoff:2800, res:3, filterEnv:55,
    attack:4, decay:300, sustain:75, release:400,
    fAttack:5, fDecay:300, fSustain:45, fRelease:400, fEnvAmt:60,
    lfoRate:2.2, lfoDepth:0, lfoCutoff:0, lfoPitch:6, lfoAmp:0, lfoFM:0,
    master:80, reverb:40, delay:25, fxDist:10, fxChorus:30 },
  pad: { wave:4, detune:0, unison:3, spread:20, sub:12, noise:0,
    fmRatio:2, fmDepth:0, filterType:0, cutoff:1600, res:1.5, filterEnv:30,
    attack:400, decay:600, sustain:80, release:1200,
    fAttack:200, fDecay:500, fSustain:60, fRelease:800, fEnvAmt:30,
    lfoRate:0.5, lfoDepth:15, lfoCutoff:20, lfoPitch:0, lfoAmp:10, lfoFM:0,
    master:60, reverb:55, delay:15, fxDist:0, fxChorus:40 },
  pluck: { wave:0, detune:0, unison:2, spread:10, sub:0, noise:0,
    fmRatio:2, fmDepth:0, filterType:0, cutoff:2400, res:6, filterEnv:70,
    attack:1, decay:200, sustain:20, release:200,
    fAttack:2, fDecay:150, fSustain:20, fRelease:200, fEnvAmt:70,
    lfoRate:2.2, lfoDepth:0, lfoCutoff:0, lfoPitch:0, lfoAmp:0, lfoFM:0,
    master:70, reverb:30, delay:30, fxDist:15, fxChorus:20 },
  bass: { wave:0, detune:0, unison:1, spread:0, sub:35, noise:0,
    fmRatio:0.5, fmDepth:15, filterType:0, cutoff:900, res:4, filterEnv:50,
    attack:2, decay:160, sustain:40, release:120,
    fAttack:2, fDecay:130, fSustain:35, fRelease:120, fEnvAmt:50,
    lfoRate:2.2, lfoDepth:0, lfoCutoff:0, lfoPitch:0, lfoAmp:0, lfoFM:0,
    master:85, reverb:10, delay:5, fxDist:25, fxChorus:0 },
};

// Voice role for each psy-anthem channel (0=lead,1=pad,2=pluck,3=bass)
export const VOICE_ROLE = ['lead','pad','pluck','bass'];

// ---- Offline render using OfflineAudioContext + AudioWorklet ----
export async function renderWithProSynth(events, bpm, workletUrl) {
  const sr = 44100;
  const spb = 60 / Math.max(1, bpm);
  let endSec = 0;
  const notes = [];
  for (const e of events) {
    if (e.type !== 'note') continue;
    const start = e.timestamp * spb;
    const dur = Math.max(0.05, e.duration * spb);
    notes.push({ start, dur, pitch: e.data.pitch, vel: (e.data.velocity||100)/127, ch: e.channel % 4 });
    if (start + dur > endSec) endSec = start + dur;
  }
  if (notes.length === 0) throw new Error('no notes');
  const totalSec = endSec + 2.5;
  const octx = new OfflineAudioContext(2, Math.ceil(totalSec * sr), sr);
  if (!octx.audioWorklet) throw new Error('no audioWorklet');
  await octx.audioWorklet.addModule(workletUrl || 'psysynth-worklet.js');

  // One worklet node per voice role
  const roleNodes = {};
  for (const role of ['lead','pad','pluck','bass']) {
    const node = new AudioWorkletNode(octx, 'psysynth-processor', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });
    // send the preset params
    const preset = PRO_PRESETS[role];
    node.port.postMessage({ type:'params', values: preset });
    node.connect(octx.destination);
    roleNodes[role] = node;
  }

  // Schedule noteOn/noteOff messages
  const leadIn = 0.1;
  for (const n of notes) {
    const role = VOICE_ROLE[n.ch] || 'lead';
    const node = roleNodes[role];
    const tOn = leadIn + n.start;
    const tOff = tOn + n.dur;
    node.port.postMessage({ type:'noteOnAt', when: tOn, note: n.pitch, vel: Math.round(n.vel*100) });
    node.port.postMessage({ type:'noteOffAt', when: tOff, note: n.pitch });
  }

  const buf = await octx.startRendering();
  return buf;
}

// ---- AudioBuffer -> WAV ----
export function audioBufferToWav(buffer) {
  const nCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const blockAlign = nCh * 2;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0,'RIFF'); dv.setUint32(4, 36 + dataSize, true); ws(8,'WAVE'); ws(12,'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true);
  dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true);
  ws(36,'data'); dv.setUint32(40, dataSize, true);
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
