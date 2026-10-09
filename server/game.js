import crypto from 'node:crypto';
import { QUESTIONS } from './questions.js';

export const RULES = Object.freeze({
  slotCount: 41,
  questionsPerRound: 3,
  spinsPerRound: 3,
  pointsPerCorrect: 300,
  questionTimeMs: 30_000,
  graceMs: 3_000, // bù trễ mạng khi chấm hết giờ
  maxNameLength: 20,
  // Tổng nhận về khi trúng (gồm cả tiền cược): cược 100 vào Đỏ trúng → nhận 200.
  payout: Object.freeze({ red: 2, black: 2, green: 35 }),
});

// Chờ khoá người chơi khi có 2 request cùng lúc (VD bấm 2 lần, 2 tab).
const LOCK_RETRIES = 25;
const LOCK_WAIT_MS = 40;

// Ô 0 = xanh, ô lẻ = đỏ, ô chẵn = đen → 20 đỏ + 20 đen + 1 xanh.
// public/js/wheel.js vẽ vòng quay theo đúng quy ước này.
export function slotColor(slot) {
  if (slot === 0) return 'green';
  return slot % 2 === 1 ? 'red' : 'black';
}

export function randomSlot() {
  return crypto.randomInt(RULES.slotCount);
}

export class GameError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function shuffle(list, randomInt) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function roundOf(p) {
  const perRound = RULES.questionsPerRound;
  if (p.phase === 'done') return Math.ceil(p.order.length / perRound);
  if (p.phase === 'spin') return Math.ceil(p.qIndex / perRound);
  return Math.floor(p.qIndex / perRound) + 1;
}

/** Bản tóm tắt công khai của một người chơi, dùng cho bảng xếp hạng (không chứa token). */
export function summaryOf(p) {
  return {
    id: p.id,
    name: p.name,
    balance: p.balance,
    correctCount: p.correctCount,
    round: roundOf(p),
    done: p.phase === 'done',
    finishedAt: p.finishedAt,
    createdAt: p.createdAt,
  };
}

export function compareRank(a, b) {
  return (
    b.balance - a.balance ||
    b.correctCount - a.correctCount ||
    (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) ||
    a.createdAt - b.createdAt
  );
}

/**
 * Toàn bộ luật chơi, chạy ở server (client chỉ hiển thị).
 * Chu trình mỗi người: 3 câu hỏi → 3 lượt quay → 3 câu tiếp … cho tới hết câu hỏi.
 *
 * Dữ liệu nằm trong `store` (bộ nhớ khi chạy 1 server, Upstash Redis khi chạy trên Vercel).
 * Mỗi thao tác: khoá người chơi → đọc → áp luật → ghi + mở khoá, nên nhiều bản server
 * cùng chạy (Vercel tự nhân bản) vẫn không cộng/trừ điểm hai lần.
 */
export function createGame({
  store,
  questions = QUESTIONS,
  randomInt = crypto.randomInt,
  spinSlot = randomSlot,
  now = Date.now,
  onChange = () => {},
}) {
  if (!store) throw new Error('createGame cần một store');
  const totalQuestions = questions.length;
  const totalRounds = Math.ceil(totalQuestions / RULES.questionsPerRound);
  const deadlineMs = RULES.questionTimeMs + RULES.graceMs;

  function cleanName(raw) {
    const collapsed = String(raw ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const name = [...collapsed].slice(0, RULES.maxNameLength).join('').trim();
    if (!name) throw new GameError(400, 'Vui lòng nhập tên.');
    return name;
  }

  // ---------- Luật chơi trên một người chơi (đồng bộ, không I/O) ----------

  // Trả về số lượt quay bị bỏ qua (khác 0 khi người chơi hết điểm).
  function enterSpinPhase(p) {
    p.phase = 'spin';
    p.spinsLeft = RULES.spinsPerRound; // luôn reset về 3, không cộng dồn
    return p.balance === 0 ? endSpinPhase(p) : 0;
  }

  function endSpinPhase(p) {
    const skipped = p.spinsLeft;
    p.spinsLeft = 0;
    if (p.qIndex >= totalQuestions) {
      p.phase = 'done';
      p.finishedAt = now();
    } else {
      p.phase = 'question';
    }
    return skipped;
  }

  function finishQuestion(p, correct) {
    if (correct) {
      p.balance += RULES.pointsPerCorrect;
      p.correctCount++;
    }
    p.qIndex++;
    p.questionStartedAt = null;
    const roundOver = p.qIndex % RULES.questionsPerRound === 0 || p.qIndex >= totalQuestions;
    return roundOver ? enterSpinPhase(p) : 0;
  }

  // Người chơi rời đi khi đang có câu hỏi → quá giờ thì tự chấm sai.
  function expireQuestion(p) {
    if (p.phase === 'question' && p.questionStartedAt !== null && now() - p.questionStartedAt > deadlineMs) {
      finishQuestion(p, false);
    }
  }

  function answerQuestion(p, { qIndex, choice } = {}) {
    if (p.phase !== 'question') throw new GameError(409, 'Chưa đến lượt trả lời câu hỏi.');
    if (qIndex !== p.qIndex) throw new GameError(409, 'Câu hỏi này đã được trả lời.');
    if (p.questionStartedAt === null) throw new GameError(409, 'Câu hỏi chưa bắt đầu.');
    const q = questions[p.order[p.qIndex]];
    if (choice !== null && !(Number.isInteger(choice) && choice >= 0 && choice < q.options.length)) {
      throw new GameError(400, 'Lựa chọn không hợp lệ.');
    }
    const timedOut = choice === null || now() - p.questionStartedAt > deadlineMs;
    const correct = !timedOut && choice === q.answer;
    const spinsSkipped = finishQuestion(p, correct);
    return {
      correct,
      timedOut,
      correctChoice: q.answer,
      gained: correct ? RULES.pointsPerCorrect : 0,
      spinsSkipped,
    };
  }

  function spinWheel(p, { spinsLeft, color, amount } = {}) {
    if (p.phase !== 'spin') throw new GameError(409, 'Chưa đến lượt quay.');
    if (spinsLeft !== p.spinsLeft) throw new GameError(409, 'Lượt quay này đã được thực hiện.');
    if (!Object.hasOwn(RULES.payout, color)) throw new GameError(400, 'Màu cược không hợp lệ.');
    if (!Number.isInteger(amount) || amount < 0) throw new GameError(400, 'Số điểm cược không hợp lệ.');
    if (amount > p.balance) throw new GameError(400, 'Không đủ điểm để cược.');

    const slot = spinSlot();
    if (!Number.isInteger(slot) || slot < 0 || slot >= RULES.slotCount) throw new Error(`Ô quay không hợp lệ: ${slot}`);
    const resultColor = slotColor(slot);
    const win = resultColor === color;
    const payout = win ? amount * RULES.payout[color] : 0;
    p.balance += payout - amount;
    p.spinsLeft--;
    p.stats.spins++;
    if (win && amount > 0) {
      p.stats.wins++;
      if (color === 'green') p.stats.jackpots++;
    }
    // Còn điểm thì phải quay đủ 3 lượt (được cược 0); về 0 điểm thì bỏ các lượt còn lại.
    const spinsSkipped = p.spinsLeft === 0 || p.balance === 0 ? endSpinPhase(p) : 0;
    return { slot, resultColor, color, bet: amount, win, payout, net: payout - amount, spinsSkipped };
  }

  // `board` = null khi thao tác không cần thứ hạng (tiết kiệm 1 lượt đọc BXH mỗi lần trả lời/quay).
  function view(p, board) {
    const ranked = board ? [...board].sort(compareRank) : null;
    const state = {
      id: p.id,
      name: p.name,
      phase: p.phase,
      balance: p.balance,
      correctCount: p.correctCount,
      qIndex: p.qIndex,
      totalQuestions,
      round: roundOf(p),
      totalRounds,
      questionInRound: p.phase === 'question' ? (p.qIndex % RULES.questionsPerRound) + 1 : null,
      questionsPerRound: RULES.questionsPerRound,
      spinsLeft: p.spinsLeft,
      spinsPerRound: RULES.spinsPerRound,
      stats: { ...p.stats },
      rank: ranked ? ranked.findIndex((s) => s.id === p.id) + 1 : null,
      playerCount: ranked ? ranked.length : null,
      question: null,
    };
    if (p.phase === 'question' && p.questionStartedAt !== null) {
      const q = questions[p.order[p.qIndex]];
      state.question = {
        qIndex: p.qIndex,
        text: q.text,
        options: [...q.options],
        timeLimitMs: RULES.questionTimeMs,
        timeLeftMs: Math.max(0, p.questionStartedAt + RULES.questionTimeMs - now()),
      };
    }
    return state;
  }

  // ---------- Đọc / ghi qua store ----------

  // Khoá → đọc → chạy `fn` → ghi (nếu có thay đổi) + mở khoá.
  // Thứ hạng chỉ được tính khi cần (`withBoard`) hoặc khi người chơi vừa chơi xong.
  async function withPlayer(token, fn, { withBoard = false } = {}) {
    if (typeof token !== 'string' || !token || token.length > 64) {
      throw new GameError(401, 'Không tìm thấy người chơi. Hãy vào game lại.');
    }
    let snap = { locked: false };
    for (let i = 0; i < LOCK_RETRIES && !snap.locked; i++) {
      if (i > 0) await sleep(LOCK_WAIT_MS);
      snap = await store.lockAndRead(token, { withBoard });
    }
    if (!snap.locked) throw new GameError(409, 'Thao tác trước vẫn đang xử lý, hãy thử lại.');

    let write = null;
    let p;
    let result;
    try {
      p = snap.player;
      // Lượt chơi tạo từ bộ câu hỏi cũ (đã đổi số câu) không chơi tiếp được → coi như chưa có người chơi.
      if (!p || p.order?.length !== totalQuestions) {
        throw new GameError(401, 'Không tìm thấy người chơi. Hãy vào game lại.');
      }
      const before = JSON.stringify(p);
      result = fn(p);
      if (JSON.stringify(p) !== before) write = { player: p, summary: summaryOf(p) };
    } finally {
      await store.commit(token, write);
      if (write) onChange();
    }

    let board = snap.board ?? null;
    if (!board && p.phase === 'done') board = await store.board();
    if (board && write) board = [...board.filter((s) => s.id !== p.id), write.summary];
    return { result, state: view(p, board) };
  }

  return {
    totalRounds,

    async join(name) {
      const p = {
        id: crypto.randomBytes(6).toString('hex'),
        token: crypto.randomBytes(18).toString('base64url'),
        name: cleanName(name),
        order: shuffle([...questions.keys()], randomInt),
        qIndex: 0,
        phase: 'question',
        questionStartedAt: null,
        spinsLeft: 0,
        balance: 0,
        correctCount: 0,
        stats: { spins: 0, wins: 0, jackpots: 0 },
        createdAt: now(),
        finishedAt: null,
      };
      const board = await store.create(p, summaryOf(p));
      onChange();
      return { token: p.token, state: view(p, board) };
    },

    async getState(token) {
      const { state } = await withPlayer(token, expireQuestion, { withBoard: true });
      return { state };
    },

    // Đồng hồ 30 giây chỉ bắt đầu khi câu hỏi thực sự được hiển thị; gọi lại (F5) không reset đồng hồ.
    async startQuestion(token) {
      const { state } = await withPlayer(token, (p) => {
        expireQuestion(p);
        if (p.phase === 'question' && p.questionStartedAt === null) p.questionStartedAt = now();
      });
      return { state };
    },

    answer(token, body) {
      return withPlayer(token, (p) => answerQuestion(p, body));
    },

    spin(token, body) {
      return withPlayer(token, (p) => spinWheel(p, body));
    },

    async leaderboard() {
      const ranked = (await store.board()).sort(compareRank);
      return {
        totalPlayers: ranked.length,
        finished: ranked.filter((s) => s.done).length,
        totalRounds,
        players: ranked.map(({ id, name, balance, correctCount, round, done }) => ({
          id,
          name,
          balance,
          correctCount,
          round,
          done,
        })),
      };
    },

    async reset() {
      await store.reset();
      onChange();
    },
  };
}
