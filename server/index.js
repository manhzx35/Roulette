// Chạy như một server Node bình thường: laptop, Render, Railway… (Vercel dùng file index.js ở thư mục gốc).
import { createApp, lanUrls } from './app.js';
import { RULES } from './game.js';

const port = Number(process.env.PORT) || 3000;

// Chỉ dùng khi phát triển: FORCE_SLOT=0 để luôn quay trúng ô xanh (thử hiệu ứng jackpot).
let forceSlot;
if (process.env.FORCE_SLOT !== undefined && process.env.NODE_ENV !== 'production') {
  const slot = Number(process.env.FORCE_SLOT);
  if (Number.isInteger(slot) && slot >= 0 && slot < RULES.slotCount) {
    forceSlot = slot;
    console.warn(`[dev] FORCE_SLOT=${slot}: mọi lượt quay đều ra ô ${slot}.`);
  }
}

const { app, store, flush } = createApp({ forceSlot });

app.listen(port, () => {
  console.log(`Roulette Đạo Đức đang chạy tại http://localhost:${port}`);
  console.log(`Bảng xếp hạng:            http://localhost:${port}/bxh`);
  for (const url of lanUrls(port)) console.log(`Trong mạng LAN:           ${url}`);
  console.log(store.kind === 'upstash' ? 'Lưu dữ liệu: Upstash Redis' : 'Lưu dữ liệu: bộ nhớ + data/state.json');
  if (!process.env.ADMIN_KEY) console.log('(Chưa đặt ADMIN_KEY → nút đặt lại trò chơi trên trang BXH bị khoá.)');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    flush();
    process.exit(0);
  });
}
