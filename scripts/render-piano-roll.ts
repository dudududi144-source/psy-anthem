// PSY ANTHEM - scripts/render-piano-roll.ts
// ASCII piano roll preview. Run: bun run pianoroll
import { createAnthemEngine } from '../src/index';
import { AnthemIntent, EnergyCurve } from '../src/types';

function main(): void {
  const out = createAnthemEngine({
    seed: 42,
    intent: AnthemIntent.EUPHORIC_TRANCE,
    scale: { root: 0, mode: 'minor' },
    energyCurve: EnergyCurve.ARC,
    targetRange: { min: 48, max: 84 },
    voices: 3,
    bars: 8,
    bpm: 140,
  }).generate();

  if (!out) {
    console.log('Generation failed');
    return;
  }

  const steps = out.metadata.bars * 16;
  let lo = 127;
  let hi = 0;
  for (const e of out.events) {
    if (e.type !== 'note') continue;
    const d = e.data as { pitch: number };
    if (d.pitch < lo) lo = d.pitch;
    if (d.pitch > hi) hi = d.pitch;
  }

  const rows = hi - lo + 1;
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let s = 0; s < steps; s++) row.push('.');
    grid.push(row);
  }

  for (const e of out.events) {
    if (e.type !== 'note') continue;
    const d = e.data as { pitch: number };
    const startStep = Math.round(e.timestamp * 4);
    const lenSteps = Math.max(1, Math.round(e.duration * 4));
    const row = hi - d.pitch;
    for (let s = startStep; s < Math.min(steps, startStep + lenSteps); s++) {
      if (row >= 0 && row < rows && s >= 0 && s < steps) {
        grid[row]![s] = '#';
      }
    }
  }

  console.log('PSY ANTHEM piano roll (seed=42, bars=' + out.metadata.bars + ')');
  for (let r = 0; r < rows; r++) {
    const pitch = hi - r;
    console.log(String(pitch).padStart(3) + ' |' + grid[r]!.join('') + '|');
  }
  console.log('Memorability: ' + out.metadata.memorabilityScore + '/100  Quality: ' + out.metadata.quality);
}

main();
