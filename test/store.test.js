import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame, summaryOf } from '../server/game.js';
import { createMemoryStore } from '../server/stores/memory.js';
import { createUpstashStore } from '../server/stores/upstash.js';
import { QUESTIONS } from '../server/questions.js';
import { startUpstashMock } from './helpers/upstash-mock.js';

let mock;
before(async () => {
  mock = await startUpstashMock({ latencyMs: 2 });
});
after(() => mock.close());

const KINDS = {
  memory: () => createMemoryStore(),
  upstash: () => createUpstashStore({ url: mock.url, token: mock.token, retry: false }),
};

async function playRound(game, token, right = 3) {
  let res;
  for (let i = 0; i < 3; i++) {
    const { state } = await game.startQuestion(token);
    const q = QUESTIONS.find((x) => x.text === state.question.text);
    res = await game.answer(token, { qIndex: state.question.qIndex, choice: i < right ? q.answer : (q.answer + 1) % 4 });
  }
  return res.state;
}

for (const [kind, makeStore] of Object.entries(KINDS)) {
  test(`[${kind}] khoá, đọc, ghi, BXH và reset`, async () => {
    const store = makeStore();
    await store.reset();
    const player = { id: 'p1', token: 'tok-1', name: 'Nguyễn Thị Ánh 😀', order: [...QUESTIONS.keys()], qIndex: 0, phase: 'question', balance: 0, correctCount: 0, createdAt: 1, finishedAt: null };
    const board = await store.create(player, summaryOf(player));
    assert.deepEqual(board.map((s) => s.name), ['Nguyễn Thị Ánh 😀']);

    const first = await store.lockAndRead('tok-1');
    assert.equal(first.locked, true);
    assert.equal(first.player.name, 'Nguyễn Thị Ánh 😀');
    assert.equal((await store.lockAndRead('tok-1')).locked, false, 'đang khoá thì không ai đọc-ghi được');

    first.player.balance = 900;
    await store.commit('tok-1', { player: first.player, summary: summaryOf(first.player) });
    const second = await store.lockAndRead('tok-1', { withBoard: true });
    assert.equal(second.locked, true);
    assert.equal(second.player.balance, 900);
    assert.equal(second.board[0].balance, 900);
    await store.commit('tok-1', null);

    const missing = await store.lockAndRead('khong-co');
    assert.deepEqual([missing.locked, missing.player], [true, null]);
    await store.commit('khong-co', null);

    await store.reset();
    assert.deepEqual(await store.board(), []);
    const gone = await store.lockAndRead('tok-1');
    assert.equal(gone.player, null);
    await store.commit('tok-1', null);
  });

  test(`[${kind}] bấm quay 2 lần cùng lúc chỉ được tính 1 lần`, async () => {
    const store = makeStore();
    const game = createGame({ store, spinSlot: () => 1 });
    const { token } = await game.join('Nhanh tay');
    await playRound(game, token); // 900 điểm, vào pha quay
    const results = await Promise.allSettled([
      game.spin(token, { spinsLeft: 3, color: 'red', amount: 500 }),
      game.spin(token, { spinsLeft: 3, color: 'red', amount: 500 }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 1);
    assert.equal(rejected[0].reason.status, 409);
    const { state } = await game.getState(token);
    assert.deepEqual([state.spinsLeft, state.balance], [2, 1400]);
  });
}

test('[upstash] 2 bản server dùng chung dữ liệu (như Vercel) cho kết quả nhất quán', async () => {
  const gameA = createGame({ store: KINDS.upstash(), spinSlot: () => 2 });
  const gameB = createGame({ store: KINDS.upstash(), spinSlot: () => 2 });
  await gameA.reset();
  const { token } = await gameA.join('Hai server');
  await gameB.join('Người khác');
  // Mỗi request rơi vào một bản server khác nhau.
  const { state: s1 } = await gameB.startQuestion(token);
  const q = QUESTIONS.find((x) => x.text === s1.question.text);
  const r1 = await gameA.answer(token, { qIndex: 0, choice: q.answer });
  assert.equal(r1.state.balance, 300);
  const { state: s2 } = await gameB.getState(token);
  assert.deepEqual([s2.qIndex, s2.balance, s2.playerCount], [1, 300, 2]);
  const board = await gameA.leaderboard();
  assert.deepEqual(board.players.map((p) => [p.name, p.balance]), [['Hai server', 300], ['Người khác', 0]]);
});

test('[memory] lưu ra file và nạp lại, đọc được cả định dạng file cũ', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-'));
  const file = path.join(dir, 'state.json');
  const store = createMemoryStore({ file });
  const game = createGame({ store });
  const { token } = await game.join('Lưu file');
  await playRound(game, token, 1);
  store.flush();
  store.close();

  const reloaded = createGame({ store: createMemoryStore({ file }) });
  assert.equal((await reloaded.getState(token)).state.balance, 300);

  // File do bản trước ghi (version 1) chỉ có danh sách players.
  const legacy = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ version: 1, players: legacy.players }));
  const fromLegacy = createGame({ store: createMemoryStore({ file }) });
  assert.equal((await fromLegacy.leaderboard()).players[0].name, 'Lưu file');
  fs.rmSync(dir, { recursive: true, force: true });
});
