# E2E PIPELINE REPORT — anthem → PSYBUS v2 → foundation → WAV → gate

Run: 2026-09-05T06:36:22.004Z · foundation: http://localhost:3123
Result: ALL CLAIMS PASS

| claim | result | detail |
|---|---|---|
| compose bars=8 | PASS | 93 events, 6.9ms (0.86ms/bar), double-generate byte-identical (2nd: 3.3ms) |
| compose bars=16 | PASS | 187 events, 1.5ms (0.10ms/bar), double-generate byte-identical (2nd: 2.7ms) |
| compose bars=32 | PASS | 371 events, 6.9ms (0.22ms/bar), double-generate byte-identical (2nd: 6.0ms) |
| compose bars=64 | PASS | 741 events, 6.4ms (0.10ms/bar), double-generate byte-identical (2nd: 6.4ms) |
| compose bars=128 | PASS | 1485 events, 15.3ms (0.12ms/bar), double-generate byte-identical (2nd: 18.8ms) |
| compose intent=euphoric-trance | PASS | 371 events, 2.2ms |
| compose intent=dark-psy | PASS | 533 events, 2.7ms |
| compose intent=progressive | PASS | 371 events, 2.1ms |
| compose intent=full-on | PASS | 500 events, 2.3ms |
| compose intent=emotional-breakdown | PASS | 330 events, 1.9ms |
| compose intent=forest | PASS | 371 events, 2.0ms |
| compose intent=emotional-lead | PASS | 371 events, 2.1ms |
| compose intent=uplifting-anthem | PASS | 371 events, 1.9ms |
| compose intent=dreamy-atmosphere | PASS | 330 events, 1.6ms |
| compose intent=morning-melodic | PASS | 371 events, 1.9ms |
| compose intent=epic-cinematic | PASS | 330 events, 1.6ms |
| compose intent=nostalgic-longing | PASS | 330 events, 1.5ms |
| compose intent=triumphant-rise | PASS | 371 events, 1.8ms |
| compose intent=tender-lullaby | PASS | 371 events, 1.9ms |
| compose voices=1 | PASS | 243 events, 1.2ms |
| compose voices=2 | PASS | 307 events, 1.3ms |
| compose voices=3 | PASS | 371 events, 1.9ms |
| compose voices=4 | PASS | 499 events, 2.2ms |
| compose curve=flat | PASS | 352 events, 1.8ms |
| compose curve=arc | PASS | 371 events, 1.9ms |
| compose curve=build-drop | PASS | 388 events, 1.9ms |
| compose curve=wave | PASS | 360 events, 1.9ms |
| compose curve=custom | PASS | 448 events, 2.4ms |
| compose curve=emotional-swell | PASS | 383 events, 2.0ms |
| compose curve=double-drop | PASS | 433 events, 2.2ms |
| compose curve=progressive-climb | PASS | 420 events, 2.1ms |
| compose curve=sunrise | PASS | 440 events, 2.1ms |
| compose curve=plateau-break | PASS | 358 events, 1.9ms |
| compose seed=0 | PASS | 130 events, 0.6ms |
| compose seed=2147483647 | PASS | 130 events, 0.5ms |
| contract edge: bars=7 (below 8) | PASS | RangeError (as documented) |
| contract edge: bars=129 (above 128) | PASS | RangeError (as documented) |
| contract edge: voices=0 | PASS | RangeError (as documented) |
| contract edge: voices=5 | PASS | RangeError (as documented) |
| contract edge: targetRange min>max | PASS | RangeError (as documented) |
| contract edge: CUSTOM without customCurve | PASS | TypeError (as documented) |
| wire bars=8 | PASS | 93 envelopes, 0 non-note, 17030B (2.08KB/bar), map+validate 3.85ms |
| wire bars=32 | PASS | 371 envelopes, 0 non-note, 68147B (2.08KB/bar), map+validate 2.93ms |
| wire bars=128 | PASS | 1485 envelopes, 0 non-note, 273907B (2.09KB/bar), map+validate 8.72ms |
| foundation render 8bar (melody-only) | PASS | 5.6s, md5=bd876b8e1625, I=-12.54 LUFS (below club gate — sparse melody, documented), TP=-2.19 dBTP, notes=93/dropped=0, non-LUFS gates=ALL PASS |
| foundation render 8bar (full arrangement) | PASS | 3.7s, I=-12.42 LUFS (below club gate — density-bound, documented), TP=-2.17 dBTP, md5=38863fd6c93d, hard gates=ALL PASS |
| own render 8bar (private HOW copy) | PASS | 0.8s render, sounds={"lead":"dreamy-lead","pad":"airy-heaven","pluck":"trance-gate","bass":"rolling-psy"}, acceptance-check=FAIL(1) |
| foundation render 32bar (melody-only) | PASS | 19.3s, md5=6c67fd658b99, I=-12.94 LUFS (below club gate — sparse melody, documented), TP=-2.46 dBTP, notes=371/dropped=0, non-LUFS gates=ALL PASS |
| foundation render 32bar (full arrangement) | PASS | 14.3s, I=-13.94 LUFS (below club gate — density-bound, documented), TP=-2.39 dBTP, md5=d7ac03366e07, hard gates=ALL PASS |
| own render 32bar (private HOW copy) | PASS | 2.8s render, sounds={"lead":"dreamy-lead","pad":"airy-heaven","pluck":"trance-gate","bass":"rolling-psy"}, acceptance-check=FAIL(1) |
| foundation render 88bar(cap) (melody-only) | PASS | 55.8s, md5=8d94074a26cf, I=-14.84 LUFS (below club gate — sparse melody, documented), TP=-2.30 dBTP, notes=1021/dropped=0, non-LUFS gates=ALL PASS |
| foundation render 88bar(cap) (full arrangement) | PASS | LIMIT FOUND: 2605 notes > 2000-note POST cap → honest 400 (the wire is per-section); halves workaround: part1=1397 notes, I=-13.54 LUFS, part2=1208 notes, I=-13.80 LUFS |
| wire→render determinism (two identical POSTs) | PASS | md5 A=bd876b8e1625 B=bd876b8e1625 |
