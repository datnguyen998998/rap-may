// ===============================================================
//  ỦNG HỘ CHỦ RẠP (chuyển khoản qua mã VietQR, chủ rạp duyệt tay)
//  1. Người xem chọn số tiền, quét mã QR, chuyển khoản với nội dung là mã riêng (RAPxxxxxx)
//  2. Bấm "Đã chuyển tiền · Báo chủ rạp" → tạo yêu cầu "Chờ duyệt" (+ báo Telegram nếu có cài)
//  3. Chủ rạp mở /admin.html, kiểm tra tài khoản ngân hàng, bấm Duyệt → cộng 🍿 cho người ủng hộ
// ===============================================================
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { POINTS, SUPPORT_AMOUNTS } = require('./wardrobe');

const MIN_AMOUNT = 10000;
const MAX_AMOUNT = 5000000;
const MAX_PENDING = 3;

function store() {
  if (!db.data.support) db.data.support = { requests: [] };
  return db.data.support;
}

const pointsFor = (amount) => Math.floor(amount / POINTS.vndPerPoint);

// Nội dung chuyển khoản: chỉ chữ không dấu + số (theo quy định VietQR)
function transferNote(account) {
  return `${account.supportCode} UNG HO RAP`;
}

function qrUrl(amount, note) {
  if (!config.supportEnabled) return null;
  const q = new URLSearchParams({ amount: String(amount), addInfo: note, accountName: config.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(config.bankId)}-${encodeURIComponent(config.accountNo)}-compact2.png?${q}`;
}

function info(account) {
  const mine = store().requests.filter((r) => r.username === account.username).slice(-20).reverse();
  return {
    enabled: config.supportEnabled,
    bank: config.supportEnabled ? { id: config.bankId, name: config.bankName || config.bankId, accountNo: config.accountNo, accountName: config.accountName } : null,
    note: transferNote(account),
    amounts: SUPPORT_AMOUNTS,
    vndPerPoint: POINTS.vndPerPoint,
    donated: account.donated || 0,
    requests: mine.map((r) => ({ id: r.id, amount: r.amount, points: r.points, status: r.status, createdAt: r.createdAt })),
  };
}

async function notifyTelegram(text) {
  if (!config.telegramBotToken || !config.telegramChatId) return 'off';
  try {
    const r = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

function createRequest(account, amount) {
  if (!config.supportEnabled) return { error: 'Chủ rạp chưa cài đặt tài khoản nhận ủng hộ.' };
  amount = Math.round(Number(amount));
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT || amount % 1000 !== 0) {
    return { error: `Số tiền từ ${MIN_AMOUNT.toLocaleString('vi-VN')}đ đến ${MAX_AMOUNT.toLocaleString('vi-VN')}đ, là bội số của 1.000đ.` };
  }
  const pending = store().requests.filter((r) => r.username === account.username && r.status === 'pending');
  if (pending.length >= MAX_PENDING) return { error: 'Bạn đang có nhiều yêu cầu chờ duyệt, đợi chủ rạp kiểm tra nhé.' };
  const req = {
    id: crypto.randomBytes(6).toString('hex'),
    username: account.username,
    displayName: account.displayName,
    code: account.supportCode,
    amount,
    points: pointsFor(amount),
    status: 'pending',
    createdAt: Date.now(),
  };
  store().requests.push(req);
  if (store().requests.length > 2000) store().requests.splice(0, store().requests.length - 2000);
  db.save();
  notifyTelegram(`💖 Yêu cầu ủng hộ mới\nNgười xem: ${account.displayName} (${account.username})\nSố tiền: ${amount.toLocaleString('vi-VN')}đ\nNội dung CK: ${transferNote(account)}\nVào /admin.html để duyệt.`)
    .then((state) => { req.notify = state; db.save(); });
  return { request: req };
}

function listForAdmin() {
  return store().requests.slice(-300).reverse();
}

// Duyệt hoặc từ chối. Trả về { request, account } để server báo cho người xem.
function decide(id, approve) {
  const req = store().requests.find((r) => r.id === id);
  if (!req) return { error: 'Không tìm thấy yêu cầu.' };
  if (req.status !== 'pending') return { error: 'Yêu cầu này đã được xử lý rồi.' };
  const account = db.data.accounts[req.username];
  if (!account) return { error: 'Tài khoản không còn tồn tại.' };
  req.status = approve ? 'approved' : 'rejected';
  req.decidedAt = Date.now();
  if (approve) {
    account.points = (account.points || 0) + req.points;
    account.balance = (account.balance || 0) + req.points;
    account.donated = (account.donated || 0) + req.amount;
  }
  db.save();
  return { request: req, account };
}

// So sánh mật khẩu quản trị an toàn
function checkAdmin(password) {
  if (!config.adminPassword || typeof password !== 'string') return false;
  password = password.trim();
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(config.adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = { info, createRequest, listForAdmin, decide, checkAdmin, qrUrl, transferNote, pointsFor };
