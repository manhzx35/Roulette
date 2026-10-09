import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, RULES, slotColor, randomSlot } from '../server/game.js';
import { createMemoryStore } from '../server/stores/memory.js';
import { QUESTIONS } from '../server/questions.js';

const RED = 1;
const BLACK = 2;
const GREEN = 0;

// Game với đồng hồ và kết quả quay điều khiển được.
async function setup() {
  let time = 1_000_000;
  const slots = [];
  const game = createGame({
    store: createMemoryStore(),
    now: () => time,
    spinSlot: () => {
      if (!slots.length) throw new Error('Chưa đặt kết quả quay cho test');
      return slots.shift();
    },
  });
  const { token } = await game.join('Tester');
  return {
    game,
    token,
    tick: (ms) => {
      time += ms;
    },
    nextSlots: (...s) => slots.push(...s),
  };
}

async function answerCurrent(game, token, right) {
  const { state } = await game.startQuestion(token);
  const q = QUESTIONS.find((x) => x.text === state.question.text);
  const choice = right ? q.answer : (q.answer + 1) % q.options.length;
  return game.answer(token, { qIndex: state.question.qIndex, choice });
}

// Trả lời hết các câu của vòng hiện tại (vòng cuối có thể ít hơn 3 câu), `rightCount` câu đầu đúng.
async function answerRound(game, token, rightCount) {
  let res;
  for (let i = 0; i < RULES.questionsPerRound; i++) {
    res = await answerCurrent(game, token, i < rightCount);
    if (res.state.phase !== 'question' || res.state.qIndex % RULES.questionsPerRound === 0) break;
  }
  return res;
}

async function spin(game, token, color, amount) {
  const { state } = await game.getState(token);
  return game.spin(token, { spinsLeft: state.spinsLeft, color, amount });
}

async function expectError(promise, status) {
  await assert.rejects(promise, (err) => err.status === status);
}

test('bộ câu hỏi: 20 câu, đáp án khớp với đáp án người dùng cung cấp, không trùng câu', () => {
  assert.equal(QUESTIONS.length, 20);
  // Văn hóa · Đạo đức qua tình huống · Cần kiệm liêm chính · Xây đi đôi với chống
  const key = 'ABBAC' + 'BDACB' + 'BCBCB' + 'BBCBB';
  QUESTIONS.forEach((q, i) => {
    assert.equal(q.options.length, 4, `câu ${i + 1}`);
    assert.equal(new Set(q.options).size, 4, `câu ${i + 1} có đáp án trùng`);
    assert.equal('ABCD'[q.answer], key[i], `đáp án câu ${i + 1}`);
  });
  assert.equal(new Set(QUESTIONS.map((q) => q.text)).size, QUESTIONS.length);
});

test('vòng quay có 20 đỏ, 20 đen, 1 xanh', () => {
  const counts = { red: 0, black: 0, green: 0 };
  for (let i = 0; i < RULES.slotCount; i++) counts[slotColor(i)]++;
  assert.deepEqual(counts, { red: 20, black: 20, green: 1 });
});

test('randomSlot phân phối đều trên 41 ô', () => {
  const counts = new Array(RULES.slotCount).fill(0);
  const n = RULES.slotCount * 2000;
  for (let i = 0; i < n; i++) counts[randomSlot()]++;
  for (const c of counts) assert.ok(c > 1700 && c < 2300, `số lần ${c} lệch quá xa 2000`);
});

test('vào game: điểm 0, chưa có câu hỏi cho tới khi bắt đầu, tên được làm sạch', async () => {
  const game = createGame({ store: createMemoryStore() });
  const { state } = await game.join('   Nguyễn   Văn   An   ');
  assert.equal(state.name, 'Nguyễn Văn An');
  assert.equal(state.phase, 'question');
  assert.equal(state.balance, 0);
  assert.equal(state.round, 1);
  assert.equal(state.totalRounds, 7);
  assert.equal(state.question, null);
  assert.equal((await game.join('a'.repeat(50))).state.name.length, RULES.maxNameLength);
  await expectError(game.join('   '), 400);
});

test('thứ tự câu hỏi được xáo và là hoán vị đủ bộ câu hỏi', async () => {
  const store = createMemoryStore();
  const game = createGame({ store });
  const { token } = await game.join('A');
  const { player } = await store.lockAndRead(token);
  assert.deepEqual([...player.order].sort((a, b) => a - b), [...QUESTIONS.keys()]);
});

test('không lộ đáp án trong state gửi xuống client', async () => {
  const { game, token } = await setup();
  const { state } = await game.startQuestion(token);
  assert.ok(state.question.text);
  assert.ok(!JSON.stringify(state).includes('"answer"'));
  assert.equal(state.question.timeLeftMs, RULES.questionTimeMs);
});

test('đúng +300, sai 0; sau 3 câu chuyển sang 3 lượt quay', async () => {
  const { game, token } = await setup();
  const r1 = await answerCurrent(game, token, true);
  assert.equal(r1.result.correct, true);
  assert.equal(r1.state.balance, 300);
  const r2 = await answerCurrent(game, token, false);
  assert.equal(r2.result.correct, false);
  assert.equal(r2.state.balance, 300);
  assert.equal(r2.state.phase, 'question');
  const r3 = await answerCurrent(game, token, true);
  assert.equal(r3.state.phase, 'spin');
  assert.equal(r3.state.spinsLeft, 3);
  assert.equal(r3.state.balance, 600);
  assert.equal(r3.result.spinsSkipped, 0);
});

test('trả thưởng: Đỏ/Đen ×2, Xanh ×35 (tổng nhận về), thua mất tiền cược', async () => {
  const { game, token, nextSlots } = await setup();
  await answerRound(game, token, 3); // 900 điểm
  nextSlots(RED, BLACK, GREEN);
  let r = await spin(game, token, 'red', 100);
  assert.deepEqual([r.result.win, r.result.payout, r.result.net, r.state.balance], [true, 200, 100, 1000]);
  r = await spin(game, token, 'red', 100);
  assert.deepEqual([r.result.win, r.result.payout, r.result.net, r.state.balance], [false, 0, -100, 900]);
  r = await spin(game, token, 'green', 100);
  assert.deepEqual([r.result.win, r.result.payout, r.result.net, r.state.balance], [true, 3500, 3400, 4300]);
  assert.equal(r.state.phase, 'question');
  assert.deepEqual(r.state.stats, { spins: 3, wins: 2, jackpots: 1 });
});

test('còn điểm: cược 0 vẫn phải quay đủ 3 lượt mới được trả lời tiếp', async () => {
  const { game, token, nextSlots } = await setup();
  await answerRound(game, token, 1);
  nextSlots(RED, BLACK, RED);
  await spin(game, token, 'black', 0);
  const r = await spin(game, token, 'black', 0);
  assert.equal(r.state.phase, 'spin');
  assert.equal(r.state.spinsLeft, 1);
  assert.equal(r.state.balance, 300);
  await game.startQuestion(token);
  await expectError(game.answer(token, { qIndex: 3, choice: 0 }), 409);
  const last = await spin(game, token, 'black', 0);
  assert.equal(last.state.phase, 'question');
  assert.equal(last.result.spinsSkipped, 0);
});

test('thua về 0 điểm giữa chừng → bỏ các lượt còn lại, sang câu hỏi', async () => {
  const { game, token, nextSlots } = await setup();
  await answerRound(game, token, 1); // 300
  nextSlots(BLACK);
  const r = await spin(game, token, 'red', 300);
  assert.equal(r.state.balance, 0);
  assert.equal(r.state.phase, 'question');
  assert.equal(r.state.spinsLeft, 0);
  assert.equal(r.result.spinsSkipped, 2);
  assert.equal(r.state.round, 2);
});

test('về 0 ở lượt thứ 2 → bỏ 1 lượt', async () => {
  const { game, token, nextSlots } = await setup();
  await answerRound(game, token, 1);
  nextSlots(BLACK, BLACK);
  await spin(game, token, 'red', 100);
  const r = await spin(game, token, 'green', 200);
  assert.equal(r.state.balance, 0);
  assert.equal(r.result.spinsSkipped, 1);
  assert.equal(r.state.phase, 'question');
});

test('0 điểm sau 3 câu → bỏ qua cả pha quay; vòng sau reset đúng 3 lượt (không cộng dồn)', async () => {
  const { game, token } = await setup();
  const r = await answerRound(game, token, 0);
  assert.equal(r.result.spinsSkipped, 3);
  assert.equal(r.state.phase, 'question');
  assert.equal(r.state.qIndex, 3);
  const r2 = await answerRound(game, token, 1);
  assert.equal(r2.state.phase, 'spin');
  assert.equal(r2.state.spinsLeft, 3);
  await expectError(game.spin(token, { spinsLeft: 6, color: 'red', amount: 0 }), 409);
});

test('kiểm tra dữ liệu cược', async () => {
  const { game, token } = await setup();
  await answerRound(game, token, 1); // 300
  const bad = [
    { color: 'red', amount: -1 },
    { color: 'red', amount: 301 },
    { color: 'red', amount: 1.5 },
    { color: 'red', amount: '100' },
    { color: 'blue', amount: 100 },
    { color: 'toString', amount: 100 },
  ];
  for (const body of bad) await expectError(game.spin(token, { spinsLeft: 3, ...body }), 400);
  await expectError(game.spin(token, { spinsLeft: 2, color: 'red', amount: 0 }), 409);
  assert.equal((await game.getState(token)).state.balance, 300);
});

test('chặn trả lời trùng, trả lời trước khi bắt đầu, và lựa chọn sai định dạng', async () => {
  const { game, token } = await setup();
  await expectError(game.answer(token, { qIndex: 0, choice: 0 }), 409);
  await game.startQuestion(token);
  await expectError(game.answer(token, { qIndex: 0, choice: 4 }), 400);
  await expectError(game.answer(token, { qIndex: 0, choice: '1' }), 400);
  await game.answer(token, { qIndex: 0, choice: 0 });
  await expectError(game.answer(token, { qIndex: 0, choice: 0 }), 409);
  await expectError(game.spin(token, { spinsLeft: 3, color: 'red', amount: 0 }), 409);
  await expectError(game.getState('khong-ton-tai'), 401);
  await expectError(game.getState(undefined), 401);
});

test('hết giờ: gửi null hoặc trả lời quá hạn đều tính sai; F5 không reset đồng hồ', async () => {
  const { game, token, tick } = await setup();
  await game.startQuestion(token);
  tick(10_000);
  assert.equal((await game.startQuestion(token)).state.question.timeLeftMs, 20_000);

  const timeout = await game.answer(token, { qIndex: 0, choice: null });
  assert.equal(timeout.result.timedOut, true);
  assert.equal(timeout.state.balance, 0);

  const { state } = await game.startQuestion(token);
  const q = QUESTIONS.find((x) => x.text === state.question.text);
  tick(RULES.questionTimeMs + RULES.graceMs + 1);
  const late = await game.answer(token, { qIndex: 1, choice: q.answer });
  assert.equal(late.result.timedOut, true);
  assert.equal(late.result.correct, false);
  assert.equal(late.state.balance, 0);
});

test('rời game khi đang có câu hỏi → quay lại thì câu đó bị chấm sai', async () => {
  const { game, token, tick } = await setup();
  await game.startQuestion(token);
  tick(60_000);
  const { state } = await game.getState(token);
  assert.equal(state.qIndex, 1);
  assert.equal(state.question, null);
  assert.equal(state.balance, 0);
});

test('chơi trọn game: 7 vòng, kết thúc ở trạng thái done', async () => {
  const { game, token, nextSlots } = await setup();
  let state;
  for (let round = 1; round <= 7; round++) {
    state = (await answerRound(game, token, 3)).state;
    assert.equal(state.phase, 'spin');
    assert.equal(state.round, round);
    nextSlots(RED, RED, RED);
    for (let i = 0; i < 3; i++) state = (await spin(game, token, 'black', 0)).state;
  }
  assert.equal(state.phase, 'done');
  assert.equal(state.balance, QUESTIONS.length * 300);
  assert.equal(state.correctCount, QUESTIONS.length);
  assert.equal(state.rank, 1);
  await expectError(game.answer(token, { qIndex: QUESTIONS.length, choice: 0 }), 409);
  await expectError(game.spin(token, { spinsLeft: 0, color: 'red', amount: 0 }), 409);
  const board = await game.leaderboard();
  assert.deepEqual([board.finished, board.players[0].done, board.players[0].round], [1, true, 7]);
});

test('0 điểm ở vòng cuối → kết thúc game luôn', async () => {
  const { game, token } = await setup();
  let state;
  for (let round = 1; round <= 7; round++) state = (await answerRound(game, token, 0)).state;
  assert.equal(state.phase, 'done');
  assert.equal(state.round, 7);
});

test('vòng cuối chỉ có 2 câu (20 câu) vẫn được 3 lượt quay', async () => {
  const { game, token, nextSlots } = await setup();
  for (let round = 1; round <= 6; round++) {
    await answerRound(game, token, 0); // 0 điểm → bỏ qua pha quay, sang vòng sau
  }
  const first = await answerCurrent(game, token, true);
  assert.deepEqual([first.state.round, first.state.questionInRound, first.state.phase], [7, 2, 'question']);
  const last = await answerCurrent(game, token, true);
  assert.deepEqual([last.state.phase, last.state.spinsLeft, last.state.balance], ['spin', 3, 600]);
  nextSlots(RED, RED, RED);
  let state;
  for (let i = 0; i < 3; i++) state = (await spin(game, token, 'black', 0)).state;
  assert.equal(state.phase, 'done');
});

test('lượt chơi từ bộ câu hỏi cũ (khác số câu) bị coi như không tồn tại', async () => {
  const store = createMemoryStore();
  const game = createGame({ store });
  const { token } = await game.join('Bộ cũ');
  const snap = await store.lockAndRead(token);
  snap.player.order = [...snap.player.order, 20]; // giả lập 21 câu của bộ trước
  await store.commit(token, { player: snap.player, summary: { id: snap.player.id } });
  await expectError(game.getState(token), 401);
});

test('bảng xếp hạng: điểm giảm dần, bằng điểm thì ai đúng nhiều hơn xếp trên; không lộ token', async () => {
  let time = 0;
  const game = createGame({ store: createMemoryStore(), now: () => ++time, spinSlot: () => RED });
  const a = (await game.join('An')).token;
  const b = (await game.join('Bình')).token;
  const c = (await game.join('Chi')).token;
  await answerRound(game, a, 1); // 300 điểm, 1 câu đúng
  await answerRound(game, b, 2); // 600
  await answerRound(game, c, 2); // 600 → cược thua 300 → 300 điểm, 2 câu đúng
  await game.spin(c, { spinsLeft: 3, color: 'black', amount: 300 });
  const board = await game.leaderboard();
  assert.deepEqual(board.players.map((p) => p.name), ['Bình', 'Chi', 'An']);
  assert.equal((await game.getState(a)).state.rank, 3);
  assert.ok(![a, b, c].some((t) => JSON.stringify(board).includes(t)));
});

test('reset xoá toàn bộ người chơi', async () => {
  const { game, token } = await setup();
  await game.reset();
  await expectError(game.getState(token), 401);
  assert.equal((await game.leaderboard()).totalPlayers, 0);
});
