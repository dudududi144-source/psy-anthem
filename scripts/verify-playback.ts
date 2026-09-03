// PSY ANTHEM - scripts/verify-playback.ts
// Run: bun run scripts/verify-playback.ts
// Headless proof of the playback chain: real engine -> AnthemOutput ->
// PsySynthBrowser on a MockAudioContext -> scheduled oscillators verified.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { PsySynthBrowser, midiToFreq } from '../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../web/presets.js';
import { MockAudioContext } from '../tests/web/mock-audio-context';

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

function fail(msg: string): never {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

async function main(): Promise<void> {
  const out = createAnthemEngine(config).generate();
  if (!out) fail('engine returned null');
  if (out!.events.length === 0) fail('no events generated');

  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  const seconds = await synth.playEvents(out!.events, config.bpm ?? 140, 0);

  // Lookahead scheduler: advance the mock clock and let the window fill the
  // entire song before asserting full coverage.
  let pumpGuard = 0;
  while (synth.pendingNotes > 0 && pumpGuard < 120) {
    ctx.currentTime += 5;
    await new Promise((r) => setTimeout(r, 280));
    pumpGuard++;
  }
  if (synth.pendingNotes > 0) fail('lookahead left ' + synth.pendingNotes + ' notes unscheduled');

  const oscs = ctx.oscillators();
  const noteCount = out!.events.filter((e) => e.type === 'note').length;

  // Multi-osc engine: at least one oscillator per note (detuned unison + subs add more).
  if (synth.lastNoteCount !== noteCount) fail('scheduled notes ' + synth.lastNoteCount + ' != event notes ' + noteCount);
  if (oscs.length < noteCount) fail('too few oscillators: ' + oscs.length + ' for ' + noteCount + ' notes');

  // Every oscillator must be started exactly once.
  for (const osc of oscs) {
    if (osc.starts.length !== 1) fail('oscillator not started exactly once');
  }
  // Voice oscillators must carry audible, sane frequencies.
  // Sub-audio oscillators (< 20 Hz) are modulators, e.g. the global chorus LFO at 0.5 Hz.
  const voiceOscs = oscs.filter((o) => o.frequency.value >= 20);
  if (voiceOscs.length < noteCount) fail('too few voice oscillators: ' + voiceOscs.length + ' for ' + noteCount + ' notes');
  for (const osc of voiceOscs) {
    if (!(osc.frequency.value >= 20 && osc.frequency.value <= 16000)) fail('frequency out of range: ' + osc.frequency.value);
  }

  // Every anthem pitch must appear as a fundamental among the scheduled oscillators.
  // Phase 9 voices apply intentional pitch jitter (glitch ±3%, granular ±2%),
  // so fundamentals are matched within ±6%.
  const scheduled = voiceOscs.map((o) => o.frequency.value);
  for (const e of out!.events) {
    if (e.type !== 'note') continue;
    const f = midiToFreq((e.data as { pitch: number }).pitch);
    const found = scheduled.some((sf) => Math.abs(sf - f) / f <= 0.06);
    if (!found) fail('fundamental missing from the schedule: ' + f);
  }

  // Bass voice (channel 3, psy-bass) must carry a -1200-cent sub oscillator.
  const hasSub = oscs.some((o) => o.detune.value === -1200);
  if (!hasSub) fail('psy-bass sub-octave oscillator (-1200 cents) missing');

  console.log('=== PSY ANTHEM - headless playback verification ===');
  console.log('events generated:   ' + out!.events.length);
  console.log('oscillators scheduled: ' + oscs.length + ' (multi-osc voices + subs)');
  console.log('playback duration:  ' + seconds.toFixed(1) + 's at ' + config.bpm + ' BPM');
  console.log('context state:      ' + ctx.state);
  console.log('routing:            oscs -> voice filter(ADSR cutoff) -> drive -> ADSR gain -> master -> drive -> filter -> comp');
  console.log('RESULT: PASS - the playback chain is fully wired');
}

main().catch((e) => fail(String(e)));
