import http from 'node:http';

/**
 * Upstash Redis REST giả lập (chỉ các lệnh game dùng) để test mà không cần tài khoản Upstash.
 * Nói đúng giao thức của @upstash/redis: POST / (1 lệnh), /pipeline, /multi-exec,
 * Bearer token, và mã hoá base64 khi client gửi header Upstash-Encoding.
 */
export async function startUpstashMock({ token = 'test-token', latencyMs = 0 } = {}) {
  const strings = new Map();
  const hashes = new Map();
  const sets = new Map();
  const expiry = new Map();
  let commands = 0;

  const exists = (key) => strings.has(key) || hashes.has(key) || sets.has(key);
  function sweep(key) {
    const at = expiry.get(key);
    if (at !== undefined && at <= Date.now()) {
      strings.delete(key);
      hashes.delete(key);
      sets.delete(key);
      expiry.delete(key);
    }
  }

  function run([name, ...args]) {
    commands++;
    const key = String(args[0]);
    sweep(key);
    switch (String(name).toUpperCase()) {
      case 'GET':
        return strings.get(key) ?? null;
      case 'SET': {
        let nx = false;
        let ttl = 0;
        for (let i = 2; i < args.length; i++) {
          const opt = String(args[i]).toUpperCase();
          if (opt === 'NX') nx = true;
          else if (opt === 'PX') ttl = Number(args[++i]);
          else if (opt === 'EX') ttl = Number(args[++i]) * 1000;
        }
        if (nx && exists(key)) return null;
        strings.set(key, String(args[1]));
        if (ttl) expiry.set(key, Date.now() + ttl);
        else expiry.delete(key);
        return 'OK';
      }
      case 'DEL': {
        let removed = 0;
        for (const k of args.map(String)) {
          sweep(k);
          if (exists(k)) removed++;
          strings.delete(k);
          hashes.delete(k);
          sets.delete(k);
          expiry.delete(k);
        }
        return removed;
      }
      case 'HSET': {
        const hash = hashes.get(key) ?? new Map();
        hashes.set(key, hash);
        let added = 0;
        for (let i = 1; i < args.length; i += 2) {
          if (!hash.has(String(args[i]))) added++;
          hash.set(String(args[i]), String(args[i + 1]));
        }
        return added;
      }
      case 'HGETALL':
        return [...(hashes.get(key) ?? new Map())].flat();
      case 'SADD': {
        const set = sets.get(key) ?? new Set();
        sets.set(key, set);
        const before = set.size;
        for (const m of args.slice(1)) set.add(String(m));
        return set.size - before;
      }
      case 'SMEMBERS':
        return [...(sets.get(key) ?? [])];
      case 'EXPIRE':
        if (!exists(key)) return 0;
        expiry.set(key, Date.now() + Number(args[1]) * 1000);
        return 1;
      default:
        throw new Error(`ERR unknown command '${name}'`);
    }
  }

  function encode(value) {
    if (typeof value === 'string') return value === 'OK' ? value : Buffer.from(value, 'utf8').toString('base64');
    if (Array.isArray(value)) return value.map(encode);
    return value;
  }

  function reply(command, base64) {
    try {
      const result = run(command);
      return { result: base64 ? encode(result) : result };
    } catch (err) {
      return { error: err.message };
    }
  }

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const base64 = String(req.headers['upstash-encoding'] ?? '').toLowerCase() === 'base64';
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (req.url === '/pipeline' || req.url === '/multi-exec') {
      // Mock chạy đồng bộ nên cả lô lệnh được thực hiện liền một mạch (nguyên tử như MULTI/EXEC).
      return res.end(JSON.stringify(body.map((command) => reply(command, base64))));
    }
    const single = reply(body, base64);
    if (single.error) res.statusCode = 400;
    res.end(JSON.stringify(single));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    token,
    commandCount: () => commands,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
