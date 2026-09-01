// PSY ANTHEM - tests/web/mock-audio-context.ts
// A recording stand-in for AudioContext: lets us verify the full playback
// chain (engine events -> scheduled oscillators) without real audio hardware.

class MockParam {
  value: number;
  events: Array<[string, number, number]>;
  constructor(initial: number) {
    this.value = initial;
    this.events = [];
  }
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['ramp', v, t]); }
  setTargetAtTime(v: number, t: number, _tc: number) { this.events.push(['target', v, t]); }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push(['exp', v, t]); }
}

class MockNode {
  kind: string;
  outputs: unknown[] = [];
  constructor(kind: string) { this.kind = kind; }
  connect(target: unknown): unknown { this.outputs.push(target); return target; }
}

export class MockOscillator extends MockNode {
  type = 'sine';
  frequency = new MockParam(440);
  detune = new MockParam(0);
  starts: number[] = [];
  stops: number[] = [];
  constructor() { super('oscillator'); }
  start(t: number) { this.starts.push(t); }
  stop(t?: number) { this.stops.push(t ?? -1); }
}

export class MockGain extends MockNode {
  gain = new MockParam(1);
  constructor() { super('gain'); }
}

export class MockFilter extends MockNode {
  type = 'lowpass';
  frequency = new MockParam(1000);
  Q = new MockParam(0);
  constructor() { super('filter'); }
}

export class MockCompressor extends MockNode {
  threshold = new MockParam(-24);
  knee = new MockParam(30);
  ratio = new MockParam(12);
  attack = new MockParam(0.003);
  release = new MockParam(0.25);
  constructor() { super('compressor'); }
}

export class MockDelay extends MockNode {
  delayTime = new MockParam(0.3);
  constructor() { super('delay'); }
}

export class MockConvolver extends MockNode {
  buffer: MockBuffer | null = null;
  constructor() { super('convolver'); }
}

export class MockShaper extends MockNode {
  curve: Float32Array | null = null;
  constructor() { super('shaper'); }
}

export class MockBuffer {
  length: number;
  sampleRate: number;
  channels: number;
  private data: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.channels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(i: number): Float32Array { return this.data[i]!; }
}

export class MockAudioContext {
  state = 'running';
  currentTime = 1.0;
  sampleRate = 44100;
  destination = new MockNode('destination');
  nodes: MockNode[] = [];
  resumeCalls = 0;

  createOscillator(): MockOscillator { const n = new MockOscillator(); this.nodes.push(n); return n; }
  createGain(): MockGain { const n = new MockGain(); this.nodes.push(n); return n; }
  createBiquadFilter(): MockFilter { const n = new MockFilter(); this.nodes.push(n); return n; }
  createDynamicsCompressor(): MockCompressor { const n = new MockCompressor(); this.nodes.push(n); return n; }
  createDelay(_max?: number): MockDelay { const n = new MockDelay(); this.nodes.push(n); return n; }
  createConvolver(): MockConvolver { const n = new MockConvolver(); this.nodes.push(n); return n; }
  createWaveShaper(): MockShaper { const n = new MockShaper(); this.nodes.push(n); return n; }
  createBuffer(channels: number, length: number, sampleRate: number): MockBuffer {
    return new MockBuffer(channels, length, sampleRate);
  }

  async resume() { this.resumeCalls++; this.state = 'running'; }

  oscillators(): MockOscillator[] {
    return this.nodes.filter((n) => n instanceof MockOscillator) as MockOscillator[];
  }
}
