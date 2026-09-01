# PSY ANTHEM — DAW Integration & Real-World Validation

Everything you need to take a generated anthem from this repo into real sound.

## Step 1 — Produce the MIDI

```bash
# Single anthem
bun scripts/cli.ts --seed 42 --intent euphoric-trance --bars 32 --output anthem.mid

# Full 10-file validation bundle (writes daw-validation/ + CHECKLIST.md)
bun run scripts/validate-in-daw.ts

# The 10 canonical golden files (already committed)
ls golden-midi/
```

## Step 2 — Import per DAW

### Ableton Live
1. File -> Import -> MIDI File (or drag the .mid into the Arrangement view).
2. Choose Import as multiple MIDI clips (one per track).
3. Tempo is embedded - the transport adopts it automatically.
4. Assign an instrument per clip (Operator/Wavetable for lead, Simpler for bass).

### FL Studio
1. Drag the .mid onto the Playlist, or File -> Import -> MIDI file.
2. Accept the prompt to import per-channel patterns.
3. Program-change events map to channel rack patches if enabled in Settings -> MIDI.

### Logic Pro
1. File -> Import -> MIDI File.
2. Select Merge per track when asked.
3. Logic reads the tempo track; tracks appear as software instrument tracks.

### Reaper
1. Drag the .mid into the Arrange view.
2. In the import dialog choose Expand 16th-note shuffles: no, Multichannel: yes (one item per track).
3. Right-click an item -> Item settings -> channel map if you want to split voices.

## Step 3 — Manual checklist (from daw-validation/CHECKLIST.md)

- Tempo matches the stated BPM
- Time signature reads 4/4
- One track per voice (3 or 4)
- Program changes: ch1=0, ch2=80, ch3=24, ch4=33
- Track length = bars x 4 beats
- No stuck notes
- Lead sits around C4-C6, bass around C2-G3
- You can hear a repeating motif and a build/release shape after assigning instruments

## Known issues & notes

- Some DAWs (older FL) ignore program changes on import - assign patches manually.
- Note-off velocity is written as 0 (standard); a few hardware synths prefer a release envelope instead - adjust your patch.
- Humanized micro-timing (~5ms) is intentional; quantize in your DAW if you want hard grid.
- Format 1 tempo lives on track 0. If your DAW shows an empty first clip, it is the conductor track.
- The engine is WHAT-layer: the MIDI is an arrangement skeleton. Sound design happens in your DAW (or in psysynth/PsySynthPro if you render inside the family).
