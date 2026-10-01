// Mô phỏng nhiều người chơi cùng lúc chơi trọn game qua HTTP.
//   npm run loadtest                         → 1 server tạm, lưu trong bộ nhớ (như laptop/Render)
//   $env:MODE="vercel"; npm run loadtest     → 3 server tạm dùng chung Upstash giả lập, mỗi request
//                                              rơi ngẫu nhiên vào một server (như Vercel tự nhân bản)
//   $env:URL="https://link"; npm run loadtest → bắn vào server thật (nhớ đặt lại BXH sau đó)
import { createApp } from '../server/app.js';
import { createUpstashStore } from '../server/stores/upstash.js';
import { startUpstashMock } from '../test/helpers/upstash-mock.js';

const PLAYERS = Number(process.env.PLAYERS) || 60;
const MODE = process.env.URL ? 'url' : process.env.MODE === 'vercel' ? 'vercel' : 'memory';
const cleanups = [];
let bases = [];

async function listen(options) {
  const instance = createApp({ persist: false, env: {}, ...options });
  const server = await new Promise((resolve) => {
    const s = instance.app.listen(0, '127.0.0.1', () => resolve(s));
  });
  cleanups.push(() => {
    instance.close();
    server.close();
    server.closeAllConnections();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

if (MODE === 'url') {
  bases = [process.env.URL.replace(/\/$/, '')];
} else if (MODE === 'vercel') {
  const mock = await startUpstashMock({ latencyMs: 3 }); // ~độ trễ Vercel Function → Upstash cùng vùng
  cleanups.push(() => mock.close());
  for (let i = 0; i < 3; i++) {
    bases.push(await listen({ store: createUpstashStore({ url: mock.url, token: mock.token }) }));
  }
  cleanups.push(() => console.log(`Lệnh Redis đã dùng: ${mock.commandCount()} (gói miễn phí Upstash: 500.000/tháng)`));
} else {
  bases = [await listen({})];
}

const pickBase = () => bases[Math.floor(Math.random() * bases.length)];
const latencies = [];
let errors = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);

async function request(method, path, token, body) {
  const started = performance.now();
  const res = await fetch(pickBase() + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? {} : await res.json();
  latencies.push(performance.now() - started);
  if (!res.ok) {
    errors++;
    throw new Error(`${method} ${path} → ${res.status}: ${data.error}`);
  }
  return data;
}

async function bot(i) {
  const joined = await request('POST', '/api/join', null, { name: `Bot ${i + 1}` });
  const { token } = joined;
  let state = joined.state;
  while (state.phase !== 'done') {
    await sleep(rand(30, 150));
    if (state.phase === 'question') {
      state = (await request('POST', '/api/question', token)).state;
      if (!state.question) continue;
      await sleep(rand(50, 300));
      const choice = Math.random() < 0.1 ? null : Math.floor(Math.random() * 4);
      state = (await request('POST', '/api/answer', token, { qIndex: state.question.qIndex, choice })).state;
    } else {
      const amount = Math.random() < 0.25 ? 0 : Math.floor(Math.random() * state.balance * 0.6);
      const color = ['red', 'black', 'green'][Math.random() < 0.1 ? 2 : Math.floor(Math.random() * 2)];
      state = (await request('POST', '/api/spin', token, { spinsLeft: state.spinsLeft, color, amount })).state;
    }
    if (state.balance < 0) throw new Error(`Bot ${i + 1} bị âm điểm`);
  }
  return state;
}

// Một màn hình BXH theo dõi trong lúc bot chơi: SSE nếu có, không thì hỏi /api/bxh mỗi 2 giây.
let boardUpdates = 0;
let watching = true;
const watcher = (async () => {
  const res = await fetch(`${bases[0]}/api/bxh/stream`).catch(() => null);
  if (res?.status === 200) {
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    while (watching) {
      const { value, done } = await reader.read();
      if (done) break;
      boardUpdates += (decoder.decode(value).match(/^data:/gm) || []).length;
    }
    reader.cancel().catch(() => {});
    return;
  }
  while (watching) {
    if ((await fetch(`${pickBase()}/api/bxh`)).ok) boardUpdates++;
    await sleep(2000);
  }
})();

console.log(`Chạy ${PLAYERS} người chơi ảo · chế độ ${MODE} · ${bases.length} server …`);
const started = performance.now();
const results = await Promise.allSettled(Array.from({ length: PLAYERS }, (_, i) => bot(i)));
const seconds = (performance.now() - started) / 1000;
watching = false;
await Promise.race([watcher, sleep(2500)]);

const failed = results.filter((r) => r.status === 'rejected');
for (const f of failed.slice(0, 5)) console.error('  ✗', f.reason.message);
const finals = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
const finished = finals.filter((s) => s.phase === 'done').length;
const board = await request('GET', '/api/bxh');
latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((latencies.length * p) / 100))].toFixed(1);

// Điểm trên BXH phải khớp đúng điểm cuối cùng mỗi bot nhận được (không mất/ghi đè dữ liệu giữa các server).
const byName = new Map(board.players.map((p) => [p.name, p.balance]));
const mismatched = finals.filter((s) => byName.get(s.name) !== s.balance).length;

console.log(`Hoàn thành: ${finished}/${PLAYERS} người chơi trong ${seconds.toFixed(1)}s`);
console.log(`Request: ${latencies.length}, lỗi: ${errors}, điểm lệch BXH: ${mismatched}`);
console.log(`Độ trễ (ms): p50 ${pct(50)} · p95 ${pct(95)} · p99 ${pct(99)} · max ${latencies.at(-1).toFixed(1)}`);
console.log(`BXH cập nhật: ${boardUpdates} lần`);
console.log('Top 5:', board.players.slice(0, 5).map((p) => `${p.name} (${p.balance})`).join(', '));

for (const cleanup of cleanups.reverse()) await cleanup();
const ok = errors === 0 && failed.length === 0 && finished === PLAYERS && mismatched === 0 && boardUpdates > 0;
console.log(ok ? '✓ ĐẠT' : '✗ KHÔNG ĐẠT');
process.exit(ok ? 0 : 1);
