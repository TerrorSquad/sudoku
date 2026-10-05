// Synthesized via Web Audio — no audio files to ship or license.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, gain = 0.15): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(amp).connect(audio.destination);
  const t = audio.currentTime + startOffset;
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

export function playPlace(): void {
  tone(660, 0, 0.08);
}

export function playMistake(): void {
  tone(160, 0, 0.18, 0.2);
}

export function playWin(): void {
  [523, 659, 784, 1046].forEach((freq, i) => tone(freq, i * 0.12, 0.25));
}

/** A short rising triple: a row, column or box was just completed. */
export function playComplete(): void {
  [587, 740, 880].forEach((freq, i) => tone(freq, i * 0.07, 0.14, 0.12));
}

export function playHint(): void {
  tone(880, 0, 0.1, 0.1);
  tone(1175, 0.09, 0.14, 0.1);
}

export function playUnlock(): void {
  [784, 988, 1319].forEach((freq, i) => tone(freq, i * 0.1, 0.22, 0.12));
}
