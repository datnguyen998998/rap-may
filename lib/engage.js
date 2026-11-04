// ===============================================================
//  GIỮ CHÂN NGƯỜI XEM: điểm danh hằng ngày, nhiệm vụ hằng ngày,
//  lịch chiếu "Đêm phim", bảng xếp hạng tuần.
//  Ngày / tuần tính theo giờ Việt Nam (UTC+7), tuần bắt đầu từ thứ Hai.
// ===============================================================
const crypto = require('crypto');
const db = require('./db');

// ---------------- CẤU HÌNH (bạn có thể sửa) ----------------
const CHECKIN_REWARDS = [5, 10, 15, 20, 25, 30, 50]; // ngày 1 → ngày 7 của chuỗi (sau đó lặp lại)
const MISSIONS_PER_DAY = 3;
const MISSION_BONUS = 20;                            // làm xong tất cả nhiệm vụ trong ngày
const MISSION_POOL = [
  { id: 'watch30', type: 'watch', title: 'Xem phim 30 phút', target: 30, reward: 15, icon: '🎬', watch: true },
  { id: 'watch60', type: 'watch', title: 'Xem phim 60 phút', target: 60, reward: 30, icon: '🍿', watch: true },
  { id: 'submit1', type: 'submit', title: 'Gửi 1 video vào hàng chờ', target: 1, reward: 10, icon: '➕' },
  { id: 'vote3', type: 'vote', title: 'Bình chọn 👍 cho 3 video', target: 3, reward: 10, icon: '👍' },
  { id: 'popcorn5', type: 'popcorn', title: 'Ném bỏng ngô 5 lần', target: 5, reward: 5, icon: '🍿' },
  { id: 'emoji10', type: 'emoji', title: 'Thả 10 biểu tượng cảm xúc', target: 10, reward: 5, icon: '😂' },
  { id: 'chat5', type: 'chat', title: 'Gửi 5 tin nhắn trò chuyện', target: 5, reward: 10, icon: '💬' },
  { id: 'emote3', type: 'emote', title: 'Làm 3 động tác (nhảy, vẫy, vỗ tay)', target: 3, reward: 5, icon: '🙌' },
  { id: 'stage1', type: 'stage', title: 'Lên sân khấu quẩy 1 lần', target: 1, reward: 10, icon: '🎤' },
  { id: 'sofa10', type: 'sofa', title: 'Ngồi chung ghế đôi/ba với bạn 10 phút', target: 10, reward: 15, icon: '💞' },
];
const LEADER_CATS = [
  { id: 'watch', name: 'Mọt phim', unit: 'phút xem', icon: '🎬' },
  { id: 'likes', name: 'Đạo diễn được yêu thích', unit: '👍 nhận được', icon: '👍' },
  { id: 'popcorn', name: 'Thánh ném bỏng ngô', unit: 'lần ném', icon: '🍿' },
];
const LEADER_PRIZES = [100, 60, 40]; // 🍿 cho hạng 1, 2, 3 mỗi hạng mục
const RANK_ICONS = ['🥇', '🥈', '🥉'];

// ---------------- THỜI GIAN (giờ Việt Nam) ----------------
const VN = 7 * 3600 * 1000;
function dayKey(t = Date.now()) {
  return new Date(t + VN).toISOString().slice(0, 10);
}
function weekKey(t = Date.now()) {
  const d = new Date(t + VN);
  const dow = (d.getUTCDay() + 6) % 7; // thứ Hai = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function prevDay(key) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function store() {
  if (!db.data.engage) db.data.engage = { events: [], weekly: { week: weekKey(), stats: {} }, lastWinners: null };
  return db.data.engage;
}

// ---------------- ĐIỂM DANH ----------------
function checkinView(acc) {
  const today = dayKey();
  const c = acc.checkin || { last: null, streak: 0 };
  const done = c.last === today;
  const alive = done || c.last === prevDay(today);
  const streak = alive ? c.streak : 0;              // chuỗi hiện tại (bỏ ngày thì về 0)
  const nextDay = done ? streak : streak + 1;       // ngày thứ mấy nếu điểm danh hôm nay
  const idx = (nextDay - 1) % CHECKIN_REWARDS.length;
  return { done, streak, day: nextDay, cycleIndex: idx, reward: CHECKIN_REWARDS[idx], rewards: CHECKIN_REWARDS };
}

function doCheckin(acc) {
  const v = checkinView(acc);
  if (v.done) return { error: 'Hôm nay bạn đã điểm danh rồi, mai quay lại nhé!' };
  acc.checkin = { last: dayKey(), streak: v.day };
  db.save();
  return { reward: v.reward, streak: v.day };
}

// ---------------- NHIỆM VỤ HẰNG NGÀY ----------------
function pickMissions(day) {
  const h = crypto.createHash('sha256').update('missions:' + day).digest();
  const watch = MISSION_POOL.filter((m) => m.watch);
  const others = MISSION_POOL.filter((m) => !m.watch);
  const chosen = [watch[h[0] % watch.length]];
  const pool = [...others];
  for (let i = 1; chosen.length < MISSIONS_PER_DAY && pool.length; i++) {
    chosen.push(pool.splice(h[i] % pool.length, 1)[0]);
  }
  return chosen.map((m) => m.id);
}

function ensureDaily(acc) {
  const today = dayKey();
  if (!acc.daily || acc.daily.day !== today) {
    acc.daily = { day: today, missions: pickMissions(today), progress: {}, claimed: {}, bonus: false, voted: [] };
  }
  return acc.daily;
}

function missionsView(acc) {
  const d = ensureDaily(acc);
  const list = d.missions.map((id) => {
    const m = MISSION_POOL.find((x) => x.id === id);
    const progress = Math.min(m.target, d.progress[id] || 0);
    return { id, title: m.title, icon: m.icon, target: m.target, reward: m.reward, progress, done: progress >= m.target, claimed: !!d.claimed[id] };
  });
  const allClaimed = list.every((m) => m.claimed);
  return { day: d.day, list, bonus: { reward: MISSION_BONUS, claimable: allClaimed && !d.bonus, claimed: d.bonus } };
}

// Ghi nhận hoạt động. key dùng để không đếm trùng (ví dụ: cùng một video chỉ tính 1 lần bình chọn)
function track(acc, type, n = 1, key = null) {
  const d = ensureDaily(acc);
  if (type === 'vote' && key) {
    if (d.voted.includes(key)) return false;
    d.voted.push(key);
  }
  let changed = false;
  for (const id of d.missions) {
    const m = MISSION_POOL.find((x) => x.id === id);
    if (m.type !== type || d.claimed[id]) continue;
    const before = d.progress[id] || 0;
    if (before >= m.target) continue;
    d.progress[id] = Math.min(m.target, before + n);
    changed = true;
  }
  if (changed) db.save();
  return changed;
}

function claimMission(acc, id) {
  const d = ensureDaily(acc);
  if (id === 'bonus') {
    const v = missionsView(acc);
    if (!v.bonus.claimable) return { error: v.bonus.claimed ? 'Bạn đã nhận thưởng rồi.' : 'Hoàn thành và nhận hết nhiệm vụ trước đã nhé!' };
    d.bonus = true;
    db.save();
    return { reward: MISSION_BONUS, title: 'Hoàn thành tất cả nhiệm vụ' };
  }
  const m = MISSION_POOL.find((x) => x.id === id);
  if (!m || !d.missions.includes(id)) return { error: 'Không có nhiệm vụ này hôm nay.' };
  if (d.claimed[id]) return { error: 'Bạn đã nhận thưởng nhiệm vụ này rồi.' };
  if ((d.progress[id] || 0) < m.target) return { error: 'Nhiệm vụ chưa hoàn thành.' };
  d.claimed[id] = true;
  db.save();
  return { reward: m.reward, title: m.title };
}

// số phần thưởng đang chờ nhận (để hiện chấm đỏ trên nút)
function claimableCount(acc) {
  const v = missionsView(acc);
  return (checkinView(acc).done ? 0 : 1) + v.list.filter((m) => m.done && !m.claimed).length + (v.bonus.claimable ? 1 : 0);
}

// ---------------- LỊCH CHIẾU "ĐÊM PHIM" ----------------
function eventsView(acc) {
  const now = Date.now();
  const reminders = new Set((acc && acc.reminders) || []);
  return store().events
    .filter((e) => e.endsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 20)
    .map((e) => ({ id: e.id, title: e.title, desc: e.desc, startsAt: e.startsAt, endsAt: e.endsAt, multiplier: e.multiplier, live: e.startsAt <= now, reminded: reminders.has(e.id), subscribers: (e.subscribers || []).length }));
}
function liveEvent() {
  const now = Date.now();
  return store().events.find((e) => e.startsAt <= now && e.endsAt > now) || null;
}
function multiplier() {
  const e = liveEvent();
  return e ? e.multiplier : 1;
}
function createEvent({ title, desc, startsAt, minutes, multiplier: mult }) {
  title = String(title || '').trim().slice(0, 80);
  desc = String(desc || '').trim().slice(0, 200);
  startsAt = Number(startsAt);
  minutes = Math.round(Number(minutes) || 120);
  mult = Number(mult) || 2;
  if (!title) return { error: 'Bạn nhập tên buổi chiếu nhé.' };
  if (!Number.isFinite(startsAt) || startsAt < Date.now() - 60000) return { error: 'Thời gian bắt đầu phải ở tương lai.' };
  if (minutes < 15 || minutes > 600) return { error: 'Thời lượng từ 15 đến 600 phút.' };
  if (![1, 1.5, 2, 3].includes(mult)) return { error: 'Hệ số 🍿 chỉ được 1, 1.5, 2 hoặc 3.' };
  const e = { id: crypto.randomBytes(5).toString('hex'), title, desc, startsAt, endsAt: startsAt + minutes * 60000, multiplier: mult, subscribers: [], notifiedSoon: false, notifiedStart: false };
  store().events.push(e);
  store().events = store().events.filter((x) => x.endsAt > Date.now() - 7 * 86400000);
  db.save();
  return { event: e };
}
function deleteEvent(id) {
  const before = store().events.length;
  store().events = store().events.filter((e) => e.id !== id);
  db.save();
  return before !== store().events.length;
}
function toggleReminder(acc, id, on) {
  const e = store().events.find((x) => x.id === id);
  if (!e || e.endsAt < Date.now()) return { error: 'Buổi chiếu không còn.' };
  acc.reminders = (acc.reminders || []).filter((x) => x !== id && store().events.some((ev) => ev.id === x));
  e.subscribers = (e.subscribers || []).filter((u) => u !== acc.username);
  if (on) { acc.reminders.push(id); e.subscribers.push(acc.username); }
  db.save();
  return { ok: true };
}
// Trả về danh sách thông báo cần gửi: sắp bắt đầu (10 phút) / bắt đầu
function dueNotifications() {
  const now = Date.now();
  const out = [];
  for (const e of store().events) {
    if (!e.notifiedSoon && e.startsAt - now <= 10 * 60000 && e.startsAt > now) { e.notifiedSoon = true; out.push({ kind: 'soon', event: e }); }
    if (!e.notifiedStart && e.startsAt <= now && e.endsAt > now) { e.notifiedStart = true; e.notifiedSoon = true; out.push({ kind: 'start', event: e }); }
  }
  if (out.length) db.save();
  return out;
}

// ---------------- BẢNG XẾP HẠNG TUẦN ----------------
function weekly() {
  const s = store();
  if (!s.weekly || !s.weekly.stats) s.weekly = { week: weekKey(), stats: {} };
  return s.weekly;
}
function addStat(username, cat, n = 1) {
  const w = weekly();
  const st = w.stats[username] || (w.stats[username] = { watch: 0, likes: 0, popcorn: 0 });
  st[cat] = (st[cat] || 0) + n;
  db.save();
}
function ranking(stats, cat) {
  return Object.entries(stats)
    .filter(([, st]) => (st[cat] || 0) > 0)
    .sort((a, b) => b[1][cat] - a[1][cat])
    .map(([username, st]) => ({ username, value: st[cat] }));
}
// Sang tuần mới: tính người thắng tuần trước. Server sẽ trao thưởng.
function rollover() {
  const w = weekly();
  const now = weekKey();
  if (w.week === now) return null;
  const winners = {};
  for (const c of LEADER_CATS) winners[c.id] = ranking(w.stats, c.id).slice(0, 3);
  store().lastWinners = { week: w.week, winners };
  store().weekly = { week: now, stats: {} };
  db.save();
  return { week: w.week, newWeek: now, winners };
}
function leaderboard(accountsByName, me) {
  const w = weekly();
  const cats = LEADER_CATS.map((c) => {
    const r = ranking(w.stats, c.id);
    const top = r.slice(0, 10).map((x, i) => {
      const a = accountsByName(x.username);
      return { rank: i + 1, name: a ? a.displayName : x.username, character: a ? a.character : 'meo', value: x.value, me: me && x.username === me.username };
    });
    const myIdx = me ? r.findIndex((x) => x.username === me.username) : -1;
    return { ...c, top, mine: me ? { rank: myIdx >= 0 ? myIdx + 1 : null, value: myIdx >= 0 ? r[myIdx].value : 0 } : null };
  });
  const lw = store().lastWinners;
  const last = lw ? LEADER_CATS.map((c) => ({ ...c, winners: (lw.winners[c.id] || []).map((x, i) => ({ rank: i + 1, name: accountsByName(x.username)?.displayName || x.username, value: x.value })) })) : null;
  // ngày kết thúc tuần (Chủ nhật 23:59 giờ VN)
  const endsAt = new Date(w.week + 'T00:00:00Z').getTime() - VN + 7 * 86400000;
  return { week: w.week, endsAt, cats, prizes: LEADER_PRIZES, last, lastWeek: lw ? lw.week : null };
}

// Huy hiệu tuần này của một tài khoản (từ kết quả tuần trước), ví dụ "🥇🎬"
function badgesOf(acc) {
  const lw = store().lastWinners;
  if (!lw || !acc) return [];
  const out = [];
  for (const c of LEADER_CATS) {
    const i = (lw.winners[c.id] || []).findIndex((x) => x.username === acc.username);
    if (i >= 0) out.push({ icon: RANK_ICONS[i] + c.icon, title: `Top ${i + 1} ${c.name} tuần trước` });
  }
  return out;
}

module.exports = {
  CHECKIN_REWARDS, MISSION_BONUS, LEADER_CATS, LEADER_PRIZES, RANK_ICONS,
  dayKey, weekKey, checkinView, doCheckin, ensureDaily, missionsView, track, claimMission, claimableCount,
  eventsView, liveEvent, multiplier, createEvent, deleteEvent, toggleReminder, dueNotifications,
  addStat, rollover, leaderboard, badgesOf,
};
