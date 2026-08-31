// PSY ANTHEM - tests/integration/cli.test.ts
// CLI: argument parsing + real runs producing MIDI output.
import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs, runCli } from '../../scripts/cli';

describe('CLI parseArgs', () => {
  it('provides sensible defaults', () => {
    const opts = parseArgs([]);
    if (opts === 'help') throw new Error('unexpected help');
    expect(opts.seed).toBe(42);
    expect(opts.intent).toBe('euphoric-trance');
    expect(opts.scaleRoot).toBe(0);
    expect(opts.scaleMode).toBe('minor');
    expect(opts.energyCurve).toBe('arc');
    expect(opts.voices).toBe(3);
    expect(opts.bars).toBe(32);
    expect(opts.bpm).toBe(140);
    expect(opts.output).toBeNull();
    expect(opts.json).toBe(false);
  });

  it('parses all flags', () => {
    const opts = parseArgs([
      '--seed', '1337',
      '--intent', 'dark-psy',
      '--scale-root', '7',
      '--scale-mode', 'phrygian',
      '--energy-curve', 'build-drop',
      '--voices', '4',
      '--bars', '64',
      '--bpm', '145',
      '--output', 'out.mid',
      '--json',
    ]);
    if (opts === 'help') throw new Error('unexpected help');
    expect(opts.seed).toBe(1337);
    expect(opts.intent).toBe('dark-psy');
    expect(opts.scaleRoot).toBe(7);
    expect(opts.scaleMode).toBe('phrygian');
    expect(opts.energyCurve).toBe('build-drop');
    expect(opts.voices).toBe(4);
    expect(opts.bars).toBe(64);
    expect(opts.bpm).toBe(145);
    expect(opts.output).toBe('out.mid');
    expect(opts.json).toBe(true);
  });

  it('returns help for --help', () => {
    expect(parseArgs(['--help'])).toBe('help');
    expect(parseArgs(['-h'])).toBe('help');
  });

  it('rejects unknown flags and invalid values', () => {
    expect(() => parseArgs(['--nope'])).toThrow();
    expect(() => parseArgs(['--intent', 'nope-core'])).toThrow();
    expect(() => parseArgs(['--scale-mode', 'blues'])).toThrow();
    expect(() => parseArgs(['--energy-curve', 'zigzag'])).toThrow();
    expect(() => parseArgs(['--seed'])).toThrow(); // missing value
  });
});

describe('CLI runCli', () => {
  it('--help exits 0', () => {
    expect(runCli(['--help'])).toBe(0);
  });

  it('generates and writes a MIDI file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psy-cli-'));
    const file = path.join(dir, 'cli-test.mid');
    const code = runCli(['--seed', '42', '--bars', '16', '--output', file]);
    expect(code).toBe(0);
    expect(fs.existsSync(file)).toBe(true);
    const disk = fs.readFileSync(file);
    expect(Array.from(disk.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('--json exits 0 and is deterministic between runs', () => {
    expect(runCli(['--seed', '7', '--bars', '8', '--json'])).toBe(0);
  });

  it('invalid config exits 1', () => {
    expect(runCli(['--bars', '4'])).toBe(1); // below minimum 8
    expect(runCli(['--intent', 'fake'])).toBe(1);
  });
});
