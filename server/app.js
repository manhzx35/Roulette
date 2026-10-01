import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import QRCode from 'qrcode';
import { createGame, GameError } from './game.js';
import { createMemoryStore } from './stores/memory.js';
import { createUpstashStore, upstashConfigFromEnv } from './stores/upstash.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BXH_INTERVAL_MS = 1000;
const HEARTBEAT_MS = 25_000;

// Ưu tiên địa chỉ Wi-Fi/LAN thường gặp trước các adapter VPN/ảo.
function lanRank(address) {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  return 3;
}

export function lanUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)
    .sort((a, b) => lanRank(a) - lanRank(b))
    .map((address) => `http://${address}:${port}`);
}

/**
 * Chọn nơi lưu dữ liệu:
 * - Có biến Upstash (UPSTASH_REDIS_REST_* hoặc KV_REST_API_*) → Upstash Redis, chạy được nhiều bản server (Vercel).
 * - Không có → bộ nhớ của server này (+ file data/state.json), chỉ chạy 1 bản server (laptop, Render, Railway).
 */
export function createApp({
  store: givenStore,
  dataFile = path.join(ROOT, 'data', 'state.json'),
  persist = true,
  adminKey = process.env.ADMIN_KEY,
  forceSlot,
  env = process.env,
} = {}) {
  const onVercel = Boolean(env.VERCEL);
  const redis = upstashConfigFromEnv(env);
  const store =
    givenStore ??
    (redis ? createUpstashStore(redis) : createMemoryStore({ file: persist && !onVercel ? dataFile : null }));
  const shared = store.kind !== 'memory';
  const missingRedis = onVercel && !shared;

  // BXH realtime qua SSE chỉ dùng được khi cả game nằm trong 1 server.
  // Với Upstash (Vercel), trang BXH tự hỏi /api/bxh mỗi 2 giây, có CDN cache 1 giây phía trước.
  const streams = new Set();
  let bxhTimer = null;
  let lastBroadcast = 0;

  const game = createGame({
    store,
    spinSlot: forceSlot === undefined ? undefined : () => forceSlot,
    onChange: shared ? undefined : scheduleBroadcast,
  });

  function scheduleBroadcast() {
    if (bxhTimer) return;
    const wait = Math.max(0, BXH_INTERVAL_MS - (Date.now() - lastBroadcast));
    bxhTimer = setTimeout(async () => {
      bxhTimer = null;
      lastBroadcast = Date.now();
      if (!streams.size) return;
      const message = `data: ${JSON.stringify(await game.leaderboard())}\n\n`;
      for (const res of streams) res.write(message);
    }, wait);
  }

  const heartbeat = setInterval(() => {
    for (const res of streams) res.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  const app = express();
  app.disable('x-powered-by');
  // Trên Vercel, CDN tự nén; nén thêm ở function chỉ tốn CPU.
  if (!onVercel) {
    app.use(compression({ filter: (req, res) => req.path !== '/api/bxh/stream' && compression.filter(req, res) }));
  }
  app.use(express.json({ limit: '4kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });

  // Deploy lên Vercel mà quên gắn Upstash → báo lỗi rõ ràng thay vì chạy sai (mỗi bản server một dữ liệu).
  if (missingRedis) {
    app.use(['/api/join', '/api/state', '/api/question', '/api/answer', '/api/spin', '/api/bxh', '/api/admin'], (req, res) =>
      res.status(503).json({
        error: 'Server chưa kết nối Upstash Redis. Vào Vercel → Storage → thêm Upstash Redis cho project rồi Redeploy.',
      }),
    );
  }

  const token = (req) => req.get('x-token');
  const body = (req) => req.body ?? {};

  app.post('/api/join', async (req, res) => res.json(await game.join(body(req).name)));
  app.get('/api/state', async (req, res) => res.json(await game.getState(token(req))));
  app.post('/api/question', async (req, res) => res.json(await game.startQuestion(token(req))));
  app.post('/api/answer', async (req, res) => res.json(await game.answer(token(req), body(req))));
  app.post('/api/spin', async (req, res) => res.json(await game.spin(token(req), body(req))));

  app.get('/api/bxh', async (req, res) => {
    const board = await game.leaderboard();
    // Nhiều màn hình cùng xem BXH chỉ tạo tối đa 1 lượt đọc Redis mỗi giây.
    if (shared) res.set('Cache-Control', 'public, max-age=0, s-maxage=1, stale-while-revalidate=2');
    res.json(board);
  });

  app.get('/api/bxh/stream', async (req, res) => {
    if (shared) return res.status(204).end(); // trình duyệt sẽ chuyển sang hỏi /api/bxh định kỳ
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`retry: 3000\ndata: ${JSON.stringify(await game.leaderboard())}\n\n`);
    streams.add(res);
    req.on('close', () => streams.delete(res));
  });

  app.get('/api/info', (req, res) =>
    res.json({ store: store.kind, lanUrls: onVercel ? [] : lanUrls(req.socket.localPort) }),
  );

  app.get('/api/qr.svg', async (req, res) => {
    const url = String(req.query.u ?? '');
    if (!/^https?:\/\/\S{1,300}$/.test(url)) return res.status(400).json({ error: 'URL không hợp lệ.' });
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      color: { dark: '#3B2413FF', light: '#FFF3D6FF' },
    });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600, s-maxage=86400').send(svg);
  });

  app.post('/api/admin/reset', async (req, res) => {
    if (!adminKey) return res.status(403).json({ error: 'Server chưa cấu hình ADMIN_KEY nên không thể đặt lại.' });
    const given = Buffer.from(req.get('x-admin-key') ?? '');
    const expected = Buffer.from(adminKey);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return res.status(403).json({ error: 'Sai mã quản trị.' });
    }
    await game.reset();
    console.log('[admin] Đã đặt lại toàn bộ người chơi.');
    res.json({ ok: true });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));
  // Trên Vercel, thư mục public/ do CDN phục vụ; ở các nơi khác Express tự phục vụ.
  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

  app.use((err, req, res, next) => {
    if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
    if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Yêu cầu không hợp lệ.' });
    console.error(err);
    // Lỗi kết nối Redis là tạm thời → 503 để trình duyệt tự thử lại.
    const temporary = /upstash|fetch failed|ECONN|ETIMEDOUT/i.test(`${err.name} ${err.message}`);
    res.status(temporary ? 503 : 500).json({ error: temporary ? 'Máy chủ đang bận, đang thử lại…' : 'Lỗi máy chủ.' });
  });

  return {
    app,
    game,
    store,
    flush() {
      store.flush();
    },
    close() {
      clearInterval(heartbeat);
      clearTimeout(bxhTimer);
      store.close();
      for (const res of streams) res.end();
      streams.clear();
    },
  };
}
