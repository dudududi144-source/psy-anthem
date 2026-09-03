// PSY ANTHEM — midi-lite.mjs (clean build v6.0)
// Tiny Standard MIDI File exporter (port of the proven encoder).
const MIDI_DIVISION = 480;
function varLen(value) {
  const s = [value & 0x7f]; let v = value >>> 7;
  while (v > 0) { s.push((v & 0x7f) | 0x80); v >>>= 7; }
  return s.reverse();
}
function pushU32(a, v) { a.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); }
function pushU16(a, v) { a.push((v >>> 8) & 0xff, v & 0xff); }

export function downloadMidi(out, cfg) {
  const bpm = (cfg && cfg.bpm) || 140;
  const byChannel = new Map();
  for (const e of out.events) {
    if (e.type !== 'note') continue;
    if (!byChannel.has(e.channel)) byChannel.set(e.channel, []);
    byChannel.get(e.channel).push(e);
  }
  const channels = Array.from(byChannel.keys()).sort((a, b) => a - b);
  const tracks = [];
  for (const ch of channels) {
    const evs = byChannel.get(ch);
    const items = [];
    if (ch === channels[0]) {
      const uspq = Math.round(60000000 / Math.max(1, bpm));
      items.push({ tick: 0, order: -2, bytes: [0xff, 0x51, 0x03, (uspq >>> 16) & 0xff, (uspq >>> 8) & 0xff, uspq & 0xff] });
      items.push({ tick: 0, order: -1, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });
    }
    items.push({ tick: 0, order: 0, bytes: [0xc0 | (ch & 0x0f), [0, 80, 24, 33][ch] || 0] });
    for (const e of evs) {
      const on = Math.max(0, Math.round(e.timestamp * MIDI_DIVISION));
      const off = on + Math.max(1, Math.round(e.duration * MIDI_DIVISION));
      items.push({ tick: off, order: 0, bytes: [0x80 | (ch & 0x0f), e.data.pitch & 0x7f, 0] });
      items.push({ tick: on, order: 1, bytes: [0x90 | (ch & 0x0f), e.data.pitch & 0x7f, e.data.velocity & 0x7f] });
    }
    items.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const body = [];
    let last = 0;
    for (const it of items) {
      for (const b of varLen(it.tick - last)) body.push(b);
      for (const b of it.bytes) body.push(b);
      last = it.tick;
    }
    for (const b of varLen(0)) body.push(b);
    body.push(0xff, 0x2f, 0x00);
    const chunk = [0x4d, 0x54, 0x72, 0x6b];
    pushU32(chunk, body.length);
    for (const b of body) chunk.push(b);
    tracks.push(chunk);
  }
  const all = [0x4d, 0x54, 0x68, 0x64];
  pushU32(all, 6); pushU16(all, 1); pushU16(all, tracks.length); pushU16(all, MIDI_DIVISION);
  for (const t of tracks) for (const b of t) all.push(b);
  const bytes = Uint8Array.from(all);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'psy-anthem-seed' + ((cfg && cfg.seed) || 0) + '.mid';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
