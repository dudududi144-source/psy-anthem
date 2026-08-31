// PSY ANTHEM - harmony/index.ts
export { generateChordProgression, chordTones } from './chord-progressions';
export type { ChordProgression } from './chord-progressions';
export { sampleEnergyCurve, barEnergy, compositeTension } from './tension';
export { buildVoices, detectParallelFifths, detectParallelOctaves } from './voice-leading';
export type { VoiceLeadingInput } from './voice-leading';
export { scalePitchClasses, isInScale, intervalClass, isConsonant, isDissonant, snapToScale } from './intervals';
