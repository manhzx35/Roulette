import * as api from './api.js';
import * as sfx from './sfx.js';
import { Wheel } from './wheel.js';
import { addTicker } from './ticker.js';
import { burst, rain, countUp, floatText, replay, shake, fmt } from './fx.js';

const $ = (selector) => document.querySelector(selector);
const PAYOUT = { red: 2, black: 2, green: 35 };
const COLOR_NAME = { red: 'Đỏ', black: 'Đen', green: 'Xanh' };
const SLOTS_OF = { red: 20, black: 20, green: 1 };
const LETTERS = ['A', 'B', 'C', 'D'];
const SCREENS = ['welcome', 'ready', 'question', 'spin', 'end'];
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 20;

let S = null; // trạng thái mới nhất từ server
let shownBalance = 0; // điểm đang hiển thị (chỉ cập nhật sau hiệu ứng)
let busy = false;
let current = null;
let lastAnswer = null;
let answered = false;
let stopTimer = null;
let spinning = false;
let hoverColor = null;
let endPoll = 0;
let endCelebrated = false;
const bet = { color: null, amount: 0 };

const welcomeWheel = new Wheel($('#welcome-wheel'), { idleSpeed: 0.45 });
const wheel = new Wheel($('#wheel'), { onTick: () => sfx.tick() });
const cards = [...document.querySelectorAll('.bet-card')];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const initial = (name) => [...(name.trim().split(' ').pop() || '?')][0].toUpperCase();

// ---------- Khung chung ----------
function show(name) {
  if (current !== name) {
    for (const s of SCREENS) $(`#screen-${s}`).classList.toggle('active', s === name);
    current = name;
    window.scrollTo(0, 0);
  }
  const hud = name !== 'welcome';
  document.body.classList.toggle('has-hud', hud);
  $('#hud').hidden = !hud;
  welcomeWheel.setActive(name === 'welcome');
  wheel.setActive(name === 'spin');
  if (name !== 'question') clearTimer();
  if (name !== 'end') clearInterval(endPoll);
}

function renderHud() {
  $('#hud-name').textContent = S.name;
  $('#hud-avatar').textContent = initial(S.name);
  $('#hud-round').textContent = S.phase === 'done' ? 'Hoàn thành' : `Vòng ${S.round}/${S.totalRounds}`;
  const dots = $('#hud-dots');
  dots.replaceChildren();
  if (S.phase === 'question') {
    const answeredInRound = S.qIndex % S.questionsPerRound;
    for (let i = 0; i < S.questionsPerRound; i++) {
      const dot = document.createElement('span');
      dot.className = `dot${i < answeredInRound ? ' done' : i === answeredInRound ? ' now' : ''}`;
      dots.append(dot);
    }
  } else if (S.phase === 'spin') {
    for (let i = 0; i < S.spinsPerRound; i++) {
      const dot = document.createElement('span');
      dot.className = `dot spin${i < S.spinsPerRound - S.spinsLeft ? ' used' : ''}`;
      dots.append(dot);
    }
  }
}

function setBalance(value, animate = true) {
  const el = $('#hud-score');
  if (value === shownBalance || !animate) {
    el.textContent = fmt(value);
  } else {
    countUp(el, shownBalance, value);
    replay($('#hud-score-box'), value > shownBalance ? 'bump-up' : 'bump-down');
  }
  shownBalance = value;
}

function route() {
  renderHud();
  setBalance(S.balance);
  if (S.phase === 'done') return showEnd();
  if (S.phase === 'spin') return showSpin();
  return S.question ? showQuestion() : showReady();
}

function modal({ title, body, button = 'OK' }) {
  return new Promise((resolve) => {
    $('#modal-title').textContent = title;
    $('#modal-body').textContent = body;
    const btn = $('#modal-btn');
    btn.textContent = button;
    $('#modal').hidden = false;
    sfx.pop();
    btn.onclick = () => {
      sfx.click();
      $('#modal').hidden = true;
      resolve();
    };
    btn.focus({ preventScroll: true });
  });
}

let toastTimer = 0;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

// Chạy một thao tác gọi server; lỗi thì tự đồng bộ lại với server.
async function act(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
  } catch (err) {
    await recover(err);
  } finally {
    busy = false;
  }
}

async function recover(err) {
  if (err.status === 401) {
    api.clearToken();
    S = null;
    await modal({
      title: 'Không tìm thấy lượt chơi',
      body: 'Dữ liệu người chơi không còn (có thể trò chơi vừa được đặt lại). Hãy nhập tên để chơi lại.',
      button: 'Chơi lại',
    });
    setBalance(0, false);
    showMenu();
    return;
  }
  if (err.status === 400) toast(err.message);
  for (;;) {
    if (err.status === 0 || err.status >= 500) {
      await modal({ title: 'Mất kết nối', body: 'Không kết nối được máy chủ. Kiểm tra mạng rồi bấm thử lại nhé.', button: 'Thử lại' });
    }
    try {
      S = (await api.getState()).state;
      break;
    } catch (next) {
      if (next.status === 401) return recover(next);
      err = next;
    }
  }
  route();
}

function skipNotice(skipped) {
  const done = S.phase === 'done';
  return modal({
    title: 'Hết điểm rồi!',
    body: done
      ? `Bạn đang có 0 điểm nên bỏ qua ${skipped} lượt quay còn lại. Trò chơi đã kết thúc!`
      : `Bạn đang có 0 điểm nên bỏ qua ${skipped} lượt quay còn lại. Trả lời 3 câu hỏi tiếp theo để kiếm thêm điểm nhé!`,
    button: done ? 'Xem kết quả' : 'Sang câu hỏi tiếp',
  });
}

// ---------- Hộp thoại ----------
function openDialog(id) {
  const el = $(`#${id}`);
  el.hidden = false;
  replay(el.querySelector('.dialog'), 'dialog');
  sfx.pop();
  return el;
}

function closeDialog(id) {
  $(`#${id}`).hidden = true;
  if (id === 'board-dialog') clearInterval(boardTimer);
}

const openDialogs = () => [...document.querySelectorAll('.modal-backdrop:not([hidden])')].filter((el) => el.id !== 'modal');

for (const btn of document.querySelectorAll('[data-close]')) {
  btn.addEventListener('click', () => {
    sfx.click();
    closeDialog(btn.closest('.modal-backdrop').id);
  });
}

for (const id of ['board-dialog', 'howto-dialog']) {
  // Chạm ra ngoài khung để đóng.
  $(`#${id}`).addEventListener('click', (event) => {
    if (event.target.id === id) closeDialog(id);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const top = openDialogs().at(-1);
  if (top) closeDialog(top.id);
});

// ---------- Menu chính ----------
function showMenu() {
  $('#menu-play').textContent = !S ? 'Chơi' : S.phase === 'done' ? 'Xem kết quả' : 'Chơi tiếp';
  renderSoundButtons();
  show('welcome');
}

$('#menu-play').addEventListener('click', () => {
  sfx.click();
  if (S) {
    route(); // đã có lượt chơi trên máy này → vào tiếp đúng chỗ
    return;
  }
  openDialog('name-dialog');
  $('#name-input').focus();
});

$('#join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  sfx.unlock();
  const input = $('#name-input');
  const name = input.value.trim();
  if (!name) {
    shake(input);
    input.focus();
    return;
  }
  sfx.click();
  act(async () => {
    S = (await api.join(name)).state;
    closeDialog('name-dialog');
    endCelebrated = false;
    setBalance(S.balance, false);
    route();
  });
});

// ---------- Bảng xếp hạng trong game ----------
const BOARD_TOP = 10;
const BOARD_REFRESH_MS = 5000;
let boardTimer = 0;

function boardRow(rank, player, className = '') {
  const tr = document.createElement('tr');
  tr.className = className;
  for (const text of [`#${rank}`, player.name, fmt(player.balance)]) {
    const td = document.createElement('td');
    td.textContent = text;
    tr.append(td);
  }
  return tr;
}

async function loadBoard() {
  const rows = $('#board-rows');
  try {
    const board = await api.leaderboard();
    const myIndex = S ? board.players.findIndex((p) => p.id === S.id) : -1;
    const list = board.players.slice(0, BOARD_TOP).map((p, i) => boardRow(i + 1, p, i === myIndex ? 'me' : ''));
    if (myIndex >= BOARD_TOP) {
      const gap = document.createElement('tr');
      gap.className = 'gap';
      gap.innerHTML = '<td colspan="3">⋯</td>';
      list.push(gap, boardRow(myIndex + 1, board.players[myIndex], 'me'));
    }
    if (!list.length) {
      const empty = document.createElement('tr');
      empty.className = 'empty';
      empty.innerHTML = '<td colspan="3">Chưa có ai chơi. Hãy là người đầu tiên!</td>';
      list.push(empty);
    }
    rows.replaceChildren(...list);
    $('#board-note').textContent = `${board.totalPlayers} người chơi · ${board.finished} đã hoàn thành`;
  } catch {
    $('#board-note').textContent = 'Không tải được bảng xếp hạng, bấm Làm mới để thử lại.';
  }
}

function openBoard() {
  openDialog('board-dialog');
  loadBoard();
  clearInterval(boardTimer);
  boardTimer = setInterval(loadBoard, BOARD_REFRESH_MS);
}

$('#menu-board').addEventListener('click', () => {
  sfx.click();
  openBoard();
});

$('#board-refresh').addEventListener('click', () => {
  sfx.chip();
  loadBoard();
});

// ---------- Hướng dẫn ----------
const slides = [...document.querySelectorAll('.howto-slide')];
let slideIndex = 0;

function renderSlide() {
  slides.forEach((slide, i) => slide.classList.toggle('active', i === slideIndex));
  $('#howto-dots').replaceChildren(
    ...slides.map((_, i) => {
      const dot = document.createElement('span');
      if (i === slideIndex) dot.className = 'active';
      return dot;
    }),
  );
  $('#howto-next').textContent = slideIndex === slides.length - 1 ? 'Đã hiểu' : 'Tiếp';
}

function stepSlide(delta) {
  const next = slideIndex + delta;
  if (next < 0 || next >= slides.length) {
    closeDialog('howto-dialog');
    return;
  }
  slideIndex = next;
  sfx.select();
  renderSlide();
}

$('#menu-howto').addEventListener('click', () => {
  sfx.click();
  slideIndex = 0;
  renderSlide();
  openDialog('howto-dialog');
});

$('#howto-back').addEventListener('click', () => stepSlide(-1));
$('#howto-next').addEventListener('click', () => stepSlide(1));

document.addEventListener('keydown', (event) => {
  if ($('#howto-dialog').hidden) return;
  if (event.key === 'ArrowRight') stepSlide(1);
  if (event.key === 'ArrowLeft') stepSlide(-1);
});

// ---------- Giới thiệu vòng ----------
function showReady() {
  const inRound = S.qIndex % S.questionsPerRound;
  const fresh = inRound === 0;
  $('#ready-kicker').textContent = fresh ? (S.round === 1 ? 'Sẵn sàng chưa?' : 'Vòng mới') : `Vòng ${S.round}/${S.totalRounds}`;
  $('#ready-title').textContent = fresh ? `Vòng ${S.round}` : `Câu ${inRound + 1}/${S.questionsPerRound}`;
  $('#ready-sub').textContent = fresh
    ? `${S.questionsPerRound} câu hỏi · 30 giây mỗi câu · Đúng +300 điểm`
    : 'Đồng hồ 30 giây bắt đầu chạy ngay khi bạn bấm.';
  $('#ready-btn').textContent = fresh ? 'Bắt đầu vòng' : 'Tiếp tục';
  show('ready');
  replay($('#screen-ready .card'), 'enter');
}

$('#ready-btn').addEventListener('click', () => {
  sfx.click();
  act(async () => {
    S = (await api.startQuestion()).state;
    route();
  });
});

// ---------- Câu hỏi ----------
function showQuestion() {
  const q = S.question;
  answered = false;
  lastAnswer = null;
  $('#q-meta').textContent = `Vòng ${S.round} · Câu ${S.questionInRound}/${S.questionsPerRound}`;
  $('#q-text').textContent = q.text;
  const box = $('#options');
  box.replaceChildren(
    ...q.options.map((text, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      const letter = document.createElement('span');
      letter.className = 'opt-letter';
      letter.textContent = LETTERS[i];
      const label = document.createElement('span');
      label.textContent = text;
      btn.append(letter, label);
      btn.addEventListener('click', () => submitAnswer(i));
      return btn;
    }),
  );
  $('#q-feedback').hidden = true;
  show('question');
  replay($('#screen-question .card'), 'enter');
  startTimer(q.timeLeftMs, q.timeLimitMs);
}

function startTimer(leftMs, limitMs) {
  clearTimer();
  const deadline = performance.now() + leftMs;
  const fg = $('#timer-fg');
  const text = $('#timer-text');
  const box = $('#timer');
  let lastSecond = -1;
  box.className = 'timer';
  stopTimer = addTicker((dt, now) => {
    const left = Math.max(0, deadline - now);
    const second = Math.ceil(left / 1000);
    fg.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - left / limitMs));
    if (second !== lastSecond) {
      lastSecond = second;
      text.textContent = second;
      box.classList.toggle('warn', second <= 10);
      box.classList.toggle('danger', second <= 5);
      if (second > 0 && second <= 5) sfx.countdown(second === 1);
    }
    if (left <= 0) {
      clearTimer();
      submitAnswer(null);
    }
  });
}

function clearTimer() {
  stopTimer?.();
  stopTimer = null;
}

function submitAnswer(choice) {
  if (answered) return;
  answered = true;
  clearTimer();
  const buttons = [...document.querySelectorAll('#options .option')];
  for (const b of buttons) b.disabled = true;
  if (choice !== null) {
    buttons[choice].classList.add('picked');
    sfx.click();
  }
  act(async () => {
    const res = await api.answer(S.question.qIndex, choice);
    const { result } = res;
    S = res.state;
    lastAnswer = result;
    buttons[result.correctChoice].classList.add('correct');
    buttons.forEach((b, i) => {
      if (i !== result.correctChoice && i !== choice) b.classList.add('dim');
    });
    const verdict = $('#q-verdict');
    if (result.correct) {
      verdict.textContent = 'Chính xác! +300 điểm';
      verdict.className = 'q-verdict good';
      sfx.correct();
      const r = buttons[choice].getBoundingClientRect();
      floatText('+300', r.left + r.width / 2, r.top - 10, 'gain');
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 380 });
    } else {
      verdict.textContent = result.timedOut ? 'Hết giờ! Đáp án đúng được tô xanh.' : 'Sai rồi! Đáp án đúng được tô xanh.';
      verdict.className = 'q-verdict bad';
      if (choice !== null) {
        buttons[choice].classList.add('wrong');
        shake(buttons[choice]);
      }
      sfx.wrong();
    }
    renderHud();
    setBalance(S.balance);
    const next = $('#q-next');
    if (S.phase === 'spin') next.textContent = 'Đến lượt quay!';
    else if (S.phase === 'done') next.textContent = 'Xem kết quả';
    else next.textContent = result.spinsSkipped ? 'Tiếp tục' : 'Câu tiếp theo';
    $('#q-feedback').hidden = false;
    next.focus({ preventScroll: true });
  });
}

$('#q-next').addEventListener('click', () => {
  sfx.click();
  act(async () => {
    if (lastAnswer?.spinsSkipped) await skipNotice(lastAnswer.spinsSkipped);
    lastAnswer = null;
    // Giữa vòng thì vào thẳng câu tiếp; đầu vòng mới thì hiện màn giới thiệu.
    if (S.phase === 'question' && S.qIndex % S.questionsPerRound !== 0) S = (await api.startQuestion()).state;
    route();
  });
});

document.addEventListener('keydown', (event) => {
  if (current !== 'question' || answered || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toUpperCase();
  const index = LETTERS.indexOf(key) >= 0 ? LETTERS.indexOf(key) : ['1', '2', '3', '4'].indexOf(key);
  if (index >= 0 && index < (S?.question?.options.length ?? 0)) submitAnswer(index);
});

// ---------- Bàn quay ----------
function showSpin() {
  $('#spin-banner').hidden = true;
  show('spin');
  renderBet();
}

function compact(n) {
  if (n >= 100_000) return `${Math.round(n / 1000)}K`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace('.', ',')}K`;
  return fmt(n);
}

function renderBet() {
  const open = S.phase === 'spin' && !spinning;
  bet.amount = Math.max(0, Math.min(bet.amount, S.balance));

  const input = $('#bet-input');
  if (document.activeElement !== input) input.value = fmt(bet.amount);
  input.disabled = !open;
  const range = $('#bet-range');
  range.max = String(S.balance);
  range.value = String(bet.amount);
  range.disabled = !open || S.balance === 0;
  range.style.setProperty('--fill', S.balance ? `${(bet.amount / S.balance) * 100}%` : '0%');

  for (const card of cards) {
    const on = card.dataset.color === bet.color;
    card.classList.toggle('selected', on);
    card.setAttribute('aria-checked', String(on));
    const chip = card.querySelector('.chip-stack');
    chip.hidden = !on;
    if (on) chip.textContent = compact(bet.amount);
  }
  $('#bet-cards').classList.toggle('has-selection', Boolean(bet.color));

  const summary = $('#bet-summary');
  if (S.phase !== 'spin') {
    summary.textContent = 'Đã dùng hết lượt quay của vòng này.';
  } else if (!bet.color) {
    summary.innerHTML = 'Chạm vào <b>1 ô màu</b> trên bàn để chọn cược';
  } else {
    const color = `<b class="c-${bet.color}">${COLOR_NAME[bet.color].toUpperCase()} ×${PAYOUT[bet.color]}</b>`;
    summary.innerHTML =
      bet.amount === 0
        ? `Cược <b>0</b> điểm vào ${color}: quay cho vui, không mất điểm`
        : `Cược <b>${fmt(bet.amount)}</b> vào ${color} → trúng nhận <b>${fmt(bet.amount * PAYOUT[bet.color])}</b>`;
  }

  renderSpinControls();
  renderLabel();
}

function renderSpinControls() {
  const btn = $('#spin-btn');
  const left = S.phase === 'spin' ? S.spinsLeft : 0;
  const tokens = $('#spin-tokens');
  tokens.replaceChildren();
  for (let i = 0; i < S.spinsPerRound; i++) {
    const t = document.createElement('span');
    t.className = `token${i < left ? '' : ' used'}`;
    tokens.append(t);
  }
  $('#spin-left-text').textContent = S.phase === 'spin' ? `Còn ${left} lượt` : 'Hết lượt';
  if (S.phase === 'spin') {
    btn.textContent = spinning ? 'Đang quay…' : bet.color ? 'QUAY!' : 'Chọn màu';
    btn.disabled = spinning || !bet.color;
    btn.classList.remove('next');
  } else {
    btn.textContent = S.phase === 'done' ? 'Xem kết quả' : 'Vòng tiếp theo';
    btn.disabled = spinning;
    btn.classList.add('next');
  }
  $('#controls').classList.toggle('locked', spinning || S.phase !== 'spin');
}

function renderLabel() {
  const label = $('#bet-label');
  const color = hoverColor || bet.color;
  if (!color || spinning || S.phase !== 'spin') {
    label.hidden = true;
    return;
  }
  $('#bet-label-title').innerHTML = `Cược vào ${COLOR_NAME[color]} <span class="mult">×${PAYOUT[color]}</span>`;
  $('#bet-label-sub').textContent =
    bet.amount > 0 ? `Trúng nhận: ${fmt(bet.amount * PAYOUT[color])} điểm` : `${SLOTS_OF[color]}/41 ô trên vòng quay`;
  label.hidden = false;
  const card = cards.find((c) => c.dataset.color === color);
  const areaWidth = $('#bet-area').clientWidth;
  const center = card.offsetLeft + card.offsetWidth / 2;
  const half = label.offsetWidth / 2;
  const x = Math.max(half, Math.min(areaWidth - half, center));
  label.style.left = `${x}px`;
  label.style.setProperty('--arrow', `${center - x}px`);
}

for (const card of cards) {
  card.addEventListener('click', () => {
    if (spinning || S?.phase !== 'spin') return;
    bet.color = card.dataset.color;
    sfx.select(bet.color === 'green');
    renderBet();
  });
  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    hoverColor = card.dataset.color;
    renderLabel();
  });
  card.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    hoverColor = null;
    renderLabel();
  });
}

$('#bet-input').addEventListener('input', (event) => {
  const digits = event.target.value.replace(/\D/g, '');
  bet.amount = Math.min(Number(digits || 0), S.balance);
  event.target.value = digits === '' ? '' : fmt(bet.amount);
  renderBet();
});
$('#bet-input').addEventListener('focus', (event) => event.target.select());
$('#bet-input').addEventListener('blur', (event) => {
  event.target.value = fmt(bet.amount);
});

$('#bet-range').addEventListener('input', (event) => {
  bet.amount = Number(event.target.value);
  renderBet();
});

for (const chip of document.querySelectorAll('[data-chip]')) {
  chip.addEventListener('click', () => {
    if (spinning || S.phase !== 'spin') return;
    const kind = chip.dataset.chip;
    if (kind === 'all') bet.amount = S.balance;
    else if (kind === 'half') bet.amount = Math.floor(S.balance / 2);
    else if (kind === '0') bet.amount = 0;
    else bet.amount = Math.min(S.balance, bet.amount + Number(kind));
    sfx.chip();
    renderBet();
  });
}

$('#spin-btn').addEventListener('click', () => {
  if (spinning) return;
  if (S.phase !== 'spin') {
    sfx.click();
    route();
    return;
  }
  if (bet.color) act(doSpin);
});

async function doSpin() {
  spinning = true;
  hoverColor = null;
  $('#spin-banner').hidden = true;
  renderBet();
  sfx.spinStart();
  // Bánh xe quay ngay khi bấm; khi server trả kết quả thì giảm tốc và dừng đúng ô → không thấy độ trễ mạng.
  wheel.startSpin();
  let res;
  try {
    res = await api.spin(S.spinsLeft, bet.color, bet.amount);
    await wheel.landOn(res.result.slot);
  } catch (err) {
    wheel.stop();
    throw err;
  } finally {
    spinning = false;
  }
  sfx.land();
  S = res.state;
  renderHud();
  setBalance(S.balance);
  renderBet();
  revealSpin(res.result);
  if (res.result.spinsSkipped) {
    await sleep(1400);
    await skipNotice(res.result.spinsSkipped);
    route();
  }
}

function revealSpin(r) {
  const banner = $('#spin-banner');
  banner.className = `spin-banner ${r.resultColor}`;
  $('#banner-color').textContent = `${COLOR_NAME[r.resultColor].toUpperCase()}!`;
  let line;
  if (r.bet === 0) line = r.win ? 'Trúng màu (cược 0 điểm)' : 'Cược 0 điểm: không mất gì';
  else if (r.win) line = `Thắng +${fmt(r.net)}`;
  else line = `Thua −${fmt(r.bet)}`;
  $('#banner-line').textContent = line;
  banner.hidden = false;
  replay(banner, 'pop');

  const wheelBox = $('#wheel').getBoundingClientRect();
  const cx = wheelBox.left + wheelBox.width / 2;
  const cy = wheelBox.top + wheelBox.height / 2;
  const score = $('#hud-score-box').getBoundingClientRect();
  const scoreX = score.left + score.width / 2;
  if (r.win && r.bet > 0) {
    floatText(`+${fmt(r.net)}`, scoreX, score.bottom + 8, 'gain');
    if (r.resultColor === 'green') {
      jackpot(r.net);
    } else {
      sfx.win();
      burst(cx, cy, { count: 70 });
      burst(cx, cy, { count: 16, kind: 'coin', power: 620 });
    }
  } else if (r.bet > 0) {
    floatText(`−${fmt(r.bet)}`, scoreX, score.bottom + 8, 'loss');
    sfx.lose();
    shake($('#table'));
  } else if (r.win) {
    sfx.select(true);
    burst(cx, cy, { count: 20, power: 300 });
  }
}

function jackpot(net) {
  const overlay = $('#jackpot');
  $('#jackpot-amount').textContent = `+${fmt(net)} điểm`;
  overlay.hidden = false;
  replay(overlay, 'show');
  sfx.jackpot();
  rain(2800);
  burst(window.innerWidth / 2, window.innerHeight / 2, { count: 90, power: 820 });
  burst(window.innerWidth / 2, window.innerHeight / 2, { count: 30, kind: 'coin', power: 900 });
  const close = () => {
    overlay.hidden = true;
    overlay.removeEventListener('click', close);
    clearTimeout(timer);
  };
  const timer = setTimeout(close, 5000);
  overlay.addEventListener('click', close);
}

// ---------- Kết thúc ----------
function showEnd() {
  $('#end-name').textContent = S.name;
  $('#end-correct').textContent = `${S.correctCount}/${S.totalQuestions}`;
  $('#end-wins').textContent = fmt(S.stats.wins);
  renderRank();
  show('end');
  replay($('#screen-end .card'), 'enter');
  countUp($('#end-score'), 0, S.balance, 1400);
  if (!endCelebrated) {
    endCelebrated = true;
    sfx.fanfare();
    rain(2600);
  }
  clearInterval(endPoll);
  endPoll = setInterval(async () => {
    try {
      S = (await api.getState()).state;
      renderRank();
    } catch {
      /* thử lại ở lần sau */
    }
  }, 5000);
}

function renderRank() {
  if (!S.rank) return; // thứ hạng chưa có trong phản hồi này, lượt hỏi kế tiếp sẽ cập nhật
  $('#end-rank').textContent = `#${S.rank}`;
  $('#end-players').textContent = `trên ${S.playerCount} người`;
}

$('#end-board').addEventListener('click', () => {
  sfx.click();
  openBoard();
});

$('#end-menu').addEventListener('click', () => {
  sfx.click();
  showMenu();
});

// ---------- Âm thanh ----------
function renderSoundButtons() {
  const sound = $('#btn-sound');
  const music = $('#btn-music');
  sound.classList.toggle('off', !sfx.isSoundOn());
  music.classList.toggle('off', !sfx.isMusicOn());
  sound.setAttribute('aria-pressed', String(sfx.isSoundOn()));
  music.setAttribute('aria-pressed', String(sfx.isMusicOn()));
}

$('#btn-sound').addEventListener('click', () => {
  sfx.setSound(!sfx.isSoundOn());
  sfx.unlock();
  sfx.click();
  renderSoundButtons();
});

$('#btn-music').addEventListener('click', () => {
  sfx.setMusic(!sfx.isMusicOn());
  sfx.unlock();
  renderSoundButtons();
});

document.addEventListener('pointerdown', () => sfx.unlock());
window.addEventListener('resize', () => {
  if (current === 'spin') renderLabel();
});

// ---------- Khởi động ----------
async function boot() {
  renderSoundButtons();
  welcomeWheel.placeBall(0);
  if (api.hasToken()) {
    try {
      S = (await api.getState()).state;
      setBalance(S.balance, false);
      route();
      return;
    } catch (err) {
      if (err.status === 401) api.clearToken();
      else toast('Không kết nối được máy chủ. Hãy thử tải lại trang.');
    }
  }
  showMenu();
}

boot();
