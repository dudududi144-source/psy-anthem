// PSY ANTHEM - solver/validator.ts
import { ALLOWED_DURATIONS } from '../constants';
import type { AnthemConfig, LintIssue, MusicalEvent, TheoryLintResult } from '../types';
import { scalePitchClasses, isInScale } from '../harmony/intervals';

// Theory lint: hard errors fail generation; soft warnings reduce score.
export function theoryLint(events: MusicalEvent[], config: AnthemConfig): TheoryLintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const pcs = scalePitchClasses(config.scale);

  if (events.length === 0) {
    errors.push({ type: 'EMPTY', message: 'No events generated' });
  }

  for (const ev of events) {
    if (ev.type !== 'note') continue;
    const data = ev.data as { pitch?: number; velocity?: number };
    const pitch = data.pitch;
    const velocity = data.velocity;

    if (typeof pitch !== 'number' || pitch < 0 || pitch > 127) {
      errors.push({ type: 'INVALID_PITCH', message: 'bad pitch value' });
      continue;
    }
    // Drums (channel 9) are exempt from range/scale/duration theory checks.
    const isDrum = ev.channel === 9;
    if (!isDrum) {
      if (pitch < config.targetRange.min || pitch > config.targetRange.max) {
        errors.push({ type: 'OUT_OF_RANGE', bar: Math.floor(ev.timestamp / 4), message: 'pitch outside targetRange' });
      }
      const isTension = (ev.data as { tension?: boolean }).tension === true;
      if (!isTension && !isInScale(pitch, pcs)) {
        errors.push({ type: 'OUT_OF_SCALE', bar: Math.floor(ev.timestamp / 4), message: 'pitch outside scale' });
      }
    }
    if (typeof velocity !== 'number' || velocity < 0 || velocity > 127) {
      errors.push({ type: 'INVALID_VELOCITY', message: 'bad velocity value' });
    }
    if (ev.duration <= 0 || !Number.isFinite(ev.duration)) {
      errors.push({ type: 'INVALID_DURATION', message: 'bad duration value' });
    } else if (!isDrum) {
      const allowed = ALLOWED_DURATIONS as readonly number[];
      if (!allowed.includes(ev.duration)) {
        warnings.push({ type: 'UNUSUAL_DURATION', message: 'duration not in canonical set' });
      }
    }
    if (!Number.isFinite(ev.timestamp) || ev.timestamp < 0) {
      errors.push({ type: 'INVALID_TIMESTAMP', message: 'bad timestamp' });
    }
  }

  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
  return { valid: errors.length === 0, errors, warnings, score };
}
