// ===============================================================
//  LƯU TRỮ DỮ LIỆU BẰNG FILE JSON (không cần cài cơ sở dữ liệu)
//  Dữ liệu nằm ở thư mục data/db.json (hoặc thư mục trong biến DATA_DIR).
//  Ghi an toàn: ghi ra file tạm rồi đổi tên, tránh hỏng file khi mất điện.
// ===============================================================
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const empty = () => ({ version: 1, nextId: 1, accounts: {}, sessions: {} });

let data = empty();
let timer = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    try {
      data = { ...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    } catch (e) {
      // file hỏng: giữ lại bản lỗi để cứu dữ liệu, tạo file mới
      const bad = FILE + '.broken-' + Date.now();
      fs.copyFileSync(FILE, bad);
      console.error('⚠️  db.json bị lỗi, đã lưu bản sao tại', bad);
      data = empty();
    }
  }
  return data;
}

function writeNow() {
  clearTimeout(timer);
  timer = null;
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}

// gom nhiều thay đổi lại, ghi sau 1 giây
function save() {
  if (!timer) timer = setTimeout(() => {
    try { writeNow(); } catch (e) { console.error('Lỗi ghi dữ liệu:', e.message); }
  }, 1000);
}

// ghi nốt dữ liệu khi tắt server (Ctrl+C)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try { if (timer) writeNow(); } catch { /* bỏ qua */ }
    process.exit(0);
  });
}

module.exports = { load, save, writeNow, get data() { return data; }, FILE };
