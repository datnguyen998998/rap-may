// ===============================================================
//  RẠP CHIẾU PHIM ONLINE - SERVER
//  Chạy: node server.js   (rồi mở http://localhost:3000)
//  Không cần cài thêm thư viện nào, chỉ cần Node.js 18 trở lên.
// ===============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('./lib/websocket');
const db = require('./lib/db');
const accounts = require('./lib/accounts');
const wardrobe = require('./lib/wardrobe');
const support = require('./lib/support');
const config = require('./lib/config');
const engage = require('./lib/engage');
const moments = require('./lib/moments');
const polls = require('./lib/polls');
const moderation = require('./lib/moderation');
const guard = require('./lib/guard');
const stats = require('./lib/stats');

db.load();

// ---------------- CẤU HÌNH (bạn có thể sửa) ----------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const TOTAL_SEATS = 100;              // 10 hàng (A–J) x 10 ghế
const MAX_QUEUE_PER_USER = 5;         // mỗi người có tối đa 5 video trong hàng chờ
const CHAT_MAX = 160;                 // tin nhắn tối đa 160 ký tự
// Chống tài khoản clone gian lận vote: tài khoản phải đủ "tuổi" và đã ngồi xem một lúc mới được vote
const VOTE_MIN_AGE_MIN = process.env.VOTE_MIN_AGE_MIN != null ? Number(process.env.VOTE_MIN_AGE_MIN) : 30;   // tạo được ít nhất 30 phút
const VOTE_MIN_WATCH_MIN = process.env.VOTE_MIN_WATCH_MIN != null ? Number(process.env.VOTE_MIN_WATCH_MIN) : 10; // đã xem phim ít nhất 10 phút
const VOTES_PER_IP = Number(process.env.VOTES_PER_IP) || 2; // mỗi IP (một nhà / một wifi) tối đa 2 phiếu cho cùng một video
const SKIP_PERCENT = 35;              // TRÊN 35% số người thật trong phòng đồng ý thì bỏ qua video (3 người cần 2 phiếu, 10 người cần 4)
const MAX_VIDEO_MINUTES = 240;        // video dài hơn 4 tiếng sẽ bị bỏ qua
const START_DELAY_MS = 2000;          // chờ 2 giây cho mọi người tải video rồi mới chạy
const VOTE_SECONDS = 15;              // thời gian vòng bình chọn video tiếp theo
const BOT_MIN = 30;                   // số bot trong rạp thay đổi ngẫu nhiên từ 30 …
const BOT_MAX = 50;                   // … đến 50 (đặt cả hai = 0 để tắt bot)
const BOT_REROLL_MIN = [4, 9];        // cứ 4–9 phút lại chọn con số mới (bot vào/ra dần dần như khách thật)
const MIN_FREE_SEATS = 10;            // luôn chừa ít nhất ngần này ghế trống
const STAGE_SPOTS = 5;                // số chỗ trên sân khấu
const STAGE_MS = 60 * 1000;           // mỗi lần lên sân khấu được 1 phút
const PYRO_DANCERS = parseInt(process.env.PYRO_DANCERS, 10) || 5; // đủ ngần này người trên sân khấu …
const PYRO_EVERY_MS = 30 * 1000;      // … cứ mỗi 30 giây thì pháo sáng phun 1 lần
const PYRO_MS = 7000;                 // mỗi lần phun kéo dài 7 giây
const MOODS = ['normal', 'party', 'horror', 'romance']; // không khí video: thường · sôi động · kinh dị · lãng mạn
const REPLAY_SECONDS = 10;            // phát lại khoảnh khắc hot dài 10 giây
const REPLAY_MIN_EMOJI = 5;           // cần ít nhất 5 emoji trong 10 giây đó mới phát lại
const THROW_ITEMS = ['tomato', 'rose']; // đồ ném lên màn hình (ngoài bỏng ngô)
const POST_SECONDS = wardrobe.PRICES.postSeconds; // thời gian chiếu ảnh cho phép (giây)
const POST_MAX_BYTES = 700 * 1024;    // ảnh sau khi nén tối đa 700KB
const POST_COOLDOWN_MS = 30 * 1000;   // mỗi người 30 giây mới gửi được 1 ảnh
const POST_QUEUE_MAX = 10;            // tối đa 10 ảnh chờ chiếu

const CHARACTERS = accounts.CHARACTERS;
const POINTS_TICK_MS = parseInt(process.env.POINTS_TICK_MS, 10) || 60000; // cộng điểm mỗi phút
const EMOTES = { dance: 6000, wave: 3000, clap: 3000 }; // động tác và thời lượng (ms)
// Mời bạn bè
const INVITE_BONUS = 30;              // bạn bè đăng ký qua link mời: cả hai nhận 30 🍿
const INVITE_WATCH_MINUTES = parseFloat(process.env.INVITE_WATCH_MINUTES) || 60;      // người được mời xem đủ 60 phút …
const INVITE_DONE_BONUS = 50;         // … thì người mời nhận thêm 50 🍿 và món đồ hiếm
const INVITE_RARE_ITEM = 'heartshades'; // Kính trái tim (xem lib/wardrobe.js)
const INVITE_PER_DAY = 5;             // mỗi người tối đa 5 lời mời được thưởng mỗi ngày (chống tạo tài khoản ảo)
// Ngồi chung ghế đôi / ghế ba
const SOFA_BONUS = 1;                 // mỗi phút xem phim cùng bạn trên một sofa: thêm 1 🍿
// Phòng riêng
const MAX_ROOMS = 30;                 // tối đa 30 phòng riêng cùng lúc
const ROOM_EMPTY_MINUTES = parseFloat(process.env.ROOM_EMPTY_MINUTES) || 3;         // phòng riêng không còn ai trong 3 phút thì tự đóng
// Quà tặng (giá tính bằng 🍿 còn dùng được)
const GIFTS = {
  flower: { name: 'Bó hoa', icon: '💐', price: 20, minutes: 3 },
  milktea: { name: 'Ly trà sữa', icon: '🧋', price: 30, minutes: 3 },
  crown: { name: 'Vương miện', icon: '👑', price: 80, minutes: 10, hat: 'crown' }, // đội vương miện thật trên đầu 10 phút
};
// Bạn bè
const MAX_FRIENDS = 200;
const MAX_FRIEND_REQUESTS = 50;

const EMOJI_GROUPS = [
  { name: 'Cảm xúc', items: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🥳', '🤩', '😜', '🤗', '😅', '🥹', '😭', '😢', '😮', '😱', '🤔', '🫣', '🤫', '😴', '😤', '😡'] },
  { name: 'Trái tim', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '🤍', '🖤', '💔', '💕', '💖'] },
  { name: 'Cử chỉ', items: ['👍', '👎', '👏', '🙌', '🤝', '🤙', '🫶', '✌️', '👋', '💪', '🙏', '👌'] },
  { name: 'Tiệc tùng', items: ['🔥', '🎉', '🎊', '🥂', '🎵', '🎶', '🎬', '🍿', '🥤', '💃', '🕺', '✨', '⭐'] },
];
const EMOJIS = new Set(EMOJI_GROUPS.flatMap((g) => g.items));
const QUICK_EMOJIS = ['😂', '😍', '😱', '👏', '🔥', '😭'];

// Tên bot cho vui (bạn tự thêm/bớt thoải mái)
const BOT_NAMES = [
  'bánh tráng trộn', 'trà sữa full topping', 'cú đêm', 'khách vé free', 'fan cứng',
  'chuyên gia spoil', 'thánh ngủ gật', 'bé bắp rang', 'thợ săn sale', 'người qua đường',
  'chú hàng xóm', 'kẻ hủy diệt bim bim', 'mắt kính cận', 'ông hoàng lướt phim',
  'nàng thơ rạp chiếu', 'đội trưởng vỗ tay', 'bạn thân của bắp', 'ninja lén lút',
  'mì tôm trứng', 'cà phê muối', 'bánh mì pate', 'xôi xéo', 'trà đá vỉa hè', 'nem chua rán',
  'khoai lang nướng', 'sữa chua nếp cẩm', 'chè khúc bạch', 'kem tràng tiền', 'bánh flan',
  'gà rán sốt cay', 'phở cuốn', 'bún đậu mắm tôm', 'ốc luộc sả', 'bánh tráng nướng',
  'người hay khóc phim', 'thánh cười to', 'cô nàng mê idol', 'anh chàng đến muộn',
  'fan phim ma', 'mọt phim hàn', 'chúa tể remote', 'kẻ mở phụ đề', 'người giữ chỗ',
  'đứa hay hỏi', 'cao thủ đoán kết', 'thánh soi lỗi', 'bé mê hoạt hình', 'ông bác vui tính',
  'sinh viên năm nhất', 'dân văn phòng', 'cú mèo 2 giờ sáng', 'mèo lười', 'cún con',
  'gấu trúc ngủ ngày', 'cá vàng hay quên', 'sóc nâu', 'chim cánh cụt lạc', 'thỏ trắng',
  'mây lang thang', 'sao băng', 'nắng sớm', 'gió bấc', 'mưa rào', 'trăng khuyết',
  'pháo hoa nhỏ', 'đèn lồng đỏ', 'vé hạng VIP', 'ghế hàng cuối', 'người bán bắp',
  'kẻ thích ghế đôi', 'hội độc thân', 'cặp đôi hàng J', 'nhóm bạn thân', 'tay chơi laser',
];

// ---------------- GHẾ: hàng A–J, mỗi hàng: đơn | đôi | ba | ba | đơn ----------------
const SEAT_GROUPS = [1, 2, 3, 3, 1];
const COL_TYPE = SEAT_GROUPS.flatMap((n) => Array(n).fill(n));
const SEAT_TYPE_NAME = { 1: 'Ghế đơn', 2: 'Ghế đôi', 3: 'Ghế ba' };
function seatCode(i) {
  return 'ABCDEFGHIJ'[Math.floor(i / 10)] + String((i % 10) + 1).padStart(2, '0');
}
function seatLabel(i) {
  return `${seatCode(i)} · ${SEAT_TYPE_NAME[COL_TYPE[i % 10]]}`;
}

// ---------------- TRẠNG THÁI RẠP ----------------
// Ghế đôi / ghế ba: các ghế cùng một cụm sofa có chung "mã sofa"
const COL_GROUP_START = [];
{ let c = 0; for (const n of SEAT_GROUPS) { for (let k = 0; k < n; k++) COL_GROUP_START.push(c); c += n; } }
function sofaKey(seat) {
  if (seat == null || seat < 0) return null;
  const col = seat % 10;
  return COL_TYPE[col] > 1 ? Math.floor(seat / 10) * 10 + COL_GROUP_START[col] : null;
}

const clients = new Map();   // ws -> { id, user|null, room|null, rate:{}, token }
const tokens = new Map();    // token -> người xem (dùng cho gửi ảnh qua HTTP)
const posts = new Map();     // id ảnh -> { buf, mime }
const rooms = new Map();     // id phòng -> phòng
const liveGifts = new Map(); // tên đăng nhập -> quà đang đeo (đi theo người dù đổi phòng)
let nextId = 1;

const uid = () => (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------- GỬI TIN ----------------
function send(ws, t, d) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ t, d }));
}
function broadcastAll(t, d) {
  const msg = JSON.stringify({ t, d });
  for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(msg);
}
// tin hệ thống gửi cho mọi phòng
function allChat(text) {
  for (const r of rooms.values()) r.systemChat(text);
}
const mainRoom = () => rooms.get('main');
function allUsers() {
  const out = [];
  for (const r of rooms.values()) for (const u of r.users.values()) out.push(u);
  return out;
}
const allHumans = () => allUsers().filter((u) => !u.bot);

// ---------------- TIỆN ÍCH ----------------
function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function rateLimited(client, key, ms) {
  const now = Date.now();
  if (client.rate[key] && now - client.rate[key] < ms) return true;
  client.rate[key] = now;
  return false;
}
// Trang phục đang hiện (vương miện được tặng sẽ đè lên mũ trong thời gian hiệu lực)
function effectiveOutfit(u) {
  if (!u.gifts || !u.outfit) return u.outfit || null;
  const hat = u.gifts.find((g) => g.hat && g.until > Date.now());
  return hat ? { ...u.outfit, hat: hat.hat } : u.outfit;
}
// Lý do chưa được vote (null = được vote). Chủ rạp / chủ phòng luôn được vote.
function voteBlock(u, hostOk) {
  if (!u || u.bot) return 'no';
  if (hostOk) return null;
  const acc = accounts.getAccount(u.username);
  if (!acc) return 'Bạn cần đăng nhập.';
  const ageMin = (Date.now() - (acc.createdAt || 0)) / 60000;
  const watched = Math.floor((acc.watchSeconds || 0) / 60);
  if (ageMin >= VOTE_MIN_AGE_MIN && watched >= VOTE_MIN_WATCH_MIN) return null;
  const need = [];
  if (ageMin < VOTE_MIN_AGE_MIN) need.push(`còn ${Math.ceil(VOTE_MIN_AGE_MIN - ageMin)} phút nữa tài khoản mới đủ ${VOTE_MIN_AGE_MIN} phút tuổi`);
  if (watched < VOTE_MIN_WATCH_MIN) need.push(`xem phim thêm ${VOTE_MIN_WATCH_MIN - watched} phút nữa (đã xem ${watched}/${VOTE_MIN_WATCH_MIN} phút)`);
  return `🗳️ Tài khoản mới chưa được bình chọn để chống gian lận: ${need.join(' và ')}.`;
}
// Đếm số phiếu đến từ cùng một IP trong một nhóm người đã vote
function sameIpVotes(voterIds, ip, usersMap) {
  if (!ip) return 0;
  let n = 0;
  for (const id of voterIds) { const v = usersMap.get(id); if (v && v.ip === ip) n++; }
  return n;
}
function notice(client, text) { if (client && client.ws) send(client.ws, 'notice', { text }); }

function publicUser(u) {
  return {
    id: u.id, name: u.name, character: u.character, seat: u.seat, bot: !!u.bot, stage: u.stage || null,
    outfit: effectiveOutfit(u), tier: u.tier || 0,
    gifts: (u.gifts || []).filter((g) => g.until > Date.now()).map((g) => ({ icon: g.icon, until: g.until })),
  };
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ---------------- BOT CHAT ----------------
// Câu chat lấy ngẫu nhiên từ file bot-chat.txt (mỗi dòng 1 câu). Sửa file là rạp tự đọc lại.
const BOT_CHAT_FILE = path.join(__dirname, 'bot-chat.txt');
const BOT_CHAT_MIN_S = 25;   // bot chat cách nhau ngẫu nhiên từ 25 …
const BOT_CHAT_MAX_S = 70;   // … đến 70 giây (đặt BOT_CHAT_MAX_S = 0 để tắt bot chat)
let botLines = [];
function loadBotLines() {
  try {
    const raw = fs.readFileSync(BOT_CHAT_FILE, 'utf8').replace(/^\uFEFF/, '');
    botLines = raw.split(/\r?\n/).map((l) => cleanText(l, CHAT_MAX)).filter((l) => l && !l.startsWith('#'));
    console.log(`💬 Bot chat: đã đọc ${botLines.length} câu từ bot-chat.txt`);
  } catch {
    botLines = [];
  }
}
loadBotLines();
fs.watchFile(BOT_CHAT_FILE, { interval: 3000 }, loadBotLines);
// ---------------- YOUTUBE ----------------
function parseVideoId(input) {
  input = cleanText(input, 300);
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input.startsWith('http') ? input : 'https://' + input);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    const ok = (v) => (v && /^[\w-]{11}$/.test(v) ? v : null);
    if (host === 'youtu.be') return ok(u.pathname.slice(1, 12));
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return ok(u.searchParams.get('v'));
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch { /* không phải URL */ }
  return null;
}

const videoCache = new Map(); // videoId -> { title, author, duration }

// Thời lượng video: đọc từ trang YouTube (không cần API key). Không lấy được thì để trống.
async function fetchDuration(videoId) {
  try {
    const r = await fetch('https://www.youtube.com/watch?v=' + videoId, {
      headers: { 'Accept-Language': 'vi,en;q=0.8', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const html = await r.text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    return m ? Number(m[1]) || null : null;
  } catch {
    return null;
  }
}

async function fetchVideoInfo(videoId) {
  if (videoCache.has(videoId)) return videoCache.get(videoId);
  // oEmbed của YouTube: không cần API key, trả về tiêu đề + kênh.
  // 401 = chủ video tắt chế độ nhúng; 404/400 = video không tồn tại hoặc riêng tư.
  let info;
  try {
    const url = 'https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + videoId);
    const [r, duration] = await Promise.all([fetch(url, { signal: AbortSignal.timeout(6000) }), fetchDuration(videoId)]);
    if (r.status === 401 || r.status === 403) return { error: 'Video này không cho phép phát trên trang khác 😢' };
    if (!r.ok) return { error: 'Không tìm thấy video (có thể đã bị xoá hoặc để riêng tư)' };
    const j = await r.json();
    info = { title: cleanText(j.title, 120) || videoId, author: cleanText(j.author_name, 60), duration };
  } catch {
    // Không kết nối được YouTube từ server: vẫn cho thêm, dùng ID làm tên tạm
    return { title: 'Video ' + videoId, author: '', duration: null };
  }
  videoCache.set(videoId, info);
  if (videoCache.size > 500) videoCache.delete(videoCache.keys().next().value);
  return info;
}
// Tìm 10 giây có nhiều emoji nhất của video (dữ liệu biểu đồ khoảnh khắc hot)
function hotMoment(cur) {
  const m = moments.view(cur.videoId);
  if (!m.b.length || !cur.duration || cur.duration < REPLAY_SECONDS * 3) return null;
  const per = new Map(m.b.map(([k, n, e]) => [k, { n, e }]));
  const span = Math.round(REPLAY_SECONDS / m.bucket);
  let best = null;
  for (const [k] of per) {
    let n = 0;
    const emo = {};
    for (let j = 0; j < span; j++) { const b = per.get(k + j); if (b) { n += b.n; emo[b.e] = (emo[b.e] || 0) + b.n; } }
    if (!best || n > best.n) best = { k, n, emoji: Object.entries(emo).sort((a, b) => b[1] - a[1])[0][0] };
  }
  if (!best || best.n < REPLAY_MIN_EMOJI) return null;
  const from = Math.max(0, Math.min(cur.duration - REPLAY_SECONDS - 1, best.k * m.bucket - 2)); // lùi 2 giây cho đủ ngữ cảnh
  return { from: Math.round(from), seconds: REPLAY_SECONDS, emoji: best.emoji, count: best.n };
}
function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(0, 4).toString('hex') === '89504e47') return 'image/png';
  if (buf.slice(0, 4).toString() === 'GIF8') return 'image/gif';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
// ===================== PHÒNG =====================
function createRoom({ id, name, isMain = false, ownerUsername = null, ownerName = null, passHash = null }) {
  // Phòng: sảnh chính (có bot) hoặc phòng riêng của một nhóm bạn.
  // Mỗi phòng có ghế, hàng chờ, video, chat, sân khấu, câu đoán... riêng.
  const room = { id, name, isMain, ownerUsername, ownerName, passHash, createdAt: Date.now(), emptySince: Date.now() };
  const timers = [];
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const sofaAnnounced = new Map(); // mã sofa + danh sách người -> lúc báo gần nhất
  const users = new Map();     // id -> { id, name, character, seat, bot?, stage? }
  const seats = new Array(TOTAL_SEATS).fill(null); // seat -> userId
  const stageSpots = new Array(STAGE_SPOTS).fill(null);
  let queue = [];              // { id, videoId, title, author, duration, energetic, bpm, byId, byName, voters:Set, addedAt, boostedAt }
  let current = null;          // { videoId, title, byName, startedAt, duration }
  let voting = null;           // { endsAt }
  let skipVotes = new Set();
  let endTimer = null;
  let voteTimer = null;
  let postQueue = [];
  let showingPost = null;      // { id, text, byName, seconds, endsAt }
  const pollStore = polls.createStore();
  // quản lý chat của chủ rạp / chủ phòng
  const mutes = new Map();     // tên đăng nhập -> tắt chat đến lúc nào
  let chatLocked = false;      // tạm khoá chat cả phòng (chủ rạp vẫn chat được)
  let pinned = null;           // { text, by, at } tin nhắn ghim đầu khung chat
  const chatState = () => ({ locked: chatLocked, pinned });

  function broadcast(t, d, except) {
    const msg = JSON.stringify({ t, d });
    // người chưa vào phòng nào (đang ở màn hình đăng nhập) vẫn thấy sảnh chính chuyển động phía sau
    for (const [ws, c] of clients) if ((c.room === room || (!c.room && isMain)) && ws !== except && ws.readyState === 1) ws.send(msg);
  }
  function systemChat(text) {
    broadcast('chat', { system: true, text, at: Date.now() });
  }

  function humans() { return [...users.values()].filter((u) => !u.bot); }
  // Người thật khác đang ngồi cùng sofa (không tính khi đang trên sân khấu)
  function sofaMates(u) {
    const k = sofaKey(u.seat);
    if (k == null || u.stage) return [];
    return humans().filter((x) => x !== u && !x.stage && sofaKey(x.seat) === k);
  }
  function announceSofa(u) {
    const mates = sofaMates(u);
    if (!mates.length) return;
    const group = [u, ...mates];
    const key = sofaKey(u.seat) + ':' + group.map((x) => x.id).sort().join(',');
    if (Date.now() - (sofaAnnounced.get(key) || 0) < 10 * 60000) return;
    sofaAnnounced.set(key, Date.now());
    const kind = COL_TYPE[u.seat % 10] === 2 ? 'ghế đôi' : 'ghế ba';
    const names = group.map((x) => x.name);
    const list = names.length > 2 ? names.slice(0, -1).join(', ') + ' và ' + names.at(-1) : names.join(' và ');
    systemChat(`💞 ${list} đang ngồi chung ${kind} — mỗi phút xem phim cùng nhau được thêm +${SOFA_BONUS} 🍿!`);
  }
  function bots() { return [...users.values()].filter((u) => u.bot); }
  function freeSeats() {
    const out = [];
    seats.forEach((s, i) => { if (!s) out.push(i); });
    return out;
  }
  function bestSeat(list) {
    // Ưu tiên các hàng giữa, ghế giữa (nhìn màn hình đẹp nhất)
    const score = (i) => Math.abs(Math.floor(i / 10) - 4) * 2 + Math.abs((i % 10) - 4.5) + Math.random() * 3;
    return [...list].sort((a, b) => score(a) - score(b))[0];
  }
  // Thứ tự hàng chờ: video đã "chen" lên trước (theo thời điểm chen), còn lại theo số phiếu
  function sortedQueue() {
    return [...queue].sort((a, b) => {
      if (!!a.boostedAt !== !!b.boostedAt) return a.boostedAt ? -1 : 1;
      if (a.boostedAt && b.boostedAt) return a.boostedAt - b.boostedAt;
      return b.voters.size - a.voters.size || a.addedAt - b.addedAt;
    });
  }
  function queuePayload() {
    return sortedQueue().map((q) => ({
      id: q.id, videoId: q.videoId, title: q.title, author: q.author || '', duration: q.duration || null,
      energetic: !!q.energetic, bpm: q.bpm || null, mood: q.mood || 'normal', boosted: !!q.boostedAt,
      byId: q.byId, byName: q.byName, votes: q.voters.size, voters: [...q.voters],
    }));
  }
  // Số phiếu cần: phải TRÊN 35% số người thật đang ở trong phòng (bot không tính).
  // 1 người → 1 · 2 người → 1 (50%) · 3 người → 2 · 10 người → 4 · 20 người → 8
  // chỉ tính những người được quyền vote (tài khoản đủ tuổi + đã xem đủ lâu), tài khoản clone mới tạo không làm tăng số phiếu cần
  function voters() { return humans().filter((u) => !voteBlock(u, isHost(u))); }
  function skipNeeded() {
    return Math.floor((voters().length * SKIP_PERCENT) / 100) + 1;
  }
  function skipPayload() {
    const online = voters().length;
    return {
      count: skipVotes.size, needed: skipNeeded(), voters: [...skipVotes],
      online, present: humans().length, percent: online ? Math.round((skipVotes.size / online) * 100) : 0, threshold: SKIP_PERCENT,
    };
  }
  function fullState() {
    return {
      users: [...users.values()].map(publicUser),
      queue: queuePayload(),
      current,
      voting,
      skip: skipPayload(),
      screenPost: showingPost,
      moments: moments.view(current && current.videoId),
      serverNow: Date.now(),
      totalSeats: TOTAL_SEATS,
      room: info(),
      chat: chatState(),
    };
  }
  // ---------------- BOT NGỒI SẴN ----------------
  function addBot() {
    const free = freeSeats();
    if (!free.length) return;
    const used = new Set([...users.values()].map((u) => u.name.toLowerCase()));
    const names = BOT_NAMES.filter((n) => !used.has(n.toLowerCase()));
    if (!names.length) return;
    const bot = {
      id: 'bot-' + uid(), name: pick(names), character: pick(CHARACTERS), seat: pick(free), bot: true, stage: null,
      outfit: wardrobe.randomOutfit(), tier: Math.floor(Math.random() * 3),
    };
    users.set(bot.id, bot);
    seats[bot.seat] = bot.id;
    broadcast('user-joined', publicUser(bot));
  }
  function removeUserFromRoom(u) {
    leaveStage(u, true);
    clearTimeout(u.giftTimer);
    users.delete(u.id);
    if (seats[u.seat] === u.id) seats[u.seat] = null;
    broadcast('user-left', { id: u.id });
  }
  // Số bot mong muốn: ngẫu nhiên BOT_MIN–BOT_MAX, đổi sau mỗi vài phút
  let botTarget = randInt(BOT_MIN, BOT_MAX);
  if (isMain) (function rerollBots() {
    setTimeout(() => { botTarget = randInt(BOT_MIN, BOT_MAX); rerollBots(); }, randInt(BOT_REROLL_MIN[0], BOT_REROLL_MIN[1]) * 60000);
  })();
  function botWant() {
    if (!isMain) return 0; // phòng riêng không có bot
    return Math.max(0, Math.min(botTarget, BOT_NAMES.length, TOTAL_SEATS - humans().length - MIN_FREE_SEATS));
  }
  // instant = true: lấp đầy ngay (lúc mở rạp); còn lại chỉ bớt bot ngay khi cần chỗ cho người thật
  function ensureBots(instant = false) {
    const want = botWant();
    const list = bots();
    while (list.length > want) removeUserFromRoom(list.splice(Math.floor(Math.random() * list.length), 1)[0]);
    if (instant) for (let i = list.length; i < want; i++) addBot();
  }
  // bot vào / ra rạp từng người một (cách nhau vài giây), trông như khách thật
  if (isMain) every(() => {
    const n = bots().length, want = botWant();
    if (n < want && Math.random() < 0.7) addBot();
    else if (n > want && Math.random() < 0.5) {
      const list = bots().filter((b) => !b.stage);
      if (list.length) removeUserFromRoom(pick(list));
    }
  }, 5000);
  const recentBotLines = [];
  function botChatOnce() {
    const list = bots();
    if (!humans().length || !list.length || !botLines.length) return;
    // không lặp lại những câu vừa nói gần đây
    const avoid = Math.min(recentBotLines.length, Math.floor(botLines.length / 2));
    const recent = new Set(recentBotLines.slice(-avoid));
    const pool = botLines.filter((l) => !recent.has(l));
    const line = pick(pool.length ? pool : botLines);
    recentBotLines.push(line);
    if (recentBotLines.length > 30) recentBotLines.shift();
    const people = humans();
    const text = line.replace(/\{ten\}/gi, () => pick(people).name);
    const b = pick(list);
    broadcast('chat', { id: b.id, name: b.name, character: b.character, tier: b.tier || 0, badges: '', text, at: Date.now() });
  }
  if (isMain) (function scheduleBotChat() {
    if (!BOT_CHAT_MAX_S) return;
    const wait = (BOT_CHAT_MIN_S + Math.random() * (BOT_CHAT_MAX_S - BOT_CHAT_MIN_S)) * 1000;
    setTimeout(() => { botChatOnce(); scheduleBotChat(); }, wait);
  })();
  // Bot thỉnh thoảng đổi chỗ, nhún nhảy, thả emoji, lên sân khấu
  if (isMain) every(() => {
    if (!humans().length) return;
    const list = bots();
    if (!list.length) return;
    const r = Math.random();
    if (r < 0.2) {
      const b = pick(list.filter((x) => !x.stage));
      const free = freeSeats();
      if (b && free.length) {
        seats[b.seat] = null;
        b.seat = pick(free);
        seats[b.seat] = b.id;
        broadcast('user-moved', { id: b.id, seat: b.seat });
      }
    }
    if (!current) return;
    if (Math.random() < 0.25) broadcast('emote', { id: pick(list).id, kind: pick(['dance', 'dance', 'clap', 'wave']) });
    if (Math.random() < 0.15) broadcast('emoji', { id: pick(list).id, emoji: pick(['😂', '👏', '🔥', '😍', '🍿', '🥳']) });
    if (Math.random() < 0.05) goStage(pick(list));
  }, 4000);
  // ---------------- SÂN KHẤU ----------------
  function goStage(u) {
    if (u.stage) return { ok: false, error: 'Bạn đang ở trên sân khấu rồi!' };
    const free = stageSpots.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
    if (!free.length) return { ok: false, error: 'Sân khấu kín chỗ rồi, đợi chút nhé!' };
    const spot = pick(free);
    stageSpots[spot] = u.id;
    u.stage = { spot, until: Date.now() + STAGE_MS };
    u.stageTimer = setTimeout(() => leaveStage(u), STAGE_MS);
    broadcast('user-stage', { id: u.id, stage: u.stage });
    return { ok: true, stage: u.stage };
  }
  // Pháo sáng: sân khấu đủ người liên tục 30 giây thì phun (cả rạp thấy cùng lúc)
  let stageFullSince = null;
  let lastPyro = 0;
  every(() => {
    const n = stageSpots.filter(Boolean).length;
    const now = Date.now();
    // phòng riêng ít người: đủ cả nhóm (tối thiểu 2 người) cùng lên sân khấu là được
    const need = isMain ? Math.min(PYRO_DANCERS, STAGE_SPOTS) : Math.max(2, Math.min(PYRO_DANCERS, STAGE_SPOTS, humans().length));
    if (n < need) { stageFullSince = null; return; }
    if (!stageFullSince) { stageFullSince = now; lastPyro = now; return; }
    if (now - lastPyro >= PYRO_EVERY_MS) {
      lastPyro = now;
      broadcast('pyro', { at: now + 400, duration: PYRO_MS });
      systemChat(`🎆 Sân khấu kín ${n} người quẩy ${Math.round(PYRO_EVERY_MS / 1000)} giây — PHÁO SÁNG!`);
    }
  }, 1000);

  function leaveStage(u, silent) {
    if (!u.stage) return;
    clearTimeout(u.stageTimer);
    if (stageSpots[u.stage.spot] === u.id) stageSpots[u.stage.spot] = null;
    u.stage = null;
    if (!silent) broadcast('user-stage', { id: u.id, stage: null });
  }
  // ---------------- ĐIỀU KHIỂN PHÁT ----------------
  let momentsTimer = null;
  function scheduleMoments() {
    if (momentsTimer) return;
    momentsTimer = setTimeout(() => {
      momentsTimer = null;
      if (current) broadcast('moments', moments.view(current.videoId));
    }, 2500);
  }

  function broadcastNow(reason) {
    broadcast('now-playing', { current, voting, serverNow: Date.now(), reason: reason || null, moments: moments.view(current && current.videoId) });
  }

  function finishVideo(reason) {
    clearTimeout(endTimer);
    endTimer = null;
    skipVotes = new Set();
    // Video chiếu hết tự nhiên: phát lại 10 giây cả rạp thả cảm xúc nhiều nhất
    if (reason === 'ended' && current && !current.replay) {
      const hot = hotMoment(current);
      if (hot) {
        current = { ...current, replay: hot, startedAt: Date.now() + 1500 - hot.from * 1000 };
        endTimer = setTimeout(() => finishVideo('replay-end'), 1500 + hot.seconds * 1000);
        broadcastNow('replay');
        broadcast('skip', skipPayload());
        const mm = Math.floor(hot.from / 60), ss = String(hot.from % 60).padStart(2, '0');
        systemChat(`⏪ Xem lại khoảnh khắc hot nhất: phút ${mm}:${ss}, cả rạp thả ${hot.count} ${hot.emoji}!`);
        return;
      }
    }
    if (queue.length >= 2) startVoting(reason);
    else playNext(reason);
  }

  function startVoting(reason) {
    current = null;
    clearTimeout(voteTimer);
    voting = { endsAt: Date.now() + VOTE_SECONDS * 1000 };
    voteTimer = setTimeout(() => playNext('vote'), VOTE_SECONDS * 1000);
    broadcastNow(reason);
    broadcast('skip', skipPayload());
    systemChat(`🗳️ Bình chọn video tiếp theo! Còn ${VOTE_SECONDS} giây, bấm 👍 ở hàng chờ nhé.`);
  }

  function playNext(reason) {
    clearTimeout(endTimer);
    clearTimeout(voteTimer);
    endTimer = null;
    voting = null;
    skipVotes = new Set();
    const next = sortedQueue()[0];
    if (!next) {
      current = null;
    } else {
      queue = queue.filter((q) => q.id !== next.id);
      current = {
        videoId: next.videoId,
        title: next.title,
        author: next.author || '',
        byId: next.byId,
        byName: next.byName,
        energetic: !!next.energetic,
        mood: next.mood || 'normal',
        bpm: next.bpm || 128,
        startedAt: Date.now() + START_DELAY_MS,
        duration: null,
      };
      // Phòng trường hợp không ai báo thời lượng: tự chuyển sau tối đa MAX_VIDEO_MINUTES
      endTimer = setTimeout(() => finishVideo('timeout'), MAX_VIDEO_MINUTES * 60000);
      if (next.duration) setDuration(next.duration);
    }
    broadcastNow(reason);
    broadcast('queue', queuePayload());
    broadcast('skip', skipPayload());
    if (current) {
      stats.play(current.videoId, current.title, humans().length);
      systemChat(`🎬 Đang chiếu: "${current.title}" (đề xuất bởi ${current.byName})`);
      const proposer = users.get(next.byId);
      if (proposer && proposer.username) addPoints(proposer, wardrobe.POINTS.suggestionPlayed, 'video bạn đề xuất được chiếu');
    }
  }

  function setDuration(seconds) {
    if (!current || current.duration) return;
    if (seconds > MAX_VIDEO_MINUTES * 60) {
      systemChat('⏩ Video dài quá ' + MAX_VIDEO_MINUTES / 60 + ' tiếng, chuyển sang video tiếp theo.');
      return finishVideo('too-long');
    }
    current.duration = seconds;
    broadcast('duration', { videoId: current.videoId, duration: seconds });
    clearTimeout(endTimer);
    const msLeft = current.startedAt + seconds * 1000 + 2500 - Date.now();
    endTimer = setTimeout(() => finishVideo('ended'), Math.max(1000, msLeft));
  }

  function checkSkip() {
    if (current && skipVotes.size > 0 && skipVotes.size >= skipNeeded()) {
      systemChat('⏭️ Cả rạp đã bình chọn bỏ qua video này.');
      finishVideo('skipped');
    } else {
      broadcast('skip', skipPayload());
    }
  }

  // ---------------- CHIẾU ẢNH LÊN MÀN HÌNH ----------------
  function showNextPost() {
    if (showingPost) return;
    const p = postQueue.shift();
    if (!p) { broadcast('screen-post', null); return; }
    showingPost = { id: p.id, text: p.text, byName: p.byName, seconds: p.seconds, endsAt: Date.now() + p.seconds * 1000 };
    broadcast('screen-post', showingPost);
    setTimeout(() => {
      const oldId = showingPost.id;
      showingPost = null;
      setTimeout(() => posts.delete(oldId), 60000);
      showNextPost();
    }, p.seconds * 1000);
  }
  // ---------------- ĐOÁN MINI ----------------
  // chủ rạp (hostUsers) ở mọi phòng; trong phòng riêng thì chủ phòng cũng là "chủ rạp"
  const isHost = (u) => !!(u && u.username && (config.hostUsers.includes(u.username) || u.username === ownerUsername));
  // Người được điều khiển câu đoán: chủ rạp, hoặc chính người tạo câu đoán
  const canManagePoll = (u) => isHost(u) || (u && pollStore.owner() === u.id);
  // Người được tạo câu đoán: chủ rạp, hoặc người gửi video đang chiếu
  const canCreatePoll = (u) => isHost(u) || !!(u && current && current.byId === u.id);
  function broadcastPoll() {
    for (const c of clients.values()) if (c.room === room || (!c.room && isMain)) send(c.ws, 'poll', pollStore.view(c.user ? c.user.id : null));
    schedulePollTimer();
  }
  let pollTimer = null;
  function schedulePollTimer() {
    clearTimeout(pollTimer);
    const at = pollStore.nextChange();
    if (at) pollTimer = setTimeout(broadcastPoll, Math.max(200, at - Date.now() + 100));
  }
  function tick() {
    if (!current || Date.now() < current.startedAt) return;
    if (!current.replay) stats.watchMinutes(current.videoId, humans().length);
    for (const u of humans()) {
      const acc = accounts.getAccount(u.username);
      if (!acc) continue;
      acc.watchSeconds = (acc.watchSeconds || 0) + POINTS_TICK_MS / 1000;
      acc.lastSeen = Date.now();
      const mult = engage.multiplier(); // Đêm phim: 🍿 x2
      const onSofa = sofaMates(u).length > 0;
      const reasons = [mult > 1 ? `xem Đêm phim (x${mult})` : 'xem phim'];
      if (onSofa) reasons.push('ngồi chung sofa với bạn 💞');
      addPoints(u, Math.round(wardrobe.POINTS.perMinute * mult) + (onSofa ? SOFA_BONUS : 0), reasons.join(' + '));
      engage.addStat(u.username, 'watch', 1);
      trackFor(u, 'watch', 1);
      if (onSofa) trackFor(u, 'sofa', 1);
      checkInviteDone(acc);
    }
  }
  const handlers = {
    seat(client, d) {
      const u = client.user;
      const seat = Number(d);
      if (!u || !Number.isInteger(seat) || seat < 0 || seat >= TOTAL_SEATS || seat === u.seat) return;
      if (rateLimited(client, 'seat', 800)) return;
      const occupantId = seats[seat];
      if (occupantId) {
        // Ghế có bot: bot nhường ghế (đổi chỗ với bạn)
        const bot = users.get(occupantId);
        if (!bot || !bot.bot) return;
        const oldSeat = u.seat;
        bot.seat = oldSeat;
        seats[oldSeat] = bot.id;
        u.seat = seat;
        seats[seat] = u.id;
        broadcast('user-moved', { id: bot.id, seat: bot.seat });
        broadcast('user-moved', { id: u.id, seat });
        announceSofa(u);
        return;
      }
      seats[u.seat] = null;
      seats[seat] = u.id;
      u.seat = seat;
      broadcast('user-moved', { id: u.id, seat });
      announceSofa(u);
    },

    chat(client, d) {
      const u = client.user;
      let text = cleanText(d, CHAT_MAX);
      if (!u || !text || rateLimited(client, 'chat', 600)) return;
      const mutedUntil = mutes.get(u.username) || 0;
      if (mutedUntil > Date.now()) {
        return send(client.ws, 'chat-blocked', { reason: `🔇 Bạn đang bị tắt chat, còn ${Math.ceil((mutedUntil - Date.now()) / 60000)} phút nữa.` });
      }
      if (chatLocked && !isHost(u)) return send(client.ws, 'chat-blocked', { reason: '🔒 Chủ rạp đang tạm khoá chat. Bạn vẫn thả emoji được nhé!' });
      text = moderation.clean(text); // che từ ngữ xấu thành ***
      broadcast('chat', { id: u.id, name: u.name, character: u.character, tier: u.tier || 0, badges: badgeText(u.username), text, at: Date.now() });
      trackFor(u, 'chat');
    },

    emoji(client, d) {
      const u = client.user;
      if (!u || !EMOJIS.has(d) || rateLimited(client, 'emoji', 300)) return;
      broadcast('emoji', { id: u.id, emoji: d });
      trackFor(u, 'emoji');
      // khoảnh khắc hot: ghi lại emoji theo giây của video đang chiếu
      if (current && !current.replay && Date.now() >= current.startedAt) {
        moments.record(current.videoId, (Date.now() - current.startedAt) / 1000, d);
        scheduleMoments();
      }
      // nhiều người cùng thả một emoji trong 3 giây: nổ một chùm lớn
      const n = moments.checkBurst(u.id, d, humans().length, id);
      if (n) broadcast('emoji-burst', { emoji: d, count: n });
    },

    emote(client, d) {
      const u = client.user;
      if (!u || !Object.hasOwn(EMOTES, d) || rateLimited(client, 'emote', 1000)) return;
      broadcast('emote', { id: u.id, kind: d });
      trackFor(u, 'emote');
    },

    stage(client, d, reply) {
      const u = client.user;
      if (!u) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
      if (rateLimited(client, 'stage', 1500)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      const r = goStage(u);
      if (r.ok) trackFor(u, 'stage');
      reply(r);
    },

    'stage-leave'(client) {
      if (client.user) leaveStage(client.user);
    },

    popcorn(client, d) {
      const u = client.user;
      if (!u || rateLimited(client, 'popcorn', 700)) return;
      const to = d && users.has(d.to) && d.to !== u.id ? d.to : null; // null = ném lên màn hình
      broadcast('popcorn', { from: u.id, to, seed: Math.floor(Math.random() * 1e9) });
      trackFor(u, 'popcorn');
      if (u.username) engage.addStat(u.username, 'popcorn', 1);
    },

    // Ném cà chua / hoa hồng lên màn hình
    throw(client, d) {
      const u = client.user;
      if (!u || !THROW_ITEMS.includes(d) || rateLimited(client, 'throw', 1200)) return;
      broadcast('throw', { from: u.id, item: d, seed: Math.floor(Math.random() * 1e9) });
      trackFor(u, 'popcorn');
    },
    'poll-create'(client, d, reply) {
      const u = client.user;
      if (!u || !u.username) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
      if (!canCreatePoll(u)) return reply({ ok: false, error: 'Chỉ chủ rạp hoặc người gửi video đang chiếu mới tạo được câu đoán.' });
      if (!isHost(u) && rateLimited(client, 'poll', 60000)) return reply({ ok: false, error: 'Đợi 1 phút rồi tạo câu đoán mới nhé.' });
      const pd = d || {};
      const r = pollStore.create(u, { ...pd, question: moderation.clean(String(pd.question || '')), options: Array.isArray(pd.options) ? pd.options.map((o) => moderation.clean(String(o))) : pd.options });
      if (r.error) { delete client.rate.poll; return reply({ ok: false, error: r.error }); }
      reply({ ok: true });
      broadcastPoll();
      systemChat(`🔮 ${u.name} vừa ra câu đoán: "${r.poll.question}" — đoán đúng được +${polls.POLL_REWARD} 🍿!`);
    },
    'poll-answer'(client, d, reply) {
      const u = client.user;
      if (!u) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
      if (rateLimited(client, 'pollans', 300)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      const r = pollStore.answer(u, d);
      if (r.error) return reply({ ok: false, error: r.error });
      reply({ ok: true, poll: pollStore.view(u.id) });
      broadcastPoll();
    },
    'poll-close'(client, d, reply) {
      const u = client.user;
      if (!canManagePoll(u)) return reply({ ok: false, error: 'Bạn không điều khiển câu đoán này.' });
      pollStore.close();
      reply({ ok: true });
      broadcastPoll();
    },
    'poll-reveal'(client, d, reply) {
      const u = client.user;
      if (!canManagePoll(u)) return reply({ ok: false, error: 'Bạn không điều khiển câu đoán này.' });
      const r = pollStore.reveal(d);
      if (r.error) return reply({ ok: false, error: r.error });
      reply({ ok: true });
      for (const w of r.winners) {
        const wu = users.get(w.id);
        if (wu && wu.username) addPoints(wu, polls.POLL_REWARD, 'đoán đúng 🔮');
      }
      const p = r.poll;
      systemChat(`🔮 Đáp án "${p.question}": ${p.options[p.correct]}. ${r.winners.length ? `${r.winners.length}/${p.answers.size} người đoán đúng, mỗi người +${polls.POLL_REWARD} 🍿!` : 'Không ai đoán đúng cả 😅'}`);
      broadcastPoll();
    },
    'poll-cancel'(client, d, reply) {
      const u = client.user;
      if (!canManagePoll(u)) return reply({ ok: false, error: 'Bạn không điều khiển câu đoán này.' });
      if (pollStore.cancel()) systemChat('🔮 Câu đoán đã được huỷ.');
      reply({ ok: true });
      broadcastPoll();
    },
    async 'add-video'(client, d, reply) {
      const u = client.user;
      if (!u) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
      const opts = typeof d === 'object' && d ? d : { url: d };
      const videoId = parseVideoId(opts.url);
      if (!videoId) return reply({ ok: false, error: 'Link YouTube không hợp lệ.' });
      if (rateLimited(client, 'add', 2000)) return reply({ ok: false, error: 'Từ từ thôi, đợi 2 giây nhé!' });
      if (queue.filter((q) => q.byId === u.id).length >= MAX_QUEUE_PER_USER) {
        return reply({ ok: false, error: `Mỗi người chỉ được có ${MAX_QUEUE_PER_USER} video trong hàng chờ.` });
      }
      if ((current && current.videoId === videoId) || queue.some((q) => q.videoId === videoId)) {
        return reply({ ok: false, error: 'Video này đã có trong hàng chờ hoặc đang chiếu rồi.' });
      }
      const info = await fetchVideoInfo(videoId);
      if (info.error) return reply({ ok: false, error: info.error });
      if (!users.has(u.id)) return; // người dùng đã thoát trong lúc chờ
      const bpm = Math.round(Number(opts.bpm));
      const mood = MOODS.includes(opts.mood) ? opts.mood : opts.energetic ? 'party' : 'normal';
      const item = {
        id: uid(), videoId, title: info.title, author: info.author, duration: info.duration,
        energetic: mood === 'party', mood, bpm: bpm >= 60 && bpm <= 180 ? bpm : 128,
        byId: u.id, byName: u.name, byUsername: u.username, voters: new Set([u.id]), likedBy: new Set(), addedAt: Date.now(), boostedAt: null,
      };
      queue.push(item);
      reply({ ok: true });
      systemChat(`➕ ${u.name} gửi video: "${item.title}"`);
      trackFor(u, 'submit');
      if (!current && !voting) playNext('first');
      else broadcast('queue', queuePayload());
    },

    // Chen video của mình lên đầu hàng chờ (tốn 🍿)
    boost(client, d, reply) {
      const u = client.user;
      const item = queue.find((q) => q.id === d);
      if (!u || !item) return reply({ ok: false, error: 'Không tìm thấy video.' });
      if (item.byId !== u.id) return reply({ ok: false, error: 'Bạn chỉ chen được video của mình.' });
      if (item.boostedAt) return reply({ ok: false, error: 'Video này đã được chen rồi.' });
      if (rateLimited(client, 'boost', 400)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      const acc = accounts.getAccount(u.username);
      const err = acc && spend(acc, wardrobe.PRICES.boost, 'Chen video');
      if (!acc || err) return reply({ ok: false, error: err || 'Lỗi tài khoản.' });
      item.boostedAt = Date.now();
      broadcast('queue', queuePayload());
      systemChat(`⚡ ${u.name} vừa chen "${item.title}" lên đầu hàng chờ!`);
      sendMe(u.username);
      reply({ ok: true });
    },

    vote(client, d) {
      const u = client.user;
      const item = queue.find((q) => q.id === d);
      if (!u || !item || rateLimited(client, 'vote', 250)) return;
      if (item.voters.has(u.id)) item.voters.delete(u.id);
      else {
        const why = voteBlock(u, isHost(u));
        if (why) return notice(client, why);
        if (!isHost(u) && sameIpVotes(item.voters, u.ip, users) >= VOTES_PER_IP) {
          return notice(client, `🗳️ Mạng của bạn đã có ${VOTES_PER_IP} phiếu cho video này rồi (mỗi wifi / mỗi nhà tối đa ${VOTES_PER_IP} phiếu).`);
        }
        item.voters.add(u.id);
        trackFor(u, 'vote', 1, item.id);
        // 👍 cho video của người khác: tính vào bảng xếp hạng "được yêu thích" của người gửi
        if (item.byId !== u.id && !u.bot && item.byUsername && !item.likedBy.has(u.id)) {
          item.likedBy.add(u.id);
          engage.addStat(item.byUsername, 'likes', 1);
        }
      }
      broadcast('queue', queuePayload());
    },
    'remove-video'(client, d) {
      const u = client.user;
      const item = queue.find((q) => q.id === d);
      if (!u || !item || item.byId !== u.id) return;
      queue = queue.filter((q) => q.id !== d);
      broadcast('queue', queuePayload());
    },

    skip(client) {
      const u = client.user;
      if (!u || !current || rateLimited(client, 'skip', 500)) return;
      if (skipVotes.has(u.id)) skipVotes.delete(u.id);
      else {
        const why = voteBlock(u, isHost(u));
        if (why) return notice(client, why);
        if (!isHost(u) && sameIpVotes(skipVotes, u.ip, users) >= VOTES_PER_IP) {
          return notice(client, `🗳️ Mạng của bạn đã có ${VOTES_PER_IP} phiếu bỏ qua rồi (mỗi wifi / mỗi nhà tối đa ${VOTES_PER_IP} phiếu).`);
        }
        skipVotes.add(u.id);
      }
      checkSkip();
    },

    // Người gửi video được tự chuyển sang bài tiếp theo
    'skip-own'(client) {
      const u = client.user;
      if (!u || !current || current.byId !== u.id || rateLimited(client, 'skip-own', 1000)) return;
      systemChat(`⏭️ ${u.name} đã chuyển sang bài tiếp theo.`);
      finishVideo('skipped');
    },

    // Trình duyệt báo thời lượng video khi bắt đầu phát
    duration(client, d) {
      if (!client.user || !current || !d || d.videoId !== current.videoId) return;
      const s = Number(d.duration);
      if (Number.isFinite(s) && s > 0) setDuration(s);
    },

    // Trình duyệt báo video đã hết
    ended(client, d) {
      if (!client.user || !current || d !== current.videoId || current.replay) return;
      const elapsed = (Date.now() - current.startedAt) / 1000;
      const minimum = current.duration ? current.duration - 5 : 15;
      if (elapsed >= minimum) finishVideo('ended');
    },

    // Video lỗi (bị chặn nhúng, bị xoá...)
    'video-error'(client, d) {
      if (!client.user || !current || !d || d.videoId !== current.videoId) return;
      if (rateLimited(client, 'verr', 3000)) return;
      systemChat(`⚠️ Không phát được "${current.title}" (mã lỗi ${Number(d.code) || '?'}). Chuyển video tiếp theo.`);
      finishVideo('error');
    },

    // ---- Bảng điều khiển của chủ rạp / chủ phòng ----
    'host-state'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      const now = Date.now();
      const muted = humans().filter((x) => (mutes.get(x.username) || 0) > now).map((x) => ({ id: x.id, name: x.name, until: mutes.get(x.username) }));
      reply({ ok: true, ...chatState(), muted, current: current ? { title: current.title, byName: current.byName } : null });
    },
    'host-skip'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      if (!current && !voting) return reply({ ok: false, error: 'Chưa có video nào đang chiếu.' });
      if (rateLimited(client, 'hostskip', 1500)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      systemChat(`⏭️ Chủ rạp ${u.name} đã chuyển bài.`);
      if (voting) playNext('host'); else finishVideo('skipped');
      reply({ ok: true });
    },
    'host-remove'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      const item = queue.find((q) => q.id === d);
      if (!item) return reply({ ok: false, error: 'Video không còn trong hàng chờ.' });
      queue = queue.filter((q) => q.id !== d);
      broadcast('queue', queuePayload());
      systemChat(`🗑️ Chủ rạp đã xoá "${item.title}" khỏi hàng chờ.`);
      reply({ ok: true });
    },
    'host-mute'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      const t = d && users.get(d.id);
      if (!t || t.bot) return reply({ ok: false, error: 'Người này không còn trong phòng.' });
      if (t.id === u.id) return reply({ ok: false, error: 'Không tự tắt chat của mình được.' });
      if (isHost(t)) return reply({ ok: false, error: 'Không tắt chat của chủ rạp được.' });
      const minutes = Number(d.minutes);
      const c = clientOfUser(t);
      if (!minutes) {
        mutes.delete(t.username);
        systemChat(`🔊 ${t.name} đã được mở chat lại.`);
        if (c) send(c.ws, 'chat-blocked', { reason: '🔊 Bạn đã được mở chat lại.', unmuted: true });
      } else {
        if (![5, 15, 60, 1440].includes(minutes)) return reply({ ok: false, error: 'Thời gian không hợp lệ.' });
        mutes.set(t.username, Date.now() + minutes * 60000);
        const label = minutes >= 1440 ? '1 ngày' : minutes >= 60 ? `${minutes / 60} giờ` : `${minutes} phút`;
        systemChat(`🔇 ${t.name} bị tắt chat ${label}.`);
        if (c) send(c.ws, 'chat-blocked', { reason: `🔇 Chủ rạp đã tắt chat của bạn ${label}.` });
      }
      reply({ ok: true });
    },
    'host-chatlock'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      chatLocked = !!d;
      broadcast('chat-state', chatState());
      systemChat(chatLocked ? '🔒 Chủ rạp đã tạm khoá chat. Mọi người vẫn thả emoji được nhé!' : '🔓 Chat đã mở lại.');
      reply({ ok: true, ...chatState() });
    },
    'host-pin'(client, d, reply) {
      const u = client.user;
      if (!isHost(u)) return reply({ ok: false, error: 'Chỉ chủ rạp mới dùng được.' });
      const text = moderation.clean(cleanText(d, CHAT_MAX));
      pinned = text ? { text, by: u.name, at: Date.now() } : null;
      broadcast('chat-state', chatState());
      if (pinned) systemChat(`📌 ${u.name} đã ghim: "${text}"`);
      reply({ ok: true, ...chatState() });
    },

    // Tặng quà cho người khác trong phòng (tốn 🍿)
    gift(client, d, reply) {
      const u = client.user;
      const g = d && GIFTS[d.gift];
      const to = d && users.get(d.to);
      if (!u || !g) return reply({ ok: false, error: 'Quà không hợp lệ.' });
      if (!to || to.bot) return reply({ ok: false, error: 'Người nhận không còn trong phòng.' });
      if (to.id === u.id) return reply({ ok: false, error: 'Không tự tặng quà cho mình được nhé 😄' });
      if (rateLimited(client, 'gift', 1500)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      const acc = accounts.getAccount(u.username);
      const err = acc && spend(acc, g.price, 'Tặng ' + g.name.toLowerCase());
      if (!acc || err) { delete client.rate.gift; return reply({ ok: false, error: err || 'Lỗi tài khoản.' }); }
      const now = Date.now();
      to.gifts = (to.gifts || []).filter((x) => x.until > now && !(g.hat && x.hat));
      to.gifts.push({ gift: d.gift, icon: g.icon, hat: g.hat || null, from: u.name, until: now + g.minutes * 60000 });
      to.gifts = to.gifts.slice(-5);
      liveGifts.set(to.username, to.gifts);
      scheduleGiftExpiry(to);
      broadcast('gift', { from: u.id, to: to.id, gift: d.gift, icon: g.icon, name: g.name, fromName: u.name, toName: to.name });
      broadcast('user-updated', publicUser(to));
      systemChat(`🎁 ${u.name} tặng ${to.name} ${g.name.toLowerCase()} ${g.icon}!`);
      sendMe(u.username);
      if (to.username) engage.addStat(to.username, 'gifts', 1);
      reply({ ok: true });
    },

    // Ngồi cạnh một người bạn trong cùng phòng
    'sit-near'(client, d, reply) {
      const u = client.user;
      const f = u && [...users.values()].find((x) => !x.bot && x.username === String(d || ''));
      if (!u || !f) return reply({ ok: false, error: 'Bạn ấy không ở trong phòng này.' });
      if (rateLimited(client, 'sitnear', 800)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
      const seat = seatNear(f.seat, u);
      if (seat == null) return reply({ ok: false, error: 'Quanh bạn ấy hết chỗ rồi 😢' });
      if (seat === u.seat) return reply({ ok: true, seat, already: true });
      delete client.rate.seat;
      handlers.seat(client, seat);
      reply({ ok: true, seat });
    },
  };


  // Tìm ghế gần một người nhất: ưu tiên cùng sofa, rồi cùng hàng, rồi hàng bên cạnh (ghế bot cũng được, bot sẽ nhường)
  function seatNear(target, me) {
    let best = null, bestScore = Infinity;
    const tr = Math.floor(target / 10), tc = target % 10, tk = sofaKey(target);
    for (let s = 0; s < TOTAL_SEATS; s++) {
      if (s === target) continue;
      const occ = seats[s] && users.get(seats[s]);
      if (occ && occ !== me && !occ.bot) continue;
      const r = Math.floor(s / 10), c = s % 10;
      let score = Math.abs(r - tr) * 3 + Math.abs(c - tc);
      if (tk != null && sofaKey(s) === tk) score -= 10;
      if (occ === me) score -= 0.5; // đang ngồi gần rồi thì thôi
      if (score < bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  // Quà hết hạn: gỡ khỏi nhân vật
  function scheduleGiftExpiry(u) {
    clearTimeout(u.giftTimer);
    const next = Math.min(...u.gifts.map((g) => g.until));
    if (!Number.isFinite(next)) return;
    u.giftTimer = setTimeout(() => {
      if (!users.has(u.id)) return;
      u.gifts = u.gifts.filter((g) => g.until > Date.now());
      broadcast('user-updated', publicUser(u));
      if (u.gifts.length) scheduleGiftExpiry(u);
    }, Math.max(500, next - Date.now() + 200));
  }

  function info() {
    return {
      id, name, isMain, locked: !!passHash, owner: ownerName, ownerUsername,
      people: humans().length, title: current ? current.title : null,
    };
  }

  // Vào phòng
  function join(client, acc, reply, extra = {}) {
    let free = freeSeats();
    if (!free.length) {
      // hết ghế trống: mời một bot ra về
      const b = bots()[0];
      if (b) { removeUserFromRoom(b); free = freeSeats(); }
    }
    if (!free.length) return reply({ ok: false, error: 'Phòng đã kín 100 ghế rồi 😢 Quay lại sau nhé!' });
    // tên trùng với bot đang ngồi: bot đó ra về
    for (const b of bots()) if (b.name.toLowerCase() === acc.displayName.toLowerCase()) removeUserFromRoom(b);
    const user = {
      id: acc.id, username: acc.username, name: acc.displayName, character: acc.character,
      outfit: acc.outfit, tier: wardrobe.tierOf(acc.points), seat: bestSeat(free), stage: null, room,
      gifts: (liveGifts.get(acc.username) || []).filter((g) => g.until > Date.now()),
      ip: client.ip || null, // chỉ dùng trên server để giới hạn số phiếu mỗi IP, không gửi cho ai
    };
    if (user.gifts.length) scheduleGiftExpiry(user);
    users.set(user.id, user);
    seats[user.seat] = user.id;
    client.user = user;
    client.room = room;
    client.token = crypto.randomBytes(18).toString('hex');
    tokens.set(client.token, user);
    acc.lastSeen = Date.now();
    db.save();
    room.emptySince = null;
    if ((mutes.get(acc.username) || 0) > Date.now()) setTimeout(() => send(client.ws, 'chat-blocked', { reason: `🔇 Bạn đang bị tắt chat, còn ${Math.ceil((mutes.get(acc.username) - Date.now()) / 60000)} phút nữa.` }), 1500);
    reply({ ok: true, me: publicUser(user), token: client.token, account: accounts.publicAccount(acc), state: fullState(), engage: engageState(acc), events: engage.eventsView(acc), isHost: isHost(user), poll: pollStore.view(user.id), room: info(), ...extra });
    broadcast('user-joined', publicUser(user), client.ws);
    broadcast('skip', skipPayload());
    systemChat(`👋 ${user.name} đã vào ${isMain ? 'rạp' : 'phòng'}, ngồi ghế ${seatLabel(user.seat)}.`);
    announceSofa(user);
    ensureBots();
    notifyFriendsOnline(user, room);
    broadcastRooms();
    stats.visit(acc.username, allHumans().length);
  }

  // Rời phòng (đóng trang, mất mạng, hoặc sang phòng khác)
  function leave(client, why = 'left') {
    const u = client.user;
    if (client.token) tokens.delete(client.token);
    client.user = null;
    client.room = null;
    client.token = null;
    if (!u) return;
    removeUserFromRoom(u);
    skipVotes.delete(u.id);
    let changed = false;
    for (const q of queue) if (q.voters.delete(u.id)) changed = true;
    systemChat(why === 'switch' ? `🚪 ${u.name} đã sang phòng khác.` : `🚪 ${u.name} đã rời ${isMain ? 'rạp' : 'phòng'}.`);
    if (changed) broadcast('queue', queuePayload());
    checkSkip();
    ensureBots();
    if (!humans().length) room.emptySince = Date.now();
    broadcastRooms();
    refreshFriendsOf(u.username);
  }

  function destroy() {
    timers.forEach(clearInterval);
    clearTimeout(endTimer);
    clearTimeout(voteTimer);
    clearTimeout(pollTimer);
    clearTimeout(momentsTimer);
    for (const u of users.values()) { clearTimeout(u.stageTimer); clearTimeout(u.giftTimer); }
    moments.forgetRoom(id);
  }

  // thông tin video đang chiếu (cho người dùng khác hỏi)
  const nowPlaying = () => current;
  // chiếu ảnh
  const postQueueFull = () => postQueue.length >= POST_QUEUE_MAX;
  function enqueuePost(p) {
    postQueue.push(p);
    const position = showingPost ? postQueue.length : 0;
    showNextPost();
    return position;
  }

  Object.assign(room, {
    users, humans, bots, handlers, join, leave, destroy, tick, info, fullState, broadcast, systemChat,
    ensureBots, publicView: info, nowPlaying, pollView: (uid) => pollStore.view(uid), isHost, postQueueFull, enqueuePost,
  });
  return room;

}

// ---------------- ĐIỂM 🍿 VÀ HẠNG ----------------
function clientOfUser(u) {
  for (const c of clients.values()) if (c.user === u) return c;
  return null;
}

function addPoints(u, amount, reason) {
  const acc = accounts.getAccount(u.username);
  if (!acc) return;
  const before = wardrobe.tierOf(acc.points);
  acc.points += amount;
  acc.balance = (acc.balance || 0) + amount;
  db.save();
  const tier = wardrobe.tierOf(acc.points);
  const c = clientOfUser(u);
  if (c) send(c.ws, 'me', { account: accounts.publicAccount(acc), gained: amount, reason });
  if (tier !== before) {
    u.tier = tier;
    const t = wardrobe.TIERS[tier];
    if (u.room) {
      u.room.broadcast('user-updated', publicUser(u));
      u.room.systemChat(`🎉 ${u.name} vừa lên hạng ${t.icon} ${t.name}!`);
    }
  }
}

// Trừ 🍿 còn dùng được. Trả về thông báo lỗi nếu không đủ.
function spend(acc, cost, what) {
  if (!cost) return null;
  if ((acc.balance || 0) < cost) return `${what} cần ${cost} 🍿, bạn còn ${acc.balance || 0} 🍿. Xem phim hoặc ủng hộ rạp để có thêm nhé!`;
  acc.balance -= cost;
  db.save();
  return null;
}
function sendMe(username, extra = {}) {
  const acc = accounts.getAccount(username);
  const u = allUsers().find((x) => x.username === username);
  const c = u && clientOfUser(u);
  if (c && acc) send(c.ws, 'me', { account: accounts.publicAccount(acc), ...extra });
}
// ---------------- ĐIỂM DANH / NHIỆM VỤ / XẾP HẠNG ----------------
function engageState(acc) {
  return { checkin: engage.checkinView(acc), missions: engage.missionsView(acc), claimable: engage.claimableCount(acc) };
}
function sendEngage(u) {
  const acc = accounts.getAccount(u.username);
  const c = clientOfUser(u);
  if (acc && c) send(c.ws, 'engage', engageState(acc));
}
// Ghi nhận hoạt động cho nhiệm vụ hằng ngày
function trackFor(u, type, n = 1, key = null) {
  if (!u || !u.username) return;
  const acc = accounts.getAccount(u.username);
  if (acc && engage.track(acc, type, n, key)) sendEngage(u);
}
function badgeText(username) {
  return engage.badgesOf(accounts.getAccount(username)).map((b) => b.icon).join(' ');
}
function broadcastEvents() {
  broadcastAll('events', engage.eventsView(null));
}

// Nhắc lịch chiếu: trước 10 phút và lúc bắt đầu
setInterval(() => {
  for (const { kind, event } of engage.dueNotifications()) {
    const subs = new Set(event.subscribers || []);
    for (const u of allHumans()) {
      if (!subs.has(u.username)) continue;
      const c = clientOfUser(u);
      if (c) send(c.ws, 'event-reminder', { kind, event: { id: event.id, title: event.title, startsAt: event.startsAt, multiplier: event.multiplier } });
    }
    if (kind === 'start') allChat(`🎬 ĐÊM PHIM "${event.title}" bắt đầu! Xem phim lúc này được 🍿 x${event.multiplier}.`);
    broadcastEvents();
  }
}, 15000);
// ---------------- MỜI BẠN BÈ ----------------
function onlineUserOf(username) {
  return allUsers().find((x) => x.username === username) || null;
}
function giveTo(acc, amount, reason) {
  const u = onlineUserOf(acc.username);
  if (u) return addPoints(u, amount, reason);
  acc.points += amount;
  acc.balance = (acc.balance || 0) + amount;
  db.save();
}
// Gọi ngay sau khi tạo tài khoản qua link mời
function applyInvite(newAcc, code) {
  const inviter = accounts.findByInviteCode(code);
  if (!inviter || inviter.username === newAcc.username) return null;
  const today = engage.dayKey();
  const inv = inviter.invites;
  if (inv.day !== today) { inv.day = today; inv.today = 0; }
  newAcc.invitedBy = inviter.username;
  inv.joined++;
  const rewarded = inv.today < INVITE_PER_DAY;
  if (rewarded) {
    inv.today++;
    newAcc.points += INVITE_BONUS;
    newAcc.balance += INVITE_BONUS;
    giveTo(inviter, INVITE_BONUS, `${newAcc.displayName} nhận lời mời của bạn`);
  }
  db.save();
  sendMe(inviter.username, { notice: `🤝 ${newAcc.displayName} vừa tạo tài khoản qua link mời của bạn${rewarded ? `: +${INVITE_BONUS} 🍿` : ''}. Rủ bạn ấy xem đủ ${INVITE_WATCH_MINUTES} phút để nhận Kính trái tim nhé!` });
  return { inviter, rewarded };
}
// Người được mời xem đủ giờ: người mời nhận thưởng + món đồ hiếm
function checkInviteDone(acc) {
  if (!acc.invitedBy || acc.inviteDone || (acc.watchSeconds || 0) < INVITE_WATCH_MINUTES * 60) return;
  acc.inviteDone = true;
  const inviter = accounts.getAccount(acc.invitedBy);
  if (!inviter) { db.save(); return; }
  inviter.invites.done++;
  const first = !inviter.unlocks.includes(INVITE_RARE_ITEM);
  if (first) inviter.unlocks.push(INVITE_RARE_ITEM);
  db.save();
  giveTo(inviter, INVITE_DONE_BONUS, `${acc.displayName} đã xem đủ ${INVITE_WATCH_MINUTES} phút`);
  sendMe(inviter.username, { notice: `🎁 ${acc.displayName} đã xem cùng rạp đủ ${INVITE_WATCH_MINUTES} phút! Bạn nhận +${INVITE_DONE_BONUS} 🍿${first ? ' và món hiếm 💘 Kính trái tim (vào Tủ đồ để mặc)' : ''}.` });
  if (first) allChat(`💘 ${inviter.displayName} vừa mở khoá món hiếm Kính trái tim nhờ rủ ${acc.displayName} vào rạp!`);
  sendMe(acc.username, {});
}
// Sang tuần mới: trao thưởng top 3 mỗi hạng mục của tuần trước
function checkWeekRollover() {
  const r = engage.rollover();
  if (!r) return;
  const lines = [];
  for (const cat of engage.LEADER_CATS) {
    (r.winners[cat.id] || []).forEach((w, i) => {
      const acc = accounts.getAccount(w.username);
      if (!acc) return;
      const prize = engage.LEADER_PRIZES[i] || 0;
      const u = onlineUserOf(acc.username);
      if (u) addPoints(u, prize, `đạt hạng ${i + 1} "${cat.name}" tuần trước`);
      else { acc.points += prize; acc.balance = (acc.balance || 0) + prize; db.save(); }
      if (i === 0) lines.push(`${cat.icon} ${cat.name}: ${acc.displayName}`);
    });
  }
  if (lines.length) allChat(`🏆 Kết quả xếp hạng tuần ${r.week}: ${lines.join(' · ')}. Chúc mừng các bạn!`);
}
checkWeekRollover();
setInterval(checkWeekRollover, 60000);

// Thống kê: cứ 5 phút ghi lại số người đang online (để biết giờ nào đông)
setInterval(() => stats.sample(allHumans().length), 5 * 60000);

// Mỗi phút có video đang chiếu: người thật trong từng phòng được cộng điểm (phòng riêng cũng tích 🍿)
setInterval(() => {
  for (const r of rooms.values()) r.tick();
}, POINTS_TICK_MS);


// ---------------- PHÒNG RIÊNG ----------------
function hashRoomPass(pw) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkRoomPass(room, pw) {
  const [salt, h] = room.passHash.split(':');
  const a = crypto.scryptSync(pw, salt, 32);
  const b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newRoomId() {
  let id;
  do { id = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(id));
  return id;
}
function roomList() {
  return [...rooms.values()].map((r) => r.info()).sort((a, b) => (b.isMain - a.isMain) || b.people - a.people);
}
let roomsTimer = null;
function broadcastRooms() {
  if (roomsTimer) return;
  roomsTimer = setTimeout(() => { roomsTimer = null; broadcastAll('rooms', roomList()); }, 800);
}
// Phòng riêng không còn ai trong vài phút thì tự đóng
setInterval(() => {
  for (const r of [...rooms.values()]) {
    if (r.isMain || r.humans().length) continue;
    if (r.emptySince && Date.now() - r.emptySince > ROOM_EMPTY_MINUTES * 60000) {
      r.destroy();
      rooms.delete(r.id);
      broadcastRooms();
    }
  }
}, 30000);

// ---------------- BẠN BÈ ----------------
// acc.friends = [{ u: tên đăng nhập, star: bạn thân? }] · acc.friendReqs = [tên đăng nhập gửi lời mời cho mình]
function friendsOf(acc) {
  if (!Array.isArray(acc.friends)) acc.friends = [];
  if (!Array.isArray(acc.friendReqs)) acc.friendReqs = [];
  return acc;
}
function roomBrief(r) {
  return { id: r.id, name: r.name, isMain: r.isMain, locked: !!r.passHash };
}
function friendsView(acc) {
  friendsOf(acc);
  const online = new Map(allHumans().map((u) => [u.username, u]));
  const list = acc.friends.map((f) => {
    const a = accounts.getAccount(f.u);
    if (!a) return null;
    const on = online.get(f.u);
    return {
      username: f.u, name: a.displayName, character: a.character, star: !!f.star, online: !!on,
      room: on ? roomBrief(on.room) : null, seat: on ? seatCode(on.seat) : null, lastSeen: a.lastSeen || null,
    };
  }).filter(Boolean);
  list.sort((a, b) => (b.online - a.online) || (b.star - a.star) || a.name.localeCompare(b.name, 'vi'));
  const requests = acc.friendReqs.map((n) => {
    const a = accounts.getAccount(n);
    return a ? { username: n, name: a.displayName, character: a.character } : null;
  }).filter(Boolean);
  return { list, requests };
}
function clientsOf(username) {
  return [...clients.values()].filter((c) => c.username === username);
}
function pushFriends(username) {
  const acc = accounts.getAccount(username);
  if (!acc) return;
  const view = friendsView(acc);
  for (const c of clientsOf(username)) send(c.ws, 'friends', view);
}
function friendNotice(username, text) {
  for (const c of clientsOf(username)) send(c.ws, 'friend-notice', { text });
}
// Ai có người này trong danh sách bạn bè: cập nhật trạng thái online (và báo nếu là bạn thân)
function refreshFriendsOf(username, joined = null) {
  for (const c of clients.values()) {
    if (!c.username || c.username === username) continue;
    const acc = accounts.getAccount(c.username);
    if (!acc || !Array.isArray(acc.friends)) continue;
    const f = acc.friends.find((x) => x.u === username);
    if (!f) continue;
    if (joined && f.star) send(c.ws, 'friend-online', { username, name: joined.user.name, room: roomBrief(joined.room), seat: seatCode(joined.user.seat), sameRoom: c.room === joined.room });
    send(c.ws, 'friends', friendsView(acc));
  }
}
function notifyFriendsOnline(user, room) {
  refreshFriendsOf(user.username, { user, room });
}
function makeFriends(a, b) {
  friendsOf(a); friendsOf(b);
  if (!a.friends.some((f) => f.u === b.username)) a.friends.push({ u: b.username, star: false });
  if (!b.friends.some((f) => f.u === a.username)) b.friends.push({ u: a.username, star: false });
  a.friendReqs = a.friendReqs.filter((n) => n !== b.username);
  b.friendReqs = b.friendReqs.filter((n) => n !== a.username);
  db.save();
}

// ---------------- API TÀI KHOẢN ----------------
function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); resolve(null); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// Chặn trang web khác gửi yêu cầu thay bạn (chỉ nhận JSON từ chính trang rạp)
function sameOrigin(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

const reservedNames = () => BOT_NAMES;

// Kiểm tra mật khẩu trang quản trị. Chỉ đếm lần nhập SAI (10 lần sai / 10 phút thì khoá tạm),
// để trang quản trị tự làm mới mỗi 15 giây không bị khoá nhầm.
function adminPassFrom(req) {
  const raw = String(req.headers['x-admin-password'] || '');
  try { return decodeURIComponent(raw); } catch { return raw; } // trang quản trị mã hoá để gửi được chữ có dấu
}
function adminOk(req, res, ip) {
  const key = 'adminfail:' + ip;
  // ngoài giới hạn theo IP, còn giới hạn chung: tổng 30 lần sai / 10 phút thì tạm khoá trang quản trị
  // (để kẻ xấu đổi nhiều IP cũng không dò được mật khẩu)
  if (accounts.peekLimited(key, 10) || accounts.peekLimited('adminfail:all', 30)) {
    json(res, 429, { ok: false, error: 'Bạn nhập sai mật khẩu nhiều lần quá. Đợi 10 phút rồi thử lại nhé.' });
    return false;
  }
  if (!config.adminPassword) {
    json(res, 401, { ok: false, error: 'Chủ rạp chưa đặt mật khẩu quản trị (adminPassword trong config.json hoặc biến ADMIN_PASSWORD). Đặt xong nhớ tắt rồi mở lại server.' });
    return false;
  }
  const given = adminPassFrom(req);
  if (!support.checkAdmin(given)) {
    if (given.trim()) { accounts.limited(key, 10, 600000); accounts.limited('adminfail:all', 30, 600000); } // ô trống không tính là nhập sai
    json(res, 401, { ok: false, error: 'Sai mật khẩu quản trị.' });
    return false;
  }
  return true;
}

// Đá một tài khoản ra khỏi rạp (mọi thiết bị) và xoá phiên đăng nhập
function kickUser(username, reason) {
  accounts.destroyUserSessions(username);
  for (const c of clients.values()) {
    if (c.username === username || (c.user && c.user.username === username)) {
      if (c.room) c.room.leave(c, 'left');
      send(c.ws, 'kicked', { reason });
      setTimeout(() => { try { c.ws.close(4003); } catch { /* bỏ qua */ } }, 50);
    }
  }
}
// Dữ liệu cho mục 🛡️ An ninh ở trang quản trị
function securityView() {
  const now = Date.now();
  const byIp = new Map();
  for (const a of accounts.allAccounts()) {
    if (!a.signupIp) continue;
    if (!byIp.has(a.signupIp)) byIp.set(a.signupIp, []);
    byIp.get(a.signupIp).push(a);
  }
  const online = new Map(); // ip -> số người đang trong rạp
  for (const c of clients.values()) if (c.user && c.ip) online.set(c.ip, (online.get(c.ip) || 0) + 1);
  const groups = [...byIp.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([gip, list]) => ({
      ip: gip,
      count: list.length,
      last24h: list.filter((a) => now - a.createdAt < 86400000).length,
      online: online.get(gip) || 0,
      blocked: !!guard.blockedReason(gip),
      accounts: list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map((a) => ({
        username: a.username, name: a.displayName, createdAt: a.createdAt,
        watched: Math.floor((a.watchSeconds || 0) / 60), points: a.points || 0, banned: !!guard.userBanned(a.username),
      })),
    }))
    .sort((a, b) => b.last24h - a.last24h || b.count - a.count)
    .slice(0, 60);
  const sec = db.data.security || {};
  const bannedUsers = Object.entries(sec.bannedUsers || {}).filter(([, b]) => !b.until || b.until > now).map(([username, b]) => ({ username, name: accounts.getAccount(username)?.displayName || username, ...b }));
  const recent = accounts.allAccounts().filter((a) => now - a.createdAt < 3600000).length;
  return { groups, bans: guard.listBans(), bannedUsers, recentSignups: recent, limits: guard.LIMITS, voteRule: { minAge: VOTE_MIN_AGE_MIN, minWatch: VOTE_MIN_WATCH_MIN, perIp: VOTES_PER_IP }, turnstile: !!(config.turnstileSiteKey && config.turnstileSecret) };
}

// Giới hạn tạo tài khoản theo IP (chỉ tính lần tạo thành công). Nhiều người dùng chung wifi/4G nên không siết quá.
const SIGNUP_PER_IP_HOUR = Number(process.env.SIGNUP_PER_IP_HOUR) || 3;
const SIGNUP_PER_IP_DAY = Number(process.env.SIGNUP_PER_IP_DAY) || 5;

// Kiểm tra mã "Tôi không phải robot" của Cloudflare Turnstile ở phía máy chủ (bắt buộc, chỉ gắn ô trên trang là chưa đủ)
async function verifyTurnstile(token, ip) {
  if (!token || typeof token !== 'string' || token.length > 4096) return false;
  try {
    const form = new URLSearchParams({ secret: config.turnstileSecret, response: token });
    if (ip && ip !== '?') form.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return !!d.success;
  } catch (e) {
    console.error('Không kiểm tra được Turnstile:', e.message);
    return false;
  }
}

async function handleApi(req, res, urlPath) {
  const ip = accounts.clientIp(req);
  const token = accounts.tokenFromReq(req);
  const me = accounts.accountFromToken(token);

  if (urlPath === '/api/auth/me' && req.method === 'GET') {
    return json(res, 200, { account: accounts.publicAccount(me), catalog: wardrobe.catalog });
  }
  if (urlPath === '/api/invite' && req.method === 'GET') {
    if (accounts.limited('invite:' + ip, 60, 600000)) return json(res, 429, { ok: false });
    const code = new URL(req.url, 'http://x').searchParams.get('code');
    const inviter = accounts.findByInviteCode(code);
    return json(res, 200, inviter ? { ok: true, name: inviter.displayName, bonus: INVITE_BONUS } : { ok: false });
  }
  if (urlPath === '/api/support' && req.method === 'GET') {
    if (!me) return json(res, 401, { ok: false, error: 'Bạn cần đăng nhập.' });
    return json(res, 200, { ok: true, ...support.info(me), account: accounts.publicAccount(me) });
  }
  if (urlPath === '/api/admin/events' && req.method === 'GET') {
    if (!adminOk(req, res, ip)) return;
    return json(res, 200, { ok: true, events: engage.eventsView(null) });
  }
  // ---- An ninh: soi tài khoản clone, khoá tài khoản, chặn IP ----
  if (urlPath === '/api/admin/security' && req.method === 'GET') {
    if (!adminOk(req, res, ip)) return;
    return json(res, 200, { ok: true, ...securityView() });
  }
  if (urlPath === '/api/admin/stats' && req.method === 'GET') {
    if (!adminOk(req, res, ip)) return;
    const days = Math.min(60, Math.max(7, Number(new URL(req.url, 'http://x').searchParams.get('days')) || 14));
    return json(res, 200, { ok: true, ...stats.view(days), onlineNow: allHumans().length, rooms: roomList().length });
  }
  if (urlPath === '/api/admin/support' && req.method === 'GET') {
    if (!adminOk(req, res, ip)) return;
    return json(res, 200, { ok: true, requests: support.listForAdmin(), supportEnabled: config.supportEnabled });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Không hỗ trợ.' });
  if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'Yêu cầu không hợp lệ.' });
  const body = await readJson(req);
  if (!body) return json(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' });

  if (urlPath === '/api/auth/signup') {
    if (!body.agree) return json(res, 400, { ok: false, error: 'Bạn cần đồng ý với nội quy rạp.' });
    if (accounts.peekLimited('signup:h:' + ip, SIGNUP_PER_IP_HOUR) || accounts.peekLimited('signup:d:' + ip, SIGNUP_PER_IP_DAY)) {
      return json(res, 429, { ok: false, error: 'Mạng của bạn đã tạo nhiều tài khoản quá, thử lại sau nhé.' });
    }
    if (accounts.limited('signuptry:' + ip, 30, 3600000)) return json(res, 429, { ok: false, error: 'Bạn thử quá nhiều lần, đợi một lúc nhé.' });
    if (config.turnstileSiteKey && config.turnstileSecret && !(await verifyTurnstile(body.turnstile, ip))) {
      return json(res, 400, { ok: false, error: 'Xác minh "Tôi không phải robot" chưa đạt, bạn thử lại nhé.', turnstile: true });
    }
    if (moderation.hasBad(String(body.displayName || '')) || moderation.hasBad(String(body.username || ''))) return json(res, 400, { ok: false, error: 'Tên có từ ngữ không phù hợp, chọn tên khác nhé.' });
    const r = accounts.createAccount(body, reservedNames());
    if (r.error) return json(res, 400, { ok: false, error: r.error });
    accounts.limited('signup:h:' + ip, SIGNUP_PER_IP_HOUR, 3600000);
    accounts.limited('signup:d:' + ip, SIGNUP_PER_IP_DAY, 86400000);
    r.account.signupIp = ip; // để chủ rạp soi tài khoản clone (không hiện cho người khác)
    r.account.lastIp = ip;
    db.save();
    if (body.invite) applyInvite(r.account, body.invite);
    const t = accounts.createSession(r.account.username);
    res.setHeader('Set-Cookie', accounts.sessionCookie(req, t));
    return json(res, 200, { ok: true, account: accounts.publicAccount(r.account) });
  }

  if (urlPath === '/api/auth/login') {
    const uname = String(body.username || '').toLowerCase();
    if (accounts.limited('login:' + ip, 20, 900000) || accounts.limited('login:' + ip + ':' + uname, 8, 900000)
      || accounts.peekLimited('loginfail:' + uname, 15)) { // tài khoản này bị nhập sai 15 lần (từ bất kỳ IP nào)
      return json(res, 429, { ok: false, error: 'Bạn thử sai nhiều lần quá, đợi 15 phút rồi thử lại nhé.' });
    }
    const r = accounts.login(body.username, body.password);
    if (r.error) { if (uname) accounts.limited('loginfail:' + uname, 15, 900000); return json(res, 401, { ok: false, error: r.error }); }
    const ban = guard.userBanned(r.account.username);
    if (ban) return json(res, 403, { ok: false, error: 'Tài khoản này đã bị chủ rạp khoá' + (ban.reason ? `: ${ban.reason}` : '.') });
    r.account.lastIp = ip; db.save();
    const t = accounts.createSession(r.account.username);
    res.setHeader('Set-Cookie', accounts.sessionCookie(req, t));
    return json(res, 200, { ok: true, account: accounts.publicAccount(r.account) });
  }

  if (urlPath === '/api/auth/logout') {
    accounts.destroySession(token);
    res.setHeader('Set-Cookie', accounts.clearCookie(req));
    return json(res, 200, { ok: true });
  }

  if (urlPath === '/api/support/request') {
    if (!me) return json(res, 401, { ok: false, error: 'Bạn cần đăng nhập.' });
    if (accounts.limited('support:' + me.username, 10, 3600000)) return json(res, 429, { ok: false, error: 'Bạn gửi nhiều yêu cầu quá, thử lại sau nhé.' });
    const r = support.createRequest(me, body.amount);
    if (r.error) return json(res, 400, { ok: false, error: r.error });
    return json(res, 200, { ok: true, ...support.info(me) });
  }

  if (urlPath === '/api/admin/events/create' || urlPath === '/api/admin/events/delete') {
    if (!adminOk(req, res, ip)) return;
    if (urlPath.endsWith('/delete')) {
      engage.deleteEvent(String(body.id || ''));
    } else {
      const r = engage.createEvent(body);
      if (r.error) return json(res, 400, { ok: false, error: r.error });
      allChat(`📅 Lịch chiếu mới: "${r.event.title}" lúc ${new Date(r.event.startsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}. Bấm 🎯 Nhiệm vụ → Lịch chiếu để được nhắc!`);
    }
    broadcastEvents();
    return json(res, 200, { ok: true, events: engage.eventsView(null) });
  }

  if (urlPath === '/api/admin/ban-user') {
    if (!adminOk(req, res, ip)) return;
    const username = String(body.username || '').toLowerCase();
    if (!accounts.getAccount(username)) return json(res, 404, { ok: false, error: 'Không có tài khoản này.' });
    if (body.ban) {
      if (config.hostUsers.includes(username)) return json(res, 400, { ok: false, error: 'Không khoá được tài khoản chủ rạp.' });
      guard.banUser(username, Number(body.minutes) || 0, body.reason);
      kickUser(username, 'Tài khoản của bạn đã bị chủ rạp khoá.');
    } else guard.unbanUser(username);
    return json(res, 200, { ok: true, ...securityView() });
  }
  if (urlPath === '/api/admin/ban-ip') {
    if (!adminOk(req, res, ip)) return;
    const target = String(body.ip || '').trim();
    if (!/^[0-9a-f:.]{3,45}$/i.test(target)) return json(res, 400, { ok: false, error: 'IP không hợp lệ.' });
    if (target === ip) return json(res, 400, { ok: false, error: 'Đây là IP của chính bạn, không chặn được.' });
    if (body.ban) {
      guard.banIp(target, Number(body.minutes) || 0, body.reason, 'admin');
      // khoá luôn các tài khoản tạo từ IP này (nếu chủ rạp chọn)
      if (body.alsoAccounts) {
        for (const a of accounts.allAccounts()) {
          if (a.signupIp === target && !config.hostUsers.includes(a.username)) { guard.banUser(a.username, Number(body.minutes) || 0, 'Tạo từ IP bị chặn'); kickUser(a.username, 'Tài khoản của bạn đã bị chủ rạp khoá.'); }
        }
      }
      // ngắt mọi kết nối đang mở từ IP này
      for (const c of clients.values()) if (c.ip === target) { send(c.ws, 'kicked', { reason: 'Kết nối của bạn đã bị chặn.' }); setTimeout(() => { try { c.ws.close(4003); } catch { /* bỏ qua */ } }, 50); }
    } else guard.unbanIp(target);
    return json(res, 200, { ok: true, ...securityView() });
  }

  if (urlPath === '/api/admin/support/decide') {
    if (!adminOk(req, res, ip)) return;
    const r = support.decide(String(body.id || ''), !!body.approve);
    if (r.error) return json(res, 400, { ok: false, error: r.error });
    const { request, account } = r;
    // báo ngay cho người ủng hộ nếu đang ở trong rạp
    const u = onlineUserOf(account.username);
    if (request.status === 'approved') {
      if (u) {
        const tier = wardrobe.tierOf(account.points);
        if (tier !== u.tier) { u.tier = tier; u.room.broadcast('user-updated', publicUser(u)); }
      }
      allChat(`💖 ${account.displayName} vừa ủng hộ rạp. Cảm ơn bạn rất nhiều!`);
      sendMe(account.username, { notice: `Chủ rạp đã duyệt ủng hộ ${request.amount.toLocaleString('vi-VN')}đ. Bạn nhận được ${request.points} 🍿!` });
    } else {
      sendMe(account.username, { notice: `Yêu cầu ủng hộ ${request.amount.toLocaleString('vi-VN')}đ chưa được xác nhận. Liên hệ chủ rạp nếu bạn đã chuyển tiền nhé.` });
    }
    return json(res, 200, { ok: true, request });
  }

  if (urlPath === '/api/profile') {
    if (!me) return json(res, 401, { ok: false, error: 'Bạn cần đăng nhập.' });
    if (accounts.limited('profile:' + me.username, 30, 60000)) return json(res, 429, { ok: false, error: 'Từ từ thôi nào!' });
    const displayName = accounts.cleanText(body.displayName ?? me.displayName, 20);
    if (!displayName) return json(res, 400, { ok: false, error: 'Bạn nhập biệt danh nhé!' });
    if (moderation.hasBad(displayName)) return json(res, 400, { ok: false, error: 'Biệt danh có từ ngữ không phù hợp, chọn tên khác nhé.' });
    if (accounts.displayNameTaken(displayName, me.username, reservedNames())) {
      return json(res, 400, { ok: false, error: 'Biệt danh này đã có người dùng, chọn tên khác nhé!' });
    }
    const { outfit, locked } = wardrobe.sanitizeOutfit(body.outfit ?? me.outfit, me.points, { unlocks: me.unlocks });
    if (locked.length) return json(res, 400, { ok: false, error: locked[0].unlock ? `"${locked[0].name}" là món hiếm: ${locked[0].hint}.` : `"${locked[0].name}" cần ${locked[0].points} điểm 🍿 mới mặc được.` });
    me.displayName = displayName;
    if (CHARACTERS.includes(body.character)) me.character = body.character;
    me.outfit = outfit;
    db.save();
    // đang ở trong rạp: cập nhật ngay cho mọi người thấy
    const u = onlineUserOf(me.username);
    if (u) {
      const oldName = u.name;
      u.name = me.displayName;
      u.character = me.character;
      u.outfit = me.outfit;
      u.room.broadcast('user-updated', publicUser(u));
      if (oldName !== u.name) u.room.systemChat(`✏️ ${oldName} đổi tên thành ${u.name}.`);
    }
    return json(res, 200, { ok: true, account: accounts.publicAccount(me) });
  }

  return json(res, 404, { ok: false, error: 'Không tìm thấy.' });
}

// ---------------- CHIẾU ẢNH (nhận ảnh qua HTTP) ----------------
function handlePostUpload(req, res, ip) {
  const token = req.headers['x-token'];
  const u = token && tokens.get(token);
  // Kiểm tra mọi điều kiện TRƯỚC khi đọc dữ liệu ảnh (không để kẻ phá gửi tệp nặng liên tục làm đầy bộ nhớ)
  const deny = (code, error) => { res.setHeader('Connection', 'close'); json(res, code, { ok: false, error }); req.resume(); };
  if (!u || !u.room) return deny(401, 'Bạn cần vào rạp trước.');
  const maxBody = POST_MAX_BYTES * 1.4 + 4096;
  const declared = Number(req.headers['content-length']);
  if (!declared || declared > maxBody) return deny(413, 'Ảnh quá lớn.');
  if (u.lastPost && Date.now() - u.lastPost < POST_COOLDOWN_MS) {
    return deny(429, `Đợi ${Math.ceil((POST_COOLDOWN_MS - (Date.now() - u.lastPost)) / 1000)} giây nữa mới gửi được ảnh tiếp nhé.`);
  }
  if (u.room.postQueueFull()) return deny(429, 'Đang có nhiều ảnh chờ chiếu quá, thử lại sau nhé.');
  const accPre = accounts.getAccount(u.username);
  if (!accPre) return deny(401, 'Bạn cần đăng nhập.');
  const minCost = wardrobe.postCost(POST_SECONDS[0]);
  if ((accPre.balance || 0) < minCost) return deny(402, `Chiếu ${POST_SECONDS[0]} giây cần ${minCost} 🍿, bạn còn ${accPre.balance || 0} 🍿.`);
  if (!guard.uploadBegin(ip)) return deny(429, 'Đang có nhiều ảnh được gửi cùng lúc, thử lại sau vài giây nhé.');
  let done = false;
  const release = () => { if (!done) { done = true; guard.uploadEnd(ip); } };
  res.on('close', release);
  // gửi quá chậm (giữ kết nối): ngắt sau 20 giây
  req.setTimeout(20000, () => { release(); req.destroy(); });
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (c) => {
    size += c.length;
    if (size > maxBody) { aborted = true; release(); guard.strike(ip, 'gửi ảnh vượt dung lượng'); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('error', release);
  req.on('end', () => {
    release();
    if (aborted) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return json(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' }); }
    if (u.lastPost && Date.now() - u.lastPost < POST_COOLDOWN_MS) {
      const s = Math.ceil((POST_COOLDOWN_MS - (Date.now() - u.lastPost)) / 1000);
      return json(res, 429, { ok: false, error: `Đợi ${s} giây nữa mới gửi được ảnh tiếp nhé.` });
    }
    if (u.room.postQueueFull()) return json(res, 429, { ok: false, error: 'Đang có nhiều ảnh chờ chiếu quá, thử lại sau nhé.' });
    const seconds = POST_SECONDS.includes(Number(body.seconds)) ? Number(body.seconds) : POST_SECONDS[0];
    const acc = accounts.getAccount(u.username);
    if (!acc) return json(res, 401, { ok: false, error: 'Bạn cần đăng nhập.' });
    const cost = wardrobe.postCost(seconds);
    if ((acc.balance || 0) < cost) return json(res, 402, { ok: false, error: `Chiếu ${seconds} giây cần ${cost} 🍿, bạn còn ${acc.balance || 0} 🍿.` });
    const m = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
    if (!m) return json(res, 400, { ok: false, error: 'Ảnh không hợp lệ.' });
    const buf = Buffer.from(m[1], 'base64');
    const mime = sniffImage(buf);
    if (!mime) return json(res, 400, { ok: false, error: 'Định dạng ảnh chưa hỗ trợ.' });
    if (buf.length > POST_MAX_BYTES) return json(res, 413, { ok: false, error: 'Ảnh quá lớn.' });
    const spendErr = spend(acc, cost, 'Chiếu ảnh');
    if (spendErr) return json(res, 402, { ok: false, error: spendErr });
    const id = uid();
    posts.set(id, { buf, mime });
    u.lastPost = Date.now();
    u.room.systemChat(`🖼️ ${u.name} vừa gửi một tấm ảnh lên màn chiếu!`);
    const position = u.room.enqueuePost({ id, text: moderation.clean(cleanText(body.text, 100)), byName: u.name, seconds });
    sendMe(u.username);
    json(res, 200, { ok: true, position, cost, account: accounts.publicAccount(acc) });
  });
}

// ---------------- PHỤC VỤ FILE GIAO DIỆN ----------------
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400); return res.end('Bad request');
  }
  if (urlPath === '/healthz') { res.writeHead(200); return res.end('ok'); }
  // chống phá hoại: IP bị chặn / gửi quá nhiều request
  const reqIp = accounts.clientIp(req);
  const blocked = guard.blockedReason(reqIp);
  if (blocked) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(blocked); }
  if (!guard.httpAllow(reqIp)) { res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' }); return res.end('Bạn tải trang quá nhiều lần, đợi 1 phút nhé.'); }
  if (urlPath === '/api/screen-post' && req.method === 'POST') return handlePostUpload(req, res, reqIp);
  if (urlPath.startsWith('/api/auth/') || urlPath === '/api/profile' || urlPath === '/api/invite' || urlPath.startsWith('/api/support') || urlPath.startsWith('/api/admin/')) {
    return handleApi(req, res, urlPath).catch((e) => { console.error(e); json(res, 500, { ok: false, error: 'Lỗi máy chủ.' }); });
  }
  const pm = /^\/api\/screen-post\/([a-z0-9]+)$/.exec(urlPath);
  if (pm) {
    const p = posts.get(pm[1]);
    if (!p) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': p.mime, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return res.end(p.buf);
  }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Không tìm thấy'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ---------------- XỬ LÝ TIN NHẮN TỪ NGƯỜI XEM ----------------
// Tin nhắn chung (không phụ thuộc phòng). Các tin trong phòng (chat, ghế, video...) nằm trong createRoom.
const handlers = {
  // Tín hiệu "vẫn còn đây" mỗi phút (giữ server miễn phí không bị ngủ khi đang xem)
  ka() {},

  // Đồng bộ đồng hồ (để mọi người xem đúng cùng một giây)
  time(client, d, reply) { reply(Date.now()); },

  // Vào rạp / chuyển phòng: d = { room: id phòng (bỏ trống = sảnh chính), password }
  join(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.', needLogin: true });
    if (guard.userBanned(acc.username)) return reply({ ok: false, error: 'Tài khoản này đã bị chủ rạp khoá.' });
    const wanted = d && d.room ? String(d.room) : 'main';
    const target = rooms.get(wanted);
    if (!target) return reply({ ok: false, error: 'Phòng này không còn nữa (có thể đã đóng vì không còn ai).', roomGone: true });
    if (client.user && client.room === target) {
      return reply({ ok: true, me: publicUser(client.user), token: client.token, state: target.fullState(), room: target.info(), isHost: target.isHost(client.user), poll: target.pollView(client.user.id) });
    }
    if (target.passHash && target.ownerUsername !== acc.username) {
      if (!d || !d.password) return reply({ ok: false, needPassword: true, room: target.info(), error: 'Phòng này có mật khẩu.' });
      if (rateLimited(client, 'roompass', 1500)) return reply({ ok: false, needPassword: true, room: target.info(), error: 'Từ từ thôi, đợi chút rồi thử lại nhé.' });
      if (!checkRoomPass(target, String(d.password))) return reply({ ok: false, needPassword: true, room: target.info(), error: 'Sai mật khẩu phòng.' });
    }
    if (client.room) client.room.leave(client, 'switch');
    // tài khoản đang ở trong rạp từ tab/thiết bị khác: mời phiên cũ ra
    for (const other of clients.values()) {
      if (other !== client && other.user && other.user.username === acc.username) {
        other.room.leave(other, 'left');
        send(other.ws, 'kicked', { reason: 'Tài khoản của bạn vừa vào rạp ở tab hoặc thiết bị khác.' });
        setTimeout(() => other.ws.close(4005), 50);
      }
    }
    target.join(client, acc, reply);
  },

  // Xem trước video trước khi thêm vào hàng chờ
  async preview(client, d, reply) {
    if (!client.user) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
    const videoId = parseVideoId(d);
    if (!videoId) return reply({ ok: false, error: 'Link YouTube không hợp lệ.' });
    if (rateLimited(client, 'preview', 800)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
    const info = await fetchVideoInfo(videoId);
    if (info.error) return reply({ ok: false, error: info.error });
    reply({ ok: true, videoId, title: info.title, author: info.author, duration: info.duration });
  },

  // ---- Điểm danh, nhiệm vụ, lịch chiếu, xếp hạng ----
  engage(client, d, reply) {
    const acc = client.user && accounts.getAccount(client.user.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
    reply({
      ok: true, ...engageState(acc), events: engage.eventsView(acc),
      leaderboard: engage.leaderboard((n) => accounts.getAccount(n), acc), badges: engage.badgesOf(acc),
    });
  },

  checkin(client, d, reply) {
    const u = client.user;
    const acc = u && accounts.getAccount(u.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
    const r = engage.doCheckin(acc);
    if (r.error) return reply({ ok: false, error: r.error });
    addPoints(u, r.reward, `điểm danh ngày ${r.streak}`);
    reply({ ok: true, reward: r.reward, streak: r.streak, ...engageState(acc) });
    if (r.streak > 1 && r.streak % 7 === 0) u.room.systemChat(`🔥 ${u.name} vừa điểm danh ${r.streak} ngày liên tiếp!`);
  },

  claim(client, d, reply) {
    const u = client.user;
    const acc = u && accounts.getAccount(u.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
    const r = engage.claimMission(acc, String(d || ''));
    if (r.error) return reply({ ok: false, error: r.error });
    addPoints(u, r.reward, `nhiệm vụ "${r.title}"`);
    reply({ ok: true, reward: r.reward, ...engageState(acc) });
  },

  remind(client, d, reply) {
    const acc = client.user && accounts.getAccount(client.user.username);
    if (!acc || !d) return reply({ ok: false, error: 'Bạn cần vào rạp trước.' });
    const r = engage.toggleReminder(acc, String(d.id || ''), !!d.on);
    if (r.error) return reply({ ok: false, error: r.error });
    reply({ ok: true, events: engage.eventsView(acc) });
  },

  // ---- Phòng riêng ----
  rooms(client, d, reply) {
    reply({ ok: true, rooms: roomList(), current: client.room ? client.room.id : null });
  },
  'room-create'(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    const name = cleanText(d && d.name, 30);
    if (name.length < 2) return reply({ ok: false, error: 'Tên phòng cần ít nhất 2 ký tự.' });
    if (moderation.hasBad(name)) return reply({ ok: false, error: 'Tên phòng có từ ngữ không phù hợp, đặt tên khác nhé.' });
    const pw = d && d.password ? String(d.password) : '';
    if (pw && (pw.length < 3 || pw.length > 30)) return reply({ ok: false, error: 'Mật khẩu phòng từ 3 đến 30 ký tự (hoặc để trống).' });
    const mine = [...rooms.values()].find((r) => r.ownerUsername === acc.username);
    if (mine) return reply({ ok: false, error: `Bạn đang có phòng "${mine.name}" rồi. Mỗi người mở 1 phòng một lúc thôi nhé.`, room: mine.info() });
    if (rooms.size - 1 >= MAX_ROOMS) return reply({ ok: false, error: 'Rạp đang có nhiều phòng riêng quá, thử lại sau nhé.' });
    if (rateLimited(client, 'roomcreate', 3000)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
    const id = newRoomId();
    const r = createRoom({ id, name, ownerUsername: acc.username, ownerName: acc.displayName, passHash: pw ? hashRoomPass(pw) : null });
    rooms.set(id, r);
    broadcastRooms();
    reply({ ok: true, room: r.info() });
  },

  // ---- Bạn bè ----
  friends(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    reply({ ok: true, ...friendsView(acc) });
  },
  'friend-request'(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    if (rateLimited(client, 'freq', 800)) return reply({ ok: false, error: 'Từ từ thôi nào!' });
    let target = null;
    if (d && d.id && client.room) {
      const u = client.room.users.get(d.id);
      if (u && !u.bot) target = accounts.getAccount(u.username);
    } else if (d && d.username) {
      target = accounts.getAccount(String(d.username).trim().toLowerCase());
    }
    if (!target) return reply({ ok: false, error: 'Không tìm thấy tài khoản này (nhập đúng tên đăng nhập nhé).' });
    if (target.username === acc.username) return reply({ ok: false, error: 'Không tự kết bạn với mình được 😄' });
    friendsOf(acc); friendsOf(target);
    if (acc.friends.some((f) => f.u === target.username)) return reply({ ok: false, error: `Bạn và ${target.displayName} đã là bạn bè rồi.` });
    if (acc.friendReqs.includes(target.username)) {
      // người kia đã mời mình trước: đồng ý luôn
      makeFriends(acc, target);
      friendNotice(target.username, `✅ ${acc.displayName} đã đồng ý kết bạn với bạn!`);
      pushFriends(target.username);
      return reply({ ok: true, accepted: true, ...friendsView(acc) });
    }
    if (target.friendReqs.includes(acc.username)) return reply({ ok: true, already: true });
    if (acc.friends.length >= MAX_FRIENDS) return reply({ ok: false, error: `Bạn đã có ${MAX_FRIENDS} bạn rồi.` });
    if (target.friendReqs.length >= MAX_FRIEND_REQUESTS) return reply({ ok: false, error: 'Người này đang có quá nhiều lời mời kết bạn.' });
    target.friendReqs.push(acc.username);
    db.save();
    friendNotice(target.username, `🤝 ${acc.displayName} muốn kết bạn với bạn. Mở "Bạn bè" để đồng ý nhé!`);
    pushFriends(target.username);
    reply({ ok: true, name: target.displayName });
  },
  'friend-respond'(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    friendsOf(acc);
    const n = String((d && d.username) || '');
    if (!acc.friendReqs.includes(n)) return reply({ ok: false, error: 'Lời mời không còn nữa.' });
    acc.friendReqs = acc.friendReqs.filter((x) => x !== n);
    const other = accounts.getAccount(n);
    if (d.accept && other) {
      if (acc.friends.length >= MAX_FRIENDS) return reply({ ok: false, error: `Bạn đã có ${MAX_FRIENDS} bạn rồi.` });
      makeFriends(acc, other);
      friendNotice(other.username, `✅ ${acc.displayName} đã đồng ý kết bạn với bạn!`);
      pushFriends(other.username);
    }
    db.save();
    reply({ ok: true, ...friendsView(acc) });
  },
  'friend-remove'(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    const n = String((d && d.username) || '');
    friendsOf(acc);
    acc.friends = acc.friends.filter((f) => f.u !== n);
    const other = accounts.getAccount(n);
    if (other) { friendsOf(other); other.friends = other.friends.filter((f) => f.u !== acc.username); pushFriends(n); }
    db.save();
    reply({ ok: true, ...friendsView(acc) });
  },
  'friend-star'(client, d, reply) {
    const acc = client.username && accounts.getAccount(client.username);
    if (!acc) return reply({ ok: false, error: 'Bạn cần đăng nhập trước.' });
    friendsOf(acc);
    const f = acc.friends.find((x) => x.u === String((d && d.username) || ''));
    if (!f) return reply({ ok: false, error: 'Người này chưa là bạn bè.' });
    f.star = !!d.on;
    db.save();
    reply({ ok: true, ...friendsView(acc) });
  },

};

// ---------------- WEBSOCKET ----------------
// Không cho kết nối chờ quá lâu (chống kiểu tấn công gửi request thật chậm để giữ server)
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 60;

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 16 * 1024,
  verifyClient(req) {
    const ip = accounts.clientIp(req);
    if (guard.blockedReason(ip)) return { code: 403 };
    // trang web khác không được mở kết nối tới rạp bằng tài khoản của người xem
    const origin = req.headers.origin;
    if (origin) { try { if (new URL(origin).host !== req.headers.host) return { code: 403 }; } catch { return { code: 403 }; } }
    if (!guard.wsOpen(ip)) return { code: 429 };
    req.guardIp = ip;
    return null;
  },
});

wss.on('connection', (ws, req) => {
  const acc = accounts.accountFromToken(accounts.tokenFromReq(req));
  const client = { id: uid(), ws, user: null, room: null, rate: {}, alive: true, token: null, username: acc ? acc.username : null, ip: req.guardIp || accounts.clientIp(req) };
  clients.set(ws, client);
  send(ws, 'hello', {
    id: client.id,
    account: accounts.publicAccount(acc),
    catalog: wardrobe.catalog,
    supportEnabled: config.supportEnabled,
    events: engage.eventsView(acc),
    poll: mainRoom().pollView(null),
    rooms: roomList(),
    gifts: GIFTS,
    pollSeconds: polls.POLL_SECONDS,
    invite: { bonus: INVITE_BONUS, minutes: INVITE_WATCH_MINUTES, doneBonus: INVITE_DONE_BONUS },
    chatMax: CHAT_MAX,
    maxQueuePerUser: MAX_QUEUE_PER_USER,
    state: mainRoom().fullState(),
    characters: CHARACTERS,
    emojiGroups: EMOJI_GROUPS,
    quickEmojis: QUICK_EMOJIS,
    postSeconds: POST_SECONDS,
    voteSeconds: VOTE_SECONDS,
    stageSpots: STAGE_SPOTS,
    turnstileSiteKey: config.turnstileSiteKey && config.turnstileSecret ? config.turnstileSiteKey : null,
  });

  ws.on('pong', () => { client.alive = true; });

  ws.on('message', async (raw) => {
    client.alive = true;
    // gửi dồn dập (hơn 40 tin/giây): ngắt kết nối
    if (!guard.wsMsgAllow(client)) { if (!client.cut) { client.cut = true; try { ws.close(4008); } catch { /* bỏ qua */ } } return; }
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const own = (h, k) => Object.prototype.hasOwnProperty.call(h, k);
    // tin chung trước, rồi tới tin trong phòng đang ngồi
    const handler = own(handlers, msg.t) ? handlers[msg.t] : client.room && own(client.room.handlers, msg.t) ? client.room.handlers[msg.t] : null;
    if (!handler) return;
    const reply = (data) => { if (msg.rid) send(ws, 'reply', { rid: msg.rid, data }); };
    try {
      await handler(client, msg.d, reply);
    } catch (e) {
      console.error('Lỗi xử lý', msg.t, e);
    }
  });

  ws.on('close', () => {
    if (client.closed) return;
    client.closed = true;
    guard.wsClose(client.ip);
    if (client.room) client.room.leave(client, 'left');
    clients.delete(ws);
  });
});

// Ngắt kết nối "chết" (mất mạng đột ngột) sau ~30 giây
setInterval(() => {
  for (const [ws, client] of clients) {
    if (!client.alive) { ws.terminate(); continue; }
    client.alive = false;
    ws.ping();
  }
}, 15000);

rooms.set('main', createRoom({ id: 'main', name: 'Sảnh chính', isMain: true }));
mainRoom().ensureBots(true);
server.listen(PORT, () => {
  console.log('🎬 Rạp phim đã mở cửa tại http://localhost:' + PORT);
  console.log(config.describe());
});