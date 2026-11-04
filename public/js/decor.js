// ===============================================================
//  TRANG TRÍ RẠP (theo ảnh rạp cổ điển): tường ốp tấm đỏ cam khung vàng
//  với dãy bóng đèn, trần dầm gỗ ô sáng ấm, loa treo tường, loa sân khấu,
//  đèn rọi hai bên (có luồng sáng).
//  Khi chiếu nhạc sôi động: loa "nhún" theo nhịp, đèn rọi quét và đổi màu.
// ===============================================================
import * as THREE from 'three';

const ROOM_HALF_W = 11.5;

const M = {
  cabinet: new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.55, metalness: 0.2 }),
  baffle: new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.8 }),
  cone: new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.9 }),
  surround: new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.7 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.3, metalness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.8 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x2b1f2d, roughness: 1 }),
  strip: new THREE.MeshStandardMaterial({ color: 0x8a5a24, emissive: 0xff9a3c, emissiveIntensity: 0.8 }),
  led: new THREE.MeshStandardMaterial({ color: 0xd6f06c, emissive: 0xb8e04a, emissiveIntensity: 1.6 }),
  lens: new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff0cc, emissiveIntensity: 3 }),
};

// Tấm ốp tường: đỏ sẫm ở dưới, sáng cam ở giữa (giống ánh đèn hắt trong ảnh rạp mẫu)
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, '#3a0c08');
  grad.addColorStop(0.35, '#a8361c');
  grad.addColorStop(0.6, '#d8692e');
  grad.addColorStop(0.85, '#8a2a16');
  grad.addColorStop(1, '#2a0a06');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Ô trần: cam ấm sáng ở giữa, tối dần ra mép
function cofferTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 40);
  grad.addColorStop(0, '#e07a3a');
  grad.addColorStop(0.7, '#8a3418');
  grad.addColorStop(1, '#2a0d08');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------- LOA ----------------
// Một chiếc loa: thùng + mặt loa + các củ loa (woofer) + họng loa (tweeter/horn). Mặt loa quay về +Z.
function makeSpeaker({ w, h, d, drivers = [], horn = null, logo = true }) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.cabinet);
  g.add(box);
  const front = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.95, 0.02), M.baffle);
  front.position.z = d / 2 + 0.005;
  g.add(front);
  const woofers = [];
  for (const dr of drivers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(dr.r, dr.r * 0.12, 8, 28), M.surround);
    ring.position.set(dr.x || 0, dr.y, d / 2 + 0.02);
    g.add(ring);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(dr.r * 0.92, dr.r * 0.35, 28, 1, true), M.cone);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(dr.x || 0, dr.y, d / 2 + 0.005);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(dr.r * 0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.cap);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(dr.x || 0, dr.y, d / 2 - 0.02);
    const pump = new THREE.Group();
    pump.add(cone, cap);
    g.add(pump);
    woofers.push({ pump, size: dr.r });
  }
  if (horn) {
    const hornMesh = new THREE.Mesh(new THREE.CylinderGeometry(horn.w, horn.w * 0.25, 0.18, 4, 1, true), M.cone);
    hornMesh.rotation.x = -Math.PI / 2;
    hornMesh.rotation.y = Math.PI / 4;
    hornMesh.scale.set(1, 1, horn.h / horn.w);
    hornMesh.position.set(0, horn.y, d / 2 - 0.06);
    g.add(hornMesh);
  }
  if (logo) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 0.03, 0.01), M.led);
    l.position.set(0, -h / 2 + 0.07, d / 2 + 0.02);
    g.add(l);
  }
  g.userData.woofers = woofers;
  return g;
}

// ---------------- ĐÈN RỌI ----------------
let beamAlpha = null;
function beamAlphaTexture() {
  if (beamAlpha) return beamAlpha;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#000');      // đầu xa: tắt dần
  grad.addColorStop(0.6, '#555');
  grad.addColorStop(1, '#fff');      // gần bóng đèn: sáng nhất
  x.fillStyle = grad;
  x.fillRect(0, 0, 4, 128);
  beamAlpha = new THREE.CanvasTexture(c);
  return beamAlpha;
}

function makeFixture(side) {
  const g = new THREE.Group();
  // giá gắn tường
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), M.metal);
  plate.position.x = side * 0.0;
  g.add(plate);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), M.metal);
  arm.position.x = -side * 0.2;
  g.add(arm);
  // càng chữ U + đầu đèn xoay được
  const yoke = new THREE.Group();
  yoke.position.x = -side * 0.42;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.56), M.metal);
  yoke.add(bar);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), M.metal);
    leg.position.set(0, -0.17, s * 0.27);
    yoke.add(leg);
  }
  g.add(yoke);
  const head = new THREE.Group();
  head.position.set(-side * 0.42, -0.3, 0);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 20), M.cabinet);
  can.rotation.x = Math.PI / 2;
  head.add(can);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), M.lens.clone());
  lens.position.z = 0.26;
  head.add(lens);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 24), M.metal);
  ring.position.z = 0.25;
  head.add(ring);
  g.add(head);
  return { group: g, head, lens };
}

function makeBeam(color) {
  const geo = new THREE.CylinderGeometry(1, 0.06, 1, 28, 1, true);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color, alphaMap: beamAlphaTexture(), transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

const PARTY_COLORS = [0xff3fa4, 0x3fd8ff, 0xffd23f, 0x8a5bff, 0x46f28c, 0xff7a3f].map((c) => new THREE.Color(c));
const WARM = new THREE.Color(0xfff0d6);

// ---------------- DỰNG TẤT CẢ ----------------
export function buildDecor(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const woofers = [];

  // 1) Tường: các tấm ốp đỏ cam phát sáng, khung vàng, 2 dãy bóng đèn mỗi tấm + chân tường gỗ
  const panelTex = panelTexture();
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, emissiveMap: panelTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a04a, metalness: 0.85, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const pilaster = new THREE.MeshStandardMaterial({ color: 0x2a0d0b, roughness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x2b100c, roughness: 0.65 });
  const PANEL_Y0 = 1.5, PANEL_H = 9.6, PANEL_W = 2.5, BULBS = 17;
  const panelZs = [];
  for (let z = -10.2; z <= 11; z += 3.0) panelZs.push(z);
  const bulbGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), panelZs.length * 2 * 2 * BULBS);
  const bulbInfo = []; // { col, row, side }
  const m4 = new THREE.Matrix4();
  for (const side of [-1, 1]) {
    const wx = side * (ROOM_HALF_W - 0.07);
    for (const z of panelZs) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, PANEL_H, PANEL_W), panelMat);
      p.position.set(wx, PANEL_Y0 + PANEL_H / 2, z);
      root.add(p);
      // khung vàng
      for (const [dy, h, dz, w] of [[PANEL_H / 2, 0.07, 0, PANEL_W + 0.1], [-PANEL_H / 2, 0.07, 0, PANEL_W + 0.1], [0, PANEL_H, PANEL_W / 2, 0.07], [0, PANEL_H, -PANEL_W / 2, 0.07]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), gold);
        f.position.set(wx - side * 0.06, PANEL_Y0 + PANEL_H / 2 + dy, z + dz);
        root.add(f);
      }
      // trụ sẫm giữa các tấm
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.32, PANEL_H + 0.6, 0.42), pilaster);
      pil.position.set(wx - side * 0.12, PANEL_Y0 + PANEL_H / 2, z + 1.5);
      root.add(pil);
      // 2 dãy bóng đèn dọc
      for (const dz of [-0.85, 0.85]) {
        for (let r = 0; r < BULBS; r++) {
          m4.makeTranslation(wx - side * 0.1, PANEL_Y0 + 0.35 + r * ((PANEL_H - 0.7) / (BULBS - 1)), z + dz);
          bulbs.setMatrixAt(bulbInfo.length, m4);
          bulbInfo.push({ col: panelZs.indexOf(z) * 2 + (dz > 0 ? 1 : 0), row: r, side });
        }
      }
    }
    // chân tường gỗ + nẹp vàng
    const wain = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 29.5), wood);
    wain.position.set(side * (ROOM_HALF_W - 0.08), 0.7, -1.5);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 29.5), gold);
    rail.position.set(side * (ROOM_HALF_W - 0.1), 1.42, -1.5);
    root.add(wain, rail);
  }
  root.add(bulbs);
  const WARM_BULB = new THREE.Color(0xffc070);
  const bulbColor = new THREE.Color();

  // 2) Trần: dầm gỗ ngang + ô trần phát sáng cam ấm + đèn âm trần
  const CEIL = 15;
  const coffer = new THREE.MeshStandardMaterial({ map: cofferTexture(), emissiveMap: cofferTexture(), emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.9, side: THREE.DoubleSide });
  const downlights = [];
  for (let z = -14.5; z < 13.5; z += 2.6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF_W * 2, 0.45, 0.32), wood);
    beam.position.set(0, CEIL - 0.25, z);
    root.add(beam);
    if (z + 2.6 < 13.6) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF_W * 2 - 0.4, 2.25), coffer);
      c.rotation.x = Math.PI / 2;
      c.position.set(0, CEIL - 0.08, z + 1.3);
      root.add(c);
      for (const x of [-7.5, -2.5, 2.5, 7.5]) downlights.push([x, CEIL - 0.47, z + 1.3]);
    }
  }
  for (const x of [-6, 0, 6]) { // dầm dọc
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 28.5), wood);
    b.position.set(x, CEIL - 0.22, -0.9);
    root.add(b);
  }
  const dl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), new THREE.MeshBasicMaterial({ color: 0xffe3b8, toneMapped: false }), downlights.length);
  downlights.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); dl.setMatrixAt(i, m4); });
  root.add(dl);

  // 3) Loa treo tường (3 chiếc mỗi bên, chúc xuống khán giả)
  for (const side of [-1, 1]) {
    for (const z of [-6.2, 1, 8]) {
      const sp = makeSpeaker({ w: 0.75, h: 1.15, d: 0.55, drivers: [{ y: -0.2, r: 0.24 }], horn: { y: 0.3, w: 0.14, h: 0.1 } });
      sp.rotation.order = 'YXZ';
      sp.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // quay mặt vào giữa rạp
      sp.rotation.x = 0.32;                                  // chúc xuống khán giả
      sp.position.set(side * (ROOM_HALF_W - 0.55), 9.4 + z * 0.08, z);
      // giá treo
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), M.metal);
      bracket.position.set(side * (ROOM_HALF_W - 0.25), 9.9 + z * 0.08, z);
      root.add(sp, bracket);
      woofers.push(...sp.userData.woofers);
    }
  }

  // 3) Loa sân khấu: loa siêu trầm + loa toàn dải chồng lên nhau ở hai bên
  for (const side of [-1, 1]) {
    const stack = new THREE.Group();
    const sub = makeSpeaker({ w: 1.3, h: 1.1, d: 1.0, drivers: [{ y: 0, r: 0.42 }] });
    sub.position.y = 0.55;
    const top = makeSpeaker({ w: 1.05, h: 1.45, d: 0.85, drivers: [{ y: -0.33, r: 0.27 }, { y: 0.15, r: 0.2 }], horn: { y: 0.52, w: 0.26, h: 0.14 } });
    top.position.y = 1.1 + 0.725 + 0.02;
    top.rotation.x = 0.06;
    stack.add(sub, top);
    stack.position.set(side * 10.25, 0.9, -12.6);
    stack.rotation.y = -side * 0.22;
    root.add(stack);
    woofers.push(...sub.userData.woofers.map((w) => ({ ...w, big: true })), ...top.userData.woofers);
  }


  // 5) Đèn rọi trên hai tường (3 chiếc mỗi bên) + luồng sáng
  const fixtures = [];
  const SPOTS = [
    { z: -9.5, aim: (side) => new THREE.Vector3(side * 3.4, 1.0, -11.1), sweep: { x: 6, y: 0.1, z: 1.2 } },  // rọi sân khấu
    { z: -4, aim: (side) => new THREE.Vector3(side * 3.2, 0.9, -3.6), sweep: { x: 5, y: 0.4, z: 2.4 } },          // rọi hàng ghế đầu
    { z: 3, aim: (side) => new THREE.Vector3(side * 3.2, 0.9, 2.6), sweep: { x: 5, y: 0.4, z: 2.4 } },       // rọi hàng ghế sau
  ];
  SPOTS.forEach((cfg, idx) => {
    for (const side of [-1, 1]) {
      const f = makeFixture(side);
      f.group.position.set(side * (ROOM_HALF_W - 0.04), 12.3, cfg.z);
      root.add(f.group);
      const beam = makeBeam(WARM);
      root.add(beam);
      // đèn rọi sân khấu chiếu sáng thật (2 đèn), các đèn khác chỉ có luồng sáng
      let light = null;
      if (idx === 0) {
        light = new THREE.SpotLight(0xfff0d6, 70, 30, 0.32, 0.5, 1);
        root.add(light, light.target);
      }
      fixtures.push({ ...f, beam, light, side, cfg, phase: idx * 1.7 + (side > 0 ? 0.9 : 0), colorIdx: idx * 2 + (side > 0 ? 1 : 0) });
    }
  });

  root.updateMatrixWorld(true);
  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3();
  let lastBeat = -1;

  return {
    // pulse: 0..1 sáng bùng đầu mỗi nhịp · beat: số nhịp đã qua
    // keep: 1 = đèn sáng bình thường, nhỏ hơn = đang tắt đèn chiếu phim · flash: chớp đèn (kinh dị)
    update(t, party, pulse, beat, heat = 0, keep = 1, flash = 0) {
      const lit = Math.min(1.6, keep + flash * 1.2);
      // loa nhún theo nhịp
      for (const w of woofers) {
        const amp = party ? (w.big ? 0.06 : 0.035) * pulse : 0;
        w.pump.position.z = amp;
      }
      // bóng đèn tường: bình thường lấp lánh ấm; khi quẩy chạy đuổi từ dưới lên theo nhịp
      const half = Math.floor(beat * 2);
      for (let i = 0; i < bulbInfo.length; i++) {
        const b = bulbInfo[i];
        let k;
        if (party) {
          const wave = (half + b.col) % 4 === b.row % 4 ? 1 : 0;
          k = 0.35 + 0.5 * pulse + 0.9 * wave * (0.4 + heat);
          bulbColor.copy(heat > 0.5 && wave ? PARTY_COLORS[(Math.floor(beat / 4) + b.col) % PARTY_COLORS.length] : WARM_BULB);
        } else {
          k = 0.85 + 0.15 * Math.sin(t * 1.3 + i * 0.37);
          bulbColor.copy(WARM_BULB);
        }
        // khi tắt đèn: bóng vẫn le lói như rạp thật (không tắt hẳn)
        bulbs.setColorAt(i, bulbColor.multiplyScalar(k * (party ? Math.max(0.45, lit) : 0.18 + 0.82 * lit)));
      }
      bulbs.instanceColor.needsUpdate = true;
      panelMat.emissiveIntensity = (party ? 0.4 + 0.35 * pulse : 0.55) * (0.12 + 0.88 * lit);
      coffer.emissiveIntensity = (party ? 0.3 + 0.3 * pulse : 0.5) * (0.08 + 0.92 * lit);
      dl.material.color.setHex(0xffe3b8).multiplyScalar(0.1 + 0.9 * lit);
      if (party && Math.floor(beat) !== lastBeat) lastBeat = Math.floor(beat);
      // đèn rọi
      for (const f of fixtures) {
        const base = f.cfg.aim(f.side);
        if (party) {
          const sw = f.cfg.sweep;
          target.set(
            base.x + Math.sin(t * 0.9 + f.phase) * sw.x,
            base.y + Math.sin(t * 1.3 + f.phase) * sw.y,
            base.z + Math.cos(t * 0.7 + f.phase) * sw.z,
          );
        } else {
          target.set(base.x + Math.sin(t * 0.15 + f.phase) * 0.4, base.y, base.z);
        }
        f.head.lookAt(target);
        f.lens.getWorldPosition(tmp);
        f.beam.position.copy(tmp);
        f.beam.lookAt(target);
        const len = tmp.distanceTo(target);
        const spread = 0.16;
        f.beam.scale.set(len * spread, len * spread, len);
        const color = party ? PARTY_COLORS[(f.colorIdx + Math.floor(beat / 2)) % PARTY_COLORS.length] : WARM;
        f.beam.material.color.copy(color);
        f.beam.material.opacity = party ? 0.14 + 0.22 * pulse : (f.cfg.z < -5 ? 0.06 : 0.09) * (0.15 + 0.85 * lit);
        f.lens.material.emissive.copy(color);
        if (f.light) {
          f.light.position.copy(tmp);
          f.light.target.position.copy(target);
          f.light.color.copy(color);
          f.light.intensity = party ? 60 + 140 * pulse : 70 * (0.25 + 0.75 * lit);
        }
      }
    },
    setQuality(q) {
      for (const f of fixtures) if (f.light) f.light.visible = q === 'high';
    },
  };
}
