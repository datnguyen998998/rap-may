// ===============================================================
//  KHOẢNH KHẮC HOT: đếm emoji theo từng đoạn 5 giây của mỗi video.
//  Lưu lại để lần sau video được chiếu, ai vào cũng thấy đoạn nào cả rạp từng cười.
//  Đồng thời phát hiện "bùng nổ": nhiều người cùng thả một emoji trong 3 giây.
// ===============================================================
const db = require('./db');

const BUCKET_SECONDS = 5;      // mỗi cột trên biểu đồ gốc = 5 giây video
const MAX_VIDEOS = 300;        // chỉ nhớ 300 video gần nhất
const BURST_WINDOW_MS = 3000;  // cùng thả trong 3 giây
const BURST_COOLDOWN_MS = 8000;

function store() {
  if (!db.data.moments) db.data.moments = {};
  return db.data.moments;
}

function record(videoId, second, emoji) {
  if (!videoId || !(second >= 0)) return;
  const all = store();
  let v = all[videoId];
  if (!v) {
    v = all[videoId] = { at: Date.now(), b: {} };
    const ids = Object.keys(all);
    if (ids.length > MAX_VIDEOS) {
      ids.sort((a, b) => all[a].at - all[b].at).slice(0, ids.length - MAX_VIDEOS).forEach((id) => delete all[id]);
    }
  }
  v.at = Date.now();
  const k = Math.floor(second / BUCKET_SECONDS);
  const b = v.b[k] || (v.b[k] = { n: 0, e: {} });
  b.n++;
  b.e[emoji] = (b.e[emoji] || 0) + 1;
  db.save();
}

// Gửi cho trình duyệt: [[chỉ số đoạn, số emoji, emoji nhiều nhất], ...]
function view(videoId) {
  const v = videoId && store()[videoId];
  const list = [];
  if (v) {
    for (const [k, b] of Object.entries(v.b)) {
      const top = Object.entries(b.e).sort((a, c) => c[1] - a[1])[0];
      list.push([Number(k), b.n, top ? top[0] : '😂']);
    }
  }
  return { videoId: videoId || null, bucket: BUCKET_SECONDS, b: list };
}

// ---- Bùng nổ ----
const recentByRoom = new Map(); // phòng -> [{ at, userId, emoji }]
const lastBurst = new Map();      // phòng + emoji -> thời điểm nổ gần nhất

// Số người cần thả cùng lúc: 20% số người thật trong rạp, ít nhất 2, nhiều nhất 5
function burstNeeded(humanCount) {
  return Math.min(5, Math.max(2, Math.ceil(humanCount * 0.2)));
}

// Trả về số người cùng thả nếu vừa đủ để nổ, ngược lại null
function checkBurst(userId, emoji, humanCount, roomId = 'main') {
  const now = Date.now();
  const recent = (recentByRoom.get(roomId) || []).filter((r) => now - r.at < BURST_WINDOW_MS);
  recent.push({ at: now, userId, emoji });
  recentByRoom.set(roomId, recent);
  const key = roomId + ':' + emoji;
  if (now - (lastBurst.get(key) || 0) < BURST_COOLDOWN_MS) return null;
  const people = new Set(recent.filter((r) => r.emoji === emoji).map((r) => r.userId));
  if (people.size < burstNeeded(humanCount)) return null;
  lastBurst.set(key, now);
  return people.size;
}
function forgetRoom(roomId) {
  recentByRoom.delete(roomId);
}

module.exports = { BUCKET_SECONDS, record, view, checkBurst, burstNeeded, forgetRoom };
