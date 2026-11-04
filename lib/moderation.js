// ===============================================================
//  CHẶN TỪ NGỮ XẤU
//  Danh sách từ cấm nằm trong file tu-cam.txt (mỗi dòng 1 từ/cụm từ).
//  Tin nhắn có từ cấm sẽ bị che thành ***. So khớp không phân biệt hoa thường,
//  nhưng CÓ phân biệt dấu (tiếng Việt bỏ dấu dễ trùng từ bình thường, ví dụ "dị" và "đĩ"),
//  nên muốn chặn cả kiểu viết không dấu thì ghi thêm một dòng (vd. "đm" và "dm").
//  Sửa file lúc nào cũng được, rạp tự đọc lại sau vài giây.
// ===============================================================
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'tu-cam.txt');
let words = [];   // đã chuẩn hoá (chữ thường)

// chữ thường từng ký tự, giữ nguyên độ dài chuỗi (để che đúng vị trí trong câu gốc)
function fold(text) {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const low = ch.toLowerCase();
    out += [...low].length === 1 ? low : ch;
  }
  return out;
}

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '');
    const set = new Set();
    for (const line of raw.split(/\r?\n/)) {
      const w = line.trim();
      if (!w || w.startsWith('#')) continue;
      set.add(fold(w).replace(/\s+/g, ' '));
    }
    words = [...set].sort((a, b) => b.length - a.length); // từ dài trước để che trọn cụm
    console.log(`🚫 Từ cấm: đã đọc ${words.length} từ từ tu-cam.txt`);
  } catch {
    words = [];
  }
}
load();
fs.watchFile(FILE, { interval: 3000 }, load);

const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

// Trả về { text: câu đã che, hit: có từ cấm không }
function mask(text) {
  if (!text || !words.length) return { text, hit: false };
  text = text.normalize('NFC');
  const chars = [...text];
  const folded = [...fold(text)];
  if (folded.length !== chars.length) return { text, hit: false };
  const f = folded.join('');
  const cut = new Array(chars.length).fill(false);
  let hit = false;
  for (const w of words) {
    let from = 0;
    for (;;) {
      const i = f.indexOf(w, from);
      if (i < 0) break;
      const end = i + w.length;
      // chỉ che khi là nguyên từ (không che "dm" trong "admin")
      if (!isWordChar(folded[i - 1]) && !isWordChar(folded[end])) {
        for (let k = i; k < end; k++) cut[k] = true;
        hit = true;
      }
      from = i + 1;
    }
  }
  if (!hit) return { text, hit: false };
  let out = '';
  for (let k = 0; k < chars.length; k++) {
    if (cut[k]) { if (!cut[k - 1]) out += '***'; } else out += chars[k];
  }
  return { text: out, hit: true };
}
const clean = (text) => mask(text).text;
const hasBad = (text) => mask(text).hit;

module.exports = { mask, clean, hasBad, reload: load, FILE };
