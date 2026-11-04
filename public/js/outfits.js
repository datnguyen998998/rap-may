// ===============================================================
//  TRANG PHỤC 3D: mũ, áo, phụ kiện — mặc được cho cả 8 nhân vật
//  Danh sách món đồ và điểm mở khoá nằm ở lib/wardrobe.js (máy chủ)
// ===============================================================
import * as THREE from 'three';

// Hạng (máy chủ gửi bản chính thức qua setTiers)
export let TIERS = [
  { id: 0, name: 'Khán giả', points: 0, color: '#d0d7c5', icon: '' },
  { id: 1, name: 'Fan cứng', points: 60, color: '#7fd1ff', icon: '🎟️' },
  { id: 2, name: 'Ngôi sao', points: 200, color: '#ffd166', icon: '⭐' },
  { id: 3, name: 'Siêu sao', points: 500, color: '#ff8fab', icon: '🌟' },
  { id: 4, name: 'Huyền thoại', points: 1000, color: '#c9a7ff', icon: '👑' },
];
export function setTiers(t) { if (Array.isArray(t) && t.length) TIERS = t; }
export const tierInfo = (id) => TIERS[Math.max(0, Math.min(TIERS.length - 1, id || 0))];

// Điểm neo trên từng dáng nhân vật (đầu, cổ, thân, mắt)
const BASE = { bodyY: 0.45, bodyR: 0.31, bodyH: 0.5, neckY: 0.74, headY: 1.0, headR: 0.32, headTop: 1.29, eyeY: 1.06, eyeZ: -0.3, eyeSpread: 0.12 };
const ANCHORS = {
  meo: BASE, gau: BASE, tho: BASE, heo: BASE,
  ech: { ...BASE, headR: 0.36, headTop: 1.28, eyeY: 1.22, eyeZ: -0.27, eyeSpread: 0.17 },
  robot: { ...BASE, bodyY: 0.44, bodyR: 0.34, neckY: 0.74, headY: 0.98, headR: 0.28, headTop: 1.2, eyeY: 1.02, eyeZ: -0.24, box: true, bodyW: 0.68, bodyD: 0.5 },
  ma: { ...BASE, bodyY: 0.52, bodyR: 0.45, bodyH: 0.42, neckY: 0.76, headY: 0.95, headR: 0.4, headTop: 1.33, eyeY: 1.0, eyeZ: -0.38, eyeSpread: 0.13 },
  canhcut: { ...BASE, bodyR: 0.37, bodyH: 0.46, neckY: 0.78, headTop: 1.28, eyeY: 1.03, eyeZ: -0.3, eyeSpread: 0.09 },
};

let _heart = null;
function heartGeo() {
  if (_heart) return _heart;
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.07);
  sh.bezierCurveTo(-0.02, -0.045, -0.085, -0.01, -0.085, 0.025);
  sh.bezierCurveTo(-0.085, 0.06, -0.04, 0.075, 0, 0.04);
  sh.bezierCurveTo(0.04, 0.075, 0.085, 0.06, 0.085, 0.025);
  sh.bezierCurveTo(0.085, -0.01, 0.02, -0.045, 0, -0.07);
  _heart = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
  _heart.center();
  return _heart;
}

const cache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  return cache.get(key);
}
const GOLD = () => mat(0xe8b43a, { metalness: 0.8, roughness: 0.3, emissive: 0x4a3000, emissiveIntensity: 0.6 });
function add(g, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// Lớp áo ôm thân
function shell(g, a, material, grow = 1) {
  if (a.box) return add(g, new THREE.BoxGeometry(a.bodyW * grow, a.bodyH, a.bodyD * grow), material, 0, a.bodyY, 0);
  const m = add(g, new THREE.CylinderGeometry(a.bodyR * 1.04 * grow, a.bodyR * 1.1 * grow, a.bodyH, 28, 1, true), material, 0, a.bodyY, 0);
  material.side = THREE.DoubleSide;
  return m;
}
// Áo choàng phía sau lưng
function cape(g, a, material, len = 0.85) {
  const geo = new THREE.CylinderGeometry(a.bodyR + 0.1, a.bodyR + 0.26, len, 24, 1, true, -Math.PI / 2, Math.PI);
  material.side = THREE.DoubleSide;
  return add(g, geo, material, 0, a.neckY - len / 2 + 0.04, 0.02);
}

let stripeTex = null;
function stripes(color) {
  if (!stripeTex) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#ddd';
    for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 8);
    stripeTex = new THREE.CanvasTexture(c);
    stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
    stripeTex.repeat.set(1, 3);
  }
  return new THREE.MeshStandardMaterial({ color, map: stripeTex, roughness: 0.6 });
}

// ---------------- MŨ ----------------
const HATS = {
  cap(g, a, color) {
    // đội cao hơn mắt một chút
    const cy = a.headY + a.headR * 0.32;
    const dome = add(g, new THREE.SphereGeometry(a.headR * 0.98, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color), 0, cy, 0);
    dome.scale.y = 0.9;
    const brim = add(g, new THREE.CylinderGeometry(a.headR * 0.7, a.headR * 0.7, 0.03, 24), mat(color, { roughness: 0.5 }), 0, cy + 0.01, -a.headR * 0.8);
    brim.scale.set(1, 1, 0.75);
    brim.rotation.x = -0.12;
    add(g, new THREE.SphereGeometry(0.035, 8, 6), mat(0xffffff), 0, cy + a.headR * 0.9, 0);
  },
  beanie(g, a, color) {
    const cy = a.headY + a.headR * 0.3;
    const top = add(g, new THREE.SphereGeometry(a.headR * 1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { roughness: 0.95 }), 0, cy, 0);
    top.scale.y = 1.05;
    const rim = add(g, new THREE.TorusGeometry(a.headR * 0.98, 0.05, 10, 28), mat(color, { roughness: 1 }), 0, cy + 0.02, 0);
    rim.rotation.x = Math.PI / 2;
    add(g, new THREE.SphereGeometry(0.075, 12, 10), mat(0xffffff, { roughness: 1 }), 0, cy + a.headR * 1.05 + 0.05, 0);
  },
  party(g, a, color) {
    const cone = add(g, new THREE.ConeGeometry(0.14, 0.4, 20), stripes(color), 0.04, a.headTop + 0.17, 0);
    cone.rotation.z = -0.18;
    add(g, new THREE.SphereGeometry(0.055, 10, 8), mat(0xffd84a, { emissive: 0x553300 }), 0.08, a.headTop + 0.38, 0);
  },
  headphones(g, a, color) {
    const r = a.box ? a.headR + 0.1 : a.headR + 0.04;
    const band = add(g, new THREE.TorusGeometry(r, 0.03, 8, 28, Math.PI), mat(0x222228, { roughness: 0.4 }), 0, a.headY + 0.02, 0);
    band.rotation.z = 0;
    for (const s of [-1, 1]) {
      const cup = add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), mat(0x222228, { roughness: 0.4 }), s * r, a.headY, 0);
      cup.rotation.z = Math.PI / 2;
      const ring = add(g, new THREE.TorusGeometry(0.1, 0.018, 6, 20), mat(color, { emissive: color, emissiveIntensity: 0.6 }), s * (r + 0.042), a.headY, 0);
      ring.rotation.y = Math.PI / 2;
    }
  },
  wizard(g, a) {
    const purple = mat(0x4b2a85, { roughness: 0.8 });
    const brim = add(g, new THREE.CylinderGeometry(a.headR * 1.35, a.headR * 1.35, 0.025, 28), purple, 0, a.headTop - 0.04, 0);
    brim.rotation.x = 0.06;
    const cone = add(g, new THREE.ConeGeometry(a.headR * 0.85, 0.62, 24), purple, 0, a.headTop + 0.27, 0.03);
    cone.rotation.x = 0.18;
    add(g, new THREE.TorusGeometry(a.headR * 0.83, 0.03, 6, 24), mat(0xffd84a, { emissive: 0x554400 }), 0, a.headTop + 0.01, 0).rotation.x = Math.PI / 2;
    for (const [x, y, z] of [[-0.1, 0.22, -0.2], [0.08, 0.38, -0.14], [0.13, 0.12, -0.24]]) {
      add(g, new THREE.OctahedronGeometry(0.035), mat(0xfff3a0, { emissive: 0xffe066, emissiveIntensity: 1.5 }), x, a.headTop + y, z);
    }
  },
  crown(g, a) {
    const gold = GOLD();
    gold.side = THREE.DoubleSide;
    const r = a.box ? 0.22 : a.headR * 0.68;
    add(g, new THREE.CylinderGeometry(r, r * 0.95, 0.13, 24, 1, true), gold, 0, a.headTop + 0.02, 0);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.045, 0.13, 8), gold, Math.sin(ang) * r, a.headTop + 0.15, Math.cos(ang) * r);
      add(g, new THREE.SphereGeometry(0.03, 10, 8), mat(i % 2 ? 0xe5484d : 0x3fa9ff, { emissive: i % 2 ? 0x550000 : 0x002255, roughness: 0.2 }),
        Math.sin(ang + 0.5) * (r + 0.01), a.headTop + 0.02, Math.cos(ang + 0.5) * (r + 0.01));
      add(g, new THREE.SphereGeometry(0.02, 8, 6), gold, Math.sin(ang) * r, a.headTop + 0.22, Math.cos(ang) * r);
    }
  },
};

// ---------------- TRANG PHỤC ----------------
const BODIES = {
  tee(g, a, color) {
    shell(g, a, mat(color, { roughness: 0.85 }));
    if (!a.box) {
      const col = add(g, new THREE.TorusGeometry(a.bodyR * 0.8, 0.025, 6, 24), mat(0xffffff), 0, a.bodyY + a.bodyH / 2 - 0.01, 0);
      col.rotation.x = Math.PI / 2;
    }
  },
  hoodie(g, a, color) {
    shell(g, a, mat(color, { roughness: 0.95 }), 1.04);
    const hood = add(g, new THREE.TorusGeometry(0.17, 0.075, 10, 22), mat(color, { roughness: 0.95 }), 0, a.neckY + 0.02, a.bodyR * 0.55);
    hood.rotation.x = Math.PI / 2.6;
    const pocket = add(g, new THREE.BoxGeometry(0.3, 0.12, 0.03), mat(color, { roughness: 1 }), 0, a.bodyY - 0.1, -(a.box ? a.bodyD / 2 + 0.02 : a.bodyR * 1.1));
    pocket.material = mat(new THREE.Color(color).multiplyScalar(0.8).getHex());
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.16), mat(0xffffff), s * 0.06, a.neckY - 0.12, -(a.box ? a.bodyD / 2 + 0.02 : a.bodyR * 1.05));
  },
  vest(g, a) {
    shell(g, a, mat(0x1d1d24, { roughness: 0.6 }), 1.02);
    const fz = -(a.box ? a.bodyD / 2 + 0.015 : a.bodyR * 1.06);
    add(g, new THREE.BoxGeometry(0.15, a.bodyH * 0.8, 0.02), mat(0xf5f5f5), 0, a.bodyY + 0.03, fz);
    add(g, new THREE.BoxGeometry(0.05, a.bodyH * 0.55, 0.025), mat(0xb3132c), 0, a.bodyY + 0.02, fz - 0.01);
    for (const y of [-0.12, -0.02]) add(g, new THREE.SphereGeometry(0.022, 8, 6), GOLD(), 0.1, a.bodyY + y, fz - 0.005);
    if (!a.box) {
      const trim = add(g, new THREE.TorusGeometry(a.bodyR * 1.1, 0.015, 6, 28), GOLD(), 0, a.bodyY - a.bodyH / 2 + 0.01, 0);
      trim.rotation.x = Math.PI / 2;
    }
  },
  armor(g, a) {
    const metal = mat(0xaab4c8, { metalness: 0.85, roughness: 0.3, emissive: 0x111827 });
    shell(g, a, metal, 1.05);
    for (const s of [-1, 1]) {
      const pad = add(g, new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal, s * (a.bodyR + 0.03), a.neckY - 0.06, 0);
      pad.scale.set(1, 0.8, 1);
      pad.rotation.z = -s * 0.5;
    }
    const fz = -(a.box ? a.bodyD / 2 + 0.03 : a.bodyR * 1.12);
    const emblem = add(g, new THREE.OctahedronGeometry(0.07), mat(0x5ec8ff, { emissive: 0x2288ff, emissiveIntensity: 1.2 }), 0, a.bodyY + 0.08, fz);
    emblem.scale.z = 0.4;
    if (!a.box) {
      const belt = add(g, new THREE.TorusGeometry(a.bodyR * 1.14, 0.03, 6, 28), mat(0x4a3520), 0, a.bodyY - 0.15, 0);
      belt.rotation.x = Math.PI / 2;
    }
  },
  royal(g, a) {
    const velvet = mat(0x8e1022, { roughness: 0.9 });
    shell(g, a, velvet, 1.03);
    cape(g, a, mat(0xa8122a, { roughness: 0.85 }));
    const fur = add(g, new THREE.TorusGeometry(a.bodyR * 0.95, 0.075, 10, 28), mat(0xf7f3ea, { roughness: 1 }), 0, a.neckY, 0);
    fur.rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      add(g, new THREE.SphereGeometry(0.018, 6, 4), mat(0x111111), Math.sin(ang) * a.bodyR * 0.95, a.neckY + 0.06, Math.cos(ang) * a.bodyR * 0.95);
    }
    add(g, new THREE.SphereGeometry(0.04, 10, 8), GOLD(), 0, a.neckY - 0.05, -(a.box ? a.bodyD / 2 + 0.03 : a.bodyR));
  },
  galaxy(g, a) {
    const robe = mat(0x24124a, { roughness: 0.5, emissive: 0x1a0b40, emissiveIntensity: 0.8 });
    shell(g, a, robe, 1.04);
    // áo choàng cực quang
    const geo = new THREE.CylinderGeometry(a.bodyR + 0.1, a.bodyR + 0.3, 0.9, 24, 6, true, -Math.PI / 2, Math.PI);
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + 0.45) / 0.9;
      const c = new THREE.Color().setHSL(0.5 + (1 - t) * 0.35, 0.9, 0.55);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const aurora = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    aurora.position.set(0, a.neckY - 0.41, 0.02);
    g.add(aurora);
    // sao lấp lánh trên áo
    const star = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 2 });
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const y = a.bodyY + (Math.random() - 0.5) * a.bodyH * 0.9;
      const r = a.box ? 0 : a.bodyR * 1.12;
      const x = a.box ? (Math.random() - 0.5) * a.bodyW : Math.sin(ang) * r;
      const z = a.box ? -a.bodyD / 2 - 0.01 : Math.cos(ang) * r;
      add(g, new THREE.SphereGeometry(0.014 + Math.random() * 0.012, 6, 4), star, x, y, z);
    }
    const collar = add(g, new THREE.TorusGeometry(a.bodyR * 0.9, 0.03, 6, 24), mat(0xc9a7ff, { emissive: 0x8a5bff, emissiveIntensity: 1 }), 0, a.neckY, 0);
    collar.rotation.x = Math.PI / 2;
  },
};

// ---------------- PHỤ KIỆN ----------------
const ACCS = {
  bowtie(g, a, color) {
    const z = -(a.box ? a.bodyD / 2 + 0.03 : a.bodyR * 0.98);
    const y = a.neckY - 0.03;
    for (const s of [-1, 1]) {
      const wing = add(g, new THREE.ConeGeometry(0.06, 0.12, 4), mat(color), s * 0.06, y, z);
      wing.rotation.z = s * Math.PI / 2;
    }
    add(g, new THREE.SphereGeometry(0.03, 8, 6), mat(color), 0, y, z - 0.01);
  },
  scarf(g, a, color) {
    const m = mat(color, { roughness: 1 });
    const ring = add(g, new THREE.TorusGeometry(a.box ? 0.3 : a.bodyR * 0.88, 0.075, 10, 26), m, 0, a.neckY, 0);
    ring.rotation.x = Math.PI / 2;
    const tail = add(g, new THREE.BoxGeometry(0.11, 0.3, 0.04), m, 0.12, a.neckY - 0.17, -(a.box ? a.bodyD / 2 + 0.04 : a.bodyR * 1.02));
    tail.rotation.z = 0.12;
  },
  shades(g, a) {
    const black = mat(0x0a0a0f, { metalness: 0.4, roughness: 0.15 });
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.13, 0.075, 0.02), black, s * a.eyeSpread, a.eyeY, a.eyeZ - 0.035);
    add(g, new THREE.BoxGeometry(a.eyeSpread * 2 - 0.1, 0.02, 0.02), black, 0, a.eyeY + 0.02, a.eyeZ - 0.035);
  },
  halo(g, a) {
    const halo = add(g, new THREE.TorusGeometry(0.2, 0.025, 8, 32), mat(0xffe066, { emissive: 0xffd23f, emissiveIntensity: 2 }), 0, a.headTop + 0.24, 0);
    halo.rotation.x = Math.PI / 2;
    halo.userData.float = true;
  },
  // Kính trái tim (món hiếm từ lời mời bạn bè)
  heartshades(g, a) {
    const lens = mat(0xff3d7f, { emissive: 0xff2266, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.2 });
    for (const sx of [-1, 1]) {
      const h = add(g, heartGeo(), lens, sx * a.eyeSpread, a.eyeY - 0.005, a.eyeZ - 0.04);
      h.rotation.y = Math.PI; // mặt kính hướng ra phía trước nhân vật
    }
    add(g, new THREE.BoxGeometry(a.eyeSpread * 2 - 0.12, 0.018, 0.018), mat(0xffd6e5), 0, a.eyeY + 0.025, a.eyeZ - 0.04);
  },
  wings(g, a) {
    const white = mat(0xffffff, { roughness: 0.9, emissive: 0xbfd8ff, emissiveIntensity: 0.25 });
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.16, a.bodyY + 0.22, (a.box ? a.bodyD / 2 : a.bodyR) + 0.08);
      const big = add(w, new THREE.SphereGeometry(1, 16, 12), white, s * 0.24, 0.12, 0);
      big.scale.set(0.3, 0.42, 0.05);
      big.rotation.z = -s * 0.6;
      const small = add(w, new THREE.SphereGeometry(1, 14, 10), white, s * 0.18, -0.12, 0.02);
      small.scale.set(0.2, 0.3, 0.045);
      small.rotation.z = -s * 0.9;
      w.userData.wing = s;
      g.add(w);
    }
  },
};

// Mặc đồ cho nhân vật. Trả về danh sách phần có chuyển động (cánh, hào quang)
export function dressCharacter(g, type, outfit) {
  const animated = [];
  if (!outfit) return animated;
  const a = ANCHORS[type] || BASE;
  const color = outfit.color || '#0090ff';
  const layer = new THREE.Group();
  if (outfit.body && BODIES[outfit.body]) BODIES[outfit.body](layer, a, color);
  if (outfit.hat && HATS[outfit.hat]) HATS[outfit.hat](layer, a, color);
  if (outfit.acc && ACCS[outfit.acc]) ACCS[outfit.acc](layer, a, color);
  layer.traverse((o) => { if (o.userData.float || o.userData.wing) animated.push(o); });
  g.add(layer);
  return animated;
}
