// ===============================================================
//  ĐIỀU PHỐI: kết nối server, giao diện, rạp 3D, trình phát
// ===============================================================
import { Theater, AvatarPreview, seatInfo, SEAT_GROUPS } from './theater.js';
import { CHARACTER_INFO } from './avatars.js';
import { setTiers, tierInfo, TIERS } from './outfits.js';
import { CinemaPlayer } from './player.js';

const $ = (id) => document.getElementById(id);
const EMOTE_MS = { dance: 6000, wave: 3000, clap: 3000 };

// ---------------- KẾT NỐI WEBSOCKET (tự kết nối lại khi rớt mạng) ----------------
class Net {
  constructor() {
    this.handlers = {};
    this.pending = new Map();
    this.rid = 0;
    this.connect();
  }
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => this.emit('open');
    clearInterval(this.keepAlive);
    this.keepAlive = setInterval(() => this.send('ka'), 60000);
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'reply') {
        const p = this.pending.get(m.d.rid);
        if (p) { this.pending.delete(m.d.rid); p(m.d.data); }
        return;
      }
      this.emit(m.t, m.d);
    };
    ws.onclose = () => {
      if (ws !== this.ws) return; // kết nối cũ đã được thay
      this.emit('close');
      if (!this.stopped) setTimeout(() => this.connect(), 1500);
    };
  }
  // kết nối lại ngay (sau khi đăng nhập / đăng xuất để server đọc cookie mới)
  reconnect() {
    this.stopped = false;
    const old = this.ws;
    this.connect();
    try { old.close(); } catch { /* bỏ qua */ }
  }
  on(t, fn) { this.handlers[t] = fn; }
  emit(t, d) { this.handlers[t]?.(d); }
  send(t, d) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ t, d }));
  }
  request(t, d, timeout = 12000) {
    return new Promise((resolve) => {
      const rid = ++this.rid;
      this.pending.set(rid, resolve);
      if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ t, d, rid }));
      setTimeout(() => {
        if (this.pending.has(rid)) { this.pending.delete(rid); resolve({ ok: false, error: 'Server không phản hồi, thử lại nhé.' }); }
      }, timeout);
    });
  }
}

// ---------------- LƯU TUỲ CHỌN TRÊN MÁY ----------------
const store = {
  get(k, def) { try { const v = localStorage.getItem('rap.' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('rap.' + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};

// ---------------- TRẠNG THÁI ----------------
const state = {
  me: null,
  token: null,
  joined: false,
  users: new Map(),
  queue: [],
  current: null,
  voting: null,
  skip: null,
  screenPost: null,
  emojiGroups: [],
  quickEmojis: ['😂', '😍', '😱', '👏', '🔥', '😭'],
  postSeconds: [6, 10, 15, 20, 30, 45, 60],
  chatMax: 160,
  maxQueue: 5,
  drawer: null,      // 'queue' | 'chat' | null
  engage: null,      // điểm danh + nhiệm vụ
  events: [],        // lịch chiếu
  reminded: new Set(),
  moments: null,     // khoảnh khắc hot của video đang chiếu
  poll: null,        // câu đoán đang diễn ra
  isHost: false,     // chủ rạp (được ra câu đoán bất cứ lúc nào)
  pollSeconds: [30, 60, 120, 300, 600],
  inviteCfg: null,
  room: null,        // phòng đang ngồi (sảnh chính hoặc phòng riêng)
  roomId: null,      // null = sảnh chính
  roomPass: null,
  rooms: [],
  gifts: {},
  characters: Object.keys(CHARACTER_INFO),
  character: 'meo',
  account: null,     // tài khoản đã đăng nhập
  catalog: null,     // danh mục tủ đồ (máy chủ gửi)
  kicked: false,
  everJoined: false,
  unread: 0,
  prefs: {
    quality: store.get('quality', 'high'),
    lasers: store.get('lasers', true),
    captions: store.get('captions', false),
    autoFade: store.get('autoFade', true),
    dim: store.get('dim', true),
  },
};

const net = new Net();
const theater = new Theater($('stage'), $('screen'));
const player = new CinemaPlayer({
  mount: $('ytMount'),
  idle: $('screenIdle'),
  idleText: $('screenIdle'),
  send: (t, d) => net.send(t, d),
  onNeedSound: (need) => $('soundBtn').classList.toggle('hidden', !need),
});

function applyPrefs() {
  theater.setQuality(state.prefs.quality);
  theater.setLasers(state.prefs.lasers);
  player.setCaptions(state.prefs.captions);
  $('optQuality').textContent = state.prefs.quality === 'high' ? '✨ Độ nét: Cao (bấm để chuyển Mượt)' : '⚡ Độ nét: Mượt (bấm để chuyển Cao)';
  $('laserBtn').classList.toggle('dim', !state.prefs.lasers);
  $('laserBtn').title = state.prefs.lasers ? 'Tắt hiệu ứng laser trên máy bạn' : 'Bật hiệu ứng laser trên máy bạn';
  $('ccBtn').classList.toggle('on', state.prefs.captions);
  $('ccBtn').classList.toggle('dim', !state.prefs.captions);
  $('ccBtn').title = state.prefs.captions ? 'Tắt phụ đề video (chỉ trên máy bạn)' : 'Bật phụ đề video (chỉ trên máy bạn)';
}
applyPrefs();

// ---------------- ĐỒNG HỒ ----------------
async function syncClock() {
  let best = null;
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const serverT = await net.request('time', null, 4000);
    const t1 = Date.now();
    if (typeof serverT !== 'number') continue;
    const rtt = t1 - t0;
    if (!best || rtt < best.rtt) best = { rtt, offset: serverT + rtt / 2 - t1 };
  }
  if (best) player.offset = best.offset;
}
const serverNow = () => player.serverNow();
const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
};

// ---------------- TÀI KHOẢN: ĐĂNG NHẬP / ĐĂNG KÝ / SẢNH ----------------
async function api(path, body) {
  try {
    const r = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await r.json();
  } catch {
    return { ok: false, error: 'Chưa kết nối được máy chủ. Thử lại nhé.' };
  }
}

let thumbCache = null;
function charThumbs() {
  if (!thumbCache) {
    try { thumbCache = Theater.renderThumbnails(state.characters); } catch { thumbCache = {}; }
  }
  return thumbCache;
}
function avatarImage(character, outfit, size = 220) {
  try { return Theater.renderThumbnails([character], size, outfit)[character]; } catch { return ''; }
}

// Lưới chọn nhân vật (dùng cho đăng ký và tủ đồ)
function buildCharGrid(box, selected, onSelect) {
  const thumbs = charThumbs();
  box.innerHTML = '';
  for (const key of state.characters) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'char' + (key === selected ? ' on' : '');
    if (thumbs[key]) {
      const img = document.createElement('img');
      img.src = thumbs[key];
      img.alt = CHARACTER_INFO[key].name;
      b.appendChild(img);
    }
    b.appendChild(document.createTextNode(CHARACTER_INFO[key].name));
    b.onclick = () => {
      box.querySelectorAll('.char').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onSelect(key);
    };
    box.appendChild(b);
  }
}
buildCharGrid($('charPicker'), state.character, (k) => { state.character = k; });

function tierProgress(points) {
  const t = TIERS.filter((x) => points >= x.points).pop() || TIERS[0];
  const next = TIERS.find((x) => x.points > points);
  if (!next) return { tier: t, next: null, pct: 100, text: 'Bạn đã đạt hạng cao nhất! 👑' };
  const pct = ((points - t.points) / (next.points - t.points)) * 100;
  return { tier: t, next, pct, text: `${points} 🍿 · còn ${next.points - points} điểm để lên ${next.icon} ${next.name}` };
}

function renderTierChip(el, tierId, extra = '') {
  const t = tierInfo(tierId);
  el.textContent = (t.icon ? t.icon + ' ' : '') + t.name + extra;
  el.style.setProperty('--tier', t.color);
}

function renderAccount() {
  const acc = state.account;
  if (!acc) return;
  const p = tierProgress(acc.points);
  // sảnh
  // chỉ vẽ lại ảnh nhân vật khi đổi nhân vật / trang phục (vẽ 3D khá tốn sức)
  const lookKey = acc.character + JSON.stringify(acc.outfit);
  if (lookKey !== renderAccount.lookKey && !$('lobbyBox').classList.contains('hidden')) {
    renderAccount.lookKey = lookKey;
    $('lobbyAvatar').src = avatarImage(acc.character, acc.outfit);
  }
  $('lobbyName').textContent = 'Xin chào, ' + acc.displayName + '!';
  renderTierChip($('lobbyTier'), p.tier.id);
  $('lobbyBar').style.width = p.pct + '%';
  $('lobbyNext').textContent = p.text;
  // thanh trên trong rạp
  $('pointsChip').textContent = '🍿 ' + (acc.balance ?? acc.points);
  $('pointsChip').title = `🍿 còn dùng được: ${acc.balance ?? acc.points} · tổng tích luỹ: ${acc.points} — bấm để xem hạng`;
  $('wdBalance').textContent = acc.balance ?? acc.points;
  const pb = $('profileBtn');
  pb.textContent = (acc.displayName || '?').slice(0, 1).toUpperCase();
  pb.style.setProperty('--tier', p.tier.color);
  pb.style.setProperty('--avatar', CHARACTER_INFO[acc.character]?.color || '#555');
}

function showAuth(mode = 'login') {
  $('authBox').classList.remove('hidden');
  $('lobbyBox').classList.add('hidden');
  document.querySelectorAll('#authTabs button').forEach((b) => b.classList.toggle('on', b.dataset.auth === mode));
  $('loginForm').classList.toggle('hidden', mode !== 'login');
  $('signupForm').classList.toggle('hidden', mode !== 'signup');
  $('authMsg').textContent = '';
}
function showLobby() {
  $('authBox').classList.add('hidden');
  $('lobbyBox').classList.remove('hidden');
  renderAccount.lookKey = null;
  renderAccount();
}
function showJoinScreen() {
  $('joinScreen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  if (theater.mySeat >= 0) theater.viewOverview();
  closeDrawer();
  document.querySelectorAll('.modal').forEach((m) => { if (m.id !== 'rulesModal' && m.id !== 'wardrobeModal') m.classList.add('hidden'); });
  if (state.account) showLobby(); else showAuth();
}
document.querySelectorAll('#authTabs button').forEach((b) => { b.onclick = () => showAuth(b.dataset.auth); });
$('rulesLink').onclick = (e) => { e.preventDefault(); $('rulesModal').classList.remove('hidden'); };
$('rulesClose').onclick = () => $('rulesModal').classList.add('hidden');

async function afterAuth(res) {
  state.account = res.account;
  state.kicked = false;
  showLobby();
  $('joinBtn').disabled = true;
  net.reconnect(); // kết nối lại để máy chủ nhận ra tài khoản
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  $('authMsg').textContent = '';
  const res = await api('/api/auth/login', { username: $('loginUser').value.trim(), password: $('loginPass').value });
  btn.disabled = false;
  if (!res.ok) { $('authMsg').textContent = res.error; return; }
  $('loginPass').value = '';
  afterAuth(res);
});

$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('authMsg');
  msg.textContent = '';
  const username = $('suUser').value.trim().toLowerCase();
  if (!/^[a-z0-9_.]{4,20}$/.test(username)) { msg.textContent = 'Tài khoản 4–20 ký tự: chữ không dấu, số, dấu _ hoặc dấu chấm.'; return; }
  if ($('suPass').value.length < 6) { msg.textContent = 'Mật khẩu cần ít nhất 6 ký tự.'; return; }
  if ($('suPass').value !== $('suPass2').value) { msg.textContent = 'Hai lần nhập mật khẩu chưa khớp.'; return; }
  if (!$('suName').value.trim()) { msg.textContent = 'Bạn nhập biệt danh nhé!'; return; }
  if (!$('suAgree').checked) { msg.textContent = 'Bạn cần đồng ý với nội quy rạp.'; return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  const res = await api('/api/auth/signup', {
    username, password: $('suPass').value, displayName: $('suName').value.trim(), character: state.character, agree: true,
    invite: store.get('invite', '') || undefined,
  });
  btn.disabled = false;
  if (!res.ok) { msg.textContent = res.error; return; }
  $('suPass').value = $('suPass2').value = '';
  const invited = res.account.invitedBy;
  store.set('invite', '');
  $('inviteNote').classList.add('hidden');
  toast(invited ? `🎉 Tạo tài khoản thành công! Bạn và ${invited} cùng nhận 🍿 thưởng mời bạn.` : '🎉 Tạo tài khoản thành công! Mặc thử đồ trong Tủ đồ rồi vào rạp nhé.', 5000);
  afterAuth(res);
});

$('logoutBtn').onclick = async () => {
  await api('/api/auth/logout', {});
  state.account = null;
  state.everJoined = false;
  state.joined = false;
  showJoinScreen();
  net.reconnect();
};

// target = { room, password }: chuyển sang phòng khác (bỏ trống = phòng đang ngồi / sảnh chính)
async function join(auto = false, target = null) {
  if (state.kicked) { state.kicked = false; state.pendingJoin = true; $('joinBtn').disabled = true; net.reconnect(); return; }
  $('joinBtn').disabled = true;
  $('joinMsg').textContent = '';
  const want = target || { room: state.roomId, password: state.roomPass };
  const res = await net.request('join', { room: want.room || undefined, password: want.password || undefined });
  $('joinBtn').disabled = false;
  if (!res || !res.ok) {
    if (res?.needLogin) { state.account = null; showJoinScreen(); $('authMsg').textContent = 'Phiên đăng nhập đã hết, bạn đăng nhập lại nhé.'; return res; }
    if (target) return res; // nơi gọi tự báo lỗi (sai mật khẩu, phòng đã đóng...)
    if (state.roomId && (res?.roomGone || res?.needPassword)) {
      // kết nối lại mà phòng riêng đã đóng / đổi mật khẩu: về sảnh chính
      state.roomId = null; state.roomPass = null;
      toast('🚪 Phòng riêng không còn nữa, bạn được đưa về sảnh chính.', 5000);
      return join(auto);
    }
    if (auto) showJoinScreen();
    $('joinMsg').textContent = (res && res.error) || 'Có lỗi, thử lại nhé.';
    return;
  }
  const switching = !!(target && state.joined);
  state.room = res.room || null;
  state.roomId = res.room && !res.room.isMain ? res.room.id : null;
  if (target) state.roomPass = target.password || null;
  if (switching) {
    $('chatLog').innerHTML = '';
    const w = document.createElement('p');
    w.className = 'chat-welcome';
    w.textContent = res.room.isMain ? 'Bạn đã về sảnh chính.' : `Bạn đã vào phòng "${res.room.name}". Chỉ người trong phòng thấy tin nhắn ở đây.`;
    $('chatLog').appendChild(w);
    setUnread(0);
    document.querySelectorAll('.modal:not(.hidden)').forEach((m) => closeModal(m.id));
  }
  renderRoomChip();
  state.me = res.me;
  state.token = res.token;
  if (res.account) state.account = res.account;
  if (res.events) { state.reminded = new Set(res.events.filter((e) => e.reminded).map((e) => e.id)); setEvents(res.events); }
  if (res.engage) setEngage(res.engage);
  state.isHost = !!res.isHost;
  syncHostUi();
  if (!state.isHost && state.drawer === 'host') closeDrawer();
  state.joined = true;
  setPoll(res.poll);
  state.everJoined = true;
  theater.myId = res.me.id;
  applyState(res.state);
  renderAccount();
  $('joinScreen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  theater.enterRoom(res.me.seat);
  if (!auto) theater.walkIn(res.me.id); // thấy nhân vật của mình đi từ cửa vào ghế
  setViewButtons('overview');
  player.unlock();
  setTimeout(() => $('hint').classList.add('fade'), 12000);
  // mỗi ngày tự mở bảng điểm danh 1 lần nếu chưa điểm danh
  if (!auto && state.engage && !state.engage.checkin.done && store.get('ciPrompt', '') !== vnDayKey()) {
    store.set('ciPrompt', vnDayKey());
    setTimeout(() => openActivity('daily'), 1800);
  }
  if (switching) {
    toast(res.room.isMain ? '🏛️ Bạn đã về sảnh chính' : `🚪 Đã vào phòng "${res.room.name}" — ${res.room.people} người đang ở đây`, 5000);
  } else if (!auto) {
    const portrait = window.innerWidth < window.innerHeight && window.innerWidth <= 860;
    const seat = seatInfo(res.me.seat);
    toast(portrait ? '📱 Xoay ngang điện thoại để xem rõ hơn nhé!' : `Chào ${res.me.name}! Bạn ngồi ghế ${seat.code} · ${seat.type}. Bấm ghế khác để đổi chỗ 🍿`, 5000);
  }
  // vào bằng link phòng riêng (?phong=MÃ)
  if (pendingRoom && !target) {
    const pr = pendingRoom;
    pendingRoom = null;
    setTimeout(async () => {
      const r = await switchRoom(pr);
      if (r?.ok) return;
      if (r?.needPassword) { openRooms(pr); $('roomErr').textContent = 'Phòng này có mật khẩu, nhập mật khẩu để vào nhé.'; }
      else toast(r?.error || 'Không vào được phòng trong link.', 5000);
    }, 600);
  }
  return res;
}
$('joinBtn').onclick = () => join();

// ---------------- TỦ ĐỒ ----------------
const wd = { draft: null, tab: 'look', preview: null };

function openWardrobe() {
  if (!state.account || !state.catalog) return;
  const acc = state.account;
  wd.draft = { displayName: acc.displayName, character: acc.character, outfit: { ...acc.outfit } };
  wd.tab = 'look';
  $('wardrobeModal').classList.remove('hidden');
  if (!wd.preview) {
    try { wd.preview = new AvatarPreview($('wdCanvas')); } catch (e) { console.warn(e); }
  }
  renderWardrobe();
}
function closeWardrobe() {
  $('wardrobeModal').classList.add('hidden');
  wd.preview?.dispose();
  wd.preview = null;
}

// món hiếm (unlock) chỉ mở bằng cách đặc biệt, món thường mở theo tổng 🍿
function itemLocked(item, acc = state.account) {
  if (!item || !item.id) return false;
  if (item.unlock) return !(acc.unlocks || []).includes(item.id);
  return item.points > acc.points;
}
function lockedItems() {
  return ['hat', 'body', 'acc'].map((slot) => state.catalog.items.find((i) => i.id === wd.draft.outfit[slot]))
    .filter((i) => itemLocked(i));
}

function renderWardrobe() {
  const acc = state.account;
  const d = wd.draft;
  wd.preview?.show(d.character, d.outfit);
  const p = tierProgress(acc.points);
  $('wdName').textContent = d.displayName || acc.displayName;
  renderTierChip($('wdTier'), p.tier.id);
  $('wdBar').style.width = p.pct + '%';
  $('wdNext').textContent = p.text;
  document.querySelectorAll('#wdTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === wd.tab));
  const panel = $('wdPanel');
  panel.innerHTML = '';

  if (wd.tab === 'look') {
    const l1 = document.createElement('label');
    l1.textContent = 'Biệt danh';
    const inp = document.createElement('input');
    inp.maxLength = 20;
    inp.value = d.displayName;
    inp.oninput = () => { d.displayName = inp.value; $('wdName').textContent = inp.value; };
    const l2 = document.createElement('label');
    l2.textContent = 'Nhân vật';
    const grid = document.createElement('div');
    grid.className = 'char-grid';
    buildCharGrid(grid, d.character, (k) => { d.character = k; wd.preview?.show(d.character, d.outfit); });
    const l3 = document.createElement('label');
    l3.textContent = 'Màu trang phục (áo phông, hoodie, mũ, khăn, nơ…)';
    const sw = document.createElement('div');
    sw.className = 'swatches';
    for (const c of state.catalog.colors) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.className = c === d.outfit.color ? 'on' : '';
      b.title = c;
      b.onclick = () => { d.outfit.color = c; renderWardrobe(); };
      sw.appendChild(b);
    }
    panel.append(l1, inp, l2, grid, l3, sw);
  } else if (wd.tab === 'tiers') {
    const list = document.createElement('div');
    list.className = 'tier-list';
    for (const t of TIERS) {
      const row = document.createElement('div');
      row.className = 'tier-row' + (acc.points >= t.points ? ' reached' : '');
      row.style.setProperty('--tier', t.color);
      const n = document.createElement('span');
      n.className = 'tn';
      n.textContent = (t.icon ? t.icon + ' ' : '') + t.name;
      const pt = document.createElement('span');
      pt.className = 'tp';
      pt.textContent = acc.points >= t.points ? '✓ Đã đạt' : `cần ${t.points} 🍿 (còn ${t.points - acc.points})`;
      row.append(n, pt);
      list.appendChild(row);
    }
    const earn = document.createElement('div');
    earn.className = 'earn';
    const P = state.catalog.points;
    earn.innerHTML = '';
    for (const line of [
      '<b>Cách kiếm điểm 🍿</b>',
      `• +${P.perMinute} điểm mỗi phút ngồi xem phim trong rạp (khi đang có video chiếu)`,
      `• +${P.suggestionPlayed} điểm khi video bạn đề xuất được chiếu`,
      `• Ủng hộ rạp: 1.000đ = ${Math.round(1000 / (P.vndPerPoint || 100))} 🍿 (nút Ủng hộ ở thanh bên phải)`,
      '• Điểm danh, nhiệm vụ hằng ngày, đoán đúng câu đoán, ngồi chung ghế đôi/ba với bạn (🎯 Nhiệm vụ)',
      '• Mời bạn bè qua link riêng: cả hai cùng nhận 🍿, bạn xem đủ 1 giờ thì bạn nhận món hiếm 💘 Kính trái tim',
      '• Hạng và tủ đồ tính theo 🍿 tích luỹ — tiêu 🍿 (chiếu ảnh, chen video) không làm mất hạng',
      '• Hạng cao hơn: huy hiệu trước tên, viền màu cho bảng tên và bong bóng chat',
      '• Điểm càng cao, mở khoá càng nhiều món trong tủ đồ',
    ]) {
      const div = document.createElement('div');
      if (line.startsWith('<b>')) { const b = document.createElement('b'); b.textContent = 'Cách kiếm điểm 🍿'; div.appendChild(b); } else div.textContent = line;
      earn.appendChild(div);
    }
    panel.append(list, earn);
  } else {
    const slot = wd.tab;
    const grid = document.createElement('div');
    grid.className = 'item-grid';
    const none = { id: null, name: 'Không mặc', icon: '🚫', points: 0 };
    for (const item of [none, ...state.catalog.items.filter((i) => i.slot === slot)]) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = (d.outfit[slot] || null) === item.id;
      const locked = itemLocked(item, acc);
      b.className = 'item' + (on ? ' on' : '') + (locked ? ' locked' : '') + (item.unlock ? ' rare' : '');
      if (item.unlock) b.title = (locked ? '🔒 ' : '✓ ') + item.hint;
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = item.icon;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = item.name;
      const st = document.createElement('span'); st.className = 'st';
      st.textContent = item.unlock
        ? (locked ? '🔒 Món hiếm: mời bạn' : on ? '✓ Đang mặc' : '💘 Món hiếm')
        : locked ? `🔒 cần ${item.points} 🍿` : on ? '✓ Đang mặc' : item.points ? `Đã mở (${item.points} 🍿)` : 'Miễn phí';
      b.append(ic, nm, st);
      b.onclick = () => { d.outfit[slot] = item.id; renderWardrobe(); };
      grid.appendChild(b);
    }
    panel.appendChild(grid);
  }

  const locked = lockedItems();
  const msg = $('wdMsg');
  if (locked.length) {
    msg.className = 'err';
    msg.textContent = locked[0].unlock
      ? `Bạn đang mặc thử "${locked[0].name}" — món hiếm: ${locked[0].hint}. Lấy link mời ở 🎯 Nhiệm vụ → Mời bạn.`
      : `Bạn đang mặc thử "${locked[0].name}" (cần ${locked[0].points} 🍿, bạn có ${acc.points}). Xem phim thêm để mở khoá nhé!`;
  } else {
    msg.className = '';
    msg.textContent = '';
  }
  $('wdSave').disabled = locked.length > 0;
}

document.querySelectorAll('#wdTabs button').forEach((b) => { b.onclick = () => { wd.tab = b.dataset.tab; renderWardrobe(); }; });
$('wdClose').onclick = closeWardrobe;
$('wdCancel').onclick = closeWardrobe;
$('wdSave').onclick = async () => {
  const d = wd.draft;
  if (!d.displayName.trim()) { $('wdMsg').className = 'err'; $('wdMsg').textContent = 'Bạn nhập biệt danh nhé!'; return; }
  $('wdSave').disabled = true;
  const res = await api('/api/profile', { displayName: d.displayName.trim(), character: d.character, outfit: d.outfit });
  $('wdSave').disabled = false;
  if (!res.ok) { $('wdMsg').className = 'err'; $('wdMsg').textContent = res.error; return; }
  state.account = res.account;
  renderAccount();
  closeWardrobe();
  toast('👗 Đã lưu tủ đồ!');
};
$('lobbyWardrobe').onclick = openWardrobe;
$('profileBtn').onclick = openWardrobe;
$('pointsChip').onclick = () => { openWardrobe(); wd.tab = 'tiers'; renderWardrobe(); };

// ---------------- ÁP DỤNG TRẠNG THÁI TỪ SERVER ----------------
function applyState(s) {
  theater.clearUsers();
  state.users.clear();
  for (const u of s.users) {
    state.users.set(u.id, u);
    theater.addUser(u);
  }
  if (state.me) state.me = state.users.get(state.me.id) || state.me;
  renderQueue(s.queue);
  if (s.moments) state.moments = s.moments;
  if (s.chat) setChatState(s.chat);
  setNowPlaying(s.current, s.voting);
  renderSkip(s.skip);
  showScreenPost(s.screenPost);
  renderViewers();
  renderSeatChip();
}

const humansCount = () => [...state.users.values()].filter((u) => !u.bot).length;

function renderViewers() {
  const all = [...state.users.values()];
  // số ghế đang có người ngồi / tổng số ghế
  const text = `👥 ${all.length}/100 ghế`;
  $('viewers').textContent = text;
  const cur = state.current;
  $('joinNow').textContent = (cur ? `🎬 Đang chiếu: ${cur.title}` : state.voting ? '🗳️ Đang bình chọn video tiếp theo' : '🎬 Chưa có phim nào đang chiếu')
    + ` · ${text.replace('👥 ', '')}`;
  if (state.drawer === 'chat') $('drawerEyebrow').textContent = `${humansCount()} NGƯỜI ĐANG Ở ĐÂY`;
  if (!$('seatModal').classList.contains('hidden')) renderSeatMap();
}

function renderSeatChip() {
  const me = state.me && state.users.get(state.me.id);
  if (!me) return;
  const s = seatInfo(me.seat);
  $('seatChip').textContent = `💺 ${s.code} · ${s.type}` + (me.stage ? ' · 🎤 trên sân khấu' : typeof onSofaWithFriends === 'function' && onSofaWithFriends() ? ' · 💞 ngồi cùng bạn' : '');
  $('dockSeatLabel').textContent = s.code;
  $('dockSeatLabel').parentElement.title = `Bạn đang ở ${s.code} · ${s.type} — bấm để đổi chỗ`;
  $('stageBtn').classList.toggle('live', !!me.stage);
  $('stageBtn').querySelector('span').textContent = me.stage ? 'Xuống sân khấu' : 'Lên sân khấu';
}

function renderParty() {
  const cur = state.current;
  theater.clockOffset = player.offset;
  theater.setParty(!!(cur && cur.energetic), cur?.bpm, cur?.startedAt);
  theater.setMood(cur ? cur.mood || (cur.energetic ? 'party' : 'normal') : 'normal');
  const tag = $('discoTag');
  tag.classList.toggle('hidden', !(cur && cur.energetic));
  if (cur && cur.energetic) {
    tag.querySelector('span').textContent = state.prefs.lasers ? `Disco · ${cur.bpm || 128} BPM` : 'Đã tắt hiệu ứng trên máy bạn';
  }
}

function setNowPlaying(cur, voting) {
  state.current = cur;
  state.voting = voting || null;
  player.setCurrent(cur);
  $('screenVote').classList.toggle('hidden', !state.voting);
  $('voteBanner').classList.toggle('hidden', !state.voting);
  $('skipPoll').classList.toggle('hidden', !cur);
  $('npBar').classList.toggle('hidden', !cur);
  $('changeTrackBtn').classList.toggle('hidden', !(cur && state.me && cur.byId === state.me.id));
  renderParty();
  renderVoteScreen();
  renderViewers();
  if (typeof renderPoll === 'function' && state.poll !== undefined) renderPoll();
  tick();
}

// cập nhật thời gian video, đếm ngược bình chọn (mỗi nửa giây)
function tick() {
  theater.clockOffset = player.offset; // nhịp đèn/laser theo giờ máy chủ để mọi người thấy giống nhau
  const cur = state.current;
  const bar = $('npBar').querySelector('i');
  if (state.voting) {
    const left = Math.max(0, Math.ceil((state.voting.endsAt - serverNow()) / 1000));
    $('npEyebrow').textContent = 'CHỌN VIDEO TIẾP THEO';
    $('npTitle').textContent = `Bình chọn kết thúc sau ${left} giây`;
    $('npSub').textContent = 'Mở Hàng chờ ở thanh bên phải và bấm 👍 cho video bạn muốn xem';
    $('voteSeconds').textContent = left;
    $('voteBannerSec').textContent = left;
    bar.style.width = '0';
  } else if (cur && cur.replay) {
    // phát lại khoảnh khắc hot
    const elapsed = (serverNow() - cur.startedAt) / 1000;
    const r = cur.replay;
    const left = Math.max(0, Math.ceil(r.from + r.seconds - elapsed));
    $('npEyebrow').textContent = '⏪ PHÁT LẠI KHOẢNH KHẮC HOT';
    $('npTitle').textContent = cur.title;
    $('npSub').textContent = `Đoạn cả rạp thả ${r.count} ${r.emoji} · phút ${fmtTime(r.from)} · còn ${left} giây`;
    bar.style.width = Math.min(100, Math.max(0, ((elapsed - r.from) / r.seconds) * 100)) + '%';
  } else if (cur) {
    const elapsed = (serverNow() - cur.startedAt) / 1000;
    $('npEyebrow').textContent = 'TRÊN MÀN ẢNH';
    $('npTitle').textContent = cur.title;
    $('npSub').textContent = `${cur.byName} đề xuất · ${fmtTime(Math.max(0, elapsed))}` + (cur.duration ? ' / ' + fmtTime(cur.duration) : '');
    bar.style.width = cur.duration ? Math.min(100, Math.max(0, (elapsed / cur.duration) * 100)) + '%' : '0';
  } else {
    $('npEyebrow').textContent = 'RẠP MÂY · XEM PHIM CÙNG NHAU';
    $('npTitle').textContent = 'Chọn một chỗ, xem cùng nhau.';
    $('npSub').textContent = 'Ghế đơn, ghế đôi, ghế ba — bấm "Gửi video" để chiếu video đầu tiên';
    bar.style.width = '0';
  }
  $('npTitle').title = $('npTitle').textContent;
  $('npPanel').classList.toggle('replay', !!(cur && cur.replay));
  drawHeatmap();
  // Tắt đèn: phim chạy được 10 giây thì đèn mờ dần; hết phim / bình chọn thì sáng lại
  let dim = 0;
  if (cur && !state.voting) {
    const el = (serverNow() - cur.startedAt) / 1000;
    const playing = el > 10 && (!cur.duration || el < cur.duration - 1);
    if (cur.mood === 'horror' && el > 3) dim = 1;                 // kinh dị: tối hẳn ngay
    else if (playing || cur.replay) dim = state.prefs.dim ? (cur.mood === 'romance' ? 0.7 : 0.75) : 0;
  }
  theater.setDim(dim);
}
setInterval(tick, 500);

function renderVoteScreen() {
  const list = $('voteList');
  list.innerHTML = '';
  for (const q of state.queue.slice(0, 3)) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${q.videoId}/mqdefault.jpg`;
    img.alt = '';
    const title = document.createElement('span');
    title.className = 'v-title';
    title.textContent = q.title;
    const votes = document.createElement('span');
    votes.className = 'v-votes';
    votes.textContent = `👍 ${q.votes}`;
    li.append(img, title, votes);
    list.appendChild(li);
  }
}

// Bình chọn bỏ qua: đủ 35% số người thật trong rạp đồng ý thì chuyển bài
function renderSkip(skip) {
  if (!skip) return;
  state.skip = skip;
  const mine = !!(state.me && skip.voters.includes(state.me.id));
  $('skipCount').textContent = `${skip.count}/${skip.needed}`;
  $('skipLabel').textContent = mine ? 'Rút phiếu skip' : 'Vote bỏ qua';
  $('skipBtn').setAttribute('aria-pressed', mine);
  $('skipBtn').title = mine ? 'Rút phiếu bỏ qua' : 'Bình chọn bỏ qua video đang chiếu';
  const st = $('skipStatus');
  st.textContent = `${skip.count}/${skip.online ?? '?'} người thật đồng ý · ${skip.percent ?? 0}%`;
  st.appendChild(document.createElement('br'));
  st.appendChild(document.createTextNode(`Đủ ${skip.threshold ?? 35}% thì chuyển bài`));
  $('skipProgress').max = Math.max(1, skip.needed);
  $('skipProgress').value = skip.count;
}
$('changeTrackBtn').onclick = () => net.send('skip-own');

// Danh sách chờ (ngăn bên phải)
function renderQueue(queue) {
  state.queue = queue;
  const list = $('queueList');
  list.innerHTML = '';
  $('queueEmpty').classList.toggle('hidden', queue.length > 0);
  const badge = $('queueBadge');
  badge.textContent = queue.length;
  badge.classList.toggle('hidden', queue.length === 0);
  const price = state.catalog?.prices?.boost ?? 20;
  const balance = state.account?.balance ?? 0;
  queue.forEach((q, i) => {
    const art = document.createElement('article');
    art.className = 'queue-item' + (i === 0 ? ' first' : '');
    const rank = document.createElement('span');
    rank.className = 'queue-rank';
    rank.textContent = String(i + 1).padStart(2, '0');
    const thumb = document.createElement('div');
    thumb.className = 'queue-thumb';
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${q.videoId}/mqdefault.jpg`;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
    const MOOD_ICON = { party: ['⚡', 'Nhạc sôi động · disco'], horror: ['👻', 'Kinh dị · tắt đèn, chập chờn'], romance: ['🌹', 'Lãng mạn · cánh hoa rơi'] };
    const mi = MOOD_ICON[q.mood] || (q.energetic ? MOOD_ICON.party : null);
    if (mi) { const z = document.createElement('span'); z.className = 'bolt'; z.textContent = mi[0]; z.title = mi[1]; thumb.appendChild(z); }
    const info = document.createElement('div');
    info.className = 'queue-info';
    const h = document.createElement('h3');
    h.textContent = q.title;
    h.title = q.title;
    const p = document.createElement('p');
    p.textContent = q.byName + (q.duration ? ' · ' + fmtTime(q.duration) : '') + (q.boosted ? ' · ⚡ đã chen' : '');
    info.append(h, p);
    if (state.me && q.byId === state.me.id) {
      const own = document.createElement('div');
      own.className = 'queue-own';
      if (!q.boosted) {
        const boost = document.createElement('button');
        boost.className = 'boost-button';
        boost.textContent = `⚡ Chen · ${price} 🍿`;
        boost.disabled = balance < price;
        boost.title = balance < price ? `Cần ${price} 🍿, bạn còn ${balance} 🍿` : 'Đưa video này lên trước các video chưa chen';
        boost.onclick = async () => {
          boost.disabled = true;
          const r = await net.request('boost', q.id);
          if (!r?.ok) { toast(r?.error || 'Chưa chen được.'); boost.disabled = false; } else toast('⚡ Đã chen video lên đầu hàng chờ!');
        };
        own.appendChild(boost);
      }
      const rm = document.createElement('button');
      rm.textContent = 'Xoá';
      rm.title = 'Xoá video của bạn khỏi hàng chờ';
      rm.onclick = () => net.send('remove-video', q.id);
      own.appendChild(rm);
      info.appendChild(own);
    }
    if (state.isHost) {
      const del = document.createElement('button');
      del.className = 'queue-host-del';
      del.textContent = '🗑';
      del.title = 'Chủ rạp: xoá video này khỏi hàng chờ';
      del.setAttribute('aria-label', `Xoá ${q.title} khỏi hàng chờ`);
      del.onclick = async () => { const r = await net.request('host-remove', q.id); if (!r?.ok) toast(r?.error || 'Chưa xoá được.'); };
      thumb.style.position = 'relative';
      thumb.appendChild(del);
    }
    const vote = document.createElement('button');
    const voted = state.me && q.voters.includes(state.me.id);
    vote.className = 'vote-button' + (voted ? ' voted' : '');
    vote.setAttribute('aria-pressed', !!voted);
    vote.setAttribute('aria-label', `${voted ? 'Thu hồi phiếu' : 'Bình chọn'}: ${q.title}`);
    vote.title = voted ? 'Thu hồi phiếu' : 'Bình chọn';
    vote.innerHTML = '<span>👍</span>';
    const n = document.createElement('strong');
    n.textContent = q.votes;
    vote.appendChild(n);
    vote.onclick = () => net.send('vote', q.id);
    art.append(rank, thumb, info, vote);
    list.appendChild(art);
  });
  renderVoteScreen();
}

// ---------------- ẢNH TRÊN MÀN CHIẾU ----------------
function showScreenPost(p) {
  state.screenPost = p;
  const box = $('screenPost');
  if (!p) { box.classList.add('hidden'); return; }
  $('screenPostImg').src = `/api/screen-post/${p.id}`;
  $('screenPostText').textContent = p.text || '';
  $('screenPostBy').textContent = '📸 ' + p.byName;
  box.classList.remove('hidden');
  const barEl = $('screenPostBar');
  const left = Math.max(0, p.endsAt - serverNow());
  barEl.style.transition = 'none';
  barEl.style.transform = `scaleX(${Math.min(1, left / (p.seconds * 1000))})`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    barEl.style.transition = `transform ${left}ms linear`;
    barEl.style.transform = 'scaleX(0)';
  }));
}

// ---------------- TRÒ CHUYỆN ----------------
const EMOJI_ONLY = /^(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️⃣\s])+$/u;
function isEmojiOnly(text) {
  return EMOJI_ONLY.test(text) && /\p{Extended_Pictographic}/u.test(text) && [...text].length <= 16;
}
function firstGrapheme(text) {
  try { return [...new Intl.Segmenter().segment(text.trim())][0].segment; } catch { return [...text.trim()][0]; }
}

function setUnread(n) {
  state.unread = n;
  const b = $('unread');
  b.textContent = n > 99 ? '99+' : n;
  b.classList.toggle('hidden', n === 0);
  updateDockBadge();
}
function updateDockBadge() {
  const collapsed = $('dock').classList.contains('collapsed');
  const b = $('dockBadge');
  b.textContent = state.unread > 99 ? '99+' : state.unread;
  b.classList.toggle('hidden', !collapsed || state.unread === 0);
  const f = $('focusUnread');
  f.textContent = b.textContent;
  f.classList.toggle('hidden', state.unread === 0);
}

function addChat(m) {
  const log = $('chatLog');
  log.querySelector('.chat-welcome')?.remove();
  let el;
  if (m.system) {
    el = document.createElement('div');
    el.className = 'chat-sys';
    el.textContent = m.text;
  } else {
    const own = m.id === state.me?.id;
    el = document.createElement('div');
    el.className = 'chat-message' + (own ? ' own' : '') + (isEmojiOnly(m.text) ? ' big' : '') + (m.tier ? ' tiered' : '');
    const color = CHARACTER_INFO[m.character]?.color || '#fff';
    const dot = document.createElement('span');
    dot.className = 'chat-dot';
    dot.style.background = color;
    const body = document.createElement('div');
    body.className = 'body';
    const head = document.createElement('div');
    head.className = 'head';
    const name = document.createElement('strong');
    name.style.color = color;
    name.textContent = m.name;
    head.appendChild(name);
    if (m.tier) {
      const t = tierInfo(m.tier);
      const badge = document.createElement('span');
      badge.className = 'tier-badge';
      badge.style.color = t.color;
      badge.textContent = (t.icon + ' ' + t.name).trim();
      head.appendChild(badge);
      el.style.setProperty('--tier', t.color);
    }
    if (m.badges) {
      const bd = document.createElement('span');
      bd.className = 'chat-badges';
      bd.textContent = m.badges;
      bd.title = 'Huy hiệu xếp hạng tuần trước';
      head.appendChild(bd);
    }
    const time = document.createElement('time');
    time.textContent = new Date(m.at || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    head.appendChild(time);
    // chủ rạp: nút tắt chat nhanh cạnh tên
    const sender = state.users.get(m.id);
    if (state.isHost && !own && sender && !sender.bot) {
      const mb = document.createElement('button');
      mb.className = 'chat-mute';
      mb.textContent = '🔇';
      mb.title = `Tắt chat ${m.name}`;
      mb.setAttribute('aria-label', `Tắt chat ${m.name}`);
      mb.onclick = () => {
        if (head.querySelector('.mute-pop')) { head.querySelector('.mute-pop').remove(); return; }
        const pop = document.createElement('span');
        pop.className = 'mute-pop';
        for (const [min, label] of [[5, '5p'], [15, '15p'], [60, '1g']]) {
          const b = document.createElement('button');
          b.textContent = label;
          b.onclick = () => { hostMute(m.id, min); pop.remove(); };
          pop.appendChild(b);
        }
        head.appendChild(pop);
      };
      head.appendChild(mb);
    }
    const bubble = document.createElement('p');
    bubble.className = 'chat-bubble';
    bubble.textContent = m.text;
    body.append(head, bubble);
    el.append(dot, body);
    if (state.drawer !== 'chat' && !own) setUnread(state.unread + 1);
  }
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.appendChild(el);
  while (log.children.length > 200) log.firstChild.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}

function updateChatCount() {
  const n = $('chatInput').value.length;
  const max = state.chatMax;
  $('chatCount').textContent = `${n}/${max}`;
  $('chatCount').classList.toggle('warn', n > max - 20);
  $('chatSend').disabled = !$('chatInput').value.trim();
}
$('chatInput').addEventListener('input', updateChatCount);
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text || !state.joined) return;
  net.send('chat', text);
  $('chatInput').value = '';
  updateChatCount();
  closeEmojiPanel();
});

// Bảng emoji (chèn vào ô chat)
function buildEmojiPanel() {
  const tabs = $('emojiTabs');
  const grid = $('emojiGrid');
  tabs.innerHTML = '';
  const show = (gi) => {
    tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === gi));
    grid.innerHTML = '';
    for (const em of state.emojiGroups[gi]?.items || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = em;
      b.onclick = () => {
        const inp = $('chatInput');
        const pos = inp.selectionStart ?? inp.value.length;
        inp.value = (inp.value.slice(0, pos) + em + inp.value.slice(pos)).slice(0, state.chatMax);
        inp.focus();
        inp.setSelectionRange(pos + em.length, pos + em.length);
        updateChatCount();
      };
      grid.appendChild(b);
    }
  };
  state.emojiGroups.forEach((g, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = g.name;
    b.onclick = () => show(i);
    tabs.appendChild(b);
  });
  show(0);
}
function closeEmojiPanel() {
  $('emojiPanel').classList.add('hidden');
  $('emojiBtn').classList.remove('active');
}
$('emojiBtn').onclick = (e) => {
  e.stopPropagation();
  const open = $('emojiPanel').classList.contains('hidden');
  document.querySelectorAll('.popover').forEach((p) => p.classList.add('hidden'));
  $('emojiPanel').classList.toggle('hidden', !open);
  $('emojiBtn').classList.toggle('active', open);
};
$('emojiClose').onclick = closeEmojiPanel;

// ---------------- THẢ EMOJI, ĐỘNG TÁC, ÂM THANH, TUỲ CHỌN ----------------
function buildEmojiBar() {
  const bar = $('emojiBar');
  bar.innerHTML = '';
  state.quickEmojis.forEach((em, i) => {
    const b = document.createElement('button');
    b.textContent = em;
    b.title = `Thả ${em} bay lên (phím ${i + 1})`;
    b.onclick = () => net.send('emoji', em);
    bar.appendChild(b);
  });
}
buildEmojiBar();

function togglePopover(id) {
  const el = $(id);
  const willOpen = el.classList.contains('hidden');
  document.querySelectorAll('.popover').forEach((p) => p.classList.add('hidden'));
  $('emojiBtn').classList.remove('active');
  if (willOpen) el.classList.remove('hidden');
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.popover') || e.target.closest('.menu-wrap > button') || e.target.closest('#emojiBtn')) return;
  document.querySelectorAll('.popover').forEach((p) => p.classList.add('hidden'));
  $('emojiBtn').classList.remove('active');
});

$('emoteBtn').onclick = () => togglePopover('emoteMenu');
document.querySelectorAll('[data-emote]').forEach((b) => {
  b.onclick = () => { net.send('emote', b.dataset.emote); togglePopover('emoteMenu'); };
});

$('stageBtn').onclick = async () => {
  const me = state.users.get(state.me?.id);
  if (me?.stage) { net.send('stage-leave'); return; }
  const res = await net.request('stage');
  if (res?.ok) toast('🎤 Lên sân khấu! Bạn có 1 phút để quẩy, hết giờ sẽ tự về ghế.');
  else toast(res?.error || 'Chưa lên sân khấu được.');
};

$('settingsBtn').onclick = () => togglePopover('settingsMenu');
$('optQuality').onclick = () => {
  state.prefs.quality = state.prefs.quality === 'high' ? 'smooth' : 'high';
  store.set('quality', state.prefs.quality);
  applyPrefs();
};
// ---- Tự làm mờ các nút khi không dùng (đang chiếu phim) ----
const IDLE_MS = 4000;
let lastActive = Date.now();
const markActive = () => { lastActive = Date.now(); if (document.body.classList.contains('hud-idle')) document.body.classList.remove('hud-idle'); };
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, markActive, { passive: true });
function renderAutoFade() {
  $('optAutoFade').textContent = state.prefs.autoFade ? '🌙 Tự làm mờ nút khi xem: Bật' : '🌙 Tự làm mờ nút khi xem: Tắt';
}
setInterval(() => {
  const busy = !state.prefs.autoFade || !state.joined || !state.current || state.drawer
    || document.querySelector('.modal:not(.hidden), .popover:not(.hidden)')
    || document.activeElement?.matches?.('input, textarea')
    || (state.poll && state.poll.status !== 'revealed');
  const idle = !busy && Date.now() - lastActive > IDLE_MS;
  document.body.classList.toggle('hud-idle', idle);
}, 500);
renderAutoFade();
$('optAutoFade').onclick = () => {
  state.prefs.autoFade = !state.prefs.autoFade;
  store.set('autoFade', state.prefs.autoFade);
  renderAutoFade();
  toast(state.prefs.autoFade ? '🌙 Các nút sẽ tự mờ khi bạn không đụng chuột lúc xem phim' : 'Đã tắt tự làm mờ nút');
};

function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); return; }
  const el = d.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) Promise.resolve(req.call(el)).catch(() => toast('Trình duyệt chưa cho phép toàn màn hình.'));
  else toast('Trình duyệt này chưa hỗ trợ toàn màn hình (iPhone: bấm Chia sẻ → Thêm vào MH chính để xem toàn màn hình).', 5000);
}
$('optFullscreen').onclick = () => { toggleFullscreen(); togglePopover('settingsMenu'); };
const renderDimOpt = () => { $('optDim').textContent = state.prefs.dim ? '💡 Tắt đèn khi chiếu phim: Bật' : '💡 Tắt đèn khi chiếu phim: Tắt'; };
renderDimOpt();
$('optDim').onclick = () => {
  state.prefs.dim = !state.prefs.dim;
  store.set('dim', state.prefs.dim);
  renderDimOpt();
  toast(state.prefs.dim ? '🌙 Đèn rạp sẽ mờ dần khi phim bắt đầu' : '💡 Đèn rạp luôn sáng (video kinh dị vẫn tắt đèn)');
};
$('fsBtn').onclick = toggleFullscreen;
$('fsBtnTop').onclick = toggleFullscreen;
// trình duyệt không hỗ trợ toàn màn hình (iPhone): ẩn nút ở góc trên
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $('fsBtnTop').remove();
function syncFullscreenUi() {
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  $('fsBtn').classList.toggle('on', on);
  $('fsBtn').title = on ? 'Thoát toàn màn hình (phím F)' : 'Toàn màn hình (phím F)';
  $('optFullscreen').textContent = on ? '⛶ Thoát toàn màn hình' : '⛶ Toàn màn hình';
}
document.addEventListener('fullscreenchange', syncFullscreenUi);
document.addEventListener('webkitfullscreenchange', syncFullscreenUi);

// ---- Ẩn giao diện: chỉ giữ nút Trò chuyện ----
function setFocusMode(on) {
  state.focus = on;
  document.body.classList.toggle('focus-mode', on);
  $('focusBar').classList.toggle('hidden', !on);
  if (on) {
    if (state.drawer && state.drawer !== 'chat') closeDrawer();
    closeEmojiPanel?.();
    document.querySelectorAll('.popover').forEach((p) => p.classList.add('hidden'));
    toast('👁️ Đã ẩn giao diện · bấm nút con mắt hoặc phím H để hiện lại', 3500);
  }
  syncDock();
}
$('focusBtn').onclick = () => setFocusMode(true);
$('focusBtnTop').onclick = () => setFocusMode(true);
$('focusExit').onclick = () => setFocusMode(false);
$('focusChat').onclick = () => openDrawer('chat');
document.addEventListener('keydown', (e) => {
  if (!state.joined || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  const k = e.key.toLowerCase();
  if (k === 'h') setFocusMode(!state.focus);
  if (k === 'f') toggleFullscreen();
});
$('optInvite').onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast('🔗 Đã sao chép link mời của bạn — bạn bè tạo tài khoản qua link này thì cả hai được 🍿!'); }
  catch { toast('Link mời: ' + inviteLink(), 7000); }
  togglePopover('settingsMenu');
};
$('optLogout').onclick = () => { togglePopover('settingsMenu'); $('logoutBtn').click(); };

$('laserBtn').onclick = () => {
  state.prefs.lasers = !state.prefs.lasers;
  store.set('lasers', state.prefs.lasers);
  applyPrefs();
  renderParty();
  toast(state.prefs.lasers ? 'Đã bật hiệu ứng laser' : 'Đã tắt hiệu ứng laser trên máy bạn');
};
$('ccBtn').onclick = () => {
  state.prefs.captions = !state.prefs.captions;
  store.set('captions', state.prefs.captions);
  applyPrefs();
  toast(state.prefs.captions ? 'Đã bật phụ đề (nếu video có phụ đề)' : 'Đã tắt phụ đề');
};
let lastVolume = 80;
function setVolumeUi(v) {
  $('volume').value = v;
  $('muteBtn').classList.toggle('dim', v === 0);
  $('muteBtn').title = v === 0 ? 'Bật tiếng' : 'Tắt tiếng';
}
$('muteBtn').onclick = () => {
  const v = Number($('volume').value);
  if (v > 0) { lastVolume = v; player.setVolume(0); setVolumeUi(0); }
  else { player.setVolume(lastVolume || 80); setVolumeUi(lastVolume || 80); }
};
$('volume').oninput = (e) => { const v = Number(e.target.value); player.setVolume(v); setVolumeUi(v); };
$('soundBtn').onclick = () => player.unmute();
$('popcornBtn').onclick = () => net.send('popcorn', {});
$('tomatoBtn').onclick = () => net.send('throw', 'tomato');
$('roseBtn').onclick = () => net.send('throw', 'rose');
$('skipBtn').onclick = () => net.send('skip');

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const busy = document.querySelector('.modal:not(.hidden)') || !$('emojiPanel').classList.contains('hidden') || state.drawer;
    if (!busy && state.focus) { setFocusMode(false); return; }
    closeTopLayer();
    return;
  }
  if (!state.joined || e.target.tagName === 'INPUT') return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= state.quickEmojis.length) net.send('emoji', state.quickEmojis[n - 1]);
  if (e.key === 'p' || e.key === 'P') net.send('popcorn', {});
  if (e.key === 't' || e.key === 'T') net.send('throw', 'tomato');
  if (e.key === 'r' || e.key === 'R') net.send('throw', 'rose');
  if (e.key === 'Enter') { e.preventDefault(); $('chatInput').focus(); }
});

// ---------------- BẤM / RÊ CHUỘT TRONG RẠP ----------------
theater.onPick = (hit) => {
  if (!state.joined) return;
  const me = state.me.id;
  if (!hit.user) { net.send('seat', hit.seat); return; }
  if (hit.user.id === me) return;
  if (hit.user.bot && hit.seat !== null) { net.send('seat', hit.seat); return; } // bot nhường ghế
  net.send('popcorn', { to: hit.user.id });
};

theater.onHover = (hit, x, y) => {
  const tip = $('seatTip');
  if (!hit || !state.joined) { tip.classList.add('hidden'); return; }
  tip.innerHTML = '';
  const head = document.createElement('b');
  const line = document.createElement('div');
  if (hit.seat !== null) {
    const s = seatInfo(hit.seat);
    head.textContent = `${s.code} · ${s.type}`;
  } else {
    head.textContent = '🎤 Trên sân khấu';
  }
  const u = hit.user;
  if (!u) line.textContent = 'Còn trống · bấm để ngồi';
  else if (u.id === state.me.id) line.textContent = 'Bạn đang ngồi đây';
  else if (u.bot) line.textContent = hit.seat !== null ? 'Bot · bấm để ngồi, bot sẽ nhường ghế' : 'Đang quẩy trên sân khấu';
  else line.textContent = 'Đã có người · bấm để ném bỏng ngô 🍿';
  tip.append(head, line);
  tip.style.left = x + 14 + 'px';
  tip.style.top = y + 14 + 'px';
  tip.classList.remove('hidden');
};

// ---------------- ĐỔI GÓC NHÌN ----------------
const VIEWS = [
  { id: 'overview', name: 'Toàn cảnh rạp' },
  { id: 'seat', name: 'Góc nhìn từ ghế' },
  { id: 'screen', name: 'Tập trung màn hình' },
  { id: 'audience', name: 'Nhìn khán giả từ phía màn hình' },
];
function setViewButtons(view) {
  document.querySelectorAll('#viewBar button[data-view]').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
}
function changeView(view) {
  if (!state.joined) return;
  theater.setView(view);
  setViewButtons(theater.view);
  toast('👁️ ' + VIEWS.find((v) => v.id === theater.view).name, 1800);
}
document.querySelectorAll('#viewBar button[data-view]').forEach((b) => { b.onclick = () => changeView(b.dataset.view); });
document.addEventListener('keydown', (e) => {
  if (!state.joined || e.target.tagName === 'INPUT' || e.key.toLowerCase() !== 'v') return;
  const i = VIEWS.findIndex((v) => v.id === theater.view);
  changeView(VIEWS[(i + 1) % VIEWS.length].id);
});

// ---------------- THANH MENU BÊN PHẢI + NGĂN TRƯỢT ----------------
function syncDock() {
  document.querySelectorAll('#dock [data-act]').forEach((b) => b.classList.toggle('active', b.dataset.act === state.drawer));
  document.body.classList.toggle('focus-chat', !!state.focus && state.drawer === 'chat');
  $('focusChat').classList.toggle('active', state.drawer === 'chat');
}
function openDrawer(view) {
  if (state.drawer === view) { closeDrawer(); return; }
  state.drawer = view;
  const d = $('drawer');
  d.dataset.view = view;
  d.classList.remove('hidden');
  $('drawerEyebrow').textContent = view === 'queue' ? 'CÙNG CHỌN, CÙNG XEM' : view === 'friends' ? 'KẾT BẠN · TẶNG QUÀ' : view === 'host' ? (state.room && !state.room.isMain ? 'CHỦ PHÒNG' : 'CHỦ RẠP') : `${humansCount()} NGƯỜI ĐANG Ở ĐÂY`;
  $('drawerTitle').textContent = view === 'queue' ? 'Danh sách chờ' : view === 'friends' ? 'Bạn bè' : view === 'host' ? 'Quản lý phòng' : 'Trò chuyện';
  if (view === 'chat') {
    setUnread(0);
    const log = $('chatLog');
    log.scrollTop = log.scrollHeight;
  }
  syncDock();
}
function closeDrawer() {
  state.drawer = null;
  $('drawer').classList.add('hidden');
  syncDock();
}
$('drawerClose').onclick = closeDrawer;
$('queueAdd').onclick = () => openVideoModal();

function setDockCollapsed(c) {
  $('dock').classList.toggle('collapsed', c);
  $('dockToggle').setAttribute('aria-expanded', !c);
  $('dockToggle').title = c ? 'Mở các nút' : 'Thu gọn các nút';
  store.set('dockCollapsed', c);
  updateDockBadge();
}
setDockCollapsed(store.get('dockCollapsed', false));
$('dockToggle').onclick = () => setDockCollapsed(!$('dock').classList.contains('collapsed'));

const DOCK_ACTIONS = {
  seats: () => openSeatModal(),
  video: () => openVideoModal(),
  post: () => openPostModal(),
  queue: () => openDrawer('queue'),
  chat: () => openDrawer('chat'),
  wardrobe: () => openWardrobe(),
  host: () => (state.drawer === 'host' ? closeDrawer() : openHost()),
  friends: () => (state.drawer === 'friends' ? closeDrawer() : openFriends()),
  support: () => openSupport(),
};
document.querySelectorAll('#dock [data-act]').forEach((b) => { b.onclick = () => DOCK_ACTIONS[b.dataset.act](); });
// nút ngoài menu phải: Phòng riêng (góc dưới trái), Nhiệm vụ + Xếp hạng (góc trên phải)
$('roomsBtn').onclick = () => openRooms();
$('missionBtn').onclick = () => openActivity('daily');
$('leaderBtn').onclick = () => openLeader();

// ---- Cửa sổ (modal) dùng chung ----
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) {
  if (id === 'wardrobeModal') { closeWardrobe(); return; }
  $(id).classList.add('hidden');
}
document.querySelectorAll('[data-close]').forEach((b) => { b.addEventListener('click', () => closeModal(b.dataset.close)); });
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
});
function closeTopLayer() {
  const open = [...document.querySelectorAll('.modal:not(.hidden)')];
  if (open.length) { closeModal(open[open.length - 1].id); return; }
  if (!$('emojiPanel').classList.contains('hidden')) { closeEmojiPanel(); return; }
  if (state.drawer) closeDrawer();
}

// ---------------- CHỌN GHẾ (sơ đồ) ----------------
function renderSeatMap() {
  const map = $('seatMap');
  map.innerHTML = '';
  const bySeat = new Map([...state.users.values()].map((u) => [u.seat, u]));
  const meId = state.me?.id;
  for (let r = 0; r < 10; r++) {
    const row = document.createElement('div');
    row.className = 'seatmap-row';
    const letter = 'ABCDEFGHIJ'[r];
    const l1 = document.createElement('span'); l1.className = 'row-label'; l1.textContent = letter;
    row.appendChild(l1);
    let col = 0;
    for (const size of SEAT_GROUPS) {
      const g = document.createElement('div');
      g.className = 'seat-group size-' + size;
      for (let k = 0; k < size; k++, col++) {
        const i = r * 10 + col;
        const s = seatInfo(i);
        const occ = bySeat.get(i);
        const mine = occ && occ.id === meId;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seat-choice' + (occ && !occ.bot && !mine ? ' taken' : '') + (occ?.bot ? ' bot-seat' : '') + (mine ? ' mine' : '');
        b.disabled = !!occ && !occ.bot && !mine;
        b.textContent = mine ? '✓' : String(col + 1).padStart(2, '0');
        const status = mine ? 'Bạn đang ngồi' : occ?.bot ? 'Bot · bấm để ngồi, bot sẽ nhường ghế' : occ ? 'Đã có người' : 'Còn trống';
        b.title = `${s.code} · ${s.type} · ${status}`;
        b.setAttribute('aria-label', b.title);
        b.onclick = () => { if (!mine) net.send('seat', i); closeModal('seatModal'); };
        g.appendChild(b);
      }
      row.appendChild(g);
    }
    const l2 = document.createElement('span'); l2.className = 'row-label'; l2.textContent = letter;
    row.appendChild(l2);
    map.appendChild(row);
  }
  $('seatFree').textContent = 100 - state.users.size;
}
function openSeatModal() { renderSeatMap(); openModal('seatModal'); }

// ---------------- GỬI VIDEO ----------------
let videoPreviewData = null;
function resetVideoPreview() {
  videoPreviewData = null;
  $('videoPreview').classList.add('hidden');
  $('videoPreviewBtn').classList.remove('hidden');
  $('videoErr').textContent = '';
}
function openVideoModal() {
  $('videoUrl').value = '';
  setVideoMood('normal');
  $('vpBpm').value = 128;
  $('vpBpmWrap').classList.add('hidden');
  $('vpLimit').textContent = `Mỗi tài khoản có tối đa ${state.maxQueue} video trong hàng chờ. Video có nhiều 👍 nhất được chiếu trước.`;
  resetVideoPreview();
  openModal('videoModal');
  setTimeout(() => $('videoUrl').focus(), 50);
}
$('videoUrl').addEventListener('input', resetVideoPreview);
$('videoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('videoUrl').value.trim();
  if (!url) { $('videoErr').textContent = 'Bạn dán link YouTube vào nhé.'; return; }
  const btn = $('videoPreviewBtn');
  btn.disabled = true;
  btn.textContent = 'Đang lấy thông tin video…';
  $('videoErr').textContent = '';
  const r = await net.request('preview', url);
  btn.disabled = false;
  btn.textContent = 'Xem trước video →';
  if (!r?.ok) { $('videoErr').textContent = r?.error || 'Chưa xem trước được video.'; return; }
  videoPreviewData = r;
  $('vpThumb').src = `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`;
  $('vpTitle').textContent = r.title;
  $('vpMeta').textContent = [r.author, r.duration ? fmtTime(r.duration) : null].filter(Boolean).join(' · ') || 'YouTube';
  $('videoPreview').classList.remove('hidden');
  btn.classList.add('hidden');
});
let videoMood = 'normal';
function setVideoMood(m) {
  videoMood = m;
  document.querySelectorAll('#vpMood button').forEach((b) => { const on = b.dataset.mood === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  $('vpBpmWrap').classList.toggle('hidden', m !== 'party');
}
document.querySelectorAll('#vpMood button').forEach((b) => { b.onclick = () => setVideoMood(b.dataset.mood); });
$('videoAddBtn').onclick = async () => {
  if (!videoPreviewData) return;
  const btn = $('videoAddBtn');
  btn.disabled = true;
  const r = await net.request('add-video', {
    url: $('videoUrl').value.trim(),
    mood: videoMood,
    energetic: videoMood === 'party',
    bpm: Number($('vpBpm').value) || 128,
  });
  btn.disabled = false;
  if (!r?.ok) { $('videoErr').textContent = r?.error || 'Chưa thêm được video.'; return; }
  closeModal('videoModal');
  toast('🎬 Video đã vào hàng chờ. Mời cả rạp bình chọn!');
};

// ---------------- ỦNG HỘ ----------------
const money = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';
const sup = { amount: 20000, info: null };

async function openSupport() {
  openModal('supportModal');
  $('supportErr').textContent = '';
  await loadSupport();
}
async function loadSupport() {
  const r = await api('/api/support');
  if (!r.ok) { $('supportErr').textContent = r.error || 'Chưa tải được thông tin ủng hộ.'; return; }
  sup.info = r;
  if (r.account) { state.account = r.account; renderAccount(); }
  renderSupport();
}
function qrLink(info, amount) {
  const e = encodeURIComponent;
  return `https://img.vietqr.io/image/${e(info.bank.id)}-${e(info.bank.accountNo)}-compact2.png?amount=${amount}&addInfo=${e(info.note)}&accountName=${e(info.bank.accountName)}`;
}
function renderSupport() {
  const info = sup.info;
  if (!info) return;
  const acc = state.account;
  $('supportOff').classList.toggle('hidden', info.enabled);
  $('supportOn').classList.toggle('hidden', !info.enabled);
  $('supBalance').textContent = (acc?.balance ?? 0) + ' 🍿';
  $('supDonated').textContent = money(info.donated);
  // lịch sử
  $('supHistory').classList.toggle('hidden', !info.requests.length);
  $('supHistCount').textContent = info.requests.length;
  const hist = $('supHistList');
  hist.innerHTML = '';
  const ST = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Chưa xác nhận' };
  for (const r of info.requests) {
    const row = document.createElement('div');
    const d = document.createElement('span'); d.textContent = new Date(r.createdAt).toLocaleDateString('vi-VN');
    const m = document.createElement('strong'); m.textContent = `${money(r.amount)} · ${r.points} 🍿`;
    const s = document.createElement('span'); s.className = 'status-' + r.status; s.textContent = ST[r.status] || r.status;
    row.append(d, m, s);
    hist.appendChild(row);
  }
  if (!info.enabled) return;
  // các mức ủng hộ
  const tiers = $('supportTiers');
  tiers.innerHTML = '';
  const rate = info.vndPerPoint || 100;
  const pts = acc?.points ?? 0;
  const amounts = info.amounts;
  const isCustom = !amounts.includes(sup.amount);
  amounts.forEach((amt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const gain = Math.floor(amt / rate);
    const reach = [...TIERS].reverse().find((t) => t.points > pts && t.points <= pts + gain);
    b.className = 'support-tier' + (sup.amount === amt ? ' chosen' : '');
    b.style.setProperty('--tier-color', reach ? reach.color : '#d6f06c');
    const NAMES = ['Ủng hộ nhẹ', 'Ủng hộ vừa', 'Ủng hộ xịn', 'Fan cuồng', 'Mạnh thường quân'];
    const st = document.createElement('strong'); st.textContent = NAMES[i] || 'Ủng hộ';
    const sp = document.createElement('span'); sp.textContent = money(amt);
    const sm = document.createElement('small'); sm.textContent = `+${gain} 🍿` + (reach ? ` · lên ${reach.icon} ${reach.name}` : '');
    b.append(st, sp, sm);
    b.onclick = () => { sup.amount = amt; $('supportAck').checked = false; renderSupport(); };
    tiers.appendChild(b);
  });
  const custom = document.createElement('div');
  custom.className = 'support-tier' + (isCustom ? ' chosen' : '');
  const cst = document.createElement('strong'); cst.textContent = 'Số khác';
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = 10000; inp.step = 1000; inp.placeholder = '≥ 10.000';
  if (isCustom) inp.value = sup.amount;
  const csm = document.createElement('small'); csm.textContent = isCustom ? `+${Math.floor(sup.amount / rate)} 🍿` : 'tuỳ bạn';
  inp.onchange = () => {
    const v = Math.round(Number(inp.value) / 1000) * 1000;
    if (v >= 10000) { sup.amount = v; $('supportAck').checked = false; renderSupport(); }
  };
  custom.append(cst, inp, csm);
  tiers.appendChild(custom);
  // QR + thông tin chuyển khoản
  $('qrBankId').textContent = info.bank.id;
  $('qrImg').src = qrLink(info, sup.amount);
  $('qrImg').alt = `QR chuyển ${money(sup.amount)}, nội dung ${info.note}`;
  $('qrAmount').textContent = money(sup.amount);
  $('ackAmount').textContent = money(sup.amount);
  $('bankName').textContent = info.bank.name;
  $('bankAccName').textContent = info.bank.accountName;
  $('bankAccNo').textContent = info.bank.accountNo;
  $('bankNote').textContent = info.note;
  const pending = info.requests.find((r) => r.status === 'pending');
  const pBox = $('supportPending');
  pBox.classList.toggle('hidden', !pending);
  if (pending) pBox.textContent = `⏳ Đang chờ chủ rạp xác nhận ${money(pending.amount)}. 🍿 sẽ được cộng ngay khi chủ rạp duyệt.`;
  $('supportSend').disabled = !$('supportAck').checked;
}
$('supportAck').onchange = () => { $('supportSend').disabled = !$('supportAck').checked; };
$('supportSend').onclick = async () => {
  $('supportSend').disabled = true;
  $('supportErr').textContent = '';
  const r = await api('/api/support/request', { amount: sup.amount });
  if (!r.ok) { $('supportErr').textContent = r.error; $('supportSend').disabled = false; return; }
  sup.info = r;
  $('supportAck').checked = false;
  renderSupport();
  toast('💖 Đã báo chủ rạp. Cảm ơn bạn! 🍿 sẽ được cộng khi chủ rạp duyệt.', 5000);
};
document.querySelectorAll('.copy-btn').forEach((b) => {
  b.onclick = async () => {
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); toast('Đã sao chép: ' + text); } catch { toast(text, 6000); }
  };
});
$('supWardrobe').onclick = () => { closeModal('supportModal'); openWardrobe(); };
$('wdSupport').onclick = () => { closeWardrobe(); openSupport(); };

// ---------------- CHIẾU ẢNH ----------------
let postImage = null;
let postSeconds = 6;

const postCostOf = (s) => state.catalog?.postCosts?.[s] ?? 0;

function buildPostSeconds() {
  const box = $('postSeconds');
  box.innerHTML = '';
  if (!state.postSeconds.includes(postSeconds)) postSeconds = state.postSeconds[0];
  for (const s of state.postSeconds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = s === postSeconds ? 'on' : '';
    b.textContent = s + ' giây';
    const sm = document.createElement('small');
    const c = postCostOf(s);
    sm.textContent = c ? c + ' 🍿' : 'miễn phí';
    b.appendChild(sm);
    b.onclick = () => { postSeconds = s; buildPostSeconds(); };
    box.appendChild(b);
  }
  updatePostSend();
}

function updatePostSend() {
  const cost = postCostOf(postSeconds);
  const bal = state.account?.balance ?? 0;
  $('postBalance').textContent = bal;
  $('postSend').textContent = cost ? `Chiếu lên màn hình · ${cost} 🍿` : 'Chiếu lên màn hình';
  const enough = bal >= cost;
  $('postSend').disabled = !postImage || !enough;
  if (postImage && !enough) postMessage(`Chiếu ${postSeconds} giây cần ${cost} 🍿, bạn còn ${bal} 🍿. Chọn thời gian ngắn hơn, xem phim thêm hoặc ủng hộ rạp nhé.`, 'err');
  else if ($('postMsg').className === 'err' && enough) postMessage('');
}

function postMessage(text, cls = '') {
  $('postMsg').className = cls;
  $('postMsg').textContent = text;
}

function openPostModal() {
  postImage = null;
  $('postFile').value = '';
  $('postText').value = '';
  $('postPreview').classList.add('hidden');
  $('postPick').classList.remove('hidden');
  postMessage('');
  const P = state.catalog?.prices;
  $('postSub').textContent = P && P.postBase
    ? `Chọn ảnh, viết lời nhắn và chọn thời gian chiếu. 6 giây = ${P.postBase} 🍿; từ 10 giây trở lên ${P.postPerSecond} 🍿 mỗi giây, trừ vào 🍿 còn dùng được.`
    : 'Chọn ảnh, viết lời nhắn và chọn thời gian chiếu.';
  buildPostSeconds();
  openModal('postModal');
}
function closePostModal() { closeModal('postModal'); }

async function loadImage(file) {
  try { return await createImageBitmap(file); } catch { /* thử cách khác */ }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

// Thu nhỏ + nén ảnh trên máy người gửi (tối đa 1600x900, ~650KB)
async function compressImage(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('Ảnh tối đa 12MB.');
  const img = await loadImage(file);
  if (!img) {
    throw new Error(/hei[cf]/i.test(file.type + file.name)
      ? 'Trình duyệt chưa đọc được ảnh HEIC. Bạn chụp màn hình ảnh rồi gửi lại nhé.'
      : 'Định dạng ảnh chưa hỗ trợ. Hãy chọn JPG, PNG, WebP hoặc GIF.');
  }
  let scale = Math.min(1, 1600 / img.width, 900 / img.height);
  for (let attempt = 0; attempt < 4; attempt++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.72, 0.6]) {
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= 650 * 1024) {
        return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      }
    }
    scale *= 0.7;
  }
  throw new Error('Không nén được ảnh, bạn chọn ảnh khác nhé.');
}

$('postTopup').onclick = () => { closePostModal(); openSupport(); };
$('postFile').addEventListener('change', async () => {
  const file = $('postFile').files[0];
  if (!file) return;
  postMessage('Đang xử lý ảnh…');
  $('postSend').disabled = true;
  try {
    postImage = await compressImage(file);
    $('postPreview').src = postImage;
    $('postPreview').classList.remove('hidden');
    $('postPick').classList.add('hidden');
    postMessage('');
  } catch (err) {
    postImage = null;
    postMessage(err.message, 'err');
  }
  updatePostSend();
});
$('postSend').onclick = async () => {
  if (!postImage || !state.token) return;
  $('postSend').disabled = true;
  postMessage('Đang gửi…');
  try {
    const r = await fetch('/api/screen-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': state.token },
      body: JSON.stringify({ image: postImage, text: $('postText').value.trim(), seconds: postSeconds }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'Gửi ảnh chưa được, thử lại nhé.');
    if (j.account) { state.account = j.account; renderAccount(); }
    closePostModal();
    toast(j.position ? `🖼️ Ảnh của bạn xếp thứ ${j.position} trong hàng chờ chiếu.` : '🖼️ Ảnh của bạn đang được chiếu!');
  } catch (err) {
    postMessage(err.message, 'err');
    updatePostSend();
  }
};

let toastTimer;
function toast(text, ms = 3500) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------------- HOẠT ĐỘNG: điểm danh, nhiệm vụ, lịch chiếu, xếp hạng tuần ----------------
const act = { tab: 'daily', leader: null, cat: 'watch' };
const VN_MS = 7 * 3600 * 1000;
const pad2 = (n) => String(n).padStart(2, '0');
const vnDayKey = () => new Date(Date.now() + VN_MS).toISOString().slice(0, 10);
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${pad2(m)} phút`;
  return `${pad2(m)}:${pad2(sec)}`;
}
// giờ Việt Nam (UTC+7) tính tay, không phụ thuộc dữ liệu múi giờ của trình duyệt
const vnParts = (t) => { const d = new Date(t + VN_MS); return { day: pad2(d.getUTCDate()), month: d.getUTCMonth() + 1, time: pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) }; };
const activityOpen = () => !$('activityModal').classList.contains('hidden');

function setEngage(e) {
  if (!e || !e.checkin) return;
  state.engage = { checkin: e.checkin, missions: e.missions, claimable: e.claimable };
  const b = $('engageBadge');
  b.textContent = e.claimable;
  b.classList.toggle('hidden', !e.claimable);
  if (activityOpen() && act.tab === 'daily') renderDaily();
}
function setEvents(list) {
  if (!Array.isArray(list)) return;
  state.events = list.map((ev) => ({ ...ev, reminded: ev.reminded || state.reminded.has(ev.id) }));
  if (activityOpen() && act.tab === 'events') renderEvents();
  updateEventBanner();
}

// ---- Điểm danh + nhiệm vụ ----
function renderDaily() {
  const e = state.engage;
  if (!e) return;
  const c = e.checkin;
  $('ciStreak').textContent = c.streak > 0 ? `🔥 Chuỗi ${c.streak} ngày liên tiếp` : '🔥 Bắt đầu chuỗi điểm danh nào!';
  const days = $('ciDays');
  days.innerHTML = '';
  c.rewards.forEach((r, i) => {
    const d = document.createElement('div');
    const done = c.done ? i <= c.cycleIndex : i < c.cycleIndex;
    const today = i === c.cycleIndex;
    d.className = 'ci-day' + (done ? ' done' : '') + (today ? ' today' : '') + (i === c.rewards.length - 1 ? ' big' : '');
    d.textContent = done ? '✓ Ngày ' + (i + 1) : 'Ngày ' + (i + 1);
    const b = document.createElement('b');
    b.textContent = '+' + r + ' 🍿';
    d.appendChild(b);
    days.appendChild(d);
  });
  const btn = $('ciBtn');
  if (c.done) {
    btn.disabled = true;
    btn.textContent = `✓ Đã điểm danh · mai +${c.rewards[(c.cycleIndex + 1) % c.rewards.length]} 🍿`;
  } else {
    btn.disabled = false;
    btn.textContent = `Điểm danh +${c.reward} 🍿`;
  }
  // nhiệm vụ
  const list = $('msList');
  list.innerHTML = '';
  const row = (icon, title, progress, target, reward, done, claimed, id, extra = '') => {
    const r = document.createElement('div');
    r.className = 'mission' + extra;
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = icon;
    const mid = document.createElement('div');
    const t = document.createElement('div'); t.className = 't'; t.textContent = title;
    mid.appendChild(t);
    if (target) {
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('i'); fill.style.width = Math.min(100, (progress / target) * 100) + '%';
      bar.appendChild(fill);
      const p = document.createElement('div'); p.className = 'p'; p.textContent = `${progress}/${target} · thưởng +${reward} 🍿`;
      mid.append(bar, p);
    } else {
      const p = document.createElement('div'); p.className = 'p'; p.textContent = `Thưởng thêm +${reward} 🍿`;
      mid.appendChild(p);
    }
    const b = document.createElement('button');
    b.textContent = claimed ? '✓ Đã nhận' : done ? `Nhận +${reward}` : 'Chưa xong';
    b.disabled = claimed || !done;
    b.onclick = async () => {
      b.disabled = true;
      const res = await net.request('claim', id);
      if (!res?.ok) { toast(res?.error || 'Chưa nhận được.'); b.disabled = false; return; }
      setEngage(res);
      toast(`🎁 +${res.reward} 🍿`);
    };
    r.append(ic, mid, b);
    list.appendChild(r);
  };
  for (const m of e.missions.list) row(m.icon, m.title, m.progress, m.target, m.reward, m.done, m.claimed, m.id);
  const bo = e.missions.bonus;
  row('🎁', 'Hoàn thành tất cả nhiệm vụ hôm nay', 0, 0, bo.reward, bo.claimable || bo.claimed, bo.claimed, 'bonus', ' bonus');
  updateResetCountdown();
}
function updateResetCountdown() {
  const now = Date.now();
  const next = (Math.floor((now + VN_MS) / 86400000) + 1) * 86400000 - VN_MS;
  $('msReset').textContent = `Nhiệm vụ mới sau ${fmtCountdown(next - now)}`;
}
$('ciBtn').onclick = async () => {
  $('ciBtn').disabled = true;
  const res = await net.request('checkin');
  if (!res?.ok) { toast(res?.error || 'Chưa điểm danh được.'); renderDaily(); return; }
  setEngage(res);
  renderDaily();
  toast(`🔥 Điểm danh ngày ${res.streak}: +${res.reward} 🍿`);
};

// ---- Lịch chiếu ----
function renderEvents() {
  const list = $('evList');
  list.innerHTML = '';
  if (!state.events.length) {
    const p = document.createElement('div');
    p.className = 'empty-note';
    p.textContent = '📅 Chưa có lịch chiếu nào. Chủ rạp sẽ thông báo sớm thôi!';
    list.appendChild(p);
    return;
  }
  const now = serverNow();
  for (const ev of state.events) {
    const live = ev.startsAt <= now;
    const it = document.createElement('div');
    it.className = 'event-item' + (live ? ' live' : '');
    const date = document.createElement('div'); date.className = 'event-date';
    const vp = vnParts(ev.startsAt);
    const dd = document.createElement('b'); dd.textContent = vp.day;
    const mm = document.createElement('span'); mm.textContent = `Th ${vp.month} · ${vp.time}`;
    date.append(dd, mm);
    const info = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = ev.title;
    info.appendChild(h);
    if (ev.desc) { const p = document.createElement('p'); p.textContent = ev.desc; info.appendChild(p); }
    const w = document.createElement('div'); w.className = 'when';
    w.dataset.ev = ev.id;
    info.appendChild(w);
    const b = document.createElement('button');
    b.className = ev.reminded ? 'on' : '';
    b.textContent = live ? '🎬 Đang chiếu' : ev.reminded ? '🔔 Đã bật nhắc' : '🔔 Nhắc tôi';
    b.disabled = live;
    b.onclick = async () => {
      const on = !ev.reminded;
      if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* bỏ qua */ } }
      const res = await net.request('remind', { id: ev.id, on });
      if (!res?.ok) { toast(res?.error || 'Chưa bật nhắc được.'); return; }
      if (on) state.reminded.add(ev.id); else state.reminded.delete(ev.id);
      setEvents(res.events);
      toast(on ? '🔔 Rạp sẽ nhắc bạn trước 10 phút và lúc bắt đầu' : 'Đã tắt nhắc');
    };
    it.append(date, info, b);
    list.appendChild(it);
  }
  updateEventTimes();
}
// chỉ cập nhật dòng đếm ngược mỗi giây, không vẽ lại cả danh sách (để nút bấm không bị "trôi")
function updateEventTimes() {
  const now = serverNow();
  let changed = false;
  document.querySelectorAll('#evList .when[data-ev]').forEach((w) => {
    const ev = state.events.find((e) => e.id === w.dataset.ev);
    if (!ev) return;
    const live = ev.startsAt <= now;
    if (live !== w.parentElement.parentElement.classList.contains('live')) changed = true;
    w.textContent = (live ? `🔴 ĐANG DIỄN RA · còn ${fmtCountdown(ev.endsAt - now)}` : `Bắt đầu sau ${fmtCountdown(ev.startsAt - now)}`) + ` · 🍿 x${ev.multiplier}`;
  });
  if (changed) renderEvents();
}

// ---- Xếp hạng tuần ----
function renderLeader() {
  const lb = act.leader;
  if (!lb) return;
  const chips = $('lbCats');
  chips.innerHTML = '';
  for (const c of lb.cats) {
    const b = document.createElement('button');
    b.className = c.id === act.cat ? 'on' : '';
    b.textContent = c.icon + ' ' + c.name;
    b.onclick = () => { act.cat = c.id; renderLeader(); };
    chips.appendChild(b);
  }
  $('lbEnds').textContent = `Tuần kết thúc sau ${fmtCountdown(lb.endsAt - serverNow())}`;
  const cat = lb.cats.find((c) => c.id === act.cat) || lb.cats[0];
  const list = $('lbList');
  list.innerHTML = '';
  if (!cat.top.length) {
    const p = document.createElement('div');
    p.className = 'empty-note';
    p.textContent = 'Chưa có ai trong bảng tuần này. Bạn sẽ là người đầu tiên!';
    list.appendChild(p);
  }
  const MEDAL = ['🥇', '🥈', '🥉'];
  for (const r of cat.top) {
    const row = document.createElement('div');
    row.className = 'leader-row' + (r.rank === 1 ? ' top1' : '') + (r.me ? ' me' : '');
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = MEDAL[r.rank - 1] || r.rank;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name + (r.me ? ' (bạn)' : '');
    nm.style.color = CHARACTER_INFO[r.character]?.color || '';
    const vl = document.createElement('span'); vl.className = 'vl'; vl.textContent = `${r.value} ${cat.unit}`;
    row.append(rk, nm, vl);
    list.appendChild(row);
  }
  $('lbMine').textContent = cat.mine?.rank ? `Bạn đang đứng hạng ${cat.mine.rank} với ${cat.mine.value} ${cat.unit}.` : `Bạn chưa có tên trong bảng "${cat.name}" tuần này.`;
  $('lbPrizes').textContent = `🏆 Cuối tuần (0:00 thứ Hai), top 1–2–3 mỗi bảng nhận +${lb.prizes.join(' / +')} 🍿 và huy hiệu 🥇🥈🥉 hiện cạnh tên trong Trò chuyện suốt tuần sau.`;
  const last = $('lbLast');
  last.classList.toggle('hidden', !lb.last);
  if (lb.last) {
    const box = $('lbLastList');
    box.innerHTML = '';
    for (const c of lb.last) {
      const row = document.createElement('div');
      const a = document.createElement('span'); a.textContent = c.icon + ' ' + c.name;
      const w = document.createElement('strong'); w.textContent = c.winners.map((x) => `${MEDAL[x.rank - 1]} ${x.name}`).join('  ') || '—';
      row.append(a, w);
      box.appendChild(row);
    }
  }
}

function showActTab(tab) {
  act.tab = tab;
  document.querySelectorAll('#actTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('actDaily').classList.toggle('hidden', tab !== 'daily');
  $('actEvents').classList.toggle('hidden', tab !== 'events');
  $('actInvite').classList.toggle('hidden', tab !== 'invite');
  if (tab === 'invite') renderInvite();
  if (tab === 'daily') renderDaily();
  if (tab === 'events') renderEvents();
}
document.querySelectorAll('#actTabs button').forEach((b) => { b.onclick = () => showActTab(b.dataset.tab); });

async function openActivity(tab = 'daily') {
  openModal('activityModal');
  showActTab(tab);
  const res = await net.request('engage');
  if (res?.ok) {
    setEngage(res);
    setEvents(res.events);
    act.leader = res.leaderboard;
    showActTab(act.tab);
  }
}

// ---- Xếp hạng tuần (cửa sổ riêng) ----
const leaderOpen = () => !$('leaderModal').classList.contains('hidden');
async function openLeader() {
  openModal('leaderModal');
  if (act.leader) renderLeader();
  const res = await net.request('engage');
  if (res?.ok) {
    setEngage(res);
    setEvents(res.events);
    act.leader = res.leaderboard;
    if (leaderOpen()) renderLeader();
  }
}

// Nhãn Đêm phim ở góc trái: đang diễn ra / sắp diễn ra trong 24 giờ
function updateEventBanner() {
  const el = $('eventBanner');
  const now = serverNow();
  const live = state.events.find((e) => e.startsAt <= now && e.endsAt > now);
  const next = state.events.find((e) => e.startsAt > now && e.startsAt - now < 86400000);
  if (live) {
    el.className = 'event-banner live';
    el.textContent = `🎬 ĐÊM PHIM: ${live.title} · 🍿 x${live.multiplier}`;
  } else if (next) {
    el.className = 'event-banner';
    el.textContent = `📅 ${next.title} · bắt đầu sau ${fmtCountdown(next.startsAt - now)}`;
  } else {
    el.className = 'event-banner hidden';
  }
}
$('eventBanner').onclick = () => openActivity('events');
setInterval(() => {
  updateEventBanner();
  if (leaderOpen() && act.leader) $('lbEnds').textContent = `Tuần kết thúc sau ${fmtCountdown(act.leader.endsAt - serverNow())}`;
  if (!activityOpen()) return;
  if (act.tab === 'events') updateEventTimes();
  if (act.tab === 'daily') updateResetCountdown();
}, 1000);

// ---------------- NHÓM 2: XEM CÙNG NHAU ----------------
// ===== Khoảnh khắc hot (biểu đồ cảm xúc trên thanh tiến độ) =====
const HEAT_COLS = 60;
function setMoments(m) {
  if (!m) return;
  state.moments = m;
  drawHeatmap();
}
function drawHeatmap() {
  const cur = state.current;
  const m = state.moments;
  const wrap = $('heatWrap');
  const ok = cur && cur.duration && m && m.videoId === cur.videoId && m.b.length > 0;
  wrap.classList.toggle('hidden', !ok);
  if (!ok) return;
  const cols = new Array(HEAT_COLS).fill(0);
  const tops = new Array(HEAT_COLS).fill(null).map(() => ({}));
  for (const [k, n, emo] of m.b) {
    const sec = (k + 0.5) * m.bucket;
    const c = Math.min(HEAT_COLS - 1, Math.floor((sec / cur.duration) * HEAT_COLS));
    if (c < 0) continue;
    cols[c] += n;
    tops[c][emo] = (tops[c][emo] || 0) + n;
  }
  const max = Math.max(1, ...cols);
  const cv = $('heatmap');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 220, H = cv.clientHeight || 26;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const played = Math.max(0, Math.min(1, (serverNow() - cur.startedAt) / 1000 / cur.duration));
  const cw = W / HEAT_COLS;
  for (let i = 0; i < HEAT_COLS; i++) {
    const v = cols[i] / max;
    const h = cols[i] ? Math.max(2, Math.sqrt(v) * (H - 2)) : 1;
    const past = (i + 0.5) / HEAT_COLS <= played;
    g.fillStyle = cols[i] ? (past ? `rgba(255, ${Math.round(150 - v * 90)}, ${Math.round(90 - v * 40)}, ${0.55 + v * 0.45})` : `rgba(255, 200, 120, ${0.22 + v * 0.35})`) : 'rgba(255,255,255,.12)';
    g.fillRect(i * cw + 0.5, H - h, Math.max(1, cw - 1), h);
  }
  // điểm đang chiếu
  g.fillStyle = '#d6f06c';
  g.fillRect(Math.min(W - 2, played * W), 0, 2, H);
  // 3 khoảnh khắc hot nhất: hiện emoji phía trên
  const peaks = cols.map((v, i) => [v, i]).filter(([v]) => v >= Math.max(3, max * 0.45)).sort((a, b) => b[0] - a[0]);
  const chosen = [];
  for (const [, i] of peaks) { if (chosen.every((j) => Math.abs(j - i) > 4)) chosen.push(i); if (chosen.length === 3) break; }
  const key = chosen.map((i) => i + Object.keys(tops[i]).join('')).join('|');
  if (key !== drawHeatmap.key) {
    drawHeatmap.key = key;
    const box = $('heatPeaks');
    box.innerHTML = '';
    for (const i of chosen) {
      const s = document.createElement('span');
      s.textContent = Object.entries(tops[i]).sort((a, b) => b[1] - a[1])[0][0];
      s.style.left = ((i + 0.5) / HEAT_COLS) * 100 + '%';
      box.appendChild(s);
    }
  }
}

// ===== Emoji bùng nổ =====
function emojiBurst(emoji, count) {
  const layer = $('burstLayer');
  if (layer.childElementCount > 80) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const core = document.createElement('div');
  core.className = 'burst-core';
  core.textContent = emoji;
  const sm = document.createElement('small');
  sm.textContent = `${count} người cùng thả!`;
  core.appendChild(sm);
  layer.appendChild(core);
  setTimeout(() => core.remove(), 1500);
  const n = reduce ? 0 : window.innerWidth < 700 ? 16 : 28;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('span');
    b.className = 'burst-bit';
    b.textContent = emoji;
    const ang = Math.random() * Math.PI * 2;
    const dist = 160 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.45;
    b.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    b.style.setProperty('--dy', Math.sin(ang) * dist * 0.8 - 60 + 'px');
    b.style.setProperty('--s', (0.6 + Math.random() * 1.1).toFixed(2));
    b.style.setProperty('--r', (Math.random() * 120 - 60).toFixed(0) + 'deg');
    b.style.animationDelay = Math.random() * 0.25 + 's';
    b.style.fontSize = 30 + Math.random() * 30 + 'px';
    layer.appendChild(b);
    setTimeout(() => b.remove(), 2400);
  }
  // nhân vật trong rạp cũng thả theo
  const ids = [...state.users.keys()].sort(() => Math.random() - 0.5).slice(0, 8);
  ids.forEach((id, i) => setTimeout(() => theater.emoji(id, emoji), i * 90));
}

// ===== Câu đoán =====
const canCreatePoll = () => state.joined && state.me && (state.isHost || (state.current && state.current.byId === state.me.id));
const canManagePoll = (p) => state.joined && state.me && (state.isHost || p.byId === state.me.id);
let revealArm = null; // bấm 2 lần mới chốt đáp án
function setPoll(p) {
  const prev = state.poll;
  state.poll = p || null;
  if (prev && p && prev.id === p.id && prev.status !== 'revealed' && p.status === 'revealed' && state.me && p.byId !== state.me.id) {
    if (p.mine === p.correct) toast(`🔮 Bạn đoán đúng! +${p.reward} 🍿`, 5000);
    else if (p.mine != null) toast(`🔮 Tiếc quá, đáp án là "${p.options[p.correct]}"`, 5000);
  }
  if (!p || prev?.id !== p.id) revealArm = null;
  renderPoll();
}
function renderPoll() {
  const p = state.poll;
  $('pollNewBtn').classList.toggle('hidden', !canCreatePoll() || !!(p && p.status !== 'revealed'));
  const card = $('pollCard');
  card.classList.toggle('hidden', !p || !state.joined);
  if (!p || !state.joined) return;
  $('pollQ').textContent = p.question;
  const opts = $('pollOpts');
  opts.innerHTML = '';
  const total = p.counts ? p.counts.reduce((a, b) => a + b, 0) : 0;
  const amCreator = state.me && p.byId === state.me.id;
  p.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'poll-opt' + (p.mine === i ? ' mine' : '') + (p.status === 'revealed' ? (i === p.correct ? ' correct' : ' wrong') : '');
    b.disabled = p.status !== 'open' || amCreator;
    const fill = document.createElement('i'); fill.className = 'fill';
    if (p.counts) fill.style.width = (total ? (p.counts[i] / total) * 100 : 0) + '%';
    const l = document.createElement('span');
    l.textContent = (p.status === 'revealed' && i === p.correct ? '✅ ' : p.mine === i ? '✓ ' : '') + o;
    const r = document.createElement('span');
    r.textContent = p.counts ? `${total ? Math.round((p.counts[i] / total) * 100) : 0}% · ${p.counts[i]}` : '';
    b.append(fill, l, r);
    b.onclick = async () => {
      const res = await net.request('poll-answer', i);
      if (!res?.ok) return toast(res?.error || 'Chưa chọn được.');
      setPoll(res.poll);
    };
    opts.appendChild(b);
  });
  const foot = $('pollFoot');
  foot.innerHTML = '';
  const t = (html) => { const d = document.createElement('div'); d.textContent = html; foot.appendChild(d); return d; };
  if (p.status === 'open') {
    t(`${p.byName} hỏi · ${p.total} người đã đoán · đoán đúng +${p.reward} 🍿`);
    if (amCreator) t('Bạn là người ra câu hỏi nên không đoán được.');
    else if (p.mine == null) t('Chọn một đáp án — đổi được cho tới khi hết giờ.');
  } else if (p.status === 'closed') {
    t(`Hết giờ đoán · ${p.total} người tham gia. Chờ ${p.byName} công bố đáp án…`);
  } else {
    const d = t('');
    const b = document.createElement('b');
    b.textContent = p.winners ? `${p.winners} người đoán đúng, mỗi người +${p.reward} 🍿` : 'Không ai đoán đúng cả 😅';
    d.appendChild(b);
    if (!amCreator && p.mine != null) t(p.mine === p.correct ? '🎉 Bạn đoán đúng!' : 'Lần sau may mắn hơn nhé!');
  }
  // khu điều khiển cho chủ câu hỏi / chủ rạp
  const ad = $('pollAdmin');
  ad.innerHTML = '';
  const show = canManagePoll(p) && p.status !== 'revealed';
  ad.classList.toggle('hidden', !show);
  if (!show) return;
  const lbl = document.createElement('span');
  lbl.textContent = revealArm == null ? 'Công bố đáp án đúng:' : `Bấm lần nữa vào "${p.options[revealArm]}" để chốt`;
  ad.appendChild(lbl);
  p.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'ans';
    b.textContent = (revealArm === i ? '✔ Chốt: ' : '') + o;
    b.onclick = async () => {
      if (revealArm !== i) { revealArm = i; renderPoll(); return; }
      revealArm = null;
      const res = await net.request('poll-reveal', i);
      if (!res?.ok) toast(res?.error || 'Chưa công bố được.');
    };
    ad.appendChild(b);
  });
  if (p.status === 'open') {
    const c = document.createElement('button');
    c.textContent = '⏹ Khoá ngay';
    c.onclick = () => net.request('poll-close');
    ad.appendChild(c);
  }
  const x = document.createElement('button');
  x.textContent = 'Huỷ';
  x.onclick = () => net.request('poll-cancel');
  ad.appendChild(x);
}
function tickPoll() {
  const p = state.poll;
  if (!p) return;
  const el = $('pollTime');
  if (p.status === 'open') {
    const left = Math.max(0, Math.ceil((p.closesAt - serverNow()) / 1000));
    el.textContent = `⏳ ${Math.floor(left / 60)}:${pad2(left % 60)}`;
  } else el.textContent = p.status === 'closed' ? '🔒 Đã khoá' : '🏁 Kết quả';
}
setInterval(tickPoll, 500);

// Cửa sổ ra câu đoán
const SEC_LABEL = (s) => (s < 60 ? `${s} giây` : `${s / 60} phút`);
let pqSeconds = 60;
function pqRow(value = '') {
  const box = $('pqOptions');
  if (box.childElementCount >= 4) return;
  const row = document.createElement('div');
  const inp = document.createElement('input');
  inp.maxLength = 40;
  inp.value = value;
  inp.placeholder = 'Lựa chọn ' + (box.childElementCount + 1);
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '✕';
  del.title = 'Bỏ lựa chọn này';
  del.onclick = () => { if (box.childElementCount > 2) { row.remove(); pqRefresh(); } };
  row.append(inp, del);
  box.appendChild(row);
  pqRefresh();
}
function pqRefresh() {
  const n = $('pqOptions').childElementCount;
  $('pqAdd').classList.toggle('hidden', n >= 4);
  [...$('pqOptions').children].forEach((r, i) => { r.querySelector('input').placeholder = 'Lựa chọn ' + (i + 1); });
}
function openPollModal() {
  $('pqQuestion').value = '';
  $('pqOptions').innerHTML = '';
  pqRow(); pqRow();
  $('pqMsg').textContent = '';
  const chips = $('pqSeconds');
  chips.innerHTML = '';
  for (const s of state.pollSeconds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = SEC_LABEL(s);
    b.className = s === pqSeconds ? 'on' : '';
    b.onclick = () => { pqSeconds = s; chips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    chips.appendChild(b);
  }
  openModal('pollModal');
  setTimeout(() => $('pqQuestion').focus(), 50);
}
$('pqAdd').onclick = () => pqRow();
$('pollNewBtn').onclick = openPollModal;
$('pollForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const options = [...$('pqOptions').querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
  if ($('pqQuestion').value.trim().length < 3) { $('pqMsg').textContent = 'Bạn nhập câu hỏi nhé.'; return; }
  if (options.length < 2) { $('pqMsg').textContent = 'Cần ít nhất 2 lựa chọn.'; return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  const res = await net.request('poll-create', { question: $('pqQuestion').value, options, seconds: pqSeconds });
  btn.disabled = false;
  if (!res?.ok) { $('pqMsg').textContent = res?.error || 'Chưa tạo được.'; return; }
  closeModal('pollModal');
  toast('🔮 Đã ra câu đoán! Hết giờ nhớ bấm công bố đáp án nhé.');
});

// ===== Mời bạn bè =====
const inviteLink = () => (state.account ? `${location.origin}/?moi=${state.account.inviteCode}` : location.origin);
(function readInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = (params.get('moi') || '').trim().toUpperCase();
  if (/^[0-9A-F]{6}$/.test(code)) {
    store.set('invite', code);
    params.delete('moi');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }
})();
async function showInviteNote() {
  const code = store.get('invite', '');
  if (!code || state.account) return;
  try {
    const r = await (await fetch('/api/invite?code=' + encodeURIComponent(code))).json();
    if (!r.ok) { store.set('invite', ''); return; }
    const n = $('inviteNote');
    n.textContent = `🤝 ${r.name} mời bạn vào rạp! Tạo tài khoản để cả hai cùng nhận +${r.bonus} 🍿.`;
    n.classList.remove('hidden');
    if (!$('authBox').classList.contains('hidden')) showAuth('signup');
  } catch { /* bỏ qua */ }
}
function renderInvite() {
  const acc = state.account;
  if (!acc) return;
  const cfg = state.inviteCfg;
  if (cfg) { $('ivBonus').textContent = cfg.bonus; $('ivMinutes').textContent = cfg.minutes; $('ivDone').textContent = cfg.doneBonus; }
  $('ivLink').value = inviteLink();
  $('ivJoined').textContent = acc.invites?.joined || 0;
  $('ivWatched').textContent = acc.invites?.done || 0;
  $('ivRare').textContent = (acc.unlocks || []).includes('heartshades') ? '💘' : '🔒';
  $('ivShare').classList.toggle('hidden', !navigator.share);
  const by = $('ivInvitedBy');
  by.classList.toggle('hidden', !acc.invitedBy);
  if (acc.invitedBy) {
    const left = acc.inviteWatched == null ? 0 : Math.max(0, (cfg?.minutes || 60) - acc.inviteWatched);
    by.textContent = left ? `🤝 Bạn được ${acc.invitedBy} mời vào rạp. Xem thêm ${left} phút nữa là ${acc.invitedBy} nhận quà!` : `🤝 Bạn được ${acc.invitedBy} mời vào rạp — cảm ơn bạn đã ở lại xem cùng nhé!`;
  }
}
async function copyInvite() {
  try { await navigator.clipboard.writeText(inviteLink()); toast('🔗 Đã sao chép link mời của bạn. Gửi cho bạn bè nhé!'); }
  catch { $('ivLink').select(); toast('Link mời: ' + inviteLink(), 7000); }
}
$('ivCopy').onclick = copyInvite;
$('ivShare').onclick = () => navigator.share?.({ title: 'Rạp Mây', text: 'Vào rạp xem phim cùng mình nhé! Tạo tài khoản qua link này cả hai đều được 🍿', url: inviteLink() }).catch(() => {});

// ===== Ghế đôi / ghế ba: tim bay khi bạn bè ngồi chung =====
const SOFA_START = [];
{ let c = 0; for (const n of SEAT_GROUPS) { for (let k = 0; k < n; k++) SOFA_START.push(n > 1 ? c : -1); c += n; } }
function sofaGroups() {
  const groups = new Map();
  for (const u of state.users.values()) {
    if (u.bot || u.stage || u.seat == null || u.seat < 0) continue;
    const st = SOFA_START[u.seat % 10];
    if (st < 0) continue;
    const k = Math.floor(u.seat / 10) * 10 + st;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}
const onSofaWithFriends = () => !!(state.me && sofaGroups().some((g) => g.some((u) => u.id === state.me.id)));
setInterval(() => {
  if (!state.joined || document.hidden) return;
  for (const g of sofaGroups()) {
    const u = g[Math.floor(Math.random() * g.length)];
    theater.emoji(u.id, ['💕', '💞', '💖', '❤️'][Math.floor(Math.random() * 4)]);
  }
  renderSeatChip();
}, 3500);

net.on('moments', (m) => setMoments(m));
net.on('emoji-burst', ({ emoji, count }) => emojiBurst(emoji, count));
net.on('poll', (p) => setPoll(p));

// ---------------- PHÒNG RIÊNG ----------------
let pendingRoom = null; // mở link ?phong=MÃ: vào rạp xong thì chuyển sang phòng đó
(function readRoomFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = (params.get('phong') || '').trim().toUpperCase();
  if (/^[0-9A-F]{6}$/.test(code)) {
    pendingRoom = code;
    params.delete('phong');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }
})();
const roomLink = (id) => `${location.origin}/?phong=${id}`;
const roomLabel = (r) => (r.isMain ? 'Sảnh chính' : `${r.locked ? '🔒 ' : ''}${r.name}`);

function renderRoomChip() {
  const r = state.room;
  const chip = $('roomChip');
  chip.classList.toggle('hidden', !r || r.isMain);
  if (r && !r.isMain) chip.textContent = `${r.locked ? '🔒' : '🚪'} ${r.name}`;
}
$('roomChip').onclick = () => openRooms();

async function switchRoom(id, password) {
  return join(false, { room: id || null, password: password || null });
}

let expandRoom = null; // phòng đang mở ô nhập mật khẩu
async function openRooms(expand = null) {
  expandRoom = expand;
  $('roomErr').textContent = '';
  openModal('roomsModal');
  renderRooms();
  const r = await net.request('rooms');
  if (r?.ok) { state.rooms = r.rooms; renderRooms(); }
}
function renderRooms() {
  const cur = state.room;
  const box = $('roomCurrent');
  box.innerHTML = '';
  const t = document.createElement('div');
  t.textContent = cur ? `Bạn đang ở: ${roomLabel(cur)}` : 'Bạn chưa vào phòng nào';
  box.appendChild(t);
  if (cur && !cur.isMain) {
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    const copy = document.createElement('button');
    copy.textContent = '🔗 Sao chép link phòng';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(roomLink(cur.id)); toast('🔗 Đã sao chép link phòng. Gửi kèm mật khẩu cho bạn bè nhé!'); }
      catch { toast('Link phòng: ' + roomLink(cur.id), 7000); }
    };
    const back = document.createElement('button');
    back.textContent = '🏛️ Về sảnh chính';
    back.onclick = () => doJoinRoom(null);
    btns.append(copy, back);
    box.appendChild(btns);
  }
  const list = $('roomList');
  list.innerHTML = '';
  for (const r of state.rooms) {
    const here = cur && r.id === cur.id;
    const row = document.createElement('div');
    row.className = 'room-item' + (here ? ' here' : '');
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = r.isMain ? '🏛️' : r.locked ? '🔒' : '🚪';
    const mid = document.createElement('div');
    const h = document.createElement('h4'); h.textContent = r.name;
    const p = document.createElement('p');
    p.textContent = [`${r.people} người`, r.owner ? `chủ phòng ${r.owner}` : (r.isMain ? 'có bot ngồi cùng cho vui' : ''), r.title ? `đang chiếu: ${r.title}` : ''].filter(Boolean).join(' · ');
    mid.append(h, p);
    const go = document.createElement('button');
    go.className = 'go';
    go.textContent = here ? 'Đang ở đây' : 'Vào';
    go.disabled = here;
    const needPass = r.locked && r.ownerUsername !== state.account?.username;
    go.onclick = () => {
      if (needPass) { expandRoom = expandRoom === r.id ? null : r.id; renderRooms(); setTimeout(() => $('rp-' + r.id)?.focus(), 30); }
      else doJoinRoom(r.isMain ? null : r.id);
    };
    row.append(ic, mid, go);
    if (needPass && expandRoom === r.id) {
      const f = document.createElement('form');
      f.className = 'room-pass';
      const inp = document.createElement('input');
      inp.id = 'rp-' + r.id; inp.placeholder = 'Mật khẩu phòng'; inp.type = 'password'; inp.autocomplete = 'off';
      const b = document.createElement('button'); b.type = 'submit'; b.textContent = 'Vào phòng';
      f.append(inp, b);
      f.onsubmit = (e) => { e.preventDefault(); doJoinRoom(r.id, inp.value); };
      row.appendChild(f);
    }
    list.appendChild(row);
  }
}
async function doJoinRoom(id, password) {
  $('roomErr').textContent = '';
  const res = await switchRoom(id, password);
  if (!res?.ok) {
    $('roomErr').textContent = res?.error || 'Chưa vào được phòng.';
    if (res?.needPassword && res.room) { expandRoom = res.room.id; renderRooms(); }
    if (res?.roomGone) openRooms();
    return false;
  }
  closeModal('roomsModal');
  return true;
}
$('roomCreateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('roomNameIn').value.trim(), password = $('roomPassIn').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  const r = await net.request('room-create', { name, password });
  btn.disabled = false;
  if (!r?.ok) { $('roomErr').textContent = r?.error || 'Chưa tạo được phòng.'; return; }
  $('roomNameIn').value = ''; $('roomPassIn').value = '';
  if (await doJoinRoom(r.room.id, password)) toast(`🎉 Đã mở phòng "${r.room.name}". Bấm 🔗 trong mục Phòng để gửi link cho bạn bè!`, 6000);
});
net.on('rooms', (list) => {
  state.rooms = list;
  const mine = state.room && list.find((r) => r.id === state.room.id);
  if (mine) state.room = mine;
  if (!$('roomsModal').classList.contains('hidden')) renderRooms();
});

// ---------------- BẠN BÈ ----------------
const fr = { tab: 'list', view: { list: [], requests: [] } };
function agoText(t) {
  if (!t) return 'lâu rồi';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
  return `${Math.floor(m / 1440)} ngày trước`;
}
function setFriends(v) {
  if (!v || !v.list) return;
  fr.view = { list: v.list, requests: v.requests || [] };
  const n = fr.view.requests.length;
  $('friendBadge').textContent = n;
  $('friendBadge').classList.toggle('hidden', !n);
  const on = fr.view.list.filter((f) => f.online).length;
  $('frOnline').textContent = on ? `· ${on} online` : '';
  $('frReqCount').textContent = n || '';
  if (state.drawer === 'friends') renderFriends();
}
async function openFriends(tab) {
  if (tab) fr.tab = tab;
  if (state.drawer !== 'friends') openDrawer('friends');
  renderFriends();
  const r = await net.request('friends');
  if (r?.ok) setFriends(r);
}
document.querySelectorAll('#frTabs button').forEach((b) => { b.onclick = () => { fr.tab = b.dataset.tab; renderFriends(); }; });
function frDot(name, character, online) {
  const d = document.createElement('span');
  d.className = 'fr-dot' + (online ? ' on' : '');
  d.style.background = CHARACTER_INFO[character]?.color || '#999';
  d.textContent = (name || '?').slice(0, 1).toUpperCase();
  return d;
}
function frBtn(text, fn, cls = '', title = '') {
  const b = document.createElement('button');
  b.textContent = text;
  if (cls) b.className = cls;
  if (title) { b.title = title; b.setAttribute('aria-label', title); }
  b.onclick = fn;
  return b;
}
function frRow(dot, name, sub, actions) {
  const row = document.createElement('div');
  row.className = 'fr-item';
  const info = document.createElement('div'); info.className = 'fr-info';
  const n = document.createElement('div'); n.className = 'fr-name'; n.textContent = name;
  const s = document.createElement('div'); s.className = 'fr-sub'; s.textContent = sub;
  info.append(n, s);
  const a = document.createElement('div'); a.className = 'fr-actions';
  actions.filter(Boolean).forEach((x) => a.appendChild(x));
  row.append(dot, info, a);
  return row;
}
let removeArm = null;
function renderFriends() {
  document.querySelectorAll('#frTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === fr.tab));
  $('frAddForm').classList.toggle('hidden', fr.tab !== 'list');
  document.querySelector('.fr-hint').classList.toggle('hidden', fr.tab !== 'list');
  const box = $('frList');
  box.innerHTML = '';
  const empty = (text) => { const p = document.createElement('div'); p.className = 'fr-empty'; p.textContent = text; box.appendChild(p); };
  const meRoom = state.room?.id;
  if (fr.tab === 'list') {
    if (!fr.view.list.length) return empty('Chưa có bạn bè nào. Mở tab "Trong phòng" để kết bạn với người đang xem cùng, hoặc nhập tên đăng nhập của bạn ấy ở ô bên dưới.');
    for (const f of fr.view.list) {
      const same = f.online && f.room && f.room.id === meRoom;
      const sub = f.online ? (same ? `🟢 Cùng phòng · ghế ${f.seat}` : `🟢 Đang ở ${roomLabel(f.room)}`) : `Offline · ${agoText(f.lastSeen)}`;
      const inRoom = same && [...state.users.values()].find((u) => !u.bot && u.name === f.name);
      const star = frBtn('⭐', async () => {
        if (!f.star && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* bỏ qua */ } }
        const r = await net.request('friend-star', { username: f.username, on: !f.star });
        if (r?.ok) { setFriends(r); if (!f.star) toast(`⭐ ${f.name} là bạn thân: bạn sẽ được báo khi bạn ấy vào rạp`); }
      }, 'star' + (f.star ? ' on' : ''), f.star ? 'Bỏ đánh dấu bạn thân' : 'Đánh dấu bạn thân (được báo khi online)');
      const near = same ? frBtn('Ngồi cạnh', async () => {
        const r = await net.request('sit-near', f.username);
        toast(r?.ok ? (r.already ? `Bạn đang ngồi gần ${f.name} rồi 💞` : `💺 Đã chuyển sang ngồi cạnh ${f.name}`) : r?.error || 'Chưa đổi chỗ được.');
      }, 'go') : null;
      const gift = inRoom ? frBtn('🎁', () => openGift(inRoom), '', `Tặng quà cho ${f.name}`) : null;
      const go = f.online && !same ? frBtn('Vào phòng', () => {
        if (f.room.locked) openRooms(f.room.id); else switchRoom(f.room.isMain ? null : f.room.id);
      }, 'go') : null;
      const rm = frBtn(removeArm === f.username ? 'Huỷ thật?' : '✕', async () => {
        if (removeArm !== f.username) { removeArm = f.username; renderFriends(); setTimeout(() => { if (removeArm === f.username) { removeArm = null; renderFriends(); } }, 3000); return; }
        removeArm = null;
        const r = await net.request('friend-remove', { username: f.username });
        if (r?.ok) { setFriends(r); toast(`Đã huỷ kết bạn với ${f.name}`); }
      }, '', 'Huỷ kết bạn (bấm 2 lần)');
      box.appendChild(frRow(frDot(f.name, f.character, f.online), (f.star ? '⭐ ' : '') + f.name, sub, [near, gift, go, star, rm]));
    }
  } else if (fr.tab === 'requests') {
    if (!fr.view.requests.length) return empty('Chưa có lời mời kết bạn nào.');
    for (const q of fr.view.requests) {
      const respond = (accept) => async () => {
        const r = await net.request('friend-respond', { username: q.username, accept });
        if (r?.ok) { setFriends(r); toast(accept ? `🤝 Bạn và ${q.name} đã là bạn bè!` : 'Đã từ chối lời mời'); }
        else toast(r?.error || 'Có lỗi.');
      };
      box.appendChild(frRow(frDot(q.name, q.character, false), q.name, `@${q.username} muốn kết bạn`, [frBtn('Đồng ý', respond(true), 'go'), frBtn('Từ chối', respond(false))]));
    }
  } else {
    const friendNames = new Set(fr.view.list.map((f) => f.name));
    const people = [...state.users.values()].filter((u) => !u.bot && u.id !== state.me?.id);
    if (!people.length) return empty('Phòng này chưa có ai khác (bot không tính). Rủ bạn bè vào cùng nhé!');
    for (const u of people) {
      const isFriend = friendNames.has(u.name);
      const add = isFriend ? null : frBtn('Kết bạn', async (e) => {
        const r = await net.request('friend-request', { id: u.id });
        if (r?.ok) { e.target.textContent = r.accepted ? '✓ Bạn bè' : '✓ Đã gửi'; e.target.disabled = true; if (r.accepted) setFriends(r); }
        else toast(r?.error || 'Chưa gửi được lời mời.');
      }, 'go');
      const sub = u.stage ? '🎤 Đang trên sân khấu' : `Ghế ${seatInfo(u.seat).code}` + (isFriend ? ' · bạn bè' : '');
      box.appendChild(frRow(frDot(u.name, u.character, true), u.name, sub, [add, frBtn('🎁', () => openGift(u), '', `Tặng quà cho ${u.name}`)]));
    }
  }
}
$('frAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('frAddInput').value.trim().toLowerCase();
  if (!username) return;
  const r = await net.request('friend-request', { username });
  if (!r?.ok) { toast(r?.error || 'Chưa gửi được lời mời.'); return; }
  $('frAddInput').value = '';
  if (r.accepted) { setFriends(r); toast('🤝 Hai bạn đã là bạn bè!'); }
  else toast(r.already ? 'Bạn đã gửi lời mời cho người này rồi.' : `📨 Đã gửi lời mời kết bạn tới ${r.name || username}`);
});
setInterval(() => { if (state.drawer === 'friends' && fr.tab === 'room') renderFriends(); }, 3000);
net.on('friends', (v) => setFriends(v));
net.on('friend-notice', ({ text }) => { toast(text, 6000); });
net.on('friend-online', (d) => {
  const where = d.sameRoom ? 'phòng này' : roomLabel(d.room);
  const text = `⭐ Bạn thân ${d.name} vừa vào ${where}${d.sameRoom ? ` (ghế ${d.seat})` : ''}`;
  toast(text, 6000);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('Rạp Mây', { body: text }); } catch { /* bỏ qua */ }
  }
});

// ---------------- TẶNG QUÀ ----------------
let giftTarget = null, giftPick = 'flower';
function openGift(u) {
  giftTarget = u;
  $('giftTitle').textContent = `Tặng quà cho ${u.name}`;
  $('giftErr').textContent = '';
  renderGifts();
  openModal('giftModal');
}
function renderGifts() {
  const bal = state.account?.balance ?? 0;
  const box = $('giftList');
  box.innerHTML = '';
  for (const [key, g] of Object.entries(state.gifts || {})) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = key === giftPick ? 'on' : '';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(key === giftPick));
    b.disabled = bal < g.price;
    const i = document.createElement('b'); i.textContent = g.icon;
    const n = document.createElement('strong'); n.textContent = g.name;
    const p = document.createElement('span'); p.textContent = `${g.price} 🍿`;
    const s = document.createElement('small'); s.textContent = g.hat ? `Đội trên đầu ${g.minutes} phút` : `Hiện trên đầu ${g.minutes} phút`;
    b.append(i, n, p, s);
    b.onclick = () => { giftPick = key; renderGifts(); };
    box.appendChild(b);
  }
  const g = state.gifts?.[giftPick];
  $('giftBalance').textContent = `Bạn còn ${bal} 🍿.` + (g && bal < g.price ? ' Xem phim, điểm danh hoặc làm nhiệm vụ để có thêm nhé!' : '');
  $('giftSend').disabled = !g || bal < g.price;
  $('giftSend').textContent = g ? `Tặng ${g.name.toLowerCase()} ${g.icon} · ${g.price} 🍿` : 'Tặng quà';
}
$('giftSend').onclick = async () => {
  if (!giftTarget) return;
  $('giftSend').disabled = true;
  const r = await net.request('gift', { to: giftTarget.id, gift: giftPick });
  $('giftSend').disabled = false;
  if (!r?.ok) { $('giftErr').textContent = r?.error || 'Chưa tặng được.'; return; }
  closeModal('giftModal');
};
net.on('gift', (d) => {
  theater.giftFx(d.from, d.to, d.icon);
  if (d.to === state.me?.id) toast(`🎁 ${d.fromName} tặng bạn ${d.name.toLowerCase()} ${d.icon}!`, 6000);
  else if (d.from === state.me?.id) toast(`🎁 Đã tặng ${d.toName} ${d.name.toLowerCase()} ${d.icon}`);
});

// ---------------- CHỦ RẠP: BẢNG ĐIỀU KHIỂN ----------------
state.chat = { locked: false, pinned: null };
function syncHostUi() {
  document.querySelectorAll('.host-only').forEach((el) => el.classList.toggle('hidden', !state.isHost));
}
function setChatState(c) {
  if (!c) return;
  const before = state.chat?.pinned?.at;
  state.chat = c;
  const pin = $('chatPin'), bar = $('pinBar');
  pin.classList.toggle('hidden', !c.pinned);
  bar.classList.toggle('hidden', !c.pinned);
  if (c.pinned) {
    pin.textContent = '📌 ' + c.pinned.text;
    const sm = document.createElement('small'); sm.textContent = `Ghim bởi ${c.pinned.by}`; pin.appendChild(sm);
    bar.textContent = '📌 ' + c.pinned.text;
    if (before !== c.pinned.at && state.joined) toast('📌 ' + c.pinned.text, 6000);
  }
  $('chatInput').placeholder = c.locked && !state.isHost ? '🔒 Chủ rạp đang tạm khoá chat' : 'Nói gì với cả rạp đi...';
  $('hostLock').textContent = c.locked ? '🔓 Mở chat lại' : '🔒 Tạm khoá chat cả phòng';
  $('hostLock').classList.toggle('on', c.locked);
  $('hostUnpin').classList.toggle('hidden', !c.pinned);
}
$('pinBar').onclick = () => { if (state.drawer !== 'chat') openDrawer('chat'); };
let hostMuted = [];
async function openHost() {
  if (state.drawer !== 'host') openDrawer('host');
  renderHost();
  const r = await net.request('host-state');
  if (r?.ok) { hostMuted = r.muted || []; setChatState({ locked: r.locked, pinned: r.pinned }); renderHost(); }
}
function renderHost() {
  const cur = state.current;
  $('hostNow').textContent = cur ? `Đang chiếu: ${cur.title} (${cur.byName} đề xuất)` : state.voting ? 'Đang bình chọn video tiếp theo.' : 'Chưa có video nào đang chiếu.';
  $('hostSkip').disabled = !cur && !state.voting;
  const box = $('hostPeople');
  box.innerHTML = '';
  const now = Date.now();
  const people = [...state.users.values()].filter((u) => !u.bot && u.id !== state.me?.id);
  if (!people.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Chưa có ai khác trong phòng.'; box.appendChild(p); }
  for (const u of people) {
    const m = hostMuted.find((x) => x.id === u.id && x.until > now);
    const row = document.createElement('div'); row.className = 'host-person';
    const n = document.createElement('span'); n.textContent = u.name;
    if (m) { const t = document.createElement('span'); t.className = 'muted-tag'; t.textContent = ` · 🔇 còn ${Math.ceil((m.until - now) / 60000)}p`; n.appendChild(t); }
    const acts = document.createElement('div');
    const opts = m ? [[0, 'Mở chat']] : [[5, '5p'], [15, '15p'], [60, '1 giờ'], [1440, '1 ngày']];
    for (const [min, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = min ? `Tắt chat ${u.name} ${label}` : `Mở chat cho ${u.name}`;
      b.onclick = () => hostMute(u.id, min);
      acts.appendChild(b);
    }
    row.append(n, acts);
    box.appendChild(row);
  }
}
async function hostMute(id, minutes) {
  const r = await net.request('host-mute', { id, minutes });
  if (!r?.ok) { toast(r?.error || 'Chưa làm được.'); return; }
  if (state.drawer === 'host') openHost();
}
$('hostSkip').onclick = async () => { const r = await net.request('host-skip'); if (!r?.ok) toast(r?.error || 'Chưa chuyển được.'); else setTimeout(renderHost, 500); };
$('hostLock').onclick = async () => { const r = await net.request('host-chatlock', !state.chat.locked); if (r?.ok) setChatState(r); };
$('hostPinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('hostPinIn').value.trim();
  if (!text) return;
  const r = await net.request('host-pin', text);
  if (r?.ok) { $('hostPinIn').value = ''; setChatState(r); } else toast(r?.error || 'Chưa ghim được.');
});
$('hostUnpin').onclick = async () => { const r = await net.request('host-pin', ''); if (r?.ok) setChatState(r); };
setInterval(() => { if (state.drawer === 'host') renderHost(); }, 3000);
net.on('chat-state', (c) => setChatState(c));
net.on('chat-blocked', ({ reason }) => toast(reason, 5000));

// ---------------- SỰ KIỆN TỪ SERVER ----------------
net.on('hello', async (d) => {
  if (d.catalog) { state.catalog = d.catalog; setTiers(d.catalog.tiers); }
  if (d.emojiGroups) { state.emojiGroups = d.emojiGroups; buildEmojiPanel(); }
  if (d.quickEmojis) { state.quickEmojis = d.quickEmojis; buildEmojiBar(); }
  if (d.postSeconds) state.postSeconds = d.postSeconds;
  if (d.chatMax) { state.chatMax = d.chatMax; $('chatInput').maxLength = d.chatMax; updateChatCount(); }
  if (d.maxQueuePerUser) state.maxQueue = d.maxQueuePerUser;
  if (d.events) setEvents(d.events);
  if (d.pollSeconds) state.pollSeconds = d.pollSeconds;
  if (d.gifts) state.gifts = d.gifts;
  if (d.rooms) state.rooms = d.rooms;
  if (d.invite) state.inviteCfg = d.invite;
  if ('poll' in d) state.poll = d.poll;
  if (d.characters && d.characters.join() !== state.characters.join()) {
    state.characters = d.characters.filter((c) => CHARACTER_INFO[c]);
    thumbCache = null;
    buildCharGrid($('charPicker'), state.character, (k) => { state.character = k; });
  }
  state.account = d.account || null;
  const wasJoined = state.joined;
  state.joined = false;
  state.me = null;
  state.token = null;
  theater.myId = null;
  applyState(d.state);
  $('joinBtn').disabled = false;
  syncClock();
  if (state.account && (state.everJoined || state.pendingJoin)) {
    // rớt mạng rồi kết nối lại (hoặc bấm "vào lại"): tự vào lại rạp
    state.pendingJoin = false;
    if (wasJoined || state.everJoined) toast('Đã kết nối lại ✅');
    await join(true);
  } else {
    showJoinScreen();
    showInviteNote();
  }
});

net.on('close', () => {
  $('joinBtn').disabled = true;
  if (state.joined && !state.kicked) toast('Mất kết nối, đang kết nối lại…', 60000);
  state.joined = false;
});

// Tài khoản vào rạp từ tab/thiết bị khác
net.on('kicked', ({ reason }) => {
  state.kicked = true;
  state.joined = false;
  state.everJoined = false;
  net.stopped = true;
  showJoinScreen();
  $('joinMsg').textContent = reason + ' Bấm "Vào rạp" để xem ở đây.';
  $('joinBtn').disabled = false;
});

// Điểm / hạng của mình thay đổi
net.on('me', ({ account, gained, reason, notice }) => {
  const before = state.account?.tier ?? 0;
  state.account = account;
  renderAccount();
  if (activityOpen() && act.tab === 'invite') renderInvite();
  renderQueue(state.queue);           // nút "Chen" phụ thuộc số 🍿
  if (!$('postModal').classList.contains('hidden')) updatePostSend();
  if (!$('supportModal').classList.contains('hidden')) loadSupport();
  if (notice) toast(/^\p{Extended_Pictographic}/u.test(notice) ? notice : '💖 ' + notice, 7000);
  const chip = $('pointsChip');
  chip.classList.remove('bump');
  void chip.offsetWidth;
  chip.classList.add('bump');
  if (gained >= 5) toast(`+${gained} 🍿 vì ${reason}!`);
  if (account.tier > before) {
    const t = tierInfo(account.tier);
    toast(`🎉 Chúc mừng! Bạn lên hạng ${t.icon} ${t.name}. Vào Tủ đồ xem món mới nhé!`, 6000);
    for (let i = 0; i < 3; i++) setTimeout(() => theater.emoji(state.me?.id, ['🎉', '✨', '🥳'][i]), i * 300);
  }
});

// Ai đó đổi tên / trang phục / lên hạng
net.on('user-updated', (u) => {
  const cur = state.users.get(u.id);
  if (cur) Object.assign(cur, u); else state.users.set(u.id, u);
  theater.updateUser(state.users.get(u.id));
  if (u.id === state.me?.id) renderSeatChip();
});

net.on('user-joined', (u) => {
  state.users.set(u.id, u);
  theater.addUser(u, { enter: true }); // đi từ cửa vào ghế
  renderViewers();
});
net.on('user-left', ({ id }) => {
  state.users.delete(id);
  theater.leaveUser(id); // đi ra cửa rồi mới biến mất
  renderViewers();
});
net.on('user-moved', ({ id, seat }) => {
  const u = state.users.get(id);
  if (u) u.seat = seat;
  theater.moveUser(id, seat);
  if (id === state.me?.id) renderSeatChip();
  if (!$('seatModal').classList.contains('hidden')) renderSeatMap();
});
net.on('user-stage', ({ id, stage }) => {
  const u = state.users.get(id);
  if (u) u.stage = stage;
  theater.setStage(id, stage);
  if (id === state.me?.id) {
    renderSeatChip();
    if (!stage) toast('Hết giờ quẩy, bạn đã về ghế 💺');
  }
});
net.on('chat', (m) => {
  addChat(m);
  if (m.system) return;
  if (isEmojiOnly(m.text)) theater.emoji(m.id, firstGrapheme(m.text));
  else theater.say(m.id, m.text);
});
net.on('emoji', ({ id, emoji }) => theater.emoji(id, emoji));
net.on('emote', ({ id, kind }) => theater.emote(id, kind, EMOTE_MS[kind] || 3000));
net.on('popcorn', ({ from, to, seed }) => theater.popcorn(from, to, seed));
net.on('throw', ({ from, item, seed }) => theater.throwAtScreen(from, item, seed));
net.on('pyro', ({ at, duration }) => { theater.clockOffset = player.offset; theater.pyro(at, duration); });
net.on('queue', (q) => renderQueue(q));
net.on('skip', (s) => renderSkip(s));
net.on('duration', ({ videoId, duration }) => {
  if (state.current && state.current.videoId === videoId) state.current.duration = duration;
});
net.on('screen-post', (p) => showScreenPost(p));
net.on('engage', (e) => setEngage(e));
net.on('events', (list) => setEvents(list));
net.on('event-reminder', ({ kind, event }) => {
  const text = kind === 'soon' ? `🔔 "${event.title}" bắt đầu sau 10 phút nữa!` : `🎬 "${event.title}" bắt đầu rồi! Xem phim lúc này được 🍿 x${event.multiplier}`;
  toast(text, 8000);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('Rạp Mây', { body: text }); } catch { /* bỏ qua */ }
  }
});
net.on('now-playing', ({ current, voting, reason, moments: m }) => {
  if (m) state.moments = m;
  setNowPlaying(current, voting);
  if (reason === 'skipped') toast('⏭️ Đã bỏ qua video');
  if (reason === 'replay') toast('⏪ Xem lại khoảnh khắc hot nhất của video!', 4000);
});

// cho phép kiểm tra từ console
window.__rap = { state, theater, player, net };
