// ===============================================================
//  TÀI KHOẢN: đăng ký, đăng nhập, phiên đăng nhập (cookie)
//  - Mật khẩu được băm bằng scrypt + muối ngẫu nhiên (không lưu mật khẩu gốc)
//  - Phiên đăng nhập lưu dạng mã băm SHA-256, cookie HttpOnly, hết hạn sau 30 ngày
// ===============================================================
const crypto = require('crypto');
const db = require('./db');
const { defaultOutfit, tierOf } = require('./wardrobe');

const SESSION_DAYS = 30;
const COOKIE = 'rap_sid';
const CHARACTERS = ['meo', 'gau', 'tho', 'robot', 'ma', 'ech', 'heo', 'canhcut'];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function checkPassword(account, password) {
  const { hash } = hashPassword(password, account.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(account.hash, 'hex'));
}

// ---------------- KIỂM TRA DỮ LIỆU ----------------
function validUsername(u) {
  return /^[a-z0-9_.]{4,20}$/.test(u);
}
function displayNameTaken(name, exceptUsername, reserved = []) {
  const lower = name.toLowerCase();
  if (reserved.some((r) => r.toLowerCase() === lower)) return true;
  return Object.values(db.data.accounts).some((a) => a.username !== exceptUsername && a.displayName.toLowerCase() === lower);
}

// ---------------- TÀI KHOẢN ----------------
// points  = tổng 🍿 tích luỹ (không bao giờ giảm) → quyết định hạng và món đồ mở khoá
// balance = 🍿 còn dùng được (chiếu ảnh, chen video)
// donated = tổng tiền ủng hộ đã được chủ rạp duyệt (đồng)
function upgrade(a) {
  if (a.balance === undefined) a.balance = a.points || 0;
  if (a.donated === undefined) a.donated = 0;
  if (!a.supportCode) a.supportCode = 'RAP' + sha(a.id + a.salt).slice(0, 6).toUpperCase();
  if (!a.inviteCode) a.inviteCode = sha('moi' + a.id + a.salt).slice(0, 6).toUpperCase(); // mã trong link mời
  if (!Array.isArray(a.unlocks)) a.unlocks = [];   // món đồ đặc biệt đã mở (vd. từ lời mời)
  if (!a.invites) a.invites = { joined: 0, done: 0, day: null, today: 0 };
  return a;
}

function publicAccount(a) {
  if (!a) return null;
  upgrade(a);
  return {
    username: a.username,
    displayName: a.displayName,
    character: a.character,
    outfit: a.outfit,
    points: a.points,
    balance: a.balance,
    donated: a.donated,
    tier: tierOf(a.points),
    createdAt: a.createdAt,
    unlocks: a.unlocks,
    inviteCode: a.inviteCode,
    invites: { joined: a.invites.joined, done: a.invites.done },
    invitedBy: a.invitedBy ? (db.data.accounts[a.invitedBy]?.displayName || null) : null,
    inviteWatched: a.invitedBy && !a.inviteDone ? Math.floor((a.watchSeconds || 0) / 60) : null,
  };
}

function getAccount(username) {
  const a = db.data.accounts[username];
  return a ? upgrade(a) : null;
}

function findByInviteCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(code)) return null;
  return Object.values(db.data.accounts).map(upgrade).find((a) => a.inviteCode === code) || null;
}

function findBySupportCode(code) {
  return Object.values(db.data.accounts).map(upgrade).find((a) => a.supportCode === code) || null;
}

function createAccount({ username, password, displayName, character }, reservedNames) {
  username = String(username || '').trim().toLowerCase();
  displayName = cleanText(displayName, 20);
  if (!validUsername(username)) return { error: 'Tài khoản 4–20 ký tự: chữ không dấu, số, dấu _ hoặc dấu chấm.' };
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) return { error: 'Mật khẩu cần từ 6 đến 72 ký tự.' };
  if (db.data.accounts[username]) return { error: 'Tài khoản này đã có người dùng, chọn tên khác nhé.' };
  if (!displayName) return { error: 'Bạn nhập biệt danh nhé!' };
  if (displayNameTaken(displayName, null, reservedNames)) return { error: 'Biệt danh này đã có người dùng, chọn tên khác nhé!' };
  const { salt, hash } = hashPassword(password);
  const account = {
    id: 'u' + db.data.nextId++,
    username,
    salt,
    hash,
    displayName,
    character: CHARACTERS.includes(character) ? character : CHARACTERS[0],
    outfit: defaultOutfit(),
    points: 0,
    balance: 0,
    donated: 0,
    watchSeconds: 0,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };
  upgrade(account);
  db.data.accounts[username] = account;
  db.save();
  return { account };
}

function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  const a = db.data.accounts[username];
  if (!a || typeof password !== 'string' || !checkPassword(a, password)) {
    return { error: 'Sai tài khoản hoặc mật khẩu.' };
  }
  return { account: a };
}

// ---------------- PHIÊN ĐĂNG NHẬP ----------------
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  db.data.sessions[sha(token)] = { username, expires: Date.now() + SESSION_DAYS * 86400000 };
  db.save();
  return token;
}

function accountFromToken(token) {
  if (!token) return null;
  const s = db.data.sessions[sha(token)];
  if (!s) return null;
  if (s.expires < Date.now()) { delete db.data.sessions[sha(token)]; db.save(); return null; }
  const acc = db.data.accounts[s.username];
  return acc ? upgrade(acc) : null;
}

function destroySession(token) {
  if (token && db.data.sessions[sha(token)]) { delete db.data.sessions[sha(token)]; db.save(); }
}

function cleanupSessions() {
  const now = Date.now();
  let changed = false;
  for (const [k, s] of Object.entries(db.data.sessions)) if (s.expires < now) { delete db.data.sessions[k]; changed = true; }
  if (changed) db.save();
}
setInterval(cleanupSessions, 3600000).unref();

// ---------------- COOKIE ----------------
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function tokenFromReq(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}
function isHttps(req) {
  return req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
}
function sessionCookie(req, token) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 86400}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}
function clearCookie(req) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

// ---------------- GIỚI HẠN SỐ LẦN THỬ (chống dò mật khẩu, chống spam đăng ký) ----------------
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return b.count > max;
}
// xem đã vượt giới hạn chưa mà không tính thêm lần nào
function peekLimited(key, max) {
  const b = buckets.get(key);
  return !!b && b.reset >= Date.now() && b.count >= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 600000).unref();

// Lấy IP thật của người dùng để chống dò mật khẩu / spam.
// - KHÔNG tin X-Forwarded-For: người dùng tự ghi được, Render chỉ nối thêm vào chứ không xoá.
// - Render (và Cloudflare Tunnel) đi qua Cloudflare: Cloudflare luôn ghi đè True-Client-IP / CF-Connecting-IP
//   bằng IP thật, người dùng không giả được. Chỉ tin 2 header này khi kết nối tới từ mạng nội bộ
//   (tức là đi qua proxy của Render / cloudflared), còn kết nối thẳng từ Internet thì dùng IP của kết nối.
function isPrivateAddr(a) {
  a = String(a || '').replace(/^::ffff:/, '');
  return a === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(a) || /^f[cd]/i.test(a) || /^fe80:/i.test(a);
}
function clientIp(req) {
  const sock = req.socket.remoteAddress || '?';
  if (isPrivateAddr(sock)) {
    const cf = String(req.headers['true-client-ip'] || req.headers['cf-connecting-ip'] || '').trim();
    if (cf && /^[0-9a-f:.]{3,45}$/i.test(cf)) return cf;
  }
  return sock;
}

module.exports = {
  peekLimited, findByInviteCode,
  CHARACTERS, cleanText, publicAccount, getAccount, findBySupportCode, createAccount, login, displayNameTaken,
  createSession, accountFromToken, destroySession, tokenFromReq, sessionCookie, clearCookie,
  limited, clientIp,
};
