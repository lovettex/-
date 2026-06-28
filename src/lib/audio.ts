// Web Audio API Synthesis for Premium UI Sound Effects
// Hand-crafted to evoke the premium, athletic, high-fidelity spirit of Nike's product ecosystem (SNKRS, Nike Run Club, Nike Training Club).
// Features crisp physical haptics, athletic low-noise swooshes, and inspiring, deep achievement chimes.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a high-fidelity Nike "Haptic Tap" button click.
 * Crisp, physical, highly responsive, and satisfying.
 * Simulates the sound of high-tech sportswear snapping into place or a high-end athletic hardware button.
 */
export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Sub-bass physical thump for tactile weight
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(220, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
    
    bodyGain.gain.setValueAtTime(0.18, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    
    // High-frequency crisp transient snap (resembles mechanical switch or sneaker click)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(1200, now);
    snapOsc.frequency.exponentialRampToValueAtTime(300, now + 0.015);
    
    filter.type = "highpass";
    filter.frequency.setValueAtTime(800, now);
    
    snapGain.gain.setValueAtTime(0.08, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    
    snapOsc.connect(filter);
    filter.connect(snapGain);
    snapGain.connect(ctx.destination);
    
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.05);
    
    snapOsc.start(now);
    snapOsc.stop(now + 0.02);
  } catch (e) {
    console.warn("Nike Click Sound failed", e);
  }
}

/**
 * Play a sleek, aerodynamic "Athletic Swoosh".
 * Replaces generic slide sounds with the deep, smooth whoosh of speed, air resistance, or a basketball whipping through a net.
 */
export function playSwipeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const duration = 0.22;
    
    // 1. Sleek organic low-mid sweep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + duration);
    
    oscGain.gain.setValueAtTime(0.0, now);
    oscGain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    // 2. Air friction / velocity (filtered noise burst)
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    // Sweeping the bandpass filter gives the premium aerodynamic "whoosh" sound
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + duration);
    filter.Q.setValueAtTime(3.0, now);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, now);
    noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration + 0.05);
    
    noise.start(now);
    noise.stop(now + duration);
  } catch (e) {
    console.warn("Nike Swipe Sound failed", e);
  }
}

/**
 * Play a high-precision, mechanical "Stopwatch Tick".
 * Represents premium precision, training splits, and professional timing.
 */
export function playTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    // Clean, crisp high frequency impulse
    osc.type = "sine";
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.008);
    
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1500, now);
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.015);
  } catch (e) {
    console.warn("Nike Tick Sound failed", e);
  }
}

/**
 * Play an epic, inspiring Nike "Victory Chime".
 * Emulates the rewarding achievement notification when unlocking goals or finishing elite training.
 * Utilizes a beautiful, rich, ascending major 9th chord layered with a warm athletic bass swell.
 */
export function playSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Warm, comforting bass swell (foundation of achievement)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(130.81, now); // C3
    subOsc.frequency.exponentialRampToValueAtTime(146.83, now + 0.25); // D3 swell
    
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.55);

    // Dynamic glissando swell representing athletic lift-off
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = "sine";
    sweepOsc.frequency.setValueAtTime(261.63, now); // C4
    sweepOsc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18); // C5
    
    sweepGain.gain.setValueAtTime(0, now);
    sweepGain.gain.linearRampToValueAtTime(0.07, now + 0.06);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    sweepOsc.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.22);

    // Ascending warm major 9th chord triggers (Lush, uplifting, premium)
    // Notes: E5 (659.25Hz), G5 (783.99Hz), B5 (987.77Hz), D6 (1174.66Hz)
    const tones = [
      { freq: 659.25, delay: 0.04, volume: 0.07, dur: 0.6 },  // E5
      { freq: 783.99, delay: 0.08, volume: 0.07, dur: 0.6 },  // G5
      { freq: 987.77, delay: 0.12, volume: 0.07, dur: 0.65 }, // B5
      { freq: 1174.66, delay: 0.16, volume: 0.08, dur: 0.75 } // D6
    ];

    tones.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(t.freq, now + t.delay);
      
      // Beautiful smooth attack and wide stereo-like lingering decay
      gain.gain.setValueAtTime(0, now + t.delay);
      gain.gain.linearRampToValueAtTime(t.volume, now + t.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.delay + t.dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + t.delay);
      osc.stop(now + t.delay + t.dur + 0.05);
    });

  } catch (e) {
    console.warn("Nike Success Sound failed", e);
  }
}
