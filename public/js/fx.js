import { addTicker } from './ticker.js';

const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
const COLORS = ['#F4D26B', '#D4A017', '#C8102E', '#2DA84F', '#FFF3D6', '#1E1E1E'];
const MAX_PARTICLES = 220;
const numberFormat = new Intl.NumberFormat('vi-VN');

let dpr = 1;
let width = 0;
let height = 0;
let particles = [];
let stop = null;

export const fmt = (n) => numberFormat.format(n);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}
resize();
window.addEventListener('resize', resize);

function spawn(p) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 12,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: p.kind === 'coin' ? 9 + Math.random() * 5 : 6 + Math.random() * 6,
    life: 0,
    maxLife: 1.6 + Math.random() * 1.2,
    ...p,
  });
  if (!stop) stop = addTicker(step);
}

/** Pháo giấy / đồng xu bắn ra từ (x, y) — toạ độ màn hình. */
export function burst(x, y, { count = 60, kind = 'confetti', power = 520, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = power * (0.35 + Math.random() * 0.65);
    spawn({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
  }
}

/** Mưa pháo giấy từ mép trên màn hình trong `ms` mili giây. */
export function rain(ms = 2200) {
  const end = performance.now() + ms;
  const off = addTicker((dt, now) => {
    if (now > end) {
      off();
      return;
    }
    for (let i = 0; i < 3; i++) {
      spawn({
        kind: Math.random() < 0.15 ? 'coin' : 'confetti',
        x: Math.random() * width,
        y: -20,
        vx: (Math.random() - 0.5) * 120,
        vy: 60 + Math.random() * 160,
        maxLife: 3.5,
      });
    }
  });
}

function step(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  particles = particles.filter((p) => (p.life += dt) < p.maxLife && p.y < height + 40);
  for (const p of particles) {
    const confetti = p.kind === 'confetti';
    p.vy += 900 * dt * (confetti ? 0.5 : 1);
    p.vx *= confetti ? 0.985 : 0.995;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    ctx.globalAlpha = Math.min(1, (p.maxLife - p.life) / 0.4);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (confetti) {
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.scale(0.15 + Math.abs(Math.cos(p.rot)) * 0.85, 1);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = '#F4C542';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8A6510';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFE38A';
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (!particles.length) {
    stop();
    stop = null;
    ctx.clearRect(0, 0, width, height);
  }
}

const counting = new WeakMap();

/** Số chạy từ `from` tới `to`. */
export function countUp(el, from, to, ms = 800) {
  counting.get(el)?.();
  const start = performance.now();
  const off = addTicker((dt, now) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = fmt(Math.round(from + (to - from) * eased));
    if (t >= 1) {
      off();
      counting.delete(el);
    }
  });
  counting.set(el, off);
}

/** Chữ bay lên rồi mờ dần, ví dụ "+300". */
export function floatText(text, x, y, className = '') {
  const el = document.createElement('div');
  el.className = `float-text ${className}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.addEventListener('animationend', () => el.remove());
  document.body.append(el);
}

/** Chạy lại một animation CSS theo class. */
export function replay(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

export function shake(el) {
  replay(el, 'shake');
}
