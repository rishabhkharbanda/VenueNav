let audioCtx: AudioContext | null = null;

export function resumeAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function now(): number {
  return resumeAudio().currentTime;
}

/** Soft airy “pop” when a mesh spawns. */
export function playSpawnSound() {
  const ctx = resumeAudio();
  const t0 = now();
  const freqs = [660, 990];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + i * 0.03 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.03 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.03);
    osc.stop(t0 + i * 0.03 + 0.18);
  });
}

/** Short thud on floor contact (rate-limited by caller). */
export function playThudSound(intensity = 0.45) {
  const ctx = resumeAudio();
  const t0 = now();
  const dur = 0.09;
  const bufferSize = ctx.sampleRate * dur;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = 0.001;
  gain.gain.exponentialRampToValueAtTime(0.22 * intensity, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + dur);
}
