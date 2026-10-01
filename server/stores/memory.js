import fs from 'node:fs';
import path from 'node:path';
import { summaryOf } from '../game.js';

/**
 * Lưu dữ liệu trong RAM của một server duy nhất (chạy trên laptop, Render, Railway…).
 * Có thể ghi định kỳ ra file JSON để server khởi động lại không mất điểm.
 * KHÔNG dùng được trên Vercel vì Vercel chạy nhiều bản server không chung bộ nhớ.
 */
export function createMemoryStore({ file = null, intervalMs = 5000 } = {}) {
  const players = new Map(); // token → JSON người chơi (lưu chuỗi để mỗi lần đọc là một bản sao)
  const board = new Map(); // id → bản tóm tắt cho BXH
  const locks = new Set();
  let dirty = false;
  let writing = false;
  let timer = null;

  function put(player, summary) {
    players.set(player.token, JSON.stringify(player));
    board.set(player.id, summary);
    dirty = true;
  }

  function snapshot() {
    return { version: 2, players: [...players.values()].map((raw) => JSON.parse(raw)) };
  }

  function writeSync() {
    const tmp = `${file}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(snapshot()));
    fs.renameSync(tmp, file);
  }

  if (file) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const p of saved.players ?? []) {
        if (typeof p?.token === 'string' && Array.isArray(p.order)) put(p, summaryOf(p));
      }
      dirty = false;
      if (players.size) console.log(`[store] Đã nạp ${players.size} người chơi từ ${file}`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`[store] Không đọc được ${file}:`, err.message);
    }

    // Ghi ra file tạm rồi rename để không bao giờ để lại file hỏng giữa chừng.
    timer = setInterval(async () => {
      if (!dirty || writing) return;
      dirty = false;
      writing = true;
      try {
        const tmp = `${file}.tmp`;
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(tmp, JSON.stringify(snapshot()));
        await fs.promises.rename(tmp, file);
      } catch (err) {
        dirty = true;
        console.error('[store] Lỗi ghi dữ liệu:', err.message);
      } finally {
        writing = false;
      }
    }, intervalMs);
    timer.unref();
  }

  return {
    kind: 'memory',

    async lockAndRead(token, { withBoard = false } = {}) {
      if (locks.has(token)) return { locked: false };
      locks.add(token);
      const raw = players.get(token);
      return { locked: true, player: raw ? JSON.parse(raw) : null, board: withBoard ? [...board.values()] : null };
    },

    async commit(token, write) {
      if (write) put(write.player, write.summary);
      locks.delete(token);
    },

    async create(player, summary) {
      put(player, summary);
      return [...board.values()];
    },

    async board() {
      return [...board.values()];
    },

    async reset() {
      players.clear();
      board.clear();
      dirty = true;
    },

    flush() {
      if (file && dirty) {
        writeSync();
        dirty = false;
      }
    },

    close() {
      clearInterval(timer);
    },
  };
}
