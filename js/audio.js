// Procedural sound effects via Web Audio - no audio files needed.
let ctx = null;
function ensure() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
function noiseBurst(dur, freq, vol) {
  const c = ensure();
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.max(1, (sr * dur) | 0), sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.pow(1 - i / d.length, 2);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start();
}
function thud(freq, dur, vol) {
  const c = ensure();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.4), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export const sfx = {
  resume() { const c = ensure(); if (c.state === 'suspended') c.resume(); },
  blockBreak() { noiseBurst(0.18, 900, 0.35); thud(160, 0.12, 0.25); },
  mine() { noiseBurst(0.05, 1400, 0.1); },
  place() { thud(240, 0.1, 0.3); noiseBurst(0.05, 900, 0.12); },
  step() { noiseBurst(0.06, 450, 0.1); },
  jump() { thud(320, 0.12, 0.1); },
  splash() { noiseBurst(0.35, 700, 0.35); },
};
