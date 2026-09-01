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
      startAt: Math.max(0, event.timestamp - startBeat) * secondsPerBeat,
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
  0: { type: 'sawtooth', cutoff: 2400, gain: 0.65 },  // lead
  1: { type: 'square', cutoff: 1400, gain: 0.4 },     // harmony
  2: { type: 'triangle', cutoff: 3200, gain: 0.5 },   // counter
  3: { type: 'sine', cutoff: 700, gain: 0.75 },       // bass
};

export class PsySynthBrowser {
  constructor(audioContext) {
    this.ctx = audioContext;
    // Audio chain: voices -> masterGain -> compressor -> destination
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.compressor.connect(this.ctx.destination);
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.compressor);
    this.activeNodes = [];
    this._timer = null;
    this.onFinish = null;
  }

  // Play a full AnthemOutput. fromBeat lets the scrubber start mid-piece.
  // Async: awaits the AudioContext unlock (autoplay policy) before scheduling.
  async playEvents(events, bpm = 140, fromBeat = 0) {
    this.stop();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* context may still be locked */ }
    }
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

  // Audibility check: three staggered tones (C major triad). Returns total seconds.
  async testSound() {
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* ignore */ }
    }
    const testNotes = [
      { pitch: 60, duration: 0.3 }, // C4
      { pitch: 64, duration: 0.3 }, // E4
      { pitch: 67, duration: 0.3 }, // G4
    ];
    const base = this.ctx.currentTime + 0.02;
    for (let i = 0; i < testNotes.length; i++) {
      const n = testNotes[i];
      this._scheduleNote({
        channel: 0,
        frequency: midiToFreq(n.pitch),
        startAt: i * 0.4,
        duration: n.duration,
        velocity: 0.8,
        articulation: 'normal',
        pitch: n.pitch,
      }, base + i * 0.4);
    }
    return 1.2; // total duration in seconds
  }

  // Audition a single note (piano-roll click / TEST SOUND).
  playNote(pitch, velocity = 100) {
    if (this.ctx.state !== 'running') {
      try { this.ctx.resume(); } catch (e) { /* ignore */ }
    }
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
