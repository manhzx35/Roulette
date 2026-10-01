import { addTicker } from './ticker.js';

// Quy ước khớp với server/game.js: ô 0 = xanh, ô lẻ = đỏ, ô chẵn = đen.
export const SLOT_COUNT = 41;
const TAU = Math.PI * 2;
const SLOT = TAU / SLOT_COUNT;
const INK = '#3B2413';
const FACE = { red: '#C8102E', black: '#1E1E1E', green: '#2DA84F' };
const POCKET = { red: '#8E0B21', black: '#0C0C0C', green: '#1C7A37' };

// Bán kính theo tỉ lệ bán kính canvas.
const R = {
  rim: 0.985,
  track: 0.86,
  gold: 0.8,
  ringOut: 0.775,
  ringIn: 0.6,
  pocketOut: 0.575,
  pocketIn: 0.47,
  cone: 0.45,
  ball: 0.036,
  pocketBall: 0.522,
};

export function slotColor(i) {
  if (i === 0) return 'green';
  return i % 2 === 1 ? 'red' : 'black';
}

// Quay trước trong lúc chờ server: bánh xe và bóng tăng tốc trong RAMP giây rồi giữ tốc độ.
const FREE_WHEEL_SPEED = 2.5 * TAU; // rad/s, theo chiều kim đồng hồ
const FREE_BALL_SPEED = 3 * TAU; // rad/s, ngược chiều
const RAMP = 0.35;
const MIN_LANDING_S = 4.2;

const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

// Số ngẫu nhiên có seed để vân gỗ giống nhau mỗi lần vẽ lại.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function goldGradient(g, r) {
  const grad = g.createRadialGradient(-0.3 * r, -0.35 * r, 0.05 * r, 0, 0, r);
  grad.addColorStop(0, '#FFF1BF');
  grad.addColorStop(0.55, '#E2B53A');
  grad.addColorStop(1, '#8A6510');
  return grad;
}

function wedge(g, rOut, rIn, mid) {
  g.beginPath();
  g.arc(0, 0, rOut, mid - SLOT / 2, mid + SLOT / 2);
  g.arc(0, 0, rIn, mid + SLOT / 2, mid - SLOT / 2, true);
  g.closePath();
}

function ring(g, rOut, rIn) {
  g.beginPath();
  g.arc(0, 0, rOut, 0, TAU);
  g.arc(0, 0, rIn, 0, TAU, true);
}

function star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

/**
 * Vòng quay vẽ bằng Canvas 2D. Phần tĩnh (bát gỗ, kim) và mặt quay được vẽ sẵn
 * vào canvas phụ; mỗi khung hình chỉ xoay + drawImage → nhẹ cả trên điện thoại yếu.
 */
export class Wheel {
  constructor(canvas, { idleSpeed = 0, onTick = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.idleSpeed = idleSpeed;
    this.onTick = onTick;
    this.rotation = 0;
    this.ballLocal = null; // bóng nằm yên trong ngăn: { angle, r } theo hệ toạ độ mặt quay
    this.ballScreen = null; // bóng đang lăn: { angle, r } theo hệ toạ độ màn hình
    this.highlight = null;
    this.anim = null;
    this.free = null; // đang quay tự do chờ kết quả từ server
    this.size = 0;
    this.stopTicker = null;
    this.lastSlot = this.pointerSlot();
    this.lastTickAt = 0;
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  pointerSlot() {
    return mod(Math.round(-this.rotation / SLOT), SLOT_COUNT);
  }

  placeBall(slot) {
    this.ballLocal = { angle: -Math.PI / 2 + slot * SLOT, r: R.pocketBall };
  }

  setActive(on) {
    if (on && !this.stopTicker) {
      this.resize();
      this.stopTicker = addTicker((dt, now) => this.frame(dt, now));
    } else if (!on && this.stopTicker) {
      this.stopTicker();
      this.stopTicker = null;
    }
  }

  resize() {
    const size = Math.round(this.canvas.clientWidth);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!size || (size === this.size && dpr === this.dpr)) return;
    this.size = size;
    this.dpr = dpr;
    const px = Math.round(size * dpr);
    this.canvas.width = px;
    this.canvas.height = px;
    this.bowlImg = this.paint(px, (g, lw) => this.paintBowl(g, lw));
    this.faceImg = this.paint(px, (g, lw) => this.paintFace(g, lw));
    this.topImg = this.paint(px, (g, lw) => this.paintTop(g, lw));
    this.draw();
  }

  // Vẽ vào canvas phụ với hệ toạ độ: tâm (0,0), bán kính = 1.
  paint(px, fn) {
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const g = c.getContext('2d');
    const k = px / 2;
    g.translate(k, k);
    g.scale(k, k);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    fn(g, (cssPx) => (cssPx * this.dpr) / k);
    return c;
  }

  paintBowl(g, lw) {
    const rnd = seeded(7);
    g.save();
    g.beginPath();
    g.arc(0, 0, R.rim, 0, TAU);
    g.clip();
    // 8 múi gỗ xen kẽ
    for (let i = 0; i < 8; i++) {
      const a0 = (i * TAU) / 8 - Math.PI / 2 - TAU / 16;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 1, a0, a0 + TAU / 8);
      g.closePath();
      g.fillStyle = i % 2 ? '#7C4E25' : '#8F5D2D';
      g.fill();
    }
    // vân gỗ
    for (let i = 0; i < 110; i++) {
      const r = R.gold + rnd() * (1 - R.gold);
      const a = rnd() * TAU;
      g.beginPath();
      g.arc(0, 0, r, a, a + 0.15 + rnd() * 0.6);
      g.strokeStyle = rnd() < 0.55 ? 'rgba(40,18,4,.2)' : 'rgba(255,215,160,.12)';
      g.lineWidth = lw(0.6 + rnd() * 1.4);
      g.stroke();
    }
    // đường nối các múi
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 - Math.PI / 2 - TAU / 16;
      g.beginPath();
      g.moveTo(Math.cos(a) * R.gold, Math.sin(a) * R.gold);
      g.lineTo(Math.cos(a), Math.sin(a));
      g.strokeStyle = 'rgba(40,18,4,.4)';
      g.lineWidth = lw(1.3);
      g.stroke();
    }
    // ánh đèn từ trên-trái
    const light = g.createLinearGradient(-1, -1, 1, 1);
    light.addColorStop(0, 'rgba(255,220,160,.25)');
    light.addColorStop(0.5, 'rgba(255,220,160,0)');
    light.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = light;
    g.fillRect(-1, -1, 2, 2);
    // dốc rãnh bóng tối dần vào trong
    const slope = g.createRadialGradient(0, 0, R.gold, 0, 0, 0.94);
    slope.addColorStop(0, 'rgba(20,8,0,.6)');
    slope.addColorStop(1, 'rgba(20,8,0,0)');
    g.fillStyle = slope;
    g.beginPath();
    g.arc(0, 0, 0.94, 0, TAU);
    g.fill();
    g.restore();

    g.beginPath();
    g.arc(0, 0, R.rim, 0, TAU);
    g.strokeStyle = INK;
    g.lineWidth = lw(3);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 0.955, 0, TAU);
    g.strokeStyle = 'rgba(255,220,160,.28)';
    g.lineWidth = lw(1.5);
    g.stroke();

    // 8 chốt kim cương vàng trên vành gỗ
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i * TAU) / 8 - Math.PI / 2 + TAU / 16);
      g.translate(0.915, 0);
      g.beginPath();
      g.moveTo(-0.05, 0);
      g.lineTo(0, -0.016);
      g.lineTo(0.05, 0);
      g.lineTo(0, 0.016);
      g.closePath();
      const gg = g.createLinearGradient(0, -0.016, 0, 0.016);
      gg.addColorStop(0, '#FFF1BF');
      gg.addColorStop(1, '#B8860B');
      g.fillStyle = gg;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = lw(1.2);
      g.stroke();
      g.restore();
    }
  }

  paintFace(g, lw) {
    // vành vàng ngoài
    g.beginPath();
    g.arc(0, 0, R.gold, 0, TAU);
    g.fillStyle = goldGradient(g, R.gold);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = lw(2.5);
    g.stroke();

    // vòng ô màu chính
    for (let i = 0; i < SLOT_COUNT; i++) {
      wedge(g, R.ringOut, R.ringIn, -Math.PI / 2 + i * SLOT);
      g.fillStyle = FACE[slotColor(i)];
      g.fill();
    }
    const depth = g.createRadialGradient(0, 0, R.ringIn, 0, 0, R.ringOut);
    depth.addColorStop(0, 'rgba(0,0,0,.28)');
    depth.addColorStop(0.35, 'rgba(0,0,0,0)');
    depth.addColorStop(0.85, 'rgba(255,255,255,.08)');
    depth.addColorStop(1, 'rgba(0,0,0,.15)');
    ring(g, R.ringOut, R.ringIn);
    g.fillStyle = depth;
    g.fill('evenodd');
    g.strokeStyle = '#F5E6C8';
    g.lineWidth = lw(1.4);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const a = -Math.PI / 2 + i * SLOT - SLOT / 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * R.ringIn, Math.sin(a) * R.ringIn);
      g.lineTo(Math.cos(a) * R.ringOut, Math.sin(a) * R.ringOut);
      g.stroke();
    }
    // ngôi sao đánh dấu ô xanh
    star(g, 0, -(R.ringOut + R.ringIn) / 2, 0.042);
    g.fillStyle = '#FFF3D6';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = lw(1);
    g.stroke();
    for (const r of [R.ringOut, R.ringIn]) {
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.strokeStyle = INK;
      g.lineWidth = lw(2);
      g.stroke();
    }

    // vòng vàng mỏng
    ring(g, R.ringIn, R.pocketOut);
    g.fillStyle = goldGradient(g, R.ringIn);
    g.fill('evenodd');

    // ngăn chứa bóng
    for (let i = 0; i < SLOT_COUNT; i++) {
      wedge(g, R.pocketOut, R.pocketIn, -Math.PI / 2 + i * SLOT);
      g.fillStyle = POCKET[slotColor(i)];
      g.fill();
    }
    const pocketShade = g.createRadialGradient(0, 0, R.pocketIn, 0, 0, R.pocketOut);
    pocketShade.addColorStop(0, 'rgba(0,0,0,.45)');
    pocketShade.addColorStop(1, 'rgba(0,0,0,0)');
    ring(g, R.pocketOut, R.pocketIn);
    g.fillStyle = pocketShade;
    g.fill('evenodd');
    g.strokeStyle = '#E8C35A';
    g.lineWidth = lw(1.6);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const a = -Math.PI / 2 + i * SLOT - SLOT / 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * R.pocketIn, Math.sin(a) * R.pocketIn);
      g.lineTo(Math.cos(a) * R.pocketOut, Math.sin(a) * R.pocketOut);
      g.stroke();
    }

    // vòng vàng trong + nón trung tâm
    g.beginPath();
    g.arc(0, 0, R.pocketIn, 0, TAU);
    g.fillStyle = goldGradient(g, R.pocketIn);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = lw(2);
    g.stroke();
    const cone = g.createRadialGradient(-0.12, -0.14, 0.02, 0, 0, R.cone);
    cone.addColorStop(0, '#FFF4C9');
    cone.addColorStop(0.35, '#EBC75C');
    cone.addColorStop(0.8, '#C99A1E');
    cone.addColorStop(1, '#8A6510');
    g.beginPath();
    g.arc(0, 0, R.cone, 0, TAU);
    g.fillStyle = cone;
    g.fill();
    g.strokeStyle = 'rgba(59,36,19,.6)';
    g.lineWidth = lw(1.5);
    g.stroke();

    // tay quay chữ thập
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i * TAU) / 4 + TAU / 8);
      g.beginPath();
      g.moveTo(0.04, -0.022);
      g.lineTo(0.3, -0.013);
      g.lineTo(0.3, 0.013);
      g.lineTo(0.04, 0.022);
      g.closePath();
      g.fillStyle = goldGradient(g, 0.3);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = lw(1.5);
      g.stroke();
      g.translate(0.33, 0);
      g.beginPath();
      g.arc(0, 0, 0.04, 0, TAU);
      g.fillStyle = goldGradient(g, 0.045);
      g.fill();
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, 0.08, 0, TAU);
    g.fillStyle = goldGradient(g, 0.08);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = lw(2);
    g.stroke();
    g.beginPath();
    g.arc(-0.022, -0.026, 0.026, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.fill();
  }

  paintTop(g, lw) {
    // ánh bóng kính nhẹ
    const gloss = g.createRadialGradient(-0.35, -0.45, 0, -0.35, -0.45, 0.75);
    gloss.addColorStop(0, 'rgba(255,255,255,.13)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath();
    g.arc(0, 0, R.gold, 0, TAU);
    g.fillStyle = gloss;
    g.fill();
    // kim chỉ vàng ở đỉnh
    g.beginPath();
    g.moveTo(0, -0.705);
    g.lineTo(-0.062, -0.935);
    g.quadraticCurveTo(0, -0.985, 0.062, -0.935);
    g.closePath();
    const grad = g.createLinearGradient(-0.06, 0, 0.06, 0);
    grad.addColorStop(0, '#FFF1BF');
    grad.addColorStop(0.5, '#E2B53A');
    grad.addColorStop(1, '#9C7512');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = lw(2.5);
    g.stroke();
    g.beginPath();
    g.arc(0, -0.9, 0.02, 0, TAU);
    g.fillStyle = '#FFF3D6';
    g.fill();
    g.lineWidth = lw(1.2);
    g.stroke();
  }

  /**
   * Bắt đầu quay ngay khi người chơi bấm, trong lúc chờ server trả kết quả.
   * Gọi `landOn(slot)` khi có kết quả để bánh xe giảm tốc mượt và dừng đúng ô.
   */
  startSpin() {
    this.free = {
      t0: performance.now(),
      r0: this.rotation,
      ball0: this.ballLocal ? this.ballLocal.angle + this.rotation : -Math.PI / 2,
      ballR0: this.ballLocal ? this.ballLocal.r : R.track,
    };
    this.anim = null;
    this.highlight = null;
    this.ballLocal = null;
    this.setActive(true);
  }

  /** Dừng đúng ô `slot` (server đã quyết định). Trả về Promise khi bóng nằm yên. */
  landOn(slot) {
    if (!this.free) this.startSpin();
    return new Promise((resolve) => {
      this.free.pendingSlot = slot;
      this.free.resolve = resolve;
    });
  }

  spinTo(slot) {
    this.startSpin();
    return this.landOn(slot);
  }

  /** Huỷ lượt quay đang chờ (VD lỗi mạng). */
  stop() {
    this.free = null;
    this.anim = null;
    this.ballScreen = null;
    this.draw();
  }

  frame(dt, now) {
    if (this.free) this.stepFree(now);
    else if (this.anim) this.step(now);
    else if (this.idleSpeed) this.rotation = mod(this.rotation + this.idleSpeed * dt, TAU);
    else if (this.highlight === null) return; // đứng yên: không cần vẽ lại
    this.draw(now);
  }

  stepFree(now) {
    const f = this.free;
    const t = (now - f.t0) / 1000;
    // Quãng đường khi tăng tốc đều trong RAMP giây rồi giữ tốc độ.
    const travelled = (speed) => (t < RAMP ? (speed * t * t) / (2 * RAMP) : speed * (RAMP / 2 + t - RAMP));
    this.rotation = f.r0 + travelled(FREE_WHEEL_SPEED);
    this.ballScreen = {
      angle: f.ball0 - travelled(FREE_BALL_SPEED),
      r: f.ballR0 + (R.track - f.ballR0) * easeOutCubic(Math.min(1, t / 0.3)),
    };
    this.tickIfNeeded(now);
    if (f.pendingSlot !== undefined && t >= RAMP) this.beginLanding(now);
  }

  // Chuyển từ quay tự do sang giảm tốc, giữ nguyên vận tốc bánh xe và bóng để không bị giật.
  beginLanding(now) {
    const f = this.free;
    this.free = null;
    const slot = f.pendingSlot;
    const r0 = this.rotation;
    const w0 = FREE_WHEEL_SPEED;
    const target = -slot * SLOT + (Math.random() - 0.5) * 0.6 * SLOT; // lệch nhẹ trong ô cho tự nhiên
    // rotation(t) = r0 + Δ·easeOutCubic(t/D) có vận tốc đầu 3Δ/D = w0.
    const deltaMin = (w0 * MIN_LANDING_S) / 3;
    const delta = deltaMin + mod(target - (r0 + deltaMin), TAU);
    const duration = (3 * delta) / w0;

    // Bóng: angle(t) = rotation(t) + slotLocal + offset·(1 − easeOutCubic(t/L)), vận tốc đầu = −FREE_BALL_SPEED.
    const slotLocal = -Math.PI / 2 + slot * SLOT;
    const relSpeed = w0 + FREE_BALL_SPEED;
    const required = mod(this.ballScreen.angle - r0 - slotLocal, TAU);
    const ideal = (relSpeed * 0.74 * duration) / 3;
    const offset0 = required + Math.max(1, Math.round((ideal - required) / TAU)) * TAU;
    const landSeconds = clamp((3 * offset0) / relSpeed, 0.55 * duration, 0.9 * duration);

    this.anim = {
      t0: now,
      duration: duration * 1000,
      from: r0,
      to: r0 + delta,
      slot,
      slotLocal,
      offset0,
      startR: R.track,
      land: landSeconds / duration,
      resolve: f.resolve,
    };
  }

  tickIfNeeded(now) {
    const slot = this.pointerSlot();
    if (slot !== this.lastSlot) {
      this.lastSlot = slot;
      if (now - this.lastTickAt > 32) {
        this.lastTickAt = now;
        this.onTick?.();
      }
    }
  }

  step(now) {
    const a = this.anim;
    const t = Math.min(1, (now - a.t0) / a.duration);
    this.rotation = a.from + (a.to - a.from) * easeOutCubic(t);

    const u = Math.min(1, t / a.land);
    const angle = this.rotation + a.slotLocal + a.offset0 * (1 - easeOutCubic(u));
    let r;
    if (u < 0.12) r = a.startR + (R.track - a.startR) * easeOutCubic(u / 0.12);
    else if (u < 0.5) r = R.track;
    else {
      const v = (u - 0.5) / 0.5;
      r = R.track + (R.pocketBall - R.track) * easeInOutSine(v) + Math.sin(v * Math.PI * 3) * (1 - v) * 0.05;
    }
    this.ballScreen = { angle, r };
    this.tickIfNeeded(now);

    if (t >= 1) {
      this.rotation = mod(a.to, TAU);
      this.ballScreen = null;
      this.ballLocal = { angle: a.slotLocal, r: R.pocketBall };
      this.highlight = a.slot;
      this.anim = null;
      a.resolve();
    }
  }

  draw(now = performance.now()) {
    if (!this.size || !this.bowlImg) return;
    const g = this.ctx;
    const px = this.canvas.width;
    const k = px / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.drawImage(this.bowlImg, 0, 0);

    g.translate(k, k);
    g.rotate(this.rotation);
    g.drawImage(this.faceImg, -k, -k);
    if (this.highlight !== null) this.drawHighlight(g, k, now);
    g.setTransform(1, 0, 0, 1, 0, 0);

    const ball = this.ballScreen ?? (this.ballLocal && { angle: this.ballLocal.angle + this.rotation, r: this.ballLocal.r });
    if (ball) this.drawBall(g, k, ball);
    g.drawImage(this.topImg, 0, 0);
  }

  drawHighlight(g, k, now) {
    const mid = -Math.PI / 2 + this.highlight * SLOT;
    const pulse = 0.5 + 0.5 * Math.sin(now / 170);
    g.save();
    wedge(g, R.ringOut * k, R.pocketIn * k, mid);
    g.fillStyle = `rgba(255, 236, 170, ${0.16 + 0.22 * pulse})`;
    g.fill();
    g.lineWidth = (2 + pulse * 1.5) * this.dpr;
    g.strokeStyle = '#FFE08A';
    g.shadowColor = '#FFD34D';
    g.shadowBlur = 12 * this.dpr;
    g.stroke();
    g.restore();
  }

  drawBall(g, k, { angle, r }) {
    const x = k + Math.cos(angle) * r * k;
    const y = k + Math.sin(angle) * r * k;
    const br = R.ball * k;
    g.beginPath();
    g.ellipse(x + br * 0.35, y + br * 0.5, br, br * 0.8, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fill();
    const grad = g.createRadialGradient(x - br * 0.35, y - br * 0.35, br * 0.1, x, y, br);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.6, '#E8E8E8');
    grad.addColorStop(1, '#A5A5A5');
    g.beginPath();
    g.arc(x, y, br, 0, TAU);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 1.2 * this.dpr;
    g.strokeStyle = INK;
    g.stroke();
  }
}
