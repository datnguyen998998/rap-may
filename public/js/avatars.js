// ===============================================================
//  NHÂN VẬT 3D + BẢNG TÊN + BONG BÓNG CHAT
// ===============================================================
import * as THREE from 'three';
import { dressCharacter, tierInfo } from './outfits.js';

export const CHARACTER_INFO = {
  meo:     { name: 'Mèo cam',   color: '#f4a340' },
  gau:     { name: 'Gấu nâu',   color: '#a0673a' },
  tho:     { name: 'Thỏ trắng', color: '#e9e4f0' },
  robot:   { name: 'Robot',     color: '#8fb3d9' },
  ma:      { name: 'Ma nhỏ',    color: '#c9d6ff' },
  ech:     { name: 'Ếch xanh',  color: '#5cbf5c' },
  heo:     { name: 'Heo hồng',  color: '#f59bb4' },
  canhcut: { name: 'Cánh cụt',  color: '#5d6b8a' },
};

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

// Mắt: tròng đen + chấm sáng
function addEyes(g, y, z, spread = 0.12, r = 0.055) {
  const black = mat(0x111111, { roughness: 0.2 });
  const white = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(r, 16, 12), black, s * spread, y, z));
    g.add(mesh(new THREE.SphereGeometry(r * 0.35, 8, 8), white, s * spread + r * 0.3, y + r * 0.35, z - r * 0.8));
  }
}
// Ghi nhớ 2 bàn tay (trái, phải) để làm động tác nhảy / vẫy / vỗ tay
function regHand(g, m) {
  g.userData.hands = g.userData.hands || [];
  g.userData.hands.push(m);
  g.add(m);
}
function addHands(g, color) {
  for (const s of [-1, 1]) regHand(g, mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(color), s * 0.36, 0.5, -0.12));
}
function addBlush(g, y, z, spread = 0.2) {
  const pink = mat(0xff7b9c, { transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) {
    const c = mesh(new THREE.SphereGeometry(0.05, 10, 8), pink, s * spread, y, z);
    c.scale.set(1, 0.6, 0.4);
    g.add(c);
  }
}

// Mỗi nhân vật cao khoảng 1.3 đơn vị, mặt quay về phía -Z (phía màn hình)
export function createCharacter(type) {
  const g = new THREE.Group();
  const info = CHARACTER_INFO[type] || CHARACTER_INFO.meo;
  const c = info.color;

  switch (type) {
    case 'robot': {
      const metal = mat(c, { metalness: 0.6, roughness: 0.35 });
      g.add(mesh(new THREE.BoxGeometry(0.62, 0.58, 0.46), metal, 0, 0.42, 0));
      g.add(mesh(new THREE.BoxGeometry(0.52, 0.44, 0.44), metal, 0, 0.98, 0));
      const glow = mat(0x00e5ff, { emissive: 0x00e5ff, emissiveIntensity: 1.5 });
      for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.02), glow, s * 0.12, 1.02, -0.225));
      g.add(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), mat(0x223344), 0, 0.88, -0.225));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22), mat(0x667788), 0, 1.3, 0));
      g.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), mat(0xff3355, { emissive: 0xff3355, emissiveIntensity: 1.2 }), 0, 1.43, 0));
      g.add(mesh(new THREE.BoxGeometry(0.18, 0.14, 0.02), mat(0xffcc00, { emissive: 0xffaa00, emissiveIntensity: 0.6 }), 0, 0.5, -0.235));
      for (const s of [-1, 1]) regHand(g, mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), metal, s * 0.38, 0.5, -0.12));
      break;
    }
    case 'ma': {
      const ghost = mat(c, { transparent: true, opacity: 0.88, emissive: 0x6f7fff, emissiveIntensity: 0.25 });
      g.add(mesh(new THREE.SphereGeometry(0.4, 24, 18), ghost, 0, 0.95, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.7, 24, 1, true), ghost, 0, 0.6, 0));
      // viền gợn sóng dưới chân
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), ghost, Math.cos(a) * 0.4, 0.25, Math.sin(a) * 0.4));
      }
      const black = mat(0x111122);
      for (const s of [-1, 1]) {
        const e = mesh(new THREE.SphereGeometry(0.07, 14, 10), black, s * 0.13, 1.0, -0.36);
        e.scale.set(0.8, 1.3, 0.5);
        g.add(e);
      }
      const mouth = mesh(new THREE.SphereGeometry(0.05, 12, 10), black, 0, 0.84, -0.38);
      mouth.scale.set(1, 1.3, 0.4);
      g.add(mouth);
      addBlush(g, 0.9, -0.36, 0.24);
      for (const s of [-1, 1]) regHand(g, mesh(new THREE.SphereGeometry(0.1, 12, 10), ghost, s * 0.46, 0.6, -0.1));
      break;
    }
    case 'canhcut': {
      const dark = mat(0x23283a);
      const white = mat(0xf4f4f4);
      const body = mesh(new THREE.SphereGeometry(0.36, 24, 18), dark, 0, 0.45, 0);
      body.scale.set(1, 1.15, 0.95);
      g.add(body);
      const belly = mesh(new THREE.SphereGeometry(0.28, 20, 16), white, 0, 0.42, -0.12);
      belly.scale.set(1, 1.15, 0.8);
      g.add(belly);
      g.add(mesh(new THREE.SphereGeometry(0.3, 24, 18), dark, 0, 1.0, 0));
      const face = mesh(new THREE.SphereGeometry(0.22, 20, 16), white, 0, 0.98, -0.12);
      face.scale.set(1.1, 0.9, 0.8);
      g.add(face);
      addEyes(g, 1.03, -0.29, 0.09, 0.045);
      const beak = mesh(new THREE.ConeGeometry(0.07, 0.16, 12), mat(0xffa22b), 0, 0.93, -0.36);
      beak.rotation.x = -Math.PI / 2;
      g.add(beak);
      addBlush(g, 0.94, -0.28, 0.16);
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.SphereGeometry(0.12, 12, 10), dark, s * 0.38, 0.5, -0.05);
        w.scale.set(0.45, 1.3, 0.8);
        regHand(g, w);
      }
      break;
    }
    default: {
      // Các con vật thân tròn: mèo, gấu, thỏ, ếch, heo
      const skin = mat(c);
      const body = mesh(new THREE.CapsuleGeometry(0.3, 0.25, 8, 20), skin, 0, 0.45, 0);
      g.add(body);
      const head = mesh(new THREE.SphereGeometry(0.32, 28, 20), skin, 0, 1.0, 0);
      g.add(head);
      addHands(g, c);
      // bụng sáng màu
      const belly = mesh(new THREE.SphereGeometry(0.22, 18, 14), mat(0xfff3e0), 0, 0.42, -0.17);
      belly.scale.set(1, 1.1, 0.5);
      if (type !== 'tho') g.add(belly);

      if (type === 'meo') {
        for (const s of [-1, 1]) {
          const ear = mesh(new THREE.ConeGeometry(0.11, 0.22, 4), skin, s * 0.18, 1.28, 0);
          ear.rotation.z = -s * 0.3;
          g.add(ear);
          const inner = mesh(new THREE.ConeGeometry(0.06, 0.13, 4), mat(0xffb3c6), s * 0.18, 1.27, -0.05);
          inner.rotation.z = -s * 0.3;
          g.add(inner);
        }
        const muzzle = mesh(new THREE.SphereGeometry(0.12, 16, 12), mat(0xfff3e0), 0, 0.92, -0.25);
        muzzle.scale.set(1.2, 0.8, 0.6);
        g.add(muzzle);
        g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xff6b8b), 0, 0.96, -0.31));
        addEyes(g, 1.06, -0.27);
        addBlush(g, 0.95, -0.27, 0.2);
      } else if (type === 'gau') {
        for (const s of [-1, 1]) {
          g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), skin, s * 0.22, 1.26, 0));
          g.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(0xe2b58c), s * 0.22, 1.26, -0.06));
        }
        const snout = mesh(new THREE.SphereGeometry(0.13, 16, 12), mat(0xe2b58c), 0, 0.93, -0.26);
        snout.scale.set(1.1, 0.8, 0.7);
        g.add(snout);
        g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0x1a1010), 0, 0.97, -0.34));
        addEyes(g, 1.07, -0.27);
        addBlush(g, 0.96, -0.26, 0.21);
      } else if (type === 'tho') {
        for (const s of [-1, 1]) {
          const ear = mesh(new THREE.CapsuleGeometry(0.065, 0.32, 6, 12), skin, s * 0.11, 1.48, 0.02);
          ear.rotation.z = -s * 0.15;
          g.add(ear);
          const inner = mesh(new THREE.CapsuleGeometry(0.035, 0.26, 6, 10), mat(0xffb3c6), s * 0.11, 1.48, -0.03);
          inner.rotation.z = -s * 0.15;
          g.add(inner);
        }
        g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0xff6b8b), 0, 0.95, -0.31));
        addEyes(g, 1.06, -0.27);
        addBlush(g, 0.95, -0.27, 0.2);
      } else if (type === 'ech') {
        head.scale.set(1.25, 0.82, 1);
        for (const s of [-1, 1]) {
          g.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), skin, s * 0.17, 1.2, -0.08));
          g.add(mesh(new THREE.SphereGeometry(0.085, 14, 10), mat(0xffffff), s * 0.17, 1.22, -0.15));
          g.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(0x111111), s * 0.17, 1.22, -0.22));
        }
        const mouth = mesh(new THREE.TorusGeometry(0.14, 0.015, 6, 20, Math.PI), mat(0x234d23), 0, 0.97, -0.26);
        mouth.rotation.z = Math.PI;
        g.add(mouth);
        addBlush(g, 0.95, -0.25, 0.26);
      } else if (type === 'heo') {
        for (const s of [-1, 1]) {
          const ear = mesh(new THREE.ConeGeometry(0.09, 0.16, 4), skin, s * 0.2, 1.27, -0.04);
          ear.rotation.set(-0.5, 0, -s * 0.4);
          g.add(ear);
        }
        const snout = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), mat(0xff86a5), 0, 0.94, -0.31);
        snout.rotation.x = Math.PI / 2;
        g.add(snout);
        for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), mat(0x8a2f48), s * 0.04, 0.94, -0.355));
        addEyes(g, 1.08, -0.26);
      }
    }
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// Nhân vật đã mặc đồ (dùng cho ảnh xem trước)
export function createDressed(type, outfit) {
  const g = createCharacter(type);
  g.userData.animated = dressCharacter(g, type, outfit);
  return g;
}

// ---------------- SPRITE CHỮ ----------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Be Vietnam Pro", "Segoe UI", system-ui, sans-serif';

// Vẽ chữ ở độ phân giải gấp đôi để nét khi phóng to
const TEXT_RES = 2;
// Ảnh chữ sắc nét: không bị đèn rạp / tắt đèn làm tối, không vỡ răng cưa khi ở xa
function crispTexture(cv) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}
function textMaterial(tex, depthTest = true) {
  return new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest, transparent: true, toneMapped: false, fog: false });
}

export function makeLabel(text, color = '#ffffff', tier = 0) {
  const fs = 44;
  const t = tierInfo(tier);
  if (t.icon) text = t.icon + ' ' + text;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px ${FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 44;
  const h = fs + 28;
  cv.width = w * TEXT_RES; cv.height = h * TEXT_RES;
  ctx.scale(TEXT_RES, TEXT_RES);
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = 'rgba(8,8,16,0.86)';
  roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
  ctx.fill();
  if (tier > 0) {
    // viền màu theo hạng
    ctx.lineWidth = 5;
    ctx.strokeStyle = t.color;
    ctx.stroke();
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  const sp = new THREE.Sprite(textMaterial(crispTexture(cv)));
  const height = 0.22;
  sp.scale.set((w / h) * height, height, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 10;
  return sp;
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
    // từ quá dài: cắt bớt
    while (ctx.measureText(line).width > maxW) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  if (lines.length > 4) { lines.length = 4; lines[3] += '…'; }
  return lines;
}

export function makeBubble(text, tier = 0) {
  const fs = 40, pad = 26, lh = fs * 1.25, maxW = 520;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, text, maxW);
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const w = Math.ceil(tw + pad * 2), tail = 22;
  const h = Math.ceil(lines.length * lh + pad * 1.6);
  cv.width = w * TEXT_RES; cv.height = (h + tail) * TEXT_RES;
  ctx.scale(TEXT_RES, TEXT_RES);
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, w, h, 28);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2 - 18, h - 1); ctx.lineTo(w / 2, h + tail); ctx.lineTo(w / 2 + 18, h - 1);
  ctx.fill();
  if (tier > 0) {
    // khung bong bóng chat theo hạng
    ctx.lineWidth = 8;
    ctx.strokeStyle = tierInfo(tier).color;
    roundRect(ctx, 4, 4, w - 8, h - 8, 26);
    ctx.stroke();
  }
  ctx.fillStyle = '#0d0b18';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, pad * 0.8 + i * lh + 4));
  const sp = new THREE.Sprite(textMaterial(crispTexture(cv), false));
  const height = (cv.height / TEXT_RES / 100) * 0.42;
  sp.scale.set((cv.width / cv.height) * height, height, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 20;
  return sp;
}

export function makeEmojiSprite(emoji, size = 0.6) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  sp.scale.set(size, size, 1);
  sp.renderOrder = 30;
  return sp;
}

// ---------------- NGƯỜI XEM TRONG RẠP ----------------
export class Avatar {
  constructor(user) {
    this.user = user;
    this.group = new THREE.Group();
    this.group.userData.userId = user.id;
    this.body = createCharacter(user.character);
    this.animated = dressCharacter(this.body, user.character, user.outfit);
    this.body.traverse((o) => { o.userData.userId = user.id; });
    this.group.add(this.body);
    this.label = makeLabel(user.name, CHARACTER_INFO[user.character]?.color || '#fff', user.tier || 0);
    // đặt bảng tên cao hơn mũ / tai
    this.labelY = Math.max(1.55, new THREE.Box3().setFromObject(this.body).max.y + 0.1);
    this.label.position.y = this.labelY;
    this.label.visible = false; // không hiện tên trên đầu nhân vật — tên chỉ hiện trong phần Trò chuyện
    this.group.add(this.label);
    this.hands = (this.body.userData.hands || []).map((m) => ({ m, base: m.position.clone() }));
    this.emoteKind = null;
    this.emoteUntil = 0;
    this.bubble = null;
    this.bubbleUntil = 0;
    this.hopT = 0;
    this.phase = Math.random() * Math.PI * 2;
    // quà được tặng (bó hoa, trà sữa...) lơ lửng trên đầu
    this.giftSprites = [];
    const gifts = (user.gifts || []).filter((g) => g.icon && g.icon !== '👑'); // vương miện đã đội thật trên đầu
    gifts.forEach((g, i) => {
      const sp = makeEmojiSprite(g.icon, 0.42);
      sp.material.depthTest = true;
      sp.renderOrder = 4;
      sp.position.set((i - (gifts.length - 1) / 2) * 0.42, this.labelY + 0.05, 0);
      sp.userData.baseY = sp.position.y;
      this.group.add(sp);
      this.giftSprites.push(sp);
    });
  }

  say(text) {
    if (this.bubble) {
      this.group.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
    }
    this.bubble = makeBubble(text, this.user.tier || 0);
    this.bubble.position.y = this.labelY;
    this.group.add(this.bubble);
    this.bubbleUntil = performance.now() + 5000 + Math.min(text.length * 60, 4000);
    this.hop(0.5);
  }

  hop(strength = 1) { this.hopT = 1; this.hopStrength = strength; }

  // Động tác: dance (nhún nhảy), wave (vẫy tay), clap (vỗ tay)
  emote(kind, ms) {
    this.emoteKind = kind;
    this.emoteUntil = performance.now() + ms;
  }

  // Giữ bảng tên / bong bóng chat có kích thước dễ đọc dù ở gần hay xa
  setUiScale(dist) {
    const k = Math.min(2.3, Math.max(0.35, dist / 6.5));
    if (!this.labelBase) this.labelBase = this.label.scale.clone();
    this.label.scale.set(this.labelBase.x * k, this.labelBase.y * k, 1);
    if (this.bubble) {
      if (!this.bubble.userData.base) this.bubble.userData.base = this.bubble.scale.clone();
      const b = this.bubble.userData.base;
      this.bubble.scale.set(b.x * k, b.y * k, 1);
      this.bubble.position.y = this.labelY;
    }
  }

  update(dt, t) {
    // về tư thế gốc
    for (const h of this.hands) h.m.position.copy(h.base);
    this.body.rotation.set(0, 0, 0);
    // nhún nhẹ khi ngồi xem
    let y = Math.sin(t * 1.6 + this.phase) * 0.015;
    const kind = this.walking ? 'walk' : performance.now() < this.emoteUntil ? this.emoteKind : this.user.stage ? 'dance' : null;
    const tt = t + this.phase;
    if (kind === 'walk') {
      // dáng đi lạch bạch: nhún theo bước chân, nghiêng trái phải, vung tay
      const w = tt * 11;
      y += Math.abs(Math.sin(w)) * 0.09;
      this.body.rotation.z = Math.sin(w) * 0.11;
      this.body.rotation.x = -0.08;
      this.hands.forEach((h, i) => {
        h.m.position.z = h.base.z + Math.sin(w + i * Math.PI) * 0.13;
        h.m.position.y = h.base.y + Math.abs(Math.cos(w + i * Math.PI)) * 0.04;
      });
    } else if (kind === 'dance') {
      y += Math.abs(Math.sin(tt * 7)) * 0.18;
      this.body.rotation.y = Math.sin(tt * 3.5) * 0.5;
      this.body.rotation.z = Math.sin(tt * 7) * 0.08;
      this.hands.forEach((h, i) => {
        h.m.position.y = h.base.y + 0.45 + Math.sin(tt * 7 + i * Math.PI) * 0.15;
        h.m.position.x = h.base.x + (i ? 0.08 : -0.08);
      });
    } else if (kind === 'wave') {
      const h = this.hands[1];
      if (h) h.m.position.set(h.base.x + 0.1 + Math.sin(tt * 12) * 0.12, h.base.y + 0.65, h.base.z);
      this.body.rotation.z = -0.08;
    } else if (kind === 'clap') {
      const c = Math.abs(Math.sin(tt * 9));
      this.hands.forEach((h, i) => h.m.position.set((i ? 1 : -1) * (0.05 + c * 0.2), h.base.y + 0.22, h.base.z - 0.14));
      y += c * 0.02;
    }
    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt * 2.5);
      y += Math.sin((1 - this.hopT) * Math.PI) * 0.25 * this.hopStrength;
      this.body.rotation.z += Math.sin((1 - this.hopT) * Math.PI * 4) * 0.12 * this.hopT;
    }
    this.body.position.y = y;
    // cánh vỗ nhẹ, hào quang bồng bềnh
    for (const o of this.animated) {
      if (o.userData.wing) o.rotation.y = o.userData.wing * (0.25 + Math.sin(tt * 3) * 0.2);
      else if (o.userData.float) {
        if (o.userData.baseY === undefined) o.userData.baseY = o.position.y;
        o.position.y = o.userData.baseY + Math.sin(tt * 2) * 0.03;
      }
    }
    this.giftSprites.forEach((sp, i) => { sp.position.y = sp.userData.baseY + Math.sin(t * 2.2 + i) * 0.05; });
    if (this.bubble && performance.now() > this.bubbleUntil) {
      this.group.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
      this.bubble = null;
    }
  }

  headPosition(target = new THREE.Vector3()) {
    return this.group.localToWorld(target.set(0, 1.0, 0));
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
      if (o.isMesh) o.geometry.dispose();
    });
  }
}
