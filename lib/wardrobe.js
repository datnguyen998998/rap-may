// ===============================================================
//  TỦ ĐỒ, HẠNG VÀ ĐIỂM 🍿
//  Món đồ mở khoá theo tổng điểm. Điểm kiếm được khi xem phim trong rạp.
//  Muốn thêm món mới: thêm vào ITEMS ở đây, rồi vẽ hình 3D trong public/js/avatars.js
// ===============================================================

const POINTS = {
  perMinute: 1,          // mỗi phút xem phim (khi có video đang chiếu)
  suggestionPlayed: 5,   // khi video mình đề xuất được chiếu
  vndPerPoint: 100,      // ủng hộ: 1.000đ = 10 🍿
};

// Giá dùng 🍿 trong rạp (đặt 0 nếu muốn miễn phí)
const PRICES = {
  postSeconds: [6, 10, 15, 20, 30, 45, 60], // các mức thời gian chiếu ảnh (giây)
  postBase: 10,       // chiếu ảnh 6 giây = 10 🍿
  postPerSecond: 2,   // từ 10 giây trở lên: 2 🍿 mỗi giây
  boost: 20,          // chen video lên đầu hàng chờ
};
function postCost(seconds) {
  return seconds <= 6 ? PRICES.postBase : seconds * PRICES.postPerSecond;
}

// Các mức ủng hộ gợi ý (đồng)
const SUPPORT_AMOUNTS = [10000, 20000, 50000, 100000, 200000];

const TIERS = [
  { id: 0, name: 'Khán giả', points: 0, color: '#d0d7c5', icon: '' },
  { id: 1, name: 'Fan cứng', points: 60, color: '#7fd1ff', icon: '🎟️' },
  { id: 2, name: 'Ngôi sao', points: 200, color: '#ffd166', icon: '⭐' },
  { id: 3, name: 'Siêu sao', points: 500, color: '#ff8fab', icon: '🌟' },
  { id: 4, name: 'Huyền thoại', points: 1000, color: '#c9a7ff', icon: '👑' },
];

const SLOTS = [
  { id: 'hat', name: 'Mũ' },
  { id: 'body', name: 'Trang phục' },
  { id: 'acc', name: 'Phụ kiện' },
];

const ITEMS = [
  // Mũ
  { id: 'cap', slot: 'hat', name: 'Mũ lưỡi trai', icon: '🧢', points: 0 },
  { id: 'beanie', slot: 'hat', name: 'Mũ len', icon: '🧶', points: 20 },
  { id: 'party', slot: 'hat', name: 'Mũ sinh nhật', icon: '🥳', points: 40 },
  { id: 'headphones', slot: 'hat', name: 'Tai nghe', icon: '🎧', points: 90 },
  { id: 'wizard', slot: 'hat', name: 'Mũ phù thuỷ', icon: '🧙', points: 250 },
  { id: 'crown', slot: 'hat', name: 'Vương miện', icon: '👑', points: 600 },
  // Trang phục
  { id: 'tee', slot: 'body', name: 'Áo phông', icon: '👕', points: 0 },
  { id: 'hoodie', slot: 'body', name: 'Áo hoodie', icon: '🧥', points: 30 },
  { id: 'vest', slot: 'body', name: 'Vest lịch lãm', icon: '🤵', points: 60 },
  { id: 'armor', slot: 'body', name: 'Giáp hiệp sĩ', icon: '🛡️', points: 200 },
  { id: 'royal', slot: 'body', name: 'Áo choàng hoàng gia', icon: '🦁', points: 500 },
  { id: 'galaxy', slot: 'body', name: 'Áo tinh tú', icon: '🌌', points: 1000 },
  // Phụ kiện
  { id: 'bowtie', slot: 'acc', name: 'Nơ cổ', icon: '🎀', points: 0 },
  { id: 'scarf', slot: 'acc', name: 'Khăn quàng', icon: '🧣', points: 15 },
  { id: 'shades', slot: 'acc', name: 'Kính râm', icon: '🕶️', points: 50 },
  { id: 'halo', slot: 'acc', name: 'Vầng hào quang', icon: '😇', points: 300 },
  { id: 'wings', slot: 'acc', name: 'Cánh thiên thần', icon: '🪽', points: 700 },
  // Món hiếm: không mua bằng điểm, chỉ mở khi mời được bạn xem đủ 1 giờ
  { id: 'heartshades', slot: 'acc', name: 'Kính trái tim', icon: '💘', points: 0, unlock: 'invite', hint: 'Mời 1 bạn vào rạp và xem đủ 1 giờ' },
];

// Màu cho áo phông, hoodie, mũ lưỡi trai, mũ len, mũ sinh nhật, khăn, nơ
const COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#8e4ec6', '#e93d82', '#f0f0f0', '#2b2b33'];

const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

function tierOf(points) {
  let t = TIERS[0];
  for (const x of TIERS) if (points >= x.points) t = x;
  return t.id;
}

function defaultOutfit() {
  return { hat: null, body: 'tee', acc: null, color: COLORS[5] };
}

// Làm sạch trang phục: bỏ món không tồn tại / sai chỗ / chưa đủ điểm
function isLocked(item, points, unlocks = []) {
  if (item.unlock) return !unlocks.includes(item.id);
  return item.points > points;
}
function sanitizeOutfit(outfit, points, { allowLocked = false, unlocks = [] } = {}) {
  const out = defaultOutfit();
  out.body = null;
  const locked = [];
  if (outfit && typeof outfit === 'object') {
    for (const slot of SLOTS.map((s) => s.id)) {
      const id = outfit[slot];
      if (id == null) continue;
      const item = ITEM_BY_ID.get(id);
      if (!item || item.slot !== slot) continue;
      if (!allowLocked && isLocked(item, points, unlocks)) { locked.push(item); continue; }
      out[slot] = id;
    }
    if (COLORS.includes(outfit.color)) out.color = outfit.color;
  }
  return { outfit: out, locked };
}

function randomOutfit() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const of = (slot) => ITEMS.filter((i) => i.slot === slot && !i.unlock).map((i) => i.id);
  return {
    hat: Math.random() < 0.6 ? pick(of('hat')) : null,
    body: Math.random() < 0.8 ? pick(of('body')) : null,
    acc: Math.random() < 0.5 ? pick(of('acc')) : null,
    color: pick(COLORS),
  };
}

const catalog = {
  tiers: TIERS, slots: SLOTS, items: ITEMS, colors: COLORS, points: POINTS,
  prices: PRICES, postCosts: Object.fromEntries(PRICES.postSeconds.map((s) => [s, postCost(s)])),
  supportAmounts: SUPPORT_AMOUNTS,
};

module.exports = { POINTS, PRICES, SUPPORT_AMOUNTS, TIERS, ITEMS, COLORS, postCost, tierOf, defaultOutfit, sanitizeOutfit, isLocked, randomOutfit, catalog };
