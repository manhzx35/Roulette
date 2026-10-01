// Một vòng requestAnimationFrame dùng chung cho vòng quay, hiệu ứng và đồng hồ đếm ngược.
// Tự dừng khi không còn ai đăng ký → không tốn CPU lúc đứng yên.
const subscribers = new Set();
let raf = 0;
let last = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const fn of [...subscribers]) fn(dt, now);
  raf = subscribers.size ? requestAnimationFrame(frame) : 0;
}

export function addTicker(fn) {
  subscribers.add(fn);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  return () => subscribers.delete(fn);
}
