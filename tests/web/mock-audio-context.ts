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
}

class MockNode {
  kind: string;
  outputs: MockNode[] = [];
  constructor(kind: string) { this.kind = kind; }
  connect(target: MockNode): MockNode { this.outputs.push(target); return target; }
}

export class MockOscillator extends MockNode {
  type = 'sine';
  frequency = new MockParam(440);
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
  constructor() { super('filter'); }
}

export class MockAudioContext {
  state = 'running';
  currentTime = 1.0;
  destination = new MockNode('destination');
  nodes: MockNode[] = [];
  resumeCalls = 0;

  createOscillator(): MockOscillator { const n = new MockOscillator(); this.nodes.push(n); return n; }
  createGain(): MockGain { const n = new MockGain(); this.nodes.push(n); return n; }
  createBiquadFilter(): MockFilter { const n = new MockFilter(); this.nodes.push(n); return n; }
  createDynamicsCompressor(): MockNode { const n = new MockNode('compressor'); this.nodes.push(n); return n; }

  async resume() { this.resumeCalls++; this.state = 'running'; }

  oscillators(): MockOscillator[] {
    return this.nodes.filter((n) => n instanceof MockOscillator) as MockOscillator[];
  }
}
