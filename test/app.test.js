import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { startUpstashMock } from './helpers/upstash-mock.js';

let mock;
before(async () => {
  mock = await startUpstashMock();
});
after(() => mock.close());

async function serve(options) {
  const instance = createApp({ persist: false, ...options });
  const server = await new Promise((resolve) => {
    const s = instance.app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async close() {
      instance.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const upstashEnv = () => ({ VERCEL: '1', KV_REST_API_URL: mock.url, KV_REST_API_TOKEN: mock.token });

test('trên Vercel mà chưa gắn Upstash → API báo lỗi 503 rõ ràng', async () => {
  const app = await serve({ env: { VERCEL: '1' } });
  const res = await fetch(`${app.base}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"A"}' });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /Upstash/);
  assert.equal((await fetch(`${app.base}/api/info`)).status, 200);
  await app.close();
});

test('Vercel + Upstash (biến KV_REST_API_* của Vercel Marketplace): chơi được, BXH dùng CDN cache, tắt SSE', async () => {
  const app = await serve({ env: upstashEnv() });
  const join = await fetch(`${app.base}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Vercel"}' });
  assert.equal(join.status, 200);
  const { token } = await join.json();
  const state = await fetch(`${app.base}/api/state`, { headers: { 'X-Token': token } });
  assert.equal((await state.json()).state.name, 'Vercel');
  assert.equal(state.headers.get('cache-control'), 'no-store');

  const bxh = await fetch(`${app.base}/api/bxh`);
  assert.match(bxh.headers.get('cache-control'), /s-maxage=1/);
  assert.ok((await bxh.json()).players.some((p) => p.name === 'Vercel'));

  assert.equal((await fetch(`${app.base}/api/bxh/stream`)).status, 204);
  assert.equal((await (await fetch(`${app.base}/api/info`)).json()).store, 'upstash');
  await app.close();
});

test('Upstash lỗi kết nối → 503 để trình duyệt tự thử lại', async () => {
  const app = await serve({ env: { VERCEL: '1', KV_REST_API_URL: mock.url, KV_REST_API_TOKEN: 'sai-token' } });
  const res = await fetch(`${app.base}/api/bxh`);
  assert.equal(res.status, 503);
  await app.close();
});

test('chạy thường (không Vercel, không Upstash) → SSE BXH hoạt động', async () => {
  const app = await serve({ env: {} });
  const controller = new AbortController();
  try {
    const res = await fetch(`${app.base}/api/bxh/stream`, { signal: controller.signal });
    assert.match(res.headers.get('content-type'), /^text\/event-stream/);
    const { value } = await res.body.getReader().read();
    assert.match(new TextDecoder().decode(value), /data: \{"totalPlayers":0/);
  } finally {
    controller.abort();
    await app.close();
  }
});
