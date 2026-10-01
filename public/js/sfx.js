// Âm thanh tổng hợp bằng Web Audio API — không cần file âm thanh, không lo bản quyền.
const PREF_SOUND = 'rtg_sound';
const PREF_MUSIC = 'rtg_music';

function readPref(key) {
  try {
    return localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
}

function writePref(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* chế độ ẩn danh: bỏ qua */
  }
}

let soundOn = readPref(PREF_SOUND);
let musicOn = readPref(PREF_MUSIC);
let ac = null;
let sfxBus;
let musicBus;
let noiseBuffer;

export const isSoundOn = () => soundOn;
export const isMusicOn = () => musicOn;

/** Trình duyệt chỉ cho phát âm thanh sau thao tác của người dùng → gọi trong sự kiện click/chạm. */
export function unlock() {
  if (!ac) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ac = new AudioCtx();
    const master = ac.createGain();
    master.gain.value = 0.8;
    const limiter = ac.createDynamicsCompressor();
    master.connect(limiter).connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = soundOn ? 1 : 0;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ac.suspend();
      else ac.resume();
    });
  }
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
  if (musicOn) startMusic();
}

export function setSound(on) {
  soundOn = on;
  writePref(PREF_SOUND, on);
  if (ac) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.02);
}

export function setMusic(on) {
  musicOn = on;
  writePref(PREF_MUSIC, on);
  if (on) startMusic();
  else stopMusic();
}

const muted = (bus) => !ac || (bus === sfxBus && !soundOn) || (bus === musicBus && !musicOn);

function tone(freq, { type = 'sine', dur = 0.15, vol = 0.2, at = 0, to = null, attack = 0.005, lp = 0, vibrato = 0, bus = sfxBus } = {}) {
  if (muted(bus)) return;
  const t = ac.currentTime + Math.max(0, at);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vibrato) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (lp) {
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    node = node.connect(filter);
  }
  node.connect(gain).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.05, vol = 0.2, at = 0, type = 'highpass', freq = 3000, to = null, q = 1, bus = sfxBus } = {}) {
  if (muted(bus)) return;
  const t = ac.currentTime + Math.max(0, at);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(bus);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

// ---------- Hiệu ứng ----------
export function click() {
  tone(620, { type: 'triangle', dur: 0.07, vol: 0.18, to: 900 });
}

export function pop() {
  tone(420, { dur: 0.14, vol: 0.22, to: 880 });
}

export function select(big = false) {
  tone(big ? 880 : 660, { type: 'triangle', dur: 0.09, vol: 0.2 });
  tone(big ? 1320 : 990, { type: 'triangle', dur: 0.14, vol: 0.16, at: 0.06 });
}

export function chip() {
  noise({ type: 'bandpass', freq: 2600, q: 2, dur: 0.05, vol: 0.6 });
  noise({ type: 'bandpass', freq: 3300, q: 2, dur: 0.05, vol: 0.4, at: 0.045 });
}

export function tick() {
  noise({ type: 'highpass', freq: 2500, dur: 0.025, vol: 0.35 });
  tone(1900, { type: 'square', dur: 0.02, vol: 0.035 });
}

export function countdown(last = false) {
  tone(last ? 1320 : 990, { dur: 0.09, vol: 0.22 });
}

export function correct() {
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, { type: 'triangle', dur: i === 3 ? 0.4 : 0.14, vol: 0.2, at: i * 0.08 }));
}

export function wrong() {
  tone(330, { type: 'square', dur: 0.16, vol: 0.09, to: 262, lp: 1400 });
  tone(247, { type: 'square', dur: 0.34, vol: 0.09, to: 165, at: 0.17, lp: 1200 });
}

export function spinStart() {
  noise({ type: 'bandpass', freq: 300, to: 2400, q: 1.2, dur: 0.6, vol: 0.4 });
}

export function land() {
  tone(190, { dur: 0.14, vol: 0.3, to: 90 });
  noise({ type: 'lowpass', freq: 900, dur: 0.08, vol: 0.3 });
}

export function win(at = 0) {
  for (let i = 0; i < 6; i++) {
    tone(988, { type: 'square', dur: 0.06, vol: 0.07, at: at + i * 0.1, lp: 4000 });
    tone(1319, { type: 'square', dur: 0.16, vol: 0.07, at: at + i * 0.1 + 0.055, lp: 4000 });
  }
}

export function lose() {
  [392, 370, 349].forEach((f, i) => tone(f, { type: 'sawtooth', dur: 0.28, vol: 0.12, at: i * 0.3, lp: 1100 }));
  tone(330, { type: 'sawtooth', dur: 0.9, vol: 0.12, at: 0.9, lp: 1000, vibrato: 7 });
}

export function jackpot() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
    tone(f, { type: 'square', dur: 0.12, vol: 0.08, at: i * 0.07, lp: 5000 }),
  );
  for (const f of [523.25, 659.25, 783.99, 1046.5]) {
    tone(f, { type: 'triangle', dur: 1.3, vol: 0.12, at: 0.55, attack: 0.02 });
    tone(f * 1.004, { type: 'sawtooth', dur: 1.3, vol: 0.03, at: 0.55, attack: 0.02, lp: 2500 });
  }
  win(0.6);
}

export function fanfare() {
  [[523.25, 0], [659.25, 0.13], [783.99, 0.26], [1046.5, 0.39]].forEach(([f, at]) =>
    tone(f, { type: 'triangle', dur: 0.2, vol: 0.18, at }),
  );
  for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(f, { type: 'triangle', dur: 1.1, vol: 0.1, at: 0.55, attack: 0.02 });
}

// ---------- Nhạc nền lounge (bass đi bộ + hợp âm swing) ----------
const BPM = 100;
const EIGHTH = 60 / BPM / 2;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const PROGRESSION = [
  { bass: [48, 52, 55, 57], chord: [60, 64, 67, 71] }, // Cmaj7
  { bass: [45, 48, 52, 55], chord: [57, 60, 64, 67] }, // Am7
  { bass: [50, 53, 57, 55], chord: [57, 60, 62, 65] }, // Dm7
  { bass: [43, 47, 50, 47], chord: [55, 59, 62, 65] }, // G7
];
const MELODY = [
  [[0, 76], [3, 74], [4, 72]],
  [[0, 72], [2, 76], [5, 79]],
  [[0, 77], [3, 76], [4, 74]],
  [[0, 71], [2, 74], [4, 77], [6, 76]],
];

let musicTimer = 0;
let nextTime = 0;
let stepIndex = 0;

function startMusic() {
  if (!ac || musicTimer || !musicOn) return;
  nextTime = ac.currentTime + 0.1;
  stepIndex = 0;
  musicBus.gain.setTargetAtTime(0.55, ac.currentTime, 0.4);
  musicTimer = setInterval(scheduleMusic, 50);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (ac) musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.1);
}

function scheduleMusic() {
  while (nextTime < ac.currentTime + 0.2) {
    playStep(stepIndex, nextTime - ac.currentTime);
    nextTime += EIGHTH;
    stepIndex = (stepIndex + 1) % 64;
  }
}

function playStep(step, at) {
  const bar = Math.floor(step / 8) % 4;
  const eighth = step % 8;
  const when = at + (eighth % 2 ? EIGHTH * 0.28 : 0); // swing nhẹ
  const { bass, chord } = PROGRESSION[bar];
  const bus = musicBus;
  if (eighth % 2 === 0) tone(midi(bass[eighth / 2]), { type: 'triangle', dur: EIGHTH * 1.8, vol: 0.13, at: when, attack: 0.01, bus });
  if (eighth === 3 || eighth === 7) for (const n of chord) tone(midi(n), { dur: 0.22, vol: 0.035, at: when, attack: 0.01, bus });
  noise({ type: 'highpass', freq: 8000, dur: 0.03, vol: eighth % 2 ? 0.05 : 0.025, at: when, bus });
  if (Math.floor(step / 32) === 1) {
    const note = MELODY[bar].find(([pos]) => pos === eighth);
    if (note) tone(midi(note[1]), { dur: 0.4, vol: 0.05, at: when, attack: 0.015, bus });
  }
}
