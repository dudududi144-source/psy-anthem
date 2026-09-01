# Presets Reference

The browser sound engine (web/synth.js) renders each voice with a preset from web/presets.js:
detuned oscillators, optional sub-osc, resonant filter with envelope, ADSR, optional LFO, and FX sends
(reverb / delay / chorus / distortion). Pick presets per voice in the demo's Voice Presets card.

## Lead Voices
- **Psy Lead (Classic)** - 3 detuned saws + sub, resonant filter sweep, classic psytrance lead
- **Acid Lead (TB-303 style)** - square + saw into a heavily resonant lowpass, aggressive drive
- **Emotional Lead (breakdown)** - triangle + sine, soft attack, drenched in reverb/chorus

## Harmony Voices
- **Psy Pad (Atmospheric)** - 4 detuned saws, slow attack, wide chorus + reverb
- **Supersaw (JP-8000 style)** - 5 detuned saws, wide and bright

## Counter Voices
- **Pluck** - short percussive hit with fast filter envelope and delay
- **Arp Sequence** - resonant square/saw pair built for delay-soaked arps

## Bass Voices
- **Psy Bass (Classic offbeat)** - saw + sine sub, tight envelope, drive
- **Sub Rumble** - pure sub sine, no frills
- **Wobble Bass** - 4Hz LFO on the resonant filter

## Global Bus
masterGain -> drive shaper -> master filter -> compressor -> out, with three shared sends:
- Convolution reverb (generated impulse)
- Tempo-synced dotted-8th delay with 35% feedback
- Modulated chorus

Macros: Master Cutoff, Reverb Send, Delay Send, Master Drive.

## Adding Custom Presets
Add new presets to web/presets.js:

```javascript
'my-custom': {
  name: 'My Custom Lead',
  oscillators: [{ type: 'sawtooth', detune: 0, gain: 0.6 }],
  sub: { type: 'sine', octaves: -1, gain: 0.5 },
  filter: { type: 'lowpass', cutoff: 2000, resonance: 10, envelope: 0.5 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
  lfo: { rate: 4, depth: 0.5, target: 'filter' }, // optional
  fx: { distortion: 0.2, delay: 0.3, reverb: 0.2, chorus: 0.2 },
},
```

Then list it under the right category in PRESET_CATEGORIES and it appears in the dropdown.
