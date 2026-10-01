// Chạy thử chế độ Vercel ngay trên máy: dữ liệu nằm trong một Upstash Redis giả lập,
// SSE tắt (BXH tự hỏi 2 giây/lần) — giống hệt khi deploy lên Vercel + Upstash.
//   npm run dev:vercel
//   $env:LATENCY_MS="150"; npm run dev:vercel   → giả lập mạng chậm để xem độ mượt
import { createApp } from '../server/app.js';
import { startUpstashMock } from '../test/helpers/upstash-mock.js';

const port = Number(process.env.PORT) || 3000;
const latencyMs = Number(process.env.LATENCY_MS ?? 20);
const mock = await startUpstashMock({ latencyMs });

const { app } = createApp({
  env: { VERCEL: '1', KV_REST_API_URL: mock.url, KV_REST_API_TOKEN: mock.token },
});

app.listen(port, () => {
  console.log(`Chế độ giống Vercel (Upstash giả lập, trễ ${latencyMs}ms/lượt gọi Redis)`);
  console.log(`Trang chơi:    http://localhost:${port}`);
  console.log(`Bảng xếp hạng: http://localhost:${port}/bxh`);
});
