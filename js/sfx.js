// Tiny WebAudio SFX — no assets, just oscillators/noise. Armed on first tap.
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'square', gain = 0.05, delay = 0, slide = 0 } = {}) {
  if (!enabled) return;
  try {
    const a = ac();
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio unavailable — stay silent */ }
}

function noise(dur, { gain = 0.05, delay = 0, hp = 900 } = {}) {
  if (!enabled) return;
  try {
    const a = ac();
    const t = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  } catch { /* silent */ }
}

export const sfx = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; if (enabled) tone(660, 0.06); return enabled; },
  unlock() { try { ac(); } catch { /* no audio */ } },
  roll() { noise(0.22, { gain: 0.07, hp: 700 }); tone(180, 0.08, { gain: 0.03, slide: -60 }); },
  keep() { tone(520, 0.05, { gain: 0.035 }); },
  score() { tone(660, 0.09); tone(880, 0.1, { delay: 0.09 }); },
  spirit() { tone(1046, 0.07, { type: 'triangle', gain: 0.045 }); tone(1318, 0.09, { type: 'triangle', gain: 0.04, delay: 0.07 }); },
  windup() { tone(220, 0.28, { type: 'sawtooth', gain: 0.03, slide: 340 }); },
  hit() { tone(95, 0.16, { type: 'square', gain: 0.07, slide: -40 }); noise(0.1, { gain: 0.05, hp: 300 }); },
  miss() { tone(300, 0.08, { gain: 0.02, slide: -120 }); },
  heal() { tone(523, 0.08, { type: 'triangle', gain: 0.045 }); tone(784, 0.12, { type: 'triangle', gain: 0.04, delay: 0.08 }); },
  capture() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { gain: 0.05, delay: i * 0.09 })); },
  buy() { tone(880, 0.06, { gain: 0.04 }); tone(1174, 0.08, { delay: 0.06, gain: 0.04 }); },
  ko() { [440, 330, 220, 165].forEach((f, i) => tone(f, 0.16, { gain: 0.05, delay: i * 0.12 })); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, { gain: 0.06, delay: i * 0.13 })); },
};
