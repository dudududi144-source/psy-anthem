// PSY ANTHEM - src/integration/wire.ts
// The WHAT→HOW wire (Task 17): maps the composition engine's internal event
// format onto the REAL family wire — PSYBUS v2 note envelopes, validated by
// the verbatim foundation shim codec (foundation-shim/psybus-v2-*.ts) using
// the exact rules foundation's own /api/render-notes endpoint enforces.
//
// Why this exists: Task 17's serving audit proved the repo's old claim
// ("output is canonical MusicalEvent[], psy-foundation protocol v1") was
// never true — the internal shape matched neither foundation v1 nor PSYBUS
// v2, and the shim pin was <TBD>. This adapter is the single place where
// composition events become wire bytes, so the claim lives in exactly one
// tested place instead of zero.

import { validateEnvelope, canonicalJson } from '../foundation-shim/psybus-v2-envelope';
import { asTrackId } from '../foundation-shim/psybus-v2-types';
import type { BusEnvelope, NotePayload } from '../foundation-shim/psybus-v2-types';
import type { AnthemOutput, MusicalEvent, NoteData } from '../types';

/** The 16 foundation voice/track names — exactly foundation's ExternalTrack
 *  union (apps/web/src/lib/psy4/forensic-bridge.ts, pinned eb3c663f). */
export const FOUNDATION_TRACKS = [
  'kick', 'bass', 'lead', 'counter', 'subbass', 'hat', 'openhat', 'snare',
  'clap', 'perc', 'shaker', 'pad', 'acid', 'riser', 'impact', 'texture',
] as const;
export type FoundationTrack = (typeof FOUNDATION_TRACKS)[number];

/** Anthem voice channel → foundation track. Anthem voices are
 *  lead / harmony / counter / bass (channels 0..3); foundation has no
 *  "harmony" voice, so harmony maps to its pad voice. */
export const VOICE_TRACK_MAP: Record<number, FoundationTrack> = {
  0: 'lead',
  1: 'pad',
  2: 'counter',
  3: 'bass',
};

export interface WireOptions {
  /** Transport for ts math (beats → seconds). Default 140 (anthem default). */
  bpm?: number;
  /** Publisher device id (PSYBUS src). Default 'psy-anthem'. */
  deviceId?: string;
}

export interface WireResult {
  /** Validated PSYBUS v2 note envelopes, in composition order. */
  envelopes: BusEnvelope<NotePayload>[];
  /** note-bearing envelopes rejected by the validator (must stay 0). */
  rejected: number;
  /** events skipped because they are control/program (not renderable sound). */
  nonNote: number;
  /** events whose channel has no foundation voice mapping. */
  unmappedChannel: number;
  /** canonical-JSON byte size of the wire payload (efficiency metric). */
  wireBytes: number;
  /** envelope time span in seconds (should match bars × 4 × 60/bpm). */
  spanSec: number;
}

function isNoteData(d: MusicalEvent['data']): d is NoteData {
  return typeof (d as NoteData).pitch === 'number';
}

/**
 * Map a full AnthemOutput onto the PSYBUS v2 wire.
 *
 * Determinism: same output → same envelopes → same canonical JSON bytes
 * (byte-identical wire is tested across the generation grid).
 * Conformance: every envelope passes foundation's own validation rules
 * (6-field envelope, note 0-127, vel 0..1, durBeats ≥ 0, known track) —
 * a rejection throws, because shipping a non-conformant wire would repeat
 * the exact lie this module exists to fix.
 */
export function anthemToWire(out: AnthemOutput, opts: WireOptions = {}): WireResult {
  const bpm = opts.bpm ?? 140;
  const deviceId = opts.deviceId ?? 'psy-anthem';
  if (deviceId.length > 128) throw new RangeError('deviceId exceeds PSYBUS MAX_ID_LENGTH (128)');
  const secPerBeat = 60 / bpm;

  const envelopes: BusEnvelope<NotePayload>[] = [];
  let rejected = 0;
  let nonNote = 0;
  let unmappedChannel = 0;
  let rev = 0;
  let spanSec = 0;

  for (const ev of out.events) {
    if (ev.type !== 'note') {
      nonNote += 1;
      continue;
    }
    const track = VOICE_TRACK_MAP[ev.channel];
    if (track === undefined) {
      unmappedChannel += 1;
      continue;
    }
    if (!isNoteData(ev.data)) {
      nonNote += 1;
      continue;
    }
    const ts = ev.timestamp * secPerBeat;
    if (ts > spanSec) spanSec = ts;
    // Track ids are validated strings (the brand is phantom and erased at
    // runtime — foundation's own asTrackId, made safe by validateEnvelope).
    const payload: NotePayload = {
      kind: 'note',
      track: asTrackId(track),
      note: ev.data.pitch,
      vel: ev.data.velocity / 127,
      durBeats: ev.duration,
      channel: ev.channel,
    };
    const candidate = {
      rev: ++rev,
      seed: out.metadata.seed,
      src: deviceId,
      dst: 'broadcast' as const,
      ts,
      payload,
    };
    const checked = validateEnvelope(candidate);
    if (!checked.ok) {
      rejected += 1;
      continue;
    }
    envelopes.push(checked.value as BusEnvelope<NotePayload>);
  }

  if (rejected > 0) {
    throw new Error(
      `anthemToWire: ${rejected} note envelope(s) failed PSYBUS v2 validation — ` +
        'this is a bug in the mapping, not in your config'
    );
  }

  const wireBytes = wireSize(envelopes);
  return { envelopes, rejected, nonNote, unmappedChannel, wireBytes, spanSec };
}

/** Canonical-JSON byte size of a wire (the byte-stable efficiency metric). */
export function wireSize(envelopes: readonly BusEnvelope[]): number {
  return Buffer.from(canonicalJson(envelopes), 'utf8').length;
}

/** Build the exact POST body foundation's /api/render-notes consumes. */
export function wireToRenderNotesBody(
  envelopes: readonly BusEnvelope<NotePayload>[],
  opts: { seed: number; bpm: number; bars: number; useSamples?: boolean }
): string {
  return JSON.stringify({
    seed: opts.seed,
    bpm: opts.bpm,
    bars: opts.bars,
    ...(opts.useSamples === true ? { useSamples: true } : {}),
    notes: envelopes,
  });
}
