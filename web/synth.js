// PSY ANTHEM - web/synth.js
// Browser HOW-layer for the demo: plays MusicalEvent[] through Web Audio.
// The engine stays WHAT-layer; this file is presentation-only (like a DAW).

// Pure scheduling math (unit-testable without AudioContext).
export function scheduleEvents(events, bpm, startBeat = 0) {
  const secondsPerBeat = 60 / Math.max(1, bpm);
  const notes = [];
  for (const event of events) {
    if (event.type !== 'note') continue;
    if (event.timestamp + event.duration <= startBeat) continue;
    const pitch = event.data.pitch;
    const frequency = 440 * Math.pow(2, (pitch - 69) / 12);
    const offset = Math.max(0, startBeat - event.timestamp);
    notes.push({
      channel: event.channel,
      frequency,
      startBeat: Math.max(event.timestamp, startBeat),
      startAt: (event.timestamp - startBeat) * secondsPerBeat,
      duration: Math.max(0.05, (event.duration - offset) * secondsPerBeat),
      velocity: event.data.velocity / 127,
      articulation: event.data.articulation || 'normal',
      pitch,
    });
  }
  notes.sort((a, b) => a.startAt - b.startAt);
  const totalBeats = events.reduce((m, e) => {
    if (e.type !== 'note') return m;
    return Math.max(m, e.timestamp + e.duration);
  }, 0);
  return { notes, totalSeconds: Math.max(0, (totalBeats - startBeat)) * secondsPerBeat, totalBeats };
}

export function midiToFreq(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

const VOICE_STYLE = {
  0: { type: 'sawtooth', cutoff: 2400, gain: 0.5 },   // lead
  1: { type: 'square', cutoff: 1400, gain: 0.28 },    // harmony
  2: { type: 'triangle', cutoff: 3200, gain: 0.4 },   // counter
  3: { type: 'sine', cutoff: 700, gain: 0.6 },        // bass
};

export class PsySynthBrowser {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
    this.activeNodes = [];
    this._timer = null;
    this.onFinish = null;
  }

  // Play a full AnthemOutput. fromBeat lets the scrubber start mid-piece.
  playEvents(events, bpm = 140, fromBeat = 0) {
    this.stop();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const plan = scheduleEvents(events, bpm, fromBeat);
    const t0 = this.ctx.currentTime + 0.06;

    for (const note of plan.notes) {
      this._scheduleNote(note, t0 + Math.max(0, note.startAt));
    }

    if (plan.totalSeconds > 0 && this.onFinish) {
      this._timer = setTimeout(() => {
        if (this.onFinish) this.onFinish();
      }, (plan.totalSeconds + 0.4) * 1000);
    }
    return plan.totalSeconds;
  }

  _scheduleNote(note, startTime) {
    const style = VOICE_STYLE[note.channel] || VOICE_STYLE[0];
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = style.type;
    osc.frequency.value = note.frequency;
    filter.type = 'lowpass';
    filter.frequency.value = style.cutoff * (0.6 + note.velocity * 0.7);

    // Articulation shapes the envelope.
    let dur = note.duration;
    let peak = note.velocity * style.gain;
    if (note.articulation === 'staccato') dur = Math.min(dur, 0.12);
    if (note.articulation === 'accent') peak = Math.min(1, peak * 1.35);
    if (note.articulation === 'ghost') peak *= 0.45;

    const attack = note.articulation === 'legato' ? 0.03 : 0.01;
    const release = note.articulation === 'legato' ? 0.12 : 0.05;
    const sustainLevel = peak * 0.7;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + attack);
    gain.gain.linearRampToValueAtTime(sustainLevel, startTime + attack + 0.06);
    const releaseStart = Math.max(startTime + attack + 0.06, startTime + dur - release);
    gain.gain.setValueAtTime(sustainLevel, releaseStart);
    gain.gain.linearRampToValueAtTime(0, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    this.activeNodes.push(osc);
  }

  // Audition a single note (piano-roll click).
  playNote(pitch, velocity = 100) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._scheduleNote({
      channel: 0,
      frequency: midiToFreq(pitch),
      startAt: 0,
      duration: 0.35,
      velocity: velocity / 127,
      articulation: 'normal',
      pitch,
    }, this.ctx.currentTime + 0.02);
  }

  stop() {
    for (const node of this.activeNodes) {
      try { node.stop(); } catch (e) { /* already stopped */ }
    }
    this.activeNodes = [];
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
