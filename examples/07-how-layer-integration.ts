// PSY ANTHEM - examples/07-how-layer-integration.ts
// Run: bun run examples/07-how-layer-integration.ts
// Demonstrates the WHAT -> HOW contract: psy-anthem decides the notes,
// a HOW-layer device (psysynth-style) realizes them as audio.
// NO audio here - this is a deterministic dispatch simulation.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig, AnthemOutput, MusicalEvent, NoteData } from '../src/types';

// ---- Mock HOW layer: a psysynth-style realization device ----

interface DevicePlan {
  channel: number;
  device: string;
  patch: string;
  noteCount: number;
  firstNoteTick: number;
  articulations: Record<string, number>;
}

function mockPsysynthDispatch(out: AnthemOutput): DevicePlan[] {
  const plans = new Map<number, DevicePlan>();

  for (const e of out.events) {
    if (e.type !== 'note') continue;
    const data = e.data as NoteData;
    let plan = plans.get(e.channel);
    if (!plan) {
      plan = {
        channel: e.channel,
        device: 'psysynth',
        patch: patchForChannel(e.channel),
        noteCount: 0,
        firstNoteTick: Math.round(e.timestamp * 480),
        articulations: {},
      };
      plans.set(e.channel, plan);
    }
    plan.noteCount++;
    const art = data.articulation ?? 'normal';
    plan.articulations[art] = (plan.articulations[art] ?? 0) + 1;
  }

  return Array.from(plans.values()).sort((a, b) => a.channel - b.channel);
}

function patchForChannel(channel: number): string {
  if (channel === 0) return 'PolyBLEP supersaw -> ZDF SVF -> delay/reverb';
  if (channel === 1) return 'PolyBLEP square -> ZDF SVF (softer cutoff)';
  if (channel === 2) return 'Wavetable pluck -> ZDF SVF (short envelope)';
  return 'PolyBLEP saw sub -> lowpass (bass bus, sidechained)';
}

// ---- The contract in action ----

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 4,
  bars: 16,
  bpm: 140,
};

const out = createAnthemEngine(config).generate();
if (!out) {
  console.error('generation failed');
  process.exit(1);
}

console.log('=== PSY ANTHEM - HOW-layer integration (mock psysynth) ===');
console.log('WHAT layer produced: ' + out.events.length + ' MusicalEvents');
console.log('');

const plans = mockPsysynthDispatch(out);
let dispatched = 0;
for (const p of plans) {
  dispatched += p.noteCount;
  const arts = Object.entries(p.articulations).map((kv) => kv[0] + '=' + kv[1]).join(' ');
  console.log('channel ' + p.channel + ' -> ' + p.device + ': ' + p.patch);
  console.log('   notes=' + p.noteCount + ' first@tick' + p.firstNoteTick + ' articulation{' + arts + '}');
}

console.log('');
console.log('contract check:');
console.log('  events produced:  ' + out.events.length);
console.log('  events dispatched:' + String(dispatched).padStart(4));
console.log('  dropped:          ' + (out.events.length - dispatched));
console.log('  result:           ' + (dispatched === out.events.length ? 'PASS - every WHAT event maps to a HOW action' : 'FAIL'));
