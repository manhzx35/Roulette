import { Redis } from '@upstash/redis';

const PREFIX = 'rtg:';
const KEY = {
  player: (token) => `${PREFIX}p:${token}`,
  lock: (token) => `${PREFIX}lock:${token}`,
  board: `${PREFIX}board`, // hash: id → bản tóm tắt JSON cho BXH
  tokens: `${PREFIX}tokens`, // set các token, dùng khi đặt lại trò chơi
};
const TTL_SECONDS = 3 * 24 * 60 * 60; // dữ liệu tự xoá sau 3 ngày không dùng
const LOCK_MS = 5000; // khoá tự hết hạn nếu một bản server chết giữa chừng

/** Đọc cấu hình Upstash từ biến môi trường (tên do Vercel Marketplace hoặc Upstash Console đặt). */
export function upstashConfigFromEnv(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// HGETALL trả về mảng phẳng [field, value, field, value, …].
function parseBoard(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (let i = 1; i < raw.length; i += 2) out.push(JSON.parse(raw[i]));
  return out;
}

/**
 * Lưu dữ liệu trong Upstash Redis (REST) để mọi bản server trên Vercel dùng chung.
 * Mỗi thao tác chỉ tốn 2 lượt gọi Redis: [khoá + đọc] rồi [ghi + mở khoá] (~5 lệnh).
 */
export function createUpstashStore({ url, token, retry } = {}) {
  const redis = new Redis({
    url,
    token,
    automaticDeserialization: false, // tự parse JSON để không bị đổi kiểu ngoài ý muốn
    enableTelemetry: false,
    ...(retry === undefined ? {} : { retry }),
  });

  return {
    kind: 'upstash',

    async lockAndRead(token, { withBoard = false } = {}) {
      const pipe = redis.pipeline().set(KEY.lock(token), '1', { nx: true, px: LOCK_MS }).get(KEY.player(token));
      if (withBoard) pipe.hgetall(KEY.board);
      const [locked, rawPlayer, rawBoard] = await pipe.exec();
      if (locked !== 'OK') return { locked: false };
      return {
        locked: true,
        player: rawPlayer ? JSON.parse(rawPlayer) : null,
        board: withBoard ? parseBoard(rawBoard) : null,
      };
    },

    async commit(token, write) {
      if (!write) {
        await redis.del(KEY.lock(token));
        return;
      }
      await redis
        .multi()
        .set(KEY.player(token), JSON.stringify(write.player), { ex: TTL_SECONDS })
        .hset(KEY.board, { [write.player.id]: JSON.stringify(write.summary) })
        .del(KEY.lock(token))
        .exec();
    },

    async create(player, summary) {
      const results = await redis
        .multi()
        .set(KEY.player(player.token), JSON.stringify(player), { ex: TTL_SECONDS })
        .hset(KEY.board, { [player.id]: JSON.stringify(summary) })
        .expire(KEY.board, TTL_SECONDS)
        .sadd(KEY.tokens, player.token)
        .expire(KEY.tokens, TTL_SECONDS)
        .hgetall(KEY.board)
        .exec();
      return parseBoard(results.at(-1));
    },

    async board() {
      return parseBoard(await redis.hgetall(KEY.board));
    },

    async reset() {
      const tokens = (await redis.smembers(KEY.tokens)) ?? [];
      const keys = [KEY.board, KEY.tokens, ...tokens.map((t) => KEY.player(String(t)))];
      for (let i = 0; i < keys.length; i += 500) await redis.del(...keys.slice(i, i + 500));
    },

    flush() {},
    close() {},
  };
}
