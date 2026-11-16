// Synthesized via Web Audio — no audio files to ship or license.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  return ctx;
}

function tone(
  freq: number,
  startOffset: number,
  duration: number,
  gain = 0.15,
  type: OscillatorType = "sine",
): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(amp).connect(audio.destination);
  const t = audio.currentTime + startOffset;
  // A 6 ms attack instead of starting at full volume: no click at the start of each note.
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

// C major pentatonic from C5: any run of placements sounds like a melody, never a clash.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

/** The note a digit plays: 1 lowest, 9 highest. */
function digitFreq(digit: number): number {
  return PENTATONIC[Math.min(9, Math.max(1, digit)) - 1]!;
}

/** Placing a digit plays its own note (a soft pluck with a quiet octave on top). */
export function playPlace(digit = 5): void {
  const f = digitFreq(digit);
  tone(f, 0, 0.16, 0.13);
  tone(f * 2, 0, 0.08, 0.03, "triangle");
}

export function playMistake(): void {
  tone(160, 0, 0.18, 0.18, "triangle");
  tone(151, 0.02, 0.16, 0.1, "triangle");
}

export function playWin(): void {
  // C – E – G – C, then the full chord rings under it.
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, i * 0.11, 0.3, 0.12));
  [523.25, 659.25, 783.99].forEach((freq) => tone(freq, 0.48, 0.9, 0.06));
}

/**
 * A row, column or box was completed. One unit plays a rising triad from the placed digit's
 * note; completing two or three at once stacks a fuller chord on top.
 */
export function playComplete(units = 1, digit = 1): void {
  const root = digitFreq(digit) / 2;
  const steps = [1, 5 / 4, 3 / 2, 2, 5 / 2, 3].slice(0, 3 + Math.min(3, units));
  steps.forEach((ratio, i) => tone(root * ratio, i * 0.065, 0.22, 0.1));
  if (units > 1) tone(root * 2, steps.length * 0.065, 0.5, 0.07);
}

/** All nine of a digit are in: its note twinkles up two octaves, quick and bright. */
export function playDigitDone(digit = 1): void {
  const f = digitFreq(digit);
  [1, 2, 3, 4].forEach((ratio, i) => tone(f * ratio, 0.05 + i * 0.05, 0.14, 0.06, "triangle"));
}

/** A star filling in on the win modal: a soft, short tick that climbs with each star. */
export function playTick(step = 1): void {
  tone(1320 + step * 180, 0, 0.05, 0.05, "triangle");
}

/** The red-pen "Perfect!" stamp landing: a low thud with a papery snap on top. */
export function playStamp(): void {
  tone(110, 0, 0.18, 0.22, "triangle");
  tone(82, 0.01, 0.2, 0.14);
  tone(2400, 0, 0.03, 0.03, "square");
}

export function playHint(): void {
  tone(880, 0, 0.1, 0.1);
  tone(1175, 0.09, 0.14, 0.1);
}

export function playUnlock(): void {
  [784, 988, 1319].forEach((freq, i) => tone(freq, i * 0.1, 0.22, 0.12));
}
