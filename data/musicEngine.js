// ── Music Engine ── composes an ORIGINAL instrumental bed in code (additive
// synthesis): chords pad + plucked arpeggio + bass + light drums, by mood. Being
// generated here from scratch, it carries NO third-party licence — safe for
// commercial reels. Owner-uploaded licensed tracks can replace it per project.
// Output: 44.1kHz stereo 16-bit WAV of exactly `seconds`.
const SR = 44100;
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

// Moods: tempo, key root (MIDI), chord progression (scale degrees as triads in
// semitone offsets from the root), drum density.
const MOODS = {
  energetic: { bpm: 112, root: 62, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], kick: "four", hats: 8, clap: true, arp: 16, gain: 1.0 },
  playful: { bpm: 118, root: 60, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], kick: "four", hats: 8, clap: true, arp: 8, gain: 0.95 },
  calm: { bpm: 84, root: 65, prog: [[0, 4, 7], [7, 11, 14], [2, 5, 9], [10, 14, 17]], kick: "soft", hats: 4, clap: false, arp: 8, gain: 0.85 },
  cinematic: { bpm: 90, root: 57, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], kick: "soft", hats: 0, clap: false, arp: 8, gain: 0.9 },
};
export const MOOD_KEYS = Object.keys(MOODS);

let seed = 1234567;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; }; // deterministic noise

export function compose({ seconds = 20, mood = "energetic" } = {}) {
  const M = MOODS[mood] || MOODS.energetic;
  const len = Math.ceil(seconds * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  const beat = 60 / M.bpm, bar = beat * 4;
  const add = (buf, i, v) => { if (i >= 0 && i < len) buf[i] += v; };
  // tone helper: renders a voice into both channels with pan
  const tone = (t0, dur, f, amp, env, pan = 0, harm = [1]) => {
    const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR), gl = amp * (1 - pan) * 0.5 + amp * 0.5 * (pan <= 0 ? 1 : 1 - pan), gr = amp * (1 + pan) * 0.5 + amp * 0.5 * (pan >= 0 ? 1 : 1 + pan);
    for (let k = 0; k < n; k++) {
      const t = k / SR; let v = 0;
      for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
      v *= env(t, dur);
      add(L, s0 + k, v * gl); add(R, s0 + k, v * gr);
    }
  };
  const padEnv = (t, d) => Math.min(1, t / 0.35) * Math.min(1, (d - t) / 0.45);
  const pluckEnv = (t) => Math.min(1, t / 0.004) * Math.exp(-t * 7);
  const bassEnv = (t, d) => Math.min(1, t / 0.01) * Math.exp(-t * 2.2) * Math.min(1, (d - t) / 0.05);
  const bars = Math.ceil(seconds / bar);
  for (let b = 0; b < bars; b++) {
    const chord = M.prog[b % M.prog.length], t0 = b * bar;
    // pad: soft chord, two slightly detuned layers for width
    for (const st of chord) {
      const f = NOTE(M.root + st);
      tone(t0, bar + 0.4, f * 1.003, 0.045, padEnv, -0.35, [1, 0.35, 0.12]);
      tone(t0, bar + 0.4, f * 0.997, 0.045, padEnv, 0.35, [1, 0.35, 0.12]);
    }
    // arpeggio: chord tones up an octave, plucked
    const steps = M.arp, stepDur = bar / steps;
    for (let s = 0; s < steps; s++) {
      const st = chord[s % chord.length] + 12 + (s % 6 === 5 ? 12 : 0);
      tone(t0 + s * stepDur, 0.5, NOTE(M.root + st), 0.05, pluckEnv, (s % 2 ? 0.25 : -0.25), [1, 0.25, 0.08]);
    }
    // bass: root on beats 1 and 3
    for (const bt of [0, 2]) tone(t0 + bt * beat, beat * 1.9, NOTE(M.root + chord[0] - 24), 0.16, bassEnv, 0, [1, 0.3]);
  }
  // drums
  const beats = Math.ceil(seconds / beat);
  for (let q = 0; q < beats; q++) {
    const t0 = q * beat, s0 = Math.floor(t0 * SR);
    if (M.kick === "four" || (M.kick === "soft" && q % 4 === 0)) {
      const amp = M.kick === "soft" ? 0.35 : 0.55, n = Math.floor(0.35 * SR); let ph = 0;
      for (let k = 0; k < n; k++) { const t = k / SR, f = 45 + 110 * Math.exp(-t * 32); ph += 2 * Math.PI * f / SR; const v = Math.sin(ph) * Math.exp(-t * 9) * amp; add(L, s0 + k, v); add(R, s0 + k, v); }
    }
    if (M.clap && q % 2 === 1) {
      const n = Math.floor(0.18 * SR); let prev = 0;
      for (let k = 0; k < n; k++) { const t = k / SR, w = rnd(), hp = w - prev; prev = w; const v = hp * Math.exp(-t * 26) * 0.09; add(L, s0 + k, v * 0.9); add(R, s0 + k, v); }
    }
    if (M.hats) {
      const per = M.hats / 4; // hats per beat
      for (let h = 0; h < per; h++) {
        const hs = s0 + Math.floor(h * beat / per * SR), n = Math.floor(0.05 * SR); let prev = 0;
        const accent = h % 2 === 0 ? 0.03 : 0.019;
        for (let k = 0; k < n; k++) { const t = k / SR, w = rnd(), hp = w - prev; prev = w; const v = hp * Math.exp(-t * 95) * accent; add(L, hs + k, v * 0.8); add(R, hs + k, v * 1.1); }
      }
    }
  }
  // master: gain, soft fades, gentle soft-clip, normalise to -3 dBFS
  const fadeIn = Math.floor(0.5 * SR), fadeOut = Math.floor(1.4 * SR);
  let peak = 0;
  for (let i = 0; i < len; i++) {
    let g = M.gain; if (i < fadeIn) g *= i / fadeIn; if (i > len - fadeOut) g *= Math.max(0, (len - i) / fadeOut);
    L[i] = Math.tanh(L[i] * g * 1.3); R[i] = Math.tanh(R[i] * g * 1.3);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0 ? 0.708 / peak : 1;
  const pcm = Buffer.alloc(len * 4);
  for (let i = 0; i < len; i++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), i * 4); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), i * 4 + 2); }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
