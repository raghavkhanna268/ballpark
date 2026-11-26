/**
 * The game's sounds, made with WebAudio so there are no files to load: a burner that roars louder and longer for
 * rarer answers, a chime for each landmark passed, a sputter for a miss, a bonk for a name that is not on the list,
 * and a pop, a parachute and a thud for the trip home.
 * Sound is on unless the player turns it off. Browsers only allow sound after a tap or a key press, so the page calls
 * unlockAudio from one.
 */

const SOUND_KEY = "ballpark.sound";

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = readSound();

export function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // The choice holds for this visit only.
  }
  if (on) unlockAudio();
}

/** Call from a tap or key press. It creates the audio context, or wakes it if the browser put it to sleep. */
export function unlockAudio() {
  if (!enabled) return;
  try {
    if (!audio) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      audio = new Context();
    }
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function ready(): AudioContext | null {
  if (!enabled || !audio || audio.state !== "running") return null;
  return audio;
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === context.sampleRate) return noise;
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish noise: softer than white noise, more like a rocket than static.
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    data[i] = last * 3.5;
  }
  noise = buffer;
  return buffer;
}

function envelope(context: AudioContext, start: number, peak: number, attack: number, hold: number, release: number): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  return gain;
}

/**
 * The rocket's burner for one climb. `tier` runs from 0 (Liftoff) to 4 (Supernova): a higher tier burns louder,
 * deeper and brighter. `delayMs` waits for ignition and `ms` is how long the climb lasts.
 */
export function playBurner(tier: number, ms: number, delayMs = 250) {
  const context = ready();
  if (!context) return;
  const level = Math.max(0, Math.min(4, tier));
  const start = context.currentTime + delayMs / 1000;
  const length = Math.max(0.5, ms / 1000);
  const peak = [0.16, 0.2, 0.25, 0.3, 0.36][level];
  const out = envelope(context, start, peak, 0.12, Math.max(0.05, length * 0.75 - 0.12), length * 0.25);
  out.connect(context.destination);

  const hiss = context.createBufferSource();
  hiss.buffer = noiseBuffer(context);
  hiss.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(260 + level * 60, start);
  filter.frequency.exponentialRampToValueAtTime(700 + level * 450, start + length * 0.45);
  filter.frequency.exponentialRampToValueAtTime(320, start + length);
  hiss.connect(filter).connect(out);
  hiss.start(start);
  hiss.stop(start + length + 0.1);

  const rumble = context.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(42 + level * 5, start);
  rumble.frequency.linearRampToValueAtTime(62 + level * 12, start + length * 0.7);
  const low = context.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 160;
  const rumbleGain = context.createGain();
  rumbleGain.gain.value = 0.5;
  rumble.connect(low).connect(rumbleGain).connect(out);
  rumble.start(start);
  rumble.stop(start + length + 0.1);

  if (level >= 2) {
    // Rare answers add a rising whine on top of the roar.
    const whine = context.createOscillator();
    whine.type = "triangle";
    whine.frequency.setValueAtTime(220, start);
    whine.frequency.exponentialRampToValueAtTime(520 + level * 160, start + length * 0.8);
    const whineGain = envelope(context, start, 0.025 + (level - 2) * 0.015, 0.3, Math.max(0.05, length * 0.5), length * 0.3);
    whine.connect(whineGain).connect(context.destination);
    whine.start(start);
    whine.stop(start + length + 0.1);
  }
}

/** A bell for each landmark passed. The pitch steps up the scale as the climb goes higher. */
export function playChime(index: number) {
  const context = ready();
  if (!context) return;
  const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
  const base = 523.25 * Math.pow(2, steps[Math.max(0, index - 1) % steps.length] / 12);
  const start = context.currentTime;
  for (const [ratio, peak] of [[1, 0.09], [2.01, 0.035], [3.02, 0.015]] as const) {
    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = base * ratio;
    const gain = envelope(context, start, peak, 0.008, 0.02, 0.7);
    tone.connect(gain).connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.8);
  }
}

/** A Deep space or Supernova landing: a quick bright arpeggio. */
export function playSparkle() {
  const context = ready();
  if (!context) return;
  const start = context.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((frequency, index) => {
    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = frequency;
    const at = start + index * 0.06;
    const gain = envelope(context, at, 0.06, 0.005, 0.03, 0.45);
    tone.connect(gain).connect(context.destination);
    tone.start(at);
    tone.stop(at + 0.55);
  });
}

/** A miss: the burner coughs a few times and dies. */
export function playSputter(delayMs = 250) {
  const context = ready();
  if (!context) return;
  const start = context.currentTime + delayMs / 1000;
  const pops = [0, 0.16, 0.27, 0.5, 0.66];
  pops.forEach((offset, index) => {
    const at = start + offset;
    const pop = context.createBufferSource();
    pop.buffer = noiseBuffer(context);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520 - index * 60;
    const gain = envelope(context, at, 0.28 - index * 0.04, 0.01, 0.04, 0.09);
    pop.connect(filter).connect(gain).connect(context.destination);
    pop.start(at, Math.random());
    pop.stop(at + 0.16);
  });
  const fall = context.createOscillator();
  fall.type = "square";
  fall.frequency.setValueAtTime(180, start);
  fall.frequency.exponentialRampToValueAtTime(60, start + 0.8);
  const low = context.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 400;
  const gain = envelope(context, start, 0.03, 0.02, 0.4, 0.4);
  fall.connect(low).connect(gain).connect(context.destination);
  fall.start(start);
  fall.stop(start + 0.9);
}

/** The capsule popping off the booster: a short bright snap and a puff of air. */
export function playPop() {
  const context = ready();
  if (!context) return;
  const start = context.currentTime + 0.45;
  const puff = context.createBufferSource();
  puff.buffer = noiseBuffer(context);
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.8;
  puff.connect(band).connect(envelope(context, start, 0.22, 0.004, 0.02, 0.18)).connect(context.destination);
  puff.start(start, Math.random());
  puff.stop(start + 0.3);
  const snap = context.createOscillator();
  snap.type = "triangle";
  snap.frequency.setValueAtTime(880, start);
  snap.frequency.exponentialRampToValueAtTime(330, start + 0.08);
  snap.connect(envelope(context, start, 0.07, 0.003, 0.01, 0.1)).connect(context.destination);
  snap.start(start);
  snap.stop(start + 0.15);
}

/** The parachute opening: a soft whump of cloth catching the air. */
export function playChute() {
  const context = ready();
  if (!context) return;
  const start = context.currentTime;
  const whoosh = context.createBufferSource();
  whoosh.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.frequency.exponentialRampToValueAtTime(240, start + 0.35);
  whoosh.connect(filter).connect(envelope(context, start, 0.26, 0.02, 0.05, 0.32)).connect(context.destination);
  whoosh.start(start, Math.random());
  whoosh.stop(start + 0.5);
}

/** Touchdown on the pad: a low, soft thud. */
export function playThud() {
  const context = ready();
  if (!context) return;
  const start = context.currentTime;
  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(120, start);
  body.frequency.exponentialRampToValueAtTime(42, start + 0.22);
  body.connect(envelope(context, start, 0.3, 0.005, 0.04, 0.3)).connect(context.destination);
  body.start(start);
  body.stop(start + 0.4);
  const scuff = context.createBufferSource();
  scuff.buffer = noiseBuffer(context);
  const low = context.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 600;
  scuff.connect(low).connect(envelope(context, start, 0.12, 0.005, 0.03, 0.25)).connect(context.destination);
  scuff.start(start, Math.random());
  scuff.stop(start + 0.35);
}

/** "Not on our list": a short low bonk, so the player knows to try again. */
export function playBonk() {
  const context = ready();
  if (!context) return;
  const start = context.currentTime;
  const tone = context.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(330, start);
  tone.frequency.exponentialRampToValueAtTime(196, start + 0.18);
  const gain = envelope(context, start, 0.12, 0.01, 0.08, 0.2);
  tone.connect(gain).connect(context.destination);
  tone.start(start);
  tone.stop(start + 0.35);
}
