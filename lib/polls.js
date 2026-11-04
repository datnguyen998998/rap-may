// ===============================================================
//  ĐOÁN MINI TRONG LÚC XEM: "Ai là hung thủ?", "Đội nào ghi bàn?"...
//  Người tạo: chủ rạp (hostUsers trong config) hoặc người gửi video đang chiếu.
//  Vòng đời: mở (mọi người đoán) → khoá (hết giờ) → công bố đáp án (đoán đúng nhận 🍿).
//  Chỉ có 1 câu đoán một lúc, lưu trong bộ nhớ (không cần lưu file).
// ===============================================================
const crypto = require('crypto');

const POLL_REWARD = 15;                 // 🍿 cho mỗi người đoán đúng
const POLL_SECONDS = [30, 60, 120, 300, 600]; // thời gian cho đoán
const POLL_MAX_OPTIONS = 4;
const POLL_EXPIRE_MS = 30 * 60 * 1000;  // khoá rồi mà 30 phút không công bố thì tự huỷ
const SHOW_RESULT_MS = 25 * 1000;       // công bố xong hiện kết quả 25 giây rồi ẩn

// Mỗi phòng có một "kho" câu đoán riêng (createStore)
function createStore() {
let poll = null; // { id, question, options, byId, byName, createdAt, closesAt, status, answers: Map, correct, revealedAt }

const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function active() {
  if (!poll) return null;
  const now = Date.now();
  if (poll.status === 'open' && now >= poll.closesAt) poll.status = 'closed';
  if (poll.status === 'closed' && now - poll.closesAt > POLL_EXPIRE_MS) poll = null;
  else if (poll && poll.status === 'revealed' && now - poll.revealedAt > SHOW_RESULT_MS) poll = null;
  return poll;
}

function create(user, { question, options, seconds }) {
  const p = active();
  if (p && p.status !== 'revealed') return { error: 'Đang có một câu đoán khác. Công bố hoặc huỷ câu đó trước nhé.' };
  question = clean(question, 100);
  if (question.length < 3) return { error: 'Bạn nhập câu hỏi nhé (ít nhất 3 ký tự).' };
  if (!Array.isArray(options)) return { error: 'Thiếu các lựa chọn.' };
  const opts = [];
  for (const o of options) {
    const t = clean(o, 40);
    if (t && !opts.some((x) => x.toLowerCase() === t.toLowerCase())) opts.push(t);
  }
  if (opts.length < 2 || opts.length > POLL_MAX_OPTIONS) return { error: `Cần từ 2 đến ${POLL_MAX_OPTIONS} lựa chọn khác nhau.` };
  seconds = Number(seconds);
  if (!POLL_SECONDS.includes(seconds)) seconds = 60;
  poll = {
    id: crypto.randomBytes(4).toString('hex'),
    question, options: opts,
    byId: user.id, byName: user.name, byUsername: user.username,
    createdAt: Date.now(), closesAt: Date.now() + seconds * 1000,
    status: 'open', answers: new Map(), correct: null, revealedAt: 0, winners: 0,
  };
  return { poll };
}

function answer(user, idx) {
  const p = active();
  if (!p || p.status !== 'open') return { error: 'Đã hết giờ đoán rồi.' };
  if (p.byId === user.id) return { error: 'Bạn là người ra câu hỏi nên không đoán được nhé.' };
  idx = Number(idx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= p.options.length) return { error: 'Lựa chọn không hợp lệ.' };
  p.answers.set(user.id, { idx, username: user.username || null });
  return { ok: true };
}

function close() {
  const p = active();
  if (!p || p.status !== 'open') return false;
  p.status = 'closed';
  p.closesAt = Date.now();
  return true;
}

// Công bố đáp án: trả về danh sách người đoán đúng (để server cộng 🍿)
function reveal(idx) {
  const p = active();
  if (!p || p.status === 'revealed') return { error: 'Không có câu đoán nào đang chờ công bố.' };
  idx = Number(idx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= p.options.length) return { error: 'Đáp án không hợp lệ.' };
  if (p.status === 'open') p.closesAt = Date.now();
  p.status = 'revealed';
  p.correct = idx;
  p.revealedAt = Date.now();
  const winners = [...p.answers.entries()].filter(([, a]) => a.idx === idx).map(([id, a]) => ({ id, username: a.username }));
  p.winners = winners.length;
  return { poll: p, winners };
}

function cancel() {
  const had = !!active();
  poll = null;
  return had;
}

// Lúc đang mở: chỉ hiện tổng số người đoán (không lộ ai chọn gì). Khoá rồi mới hiện tỉ lệ.
function view(userId) {
  const p = active();
  if (!p) return null;
  const counts = p.options.map(() => 0);
  for (const a of p.answers.values()) counts[a.idx]++;
  const mine = p.answers.get(userId);
  return {
    id: p.id, question: p.question, options: p.options, byId: p.byId, byName: p.byName,
    closesAt: p.closesAt, status: p.status, total: p.answers.size,
    counts: p.status === 'open' ? null : counts,
    correct: p.correct, winners: p.winners, reward: POLL_REWARD,
    mine: mine ? mine.idx : null,
  };
}

const owner = () => (active() ? poll.byId : null);
const nextChange = () => {
  const p = active();
  if (!p) return null;
  if (p.status === 'open') return p.closesAt;
  if (p.status === 'revealed') return p.revealedAt + SHOW_RESULT_MS;
  return p.closesAt + POLL_EXPIRE_MS;
};

return { active, create, answer, close, reveal, cancel, view, owner, nextChange };
}

module.exports = { POLL_REWARD, POLL_SECONDS, POLL_MAX_OPTIONS, createStore };
