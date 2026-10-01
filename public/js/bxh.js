// Bảng xếp hạng realtime để chiếu lên màn hình lớn (nhận dữ liệu qua Server-Sent Events).
const $ = (selector) => document.querySelector(selector);
const list = $('#bxh-list');
const numberFormat = new Intl.NumberFormat('vi-VN');
const rows = new Map(); // id → <li>
const lastBalance = new Map();

function hue(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function initial(name) {
  return [...(name.trim().split(' ').pop() || '?')][0].toUpperCase();
}

function rowFor(player) {
  let li = rows.get(player.id);
  if (!li) {
    li = document.createElement('li');
    li.dataset.id = player.id;
    const rank = document.createElement('span');
    rank.className = 'bxh-rank';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.style.background = `hsl(${hue(player.id)} 70% 80%)`;
    const who = document.createElement('span');
    who.className = 'bxh-who';
    const name = document.createElement('span');
    name.className = 'bxh-name';
    const progress = document.createElement('span');
    progress.className = 'bxh-progress';
    who.append(name, progress);
    const points = document.createElement('span');
    points.className = 'bxh-points';
    li.append(rank, avatar, who, points);
    rows.set(player.id, li);
  }
  return li;
}

function render(data) {
  // FLIP: ghi lại vị trí cũ, sắp xếp lại, rồi trượt từ vị trí cũ về vị trí mới.
  const before = new Map();
  for (const li of list.children) before.set(li.dataset.id, li.getBoundingClientRect());

  const seen = new Set();
  data.players.forEach((p, i) => {
    const li = rowFor(p);
    seen.add(p.id);
    li.className = `bxh-row${i < 3 ? ` top${i + 1}` : ''}`;
    li.querySelector('.bxh-rank').textContent = i + 1;
    li.querySelector('.avatar').textContent = initial(p.name);
    li.querySelector('.bxh-name').textContent = p.name;
    const progress = li.querySelector('.bxh-progress');
    progress.textContent = p.done
      ? `✓ Hoàn thành · ${p.correctCount} câu đúng`
      : `Vòng ${p.round}/${data.totalRounds} · ${p.correctCount} câu đúng`;
    progress.classList.toggle('done', p.done);
    li.querySelector('.bxh-points').textContent = numberFormat.format(p.balance);
    const prev = lastBalance.get(p.id);
    if (prev !== undefined && prev !== p.balance) {
      li.classList.add(p.balance > prev ? 'flash-up' : 'flash-down');
    }
    lastBalance.set(p.id, p.balance);
    list.append(li);
  });
  for (const [id, li] of rows) {
    if (!seen.has(id)) {
      li.remove();
      rows.delete(id);
      lastBalance.delete(id);
    }
  }

  for (const li of list.children) {
    const from = before.get(li.dataset.id);
    if (!from) {
      li.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out' });
      continue;
    }
    const to = li.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (dx || dy) {
      li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 650,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    }
  }

  $('#count-players').textContent = data.totalPlayers;
  $('#count-done').textContent = data.finished;
  $('#bxh-empty').hidden = data.players.length > 0;
}

function setConnected(ok) {
  const el = $('#conn');
  el.textContent = ok ? '● Đang cập nhật trực tiếp' : '● Mất kết nối, đang thử lại…';
  el.classList.toggle('ok', ok);
}

// Chạy 1 server (laptop, Render…): nhận BXH tức thì qua SSE.
// Vercel (server trả 204) hoặc đường hầm không hỗ trợ SSE (VD Cloudflare Quick Tunnel):
// chuyển sang hỏi /api/bxh mỗi 2 giây.
const POLL_MS = 2000;
const SSE_WATCHDOG_MS = 5000;
let polling = false;

function startPolling() {
  if (polling) return;
  polling = true;
  const poll = async () => {
    try {
      const res = await fetch('/api/bxh', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      render(await res.json());
      setConnected(true);
    } catch {
      setConnected(false);
    }
    setTimeout(poll, POLL_MS);
  };
  poll();
}

function connect() {
  const source = new EventSource('/api/bxh/stream');
  let received = false;
  const fallback = () => {
    clearTimeout(watchdog);
    source.close();
    startPolling();
  };
  const watchdog = setTimeout(() => {
    if (!received) fallback();
  }, SSE_WATCHDOG_MS);
  source.onopen = () => setConnected(true);
  source.onmessage = (event) => {
    received = true;
    clearTimeout(watchdog);
    render(JSON.parse(event.data));
  };
  source.onerror = () => {
    if (!received) fallback(); // SSE không dùng được ngay từ đầu
    else setConnected(false); // đang chạy thì rớt mạng: EventSource tự kết nối lại
  };
}

async function showJoinLink() {
  // ?link=https://... để tự chọn link hiển thị (VD link Cloudflare Tunnel khi chiếu BXH từ localhost).
  const override = new URLSearchParams(location.search).get('link');
  let url = override && /^https?:\/\//.test(override) ? override.replace(/\/?$/, '/') : `${location.origin}/`;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && !override) {
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.lanUrls?.length) url = `${info.lanUrls[0]}/`;
    } catch {
      /* giữ link hiện tại */
    }
  }
  $('#join-url').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  $('#join-qr').src = `/api/qr.svg?u=${encodeURIComponent(url)}`;
}

$('#admin-btn').addEventListener('click', async () => {
  const key = window.prompt('Nhập mã quản trị (ADMIN_KEY) để XOÁ toàn bộ người chơi và điểm:');
  if (!key) return;
  if (!window.confirm('Chắc chắn xoá toàn bộ người chơi? Không thể hoàn tác.')) return;
  const res = await fetch('/api/admin/reset', { method: 'POST', headers: { 'X-Admin-Key': key } });
  const data = await res.json().catch(() => ({}));
  window.alert(res.ok ? 'Đã đặt lại trò chơi.' : data.error || 'Không thành công.');
});

list.addEventListener('animationend', (event) => event.target.classList.remove('flash-up', 'flash-down'));

showJoinLink();
connect();
