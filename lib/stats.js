// ===============================================================
//  THỐNG KÊ ĐƠN GIẢN CHO CHỦ RẠP
//  - Mỗi ngày: bao nhiêu người vào (không trùng), lượt vào, lúc đông nhất
//  - Theo giờ: trung bình bao nhiêu người online mỗi giờ (giờ Việt Nam) → biết giờ nào đông
//  - Video: chiếu bao nhiêu lần, tổng số phút người xem
//  Lưu trong data/db.json, giữ 60 ngày gần nhất và 300 video.
// ===============================================================
const db = require('./db');

const KEEP_DAYS = 60;
const MAX_VIDEOS = 300;
const VN = 7 * 3600 * 1000;
const dayKey = (t = Date.now()) => new Date(t + VN).toISOString().slice(0, 10);
const vnHour = (t = Date.now()) => new Date(t + VN).getUTCHours();

function store() {
  if (!db.data.stats) db.data.stats = { days: {}, videos: {} };
  return db.data.stats;
}
function today() {
  const s = store();
  const k = dayKey();
  if (!s.days[k]) {
    s.days[k] = { visitors: [], joins: 0, peak: 0, peakAt: null, hourSum: new Array(24).fill(0), hourCnt: new Array(24).fill(0) };
    const keys = Object.keys(s.days).sort();
    while (keys.length > KEEP_DAYS) delete s.days[keys.shift()];
  }
  return s.days[k];
}

// có người vào rạp (bất kỳ phòng nào)
function visit(username, onlineNow) {
  const d = today();
  d.joins++;
  if (!d.visitors.includes(username)) d.visitors.push(username);
  online(onlineNow);
  db.save();
}
// số người thật đang online: ghi lúc đông nhất trong ngày
function online(n) {
  const d = today();
  if (n > d.peak) { d.peak = n; d.peakAt = Date.now(); }
}
// lấy mẫu định kỳ (mỗi 5 phút) để tính trung bình theo giờ
function sample(n) {
  const d = today();
  const h = vnHour();
  d.hourSum[h] += n;
  d.hourCnt[h] += 1;
  online(n);
  db.save();
}
// một video bắt đầu chiếu
function play(videoId, title, viewers) {
  const s = store();
  const v = s.videos[videoId] || (s.videos[videoId] = { title, plays: 0, minutes: 0, peakViewers: 0, lastAt: 0 });
  v.title = title || v.title;
  v.plays++;
  v.peakViewers = Math.max(v.peakViewers, viewers || 0);
  v.lastAt = Date.now();
  const ids = Object.keys(s.videos);
  if (ids.length > MAX_VIDEOS) {
    ids.sort((a, b) => s.videos[a].lastAt - s.videos[b].lastAt).slice(0, ids.length - MAX_VIDEOS).forEach((id) => delete s.videos[id]);
  }
  db.save();
}
// mỗi phút: cộng số người đang xem video
function watchMinutes(videoId, viewers) {
  const v = store().videos[videoId];
  if (!v || !viewers) return;
  v.minutes += viewers;
  v.peakViewers = Math.max(v.peakViewers, viewers);
}

function view(days = 14) {
  const s = store();
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(Date.now() - i * 86400000);
    const d = s.days[k];
    list.push({ day: k, visitors: d ? d.visitors.length : 0, joins: d ? d.joins : 0, peak: d ? d.peak : 0 });
  }
  // trung bình người online theo giờ, gộp các ngày trong khoảng
  const sum = new Array(24).fill(0), cnt = new Array(24).fill(0);
  for (const { day } of list) {
    const d = s.days[day];
    if (!d) continue;
    for (let h = 0; h < 24; h++) { sum[h] += d.hourSum[h]; cnt[h] += d.hourCnt[h]; }
  }
  const hours = sum.map((v, h) => ({ hour: h, avg: cnt[h] ? Math.round((v / cnt[h]) * 10) / 10 : null }));
  const ranked = hours.filter((h) => h.avg != null && h.avg > 0).sort((a, b) => b.avg - a.avg);
  const videos = Object.entries(s.videos)
    .map(([id, v]) => ({ videoId: id, ...v }))
    .sort((a, b) => b.minutes - a.minutes || b.plays - a.plays)
    .slice(0, 10);
  const t = s.days[dayKey()];
  return {
    days: list,
    hours,
    bestHours: ranked.slice(0, 3).map((h) => h.hour),
    videos,
    today: { visitors: t ? t.visitors.length : 0, joins: t ? t.joins : 0, peak: t ? t.peak : 0, peakAt: t ? t.peakAt : null },
    accounts: Object.keys(db.data.accounts || {}).length,
  };
}

module.exports = { visit, online, sample, play, watchMinutes, view, dayKey };
