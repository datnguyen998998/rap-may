// ===============================================================
//  CHỐNG PHÁ HOẠI THEO IP (DDoS nhỏ, spam kết nối, gửi tệp liên tục)
//  - Giới hạn số request HTTP mỗi phút cho mỗi IP
//  - Giới hạn số kết nối WebSocket cùng lúc cho mỗi IP
//  - Giới hạn số tin nhắn WebSocket mỗi giây cho mỗi kết nối
//  - Vượt giới hạn nhiều lần → tự chặn IP đó một thời gian
//  - Chủ rạp chặn IP bằng tay (trang quản trị) hoặc biến môi trường BLOCK_IPS
//  Các con số chỉnh được bằng biến môi trường (xem HUONG_DAN.md, Phần 5).
// ===============================================================
const db = require('./db');

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const LIMITS = {
  httpPerMin: num(process.env.HTTP_PER_MIN, 300),      // request HTTP / phút / IP (1 lần tải trang ~ 15 request)
  wsPerIp: num(process.env.WS_PER_IP, 12),            // kết nối WebSocket cùng lúc / IP (nhiều người chung wifi/4G vẫn đủ)
  wsMsgPerSec: num(process.env.WS_MSG_PER_SEC, 40),   // tin nhắn / giây / kết nối
  uploadsPerIp: 2,                                    // ảnh đang tải lên cùng lúc / IP
  uploadsTotal: 6,                                    // ảnh đang tải lên cùng lúc / toàn rạp
  strikesToBan: 5,                                    // vượt giới hạn bao nhiêu lần thì tự chặn
  autoBanMinutes: num(process.env.AUTO_BAN_MINUTES, 15),
};

// IP bị chặn cố định qua biến môi trường: BLOCK_IPS="1.2.3.4,5.6.7.8"
const envBlocked = new Set(String(process.env.BLOCK_IPS || '').split(',').map((s) => s.trim()).filter(Boolean));

function store() {
  if (!db.data.security) db.data.security = { bannedIps: {}, bannedUsers: {} };
  if (!db.data.security.bannedIps) db.data.security.bannedIps = {};
  if (!db.data.security.bannedUsers) db.data.security.bannedUsers = {};
  return db.data.security;
}

// ---------------- CHẶN IP ----------------
const autoBans = new Map(); // ip -> { until, reason }
function blockedReason(ip) {
  if (!ip) return null;
  if (envBlocked.has(ip)) return 'IP này đã bị chủ rạp chặn.';
  const b = store().bannedIps[ip];
  if (b) {
    if (!b.until || b.until > Date.now()) return 'IP này đã bị chủ rạp chặn.';
    delete store().bannedIps[ip]; db.save();
  }
  const a = autoBans.get(ip);
  if (a) {
    if (a.until > Date.now()) return 'Bạn gửi yêu cầu quá nhiều, tạm bị chặn vài phút. Thử lại sau nhé.';
    autoBans.delete(ip);
  }
  return null;
}
function banIp(ip, minutes, reason, by) {
  store().bannedIps[ip] = { until: minutes ? Date.now() + minutes * 60000 : null, reason: String(reason || '').slice(0, 120), by: by || 'admin', at: Date.now() };
  db.save();
}
function unbanIp(ip) {
  autoBans.delete(ip);
  if (store().bannedIps[ip]) { delete store().bannedIps[ip]; db.save(); return true; }
  return false;
}
function listBans() {
  const now = Date.now();
  const out = [];
  for (const [ip, b] of Object.entries(store().bannedIps)) if (!b.until || b.until > now) out.push({ ip, ...b, kind: 'admin' });
  for (const [ip, b] of autoBans) if (b.until > now) out.push({ ip, until: b.until, reason: b.reason, kind: 'auto' });
  for (const ip of envBlocked) out.push({ ip, until: null, reason: 'BLOCK_IPS', kind: 'env' });
  return out;
}

// ---------------- ĐẾM VI PHẠM → TỰ CHẶN ----------------
const strikes = new Map(); // ip -> { n, reset }
function strike(ip, why) {
  const now = Date.now();
  let s = strikes.get(ip);
  if (!s || s.reset < now) { s = { n: 0, reset: now + 10 * 60000 }; strikes.set(ip, s); }
  s.n++;
  if (s.n >= LIMITS.strikesToBan && !autoBans.has(ip)) {
    autoBans.set(ip, { until: now + LIMITS.autoBanMinutes * 60000, reason: why });
    console.log(`🛡️ Tự chặn IP ${ip} trong ${LIMITS.autoBanMinutes} phút: ${why}`);
  }
}

// ---------------- REQUEST HTTP ----------------
const http = new Map(); // ip -> { n, reset }
function httpAllow(ip) {
  const now = Date.now();
  let b = http.get(ip);
  if (!b || b.reset < now) { b = { n: 0, reset: now + 60000, warned: false }; http.set(ip, b); }
  b.n++;
  if (b.n > LIMITS.httpPerMin) {
    if (!b.warned || b.n % LIMITS.httpPerMin === 0) { b.warned = true; strike(ip, 'gửi quá nhiều request'); }
    return false;
  }
  return true;
}

// ---------------- KẾT NỐI WEBSOCKET ----------------
const wsCount = new Map(); // ip -> số kết nối đang mở
function wsOpen(ip) {
  const n = wsCount.get(ip) || 0;
  if (n >= LIMITS.wsPerIp) { strike(ip, 'mở quá nhiều kết nối'); return false; }
  wsCount.set(ip, n + 1);
  return true;
}
function wsClose(ip) {
  const n = (wsCount.get(ip) || 1) - 1;
  if (n > 0) wsCount.set(ip, n); else wsCount.delete(ip);
}
// gọi mỗi khi nhận 1 tin nhắn; trả false nếu kết nối gửi dồn dập (nên ngắt)
function wsMsgAllow(client) {
  const now = Date.now();
  if (!client.msgWin || now - client.msgWin > 1000) { client.msgWin = now; client.msgN = 0; }
  client.msgN++;
  if (client.msgN > LIMITS.wsMsgPerSec) { strike(client.ip, 'gửi tin nhắn dồn dập'); return false; }
  return true;
}

// ---------------- TẢI ẢNH LÊN ----------------
const uploads = new Map(); // ip -> số ảnh đang tải
let uploadsTotal = 0;
function uploadBegin(ip) {
  const n = uploads.get(ip) || 0;
  if (n >= LIMITS.uploadsPerIp || uploadsTotal >= LIMITS.uploadsTotal) return false;
  uploads.set(ip, n + 1); uploadsTotal++;
  return true;
}
function uploadEnd(ip) {
  const n = (uploads.get(ip) || 1) - 1;
  if (n > 0) uploads.set(ip, n); else uploads.delete(ip);
  uploadsTotal = Math.max(0, uploadsTotal - 1);
}

// ---------------- KHOÁ TÀI KHOẢN ----------------
function userBanned(username) {
  const b = username && store().bannedUsers[username];
  if (!b) return null;
  if (b.until && b.until < Date.now()) { delete store().bannedUsers[username]; db.save(); return null; }
  return b;
}
function banUser(username, minutes, reason) {
  store().bannedUsers[username] = { until: minutes ? Date.now() + minutes * 60000 : null, reason: String(reason || '').slice(0, 120), at: Date.now() };
  db.save();
}
function unbanUser(username) {
  if (store().bannedUsers[username]) { delete store().bannedUsers[username]; db.save(); return true; }
  return false;
}

// dọn bộ đếm cũ
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of http) if (b.reset < now) http.delete(k);
  for (const [k, s] of strikes) if (s.reset < now) strikes.delete(k);
  for (const [k, b] of autoBans) if (b.until < now) autoBans.delete(k);
}, 60000).unref();

module.exports = {
  LIMITS, blockedReason, banIp, unbanIp, listBans, strike,
  httpAllow, wsOpen, wsClose, wsMsgAllow, uploadBegin, uploadEnd,
  userBanned, banUser, unbanUser,
};
