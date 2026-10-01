// Gọi API server. Token lưu trong localStorage để F5 / mất mạng vẫn chơi tiếp đúng chỗ.
const TOKEN_KEY = 'rtg_token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* localStorage bị chặn: chỉ giữ token trong phiên */
}

export const hasToken = () => Boolean(token);

export function clearToken() {
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* bỏ qua */
  }
}

const TIMEOUT_MS = 12_000;
// Wi-Fi lớp học hay chập chờn: lỗi mạng / server bận thì tự thử lại trước khi báo lỗi.
// An toàn vì server chặn trả lời/quay trùng (trả 409, client tự đồng bộ lại).
const RETRY_DELAYS_MS = [400, 1200];
const RETRYABLE = new Set([0, 429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function once(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ.'), { status: 0 });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Lỗi máy chủ (${res.status}).`), { status: res.status });
  return data;
}

async function call(method, path, body, { retry = true } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await once(method, path, body);
    } catch (err) {
      if (!retry || !RETRYABLE.has(err.status) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function join(name) {
  // Không tự thử lại: lỡ lần đầu đã tạo người chơi thì sẽ bị trùng tên trên BXH.
  const data = await call('POST', '/api/join', { name }, { retry: false });
  token = data.token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* bỏ qua */
  }
  return data;
}

export const getState = () => call('GET', '/api/state');
export const startQuestion = () => call('POST', '/api/question');
export const answer = (qIndex, choice) => call('POST', '/api/answer', { qIndex, choice });
export const spin = (spinsLeft, color, amount) => call('POST', '/api/spin', { spinsLeft, color, amount });
export const leaderboard = () => call('GET', '/api/bxh');
