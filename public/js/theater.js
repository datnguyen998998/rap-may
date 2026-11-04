// ===============================================================
//  RẠP 3D: phòng chiếu, 100 ghế, màn hình, camera, hiệu ứng
// ===============================================================
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { Avatar, createCharacter, createDressed, makeEmojiSprite } from './avatars.js';
import { buildDecor } from './decor.js';

export const ROWS = 10;
export const COLS = 10;

const SCREEN_W = 19.2;
const SCREEN_H = 10.8;
const SCREEN_POS = new THREE.Vector3(0, 7.7, -14.2); // nâng màn hình lên để hàng sau nhìn qua đầu hàng trước (sàn phẳng)
const SCREEN_PX = 1920; // kích thước khung YouTube (px) trước khi thu nhỏ vào 3D

// Mỗi hàng chia nhóm: ghế đơn | ghế đôi | ghế ba | ghế ba | ghế đơn, giữa các nhóm là lối đi
export const SEAT_GROUPS = [1, 2, 3, 3, 1];
const SEAT_W = 1.12;
const AISLE = 0.85;
const COL_X = [];
const COL_SIZE = [];
export const GROUP_SPANS = []; // [{ from, to, size }] theo cột
{
  let x = 0, c = 0;
  SEAT_GROUPS.forEach((n, g) => {
    GROUP_SPANS.push({ from: c, to: c + n - 1, size: n });
    for (let k = 0; k < n; k++) { COL_X[c] = x; COL_SIZE[c] = n; x += SEAT_W; c++; }
    if (g < SEAT_GROUPS.length - 1) x += AISLE;
  });
  const mid = (COL_X[0] + COL_X[COLS - 1]) / 2;
  for (let i = 0; i < COLS; i++) COL_X[i] -= mid;
}
export const SEAT_TYPE_NAME = { 1: 'Ghế đơn', 2: 'Ghế đôi', 3: 'Ghế ba' };
const SEAT_COLORS = { 1: 0xa8142a, 2: 0xc93a2c, 3: 0x8e1a34 }; // ghế nhung đỏ: đơn đỏ thẫm · đôi đỏ cam · ba đỏ rượu

export function seatCode(i) {
  return 'ABCDEFGHIJ'[Math.floor(i / COLS)] + String((i % COLS) + 1).padStart(2, '0');
}

// Bố cục gọn (kiểu choigivui): 10 hàng xếp sát nhau, kéo lại gần sân khấu
// để góc toàn cảnh thấy hết rạp mà màn chiếu vẫn to.
const ROW0 = -6.5;     // z của hàng A (gần màn hình nhất)
const ROW_GAP = 1.17;  // khoảng cách giữa 2 hàng
// Nhân vật to hơn cho nổi bật (phụ kiện, quần áo nhìn rõ hơn từ xa)
export const AVATAR_SCALE = 1.3;

// Hàng A gần màn hình nhất
export function seatInfo(i) {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const x = COL_X[c];
  const z = ROW0 + r * ROW_GAP;
  const floorY = 0; // sàn phẳng (giống rạp chiếu thật trong ảnh mẫu)
  const size = COL_SIZE[c];
  return { r, c, x, z, floorY, size, code: seatCode(i), type: SEAT_TYPE_NAME[size] };
}

// Góc toàn cảnh mặc định: cao phía sau, thấy từ mép trên màn chiếu tới hàng ghế cuối
const OVERVIEW_POS = new THREE.Vector3(0, 11, 13.6);
const OVERVIEW_LOOK = new THREE.Vector3(0, 2.75, -6);

// ---------------- SÂN KHẤU ----------------
export const STAGE = { top: 0.9, front: -8.3, back: -14.1, width: 21.6 };
// 5 chỗ nhảy, mỗi chỗ có vòng đèn LED tròn dưới chân
export function stageSpot(i) {
  return new THREE.Vector3((i - 2) * 3.4, STAGE.top + 0.02, -11.1);
}
// 6 máy phun pháo sáng ở mép sân khấu (xen giữa các chỗ nhảy)
export const PYRO_X = [-8.5, -5.1, -1.7, 1.7, 5.1, 8.5];

// ---------------- ĐƯỜNG ĐI TRONG RẠP ----------------
// Nhân vật đi theo lối đi thật: cửa sau → lối đi phía sau hàng J → bậc thang giữa các cụm ghế
// → lối trước mỗi hàng ghế → ghế. Lên sân khấu thì xuống hết bậc thang rồi nhảy lên sân khấu.
const WALK_SPEED = 3.4;          // đơn vị / giây khi đi bộ
const STAGE_WALK_SPEED = 4.6;    // đi nhanh hơn khi lên/xuống sân khấu (chỉ có 1 phút quẩy)
const BACK_Z = ROW0 + 9 * ROW_GAP + 1.25; // lối đi phía sau hàng cuối
const DOOR_X = 10.7;             // cửa ra vào ở hai góc phía sau (cạnh biển EXIT)
const FRONT_Z = ROW0 - 0.95;     // khoảng sàn trống trước hàng A
const STAGE_FRONT_Z = STAGE.front + 0.45; // đứng sát mép sân khấu trước khi nhảy lên
const AISLE_X = (() => {
  const xs = [COL_X[0] - SEAT_W / 2 - 0.5];
  for (const g of GROUP_SPANS.slice(1)) xs.push((COL_X[g.from] + COL_X[g.from - 1]) / 2);
  xs.push(COL_X[COLS - 1] + SEAT_W / 2 + 0.5);
  return xs;
})();
const laneZ = (r) => ROW0 + r * ROW_GAP - 0.5;   // lối đi giữa hàng ghế r và lưng ghế hàng trước
// độ cao mặt sàn tại vị trí z (sàn phẳng)
function floorAt() { return 0; }
const P = (x, z, y = null, face = null) => ({ x, z, y, face }); // y = null: đi trên sàn

// Màu quẩy cho laser / đèn sân khấu
const PARTY_HUES = [0x39ff6a, 0xff2bd6, 0x2bd9ff, 0xff3b3b, 0xffe03b, 0x6a5bff].map((c) => new THREE.Color(c));

const ROMANCE_TINT = new THREE.Color(0xff8fc0);
const HORROR_TINT = new THREE.Color(0x6a8cff);

// Thảm đỏ hoa văn (vẽ bằng canvas, lặp lại trên sàn)
function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4a1012';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { // sợi thảm
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,20,22' : '30,6,8'},0.35)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.strokeStyle = 'rgba(200,140,60,0.28)';
  g.lineWidth = 2;
  g.beginPath(); // hoa văn hình thoi
  g.moveTo(64, 14); g.lineTo(114, 64); g.lineTo(64, 114); g.lineTo(14, 64); g.closePath();
  g.stroke();
  g.fillStyle = 'rgba(210,150,70,0.35)';
  g.beginPath(); g.arc(64, 64, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(11, 15);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bộ sinh số ngẫu nhiên có hạt giống (để mọi người thấy bỏng ngô bay giống nhau)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Theater {
  constructor(container, screenElement) {
    this.container = container;
    this.avatars = new Map();
    this.effects = [];
    this.mySeat = -1;
    this.myId = null;
    this.view = 'overview'; // overview | seat | screen | audience
    this.dim = 0;           // 0 = đèn sáng · 1 = tắt hẳn
    this.dimTarget = 0;
    this.mood = 'normal';   // normal | party | horror | romance
    this.flash = 0;         // chớp đèn (kinh dị)
    this.nextFlicker = 0;
    this.onPick = () => {};
    this.onHover = () => {};
    this.clock = new THREE.Clock();

    // ---- renderer: lớp HTML (YouTube) nằm dưới, lớp WebGL nằm trên và "khoét lỗ" ở màn hình
    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.domElement.className = 'css-layer';
    container.appendChild(this.cssRenderer.domElement);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'gl-layer';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0910);
    this.scene.fog = new THREE.Fog(0x0b0910, 30, 60);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    this.camPos = OVERVIEW_POS.clone();
    this.camLook = OVERVIEW_LOOK.clone();
    this.camera.position.copy(this.camPos);
    this.yaw = 0; this.pitch = 0;
    this.tween = null;

    this.buildRoom();
    this.buildSeats();
    this.buildScreen(screenElement);
    this.buildDisco();
    this.decor = buildDecor(this.scene); // loa, đèn rọi, tấm tiêu âm, LED sân khấu
    this.setupInput();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Điện thoại: khung chứa có thể đổi cỡ mà cửa sổ không phát sự kiện resize
    // (thanh địa chỉ ẩn/hiện, xoay máy, lúc trang vừa tải) → tự đo lại để khung 3D luôn vừa màn hình
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    window.visualViewport?.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(this.container);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ PHÒNG
  buildRoom() {
    const s = this.scene;
    // ánh sáng ấm như rạp trong ảnh mẫu
    const hemi = new THREE.HemisphereLight(0xffc49a, 0x2a0d0a, 0.85);
    const amb = new THREE.AmbientLight(0x6a3426, 0.55);
    s.add(hemi, amb);
    // đèn phòng: mờ dần khi phim chiếu (chế độ tắt đèn)
    this.roomLights = [{ l: hemi, base: 0.85 }, { l: amb, base: 0.55 }];
    this.hemi = hemi;
    this.hemiBase = hemi.color.clone();
    // ánh sáng hắt từ màn hình
    const screenLight = new THREE.PointLight(0xfff1dc, 70, 48, 1.2);
    screenLight.position.set(0, 7, -10);
    s.add(screenLight);
    this.screenLight = screenLight;
    // đèn vàng ấm hai bên và phía sau
    for (const [x, y, z] of [[-9, 9, 9], [9, 9, 9]]) { // ít đèn thật để máy yếu vẫn mượt (tường tự phát sáng)
      const l = new THREE.PointLight(0xffa860, 22, 22, 1.4);
      l.position.set(x, y, z);
      s.add(l);
      this.roomLights.push({ l, base: 22 });
    }

    const W = 23, D = 30, H = 15, zc = -1.5;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a1512, roughness: 0.95, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
    room.position.set(0, H / 2, zc);
    s.add(room);

    // sàn phẳng trải thảm đỏ có hoa văn
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, zc);
    s.add(floor);
    // lối đi: dải thảm sẫm + đèn LED nhỏ dọc lối đi (dẫn đường trong bóng tối)
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0x1e0907, roughness: 1 });
    const dotGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const dotsPerAisle = 12;
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, AISLE_X.length * dotsPerAisle * 2);
    const m4 = new THREE.Matrix4();
    let di = 0;
    for (const x of AISLE_X) {
      const runner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, BACK_Z - FRONT_Z), runnerMat);
      runner.rotation.x = -Math.PI / 2;
      runner.position.set(x, 0.015, (BACK_Z + FRONT_Z) / 2);
      s.add(runner);
      for (let k = 0; k < dotsPerAisle; k++) {
        for (const dx of [-0.33, 0.33]) {
          m4.makeTranslation(x + dx, 0.03, FRONT_Z + 0.4 + k * (BACK_Z - FRONT_Z - 0.8) / (dotsPerAisle - 1));
          dots.setMatrixAt(di++, m4);
        }
      }
    }
    s.add(dots);
    // lối đi ngang phía sau hàng cuối
    const backRunner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, 1.6), runnerMat);
    backRunner.rotation.x = -Math.PI / 2;
    backRunner.position.set(0, 0.015, BACK_Z);
    s.add(backRunner);

    this.buildStage();

    // rèm nhung đỏ hai bên màn hình
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x8e0f22, roughness: 0.75 });
    const fold = new THREE.CylinderGeometry(0.28, 0.28, H, 10);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(fold, curtainMat);
        m.position.set(side * (SCREEN_W / 2 + 0.5 + i * 0.42), H / 2, -14.4 + (i % 2) * 0.12);
        s.add(m);
      }
    }
    // diềm rèm phía trên + viền vàng
    const valance = new THREE.Mesh(new THREE.BoxGeometry(W, 1.4, 0.6), curtainMat);
    valance.position.set(0, H - 0.7, -14.3);
    s.add(valance);
    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(W, 0.08, 0.64), new THREE.MeshStandardMaterial({ color: 0xc9933a, metalness: 0.8, roughness: 0.35, emissive: 0x3a2200 }));
    goldTrim.position.set(0, H - 1.42, -14.3);
    s.add(goldTrim);

    // cửa ra vào ở hai góc phía sau + biển EXIT phía trên cửa
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x24100c, roughness: 0.7 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9933a, metalness: 0.7, roughness: 0.4 });
    const exitMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff66, emissiveIntensity: 1.6 });
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.06);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.7, 1.7), doorMat);
      door.position.set(x, 1.35, BACK_Z);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.9, 1.95), frameMat);
      frame.position.set(x + side * 0.02, 1.45, BACK_Z);
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.9), exitMat);
      ex.position.set(x - side * 0.05, 3.2, BACK_Z);
      s.add(frame, door, ex);
    }
  }

  // Sân khấu lớn: 5 chỗ nhảy có vòng LED tròn, viền LED, 6 máy phun pháo sáng
  buildStage() {
    const s = this.scene;
    const depth = STAGE.front - STAGE.back;
    const top = new THREE.MeshStandardMaterial({ color: 0x120a0c, roughness: 0.25, metalness: 0.4 }); // mặt sân khấu bóng
    const stage = new THREE.Mesh(new THREE.BoxGeometry(STAGE.width, STAGE.top, -depth), top);
    stage.position.set(0, STAGE.top / 2, (STAGE.front + STAGE.back) / 2);
    s.add(stage);
    // mặt trước sân khấu: ốp gỗ + viền vàng
    const face = new THREE.Mesh(new THREE.BoxGeometry(STAGE.width + 0.02, STAGE.top - 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0x3b130f, roughness: 0.8 }));
    face.position.set(0, (STAGE.top - 0.12) / 2, STAGE.front + 0.01);
    s.add(face);

    // vòng LED tròn dưới chân mỗi chỗ nhảy
    const glowTex = this.glowTexture();
    this.spotRings = [];
    const RING_COLORS = [0xff2bd6, 0x2bd9ff, 0xffd23f, 0x39ff6a, 0xff6a2b];
    for (let i = 0; i < 5; i++) {
      const p = stageSpot(i);
      const color = new THREE.Color(RING_COLORS[i]);
      const ringMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.055, 10, 56), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, STAGE.top + 0.03, p.z);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 44), ringMat);
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(p.x, STAGE.top + 0.03, p.z);
      // quầng sáng hắt lên mặt sân khấu
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({
        map: glowTex, color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(p.x, STAGE.top + 0.02, p.z);
      s.add(ring, inner, pool);
      this.spotRings.push({ ring, inner, pool, ringMat, color, base: color.clone() });
    }
    // dải LED mép sân khấu
    this.stageEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(STAGE.width, 0.05, 0.05), this.stageEdgeMat);
    edge.position.set(0, STAGE.top - 0.03, STAGE.front + 0.03);
    s.add(edge);

    // máy phun pháo sáng (pháo lạnh)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.5, metalness: 0.6 });
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x55555c, metalness: 0.9, roughness: 0.3 });
    for (const x of PYRO_X) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.45), boxMat);
      b.position.set(x, STAGE.top + 0.16, STAGE.front + 0.35);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), nozzleMat);
      n.position.set(x, STAGE.top + 0.36, STAGE.front + 0.35);
      s.add(b, n);
    }
    this.buildPyro();
  }

  // ------------------------------------------------------------ GHẾ
  buildSeats() {
    const n = ROWS * COLS;
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c1019, roughness: 0.75 }); // khung ghế nhung đỏ sẫm
    const groupsCount = ROWS * GROUP_SPANS.length;
    this.seatCushion = new THREE.InstancedMesh(unit, seatMat, n);
    this.seatBack = new THREE.InstancedMesh(unit, seatMat, n);
    const base = new THREE.InstancedMesh(unit, frameMat, groupsCount);
    const backFrame = new THREE.InstancedMesh(unit, frameMat, groupsCount);
    const arms = new THREE.InstancedMesh(unit, frameMat, groupsCount * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const put = (mesh, idx, x, y, z, sx, sy, sz) => {
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(idx, m);
    };
    // đệm ngồi + lưng ghế: mỗi chỗ một khối riêng (để tô màu khi rê chuột)
    for (let i = 0; i < n; i++) {
      const { x, z, floorY, size } = seatInfo(i);
      put(this.seatCushion, i, x, floorY + 0.45, z, SEAT_W - 0.07, 0.2, 0.7);
      put(this.seatBack, i, x, floorY + 0.74, z + 0.34, SEAT_W - 0.07, 0.6, 0.14); // lưng ghế thấp: nhìn rõ nhân vật
      const col = new THREE.Color(SEAT_COLORS[size]);
      this.seatCushion.setColorAt(i, col);
      this.seatBack.setColorAt(i, col);
    }
    // khung sofa: chân đế, khung lưng, tay vịn ở hai đầu mỗi nhóm ghế
    let gi = 0;
    for (let r = 0; r < ROWS; r++) {
      for (const g of GROUP_SPANS) {
        const a = seatInfo(r * COLS + g.from), b = seatInfo(r * COLS + g.to);
        const cx = (a.x + b.x) / 2, w = b.x - a.x + SEAT_W;
        put(base, gi, cx, a.floorY + 0.18, a.z + 0.02, w + 0.1, 0.36, 0.78);
        put(backFrame, gi, cx, a.floorY + 0.62, a.z + 0.44, w + 0.24, 0.74, 0.08);
        put(arms, gi * 2, a.x - SEAT_W / 2 - 0.06, a.floorY + 0.6, a.z, 0.14, 0.42, 0.78);
        put(arms, gi * 2 + 1, b.x + SEAT_W / 2 + 0.06, a.floorY + 0.6, a.z, 0.14, 0.42, 0.78);
        gi++;
      }
    }
    this.scene.add(this.seatCushion, this.seatBack, base, backFrame, arms);
    this.hoverSeat = -1;
  }

  seatColor(i) {
    return new THREE.Color(SEAT_COLORS[seatInfo(i).size]);
  }

  colorSeat(i, color) {
    if (i < 0) return;
    this.seatCushion.setColorAt(i, color);
    this.seatBack.setColorAt(i, color);
    this.seatCushion.instanceColor.needsUpdate = true;
    this.seatBack.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------ MÀN HÌNH
  buildScreen(screenElement) {
    // viền màn hình
    const frame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.5, SCREEN_H + 0.5, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 }));
    frame.position.copy(SCREEN_POS).add(new THREE.Vector3(0, 0, -0.15));
    this.scene.add(frame);

    // "lỗ" trong suốt để nhìn xuyên xuống lớp YouTube bên dưới
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
      new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide, fog: false }));
    hole.position.copy(SCREEN_POS);
    this.scene.add(hole);

    screenElement.style.width = SCREEN_PX + 'px';
    screenElement.style.height = Math.round(SCREEN_PX * SCREEN_H / SCREEN_W) + 'px';
    const obj = new CSS3DObject(screenElement);
    obj.position.copy(SCREEN_POS);
    obj.scale.setScalar(SCREEN_W / SCREEN_PX);
    this.cssScene = new THREE.Scene();
    this.cssScene.add(obj);
  }

  // ------------------------------------------------------------ DISCO + LASER
  buildDisco() {
    const s = this.scene;
    // quả cầu disco treo giữa trần
    const ballPos = new THREE.Vector3(0, 13.8, 2); // lùi ra sau, cao hơn: không che màn chiếu ở góc toàn cảnh
    const geo = new THREE.IcosahedronGeometry(0.85, 3);
    const colors = [];
    for (let i = 0; i < geo.attributes.position.count; i += 3) {
      const v = 0.45 + Math.random() * 0.55;
      for (let k = 0; k < 3; k++) colors.push(v, v, v * (0.95 + Math.random() * 0.1));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.discoBall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.discoBall.position.copy(ballPos);
    s.add(this.discoBall);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    cable.position.set(ballPos.x, ballPos.y + 1.6, ballPos.z);
    s.add(cable);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture(), color: 0xffffff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(4, 4, 1);
    glow.position.copy(ballPos);
    s.add(glow);

    // đốm sáng màu quét quanh phòng
    this.discoLights = [0xff3fa4, 0x3fd8ff, 0xffd23f, 0x8a5bff].map((c) => {
      const l = new THREE.SpotLight(c, 120, 40, 0.13, 0.4, 1);
      l.position.copy(ballPos);
      s.add(l, l.target);
      return l;
    });

    // ---- LASER SÂN KHẤU: 4 cụm phát, mỗi cụm 6 tia (lõi sáng + quầng mờ) ----
    this.lasers = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6, 1, true);
    coreGeo.rotateX(Math.PI / 2); coreGeo.translate(0, 0, 0.5);
    const haloGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8, 1, true);
    haloGeo.rotateX(Math.PI / 2); haloGeo.translate(0, 0, 0.5);
    const glowTex = this.glowTexture();
    this.beams = [];
    this.emitters = [];
    const EMITTERS = [
      { x: -9.4, y: STAGE.top + 0.35, z: -13.4, side: -1 }, { x: 9.4, y: STAGE.top + 0.35, z: -13.4, side: 1 },
      { x: -4.6, y: STAGE.top + 0.25, z: -13.75, side: -1 }, { x: 4.6, y: STAGE.top + 0.25, z: -13.75, side: 1 },
    ];
    EMITTERS.forEach((e, ei) => {
      const origin = new THREE.Vector3(e.x, e.y, e.z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), new THREE.MeshStandardMaterial({ color: 0x0d0d10, metalness: 0.6, roughness: 0.4 }));
      body.position.copy(origin).add(new THREE.Vector3(0, -0.12, 0));
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      flare.scale.set(1.4, 1.4, 1);
      flare.position.copy(origin);
      this.lasers.add(body, flare);
      this.emitters.push({ flare, origin });
      for (let k = 0; k < 6; k++) {
        const mk = (geo, op) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
        }));
        const core = mk(coreGeo, 0.9), halo = mk(haloGeo, 0.18);
        core.position.copy(origin); halo.position.copy(origin);
        core.scale.z = halo.scale.z = 34;
        this.lasers.add(core, halo);
        this.beams.push({ core, halo, origin, side: e.side, k, ei, n: this.beams.length });
      }
    });
    // đèn màu rọi sân khấu chớp theo nhịp
    this.stageWash = [0].map((x) => {
      const l = new THREE.PointLight(0xff2bd6, 0, 16, 1.4);
      l.position.set(x, 3.4, -10);
      s.add(l);
      return l;
    });
    s.add(this.lasers);
  }

  glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Chế độ quẩy: bật khi chiếu nhạc sôi động (theo BPM của video) HOẶC khi có người trên sân khấu.
  // Mọi thứ (laser, đèn, vòng LED, loa) nháy theo nhịp; nhịp tính theo giờ máy chủ nên mọi người thấy giống nhau.
  // ---- Tắt đèn khi chiếu phim + không khí theo thể loại ----
  setDim(target) { this.dimTarget = Math.max(0, Math.min(1, target)); }
  setMood(mood) {
    this.mood = mood || 'normal';
    if (this.petals) this.petals.visible = this.mood === 'romance' || this.petalFade > 0;
  }
  updateAmbience(t, dt) {
    // đèn mờ / sáng dần trong khoảng 2–3 giây
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 0.9);
    // kinh dị: thỉnh thoảng đèn chập chờn / chớp sáng như sét
    if (this.mood === 'horror') {
      if (t > this.nextFlicker) {
        this.flickerUntil = t + 0.45 + Math.random() * 0.6;
        this.nextFlicker = t + 7 + Math.random() * 12;
      }
      this.flash = t < (this.flickerUntil || 0) ? (Math.random() < 0.45 ? 1 : 0) : 0;
    } else this.flash = 0;
    const keep = 1 - 0.82 * this.dim;
    for (const { l, base } of this.roomLights) l.intensity = base * keep + (this.flash ? base * 2.2 : 0);
    // lãng mạn: ánh hồng · kinh dị: ánh xanh lạnh
    const tint = this.mood === 'romance' ? ROMANCE_TINT : this.mood === 'horror' ? HORROR_TINT : null;
    this.hemi.color.copy(this.hemiBase);
    if (tint) this.hemi.color.lerp(tint, 0.6);
    this.updatePetals(t, dt);
    return { keep, flash: this.flash };
  }

  // Cánh hoa rơi (lãng mạn)
  buildPetals() {
    const N = 260;
    const g = new THREE.BufferGeometry();
    this.petalPos = new Float32Array(N * 3);
    this.petalSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.petalPos[i * 3] = (Math.random() - 0.5) * 22;
      this.petalPos[i * 3 + 1] = Math.random() * 14;
      this.petalPos[i * 3 + 2] = -12 + Math.random() * 25;
      this.petalSeed[i] = Math.random() * 100;
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.petalPos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(28, 26, 2, 32, 32, 28);
    grad.addColorStop(0, '#ffe1ec'); grad.addColorStop(0.6, '#ff7aa8'); grad.addColorStop(1, 'rgba(230,40,100,0)');
    x.fillStyle = grad;
    x.beginPath(); x.ellipse(32, 32, 26, 15, 0.6, 0, Math.PI * 2); x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.petals = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.32, map: tex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
    this.petals.frustumCulled = false;
    this.petals.visible = false;
    this.petalFade = 0;
    this.scene.add(this.petals);
  }
  updatePetals(t, dt) {
    if (!this.petals) this.buildPetals();
    const want = this.mood === 'romance' ? 1 : 0;
    this.petalFade += (want - this.petalFade) * Math.min(1, dt * 1.2);
    this.petals.visible = this.petalFade > 0.01;
    if (!this.petals.visible) return;
    this.petals.material.opacity = 0.9 * this.petalFade;
    const p = this.petalPos;
    for (let i = 0; i < this.petalSeed.length; i++) {
      const sd = this.petalSeed[i];
      p[i * 3 + 1] -= dt * (0.55 + (sd % 1) * 0.5);
      p[i * 3] += Math.sin(t * 1.3 + sd) * dt * 0.6;
      p[i * 3 + 2] += Math.cos(t * 0.9 + sd) * dt * 0.3;
      if (p[i * 3 + 1] < 0.05) { p[i * 3 + 1] = 13 + Math.random() * 2; p[i * 3] = (Math.random() - 0.5) * 22; p[i * 3 + 2] = -12 + Math.random() * 25; }
    }
    this.petals.geometry.attributes.position.needsUpdate = true;
  }

  updateDisco(t, dt) {
    const amb = this.updateAmbience(t, dt || 0.016);
    const now = Date.now() + (this.clockOffset || 0);
    let dancers = 0;
    const occupied = [false, false, false, false, false];
    for (const a of this.avatars.values()) if (a.user.stage && !a.walk) { dancers++; occupied[a.user.stage.spot] = true; }
    const videoParty = !!(this.party && this.party.on);
    const party = videoParty || dancers > 0;
    const bpm = videoParty ? this.party.bpm : 124;
    const startAt = videoParty ? this.party.startAt : 0;
    let pulse = 0, beats = 0;
    if (party) {
      beats = Math.max(0, ((now - startAt) / 60000) * bpm);
      const phase = ((beats % 1) + 1) % 1;
      pulse = Math.pow(1 - phase, 2.2); // sáng bùng lên đầu mỗi nhịp rồi tắt dần
    }
    // tắt đèn: giảm độ sáng cả khung cảnh 3D (màn chiếu YouTube nằm ở lớp riêng nên vẫn sáng rõ)
    const darkness = this.dim * (party ? 0.35 : 1);
    this.renderer.toneMappingExposure = (1 - (this.mood === 'horror' ? 0.72 : 0.55) * darkness) * (amb.flash ? 2 : 1);
    this.screenLight.intensity = 70 * (1 - 0.45 * this.dim);
    // càng đông người trên sân khấu càng "cháy"
    const heat = party ? Math.min(1, (videoParty ? 0.6 : 0.25) + dancers * 0.15) : 0;
    this.decor.update(t, party, pulse, beats, heat, amb.keep, amb.flash);
    this.discoBall.rotation.y = t * (party ? 1.4 : 0.25);
    const speed = party ? 1.2 : 0.35;
    this.discoLights.forEach((l, i) => {
      const a = t * speed + (i * Math.PI) / 2;
      l.target.position.set(Math.cos(a) * 9, 1 + Math.sin(t * 0.7 + i) * 2.5, 2 + Math.sin(a) * 9);
      l.intensity = party ? 50 + 190 * pulse : 28 * amb.keep;
    });
    // vòng LED dưới chân 5 chỗ nhảy
    const bar = Math.floor(beats / 4);
    this.spotRings.forEach((r, i) => {
      const on = occupied[i];
      let k = on ? 0.55 + 0.9 * pulse : party ? 0.25 + 0.25 * pulse : 0.3 + 0.1 * Math.sin(t * 2 + i);
      if (party && !on && Math.floor(beats) % 5 === i) k += 0.5; // đèn chạy vòng quanh các chỗ trống
      const c = on && party ? PARTY_HUES[(bar + i) % PARTY_HUES.length] : r.base;
      r.ringMat.color.copy(c).multiplyScalar(0.4 + k * 1.6);
      r.pool.material.color.copy(c);
      r.pool.material.opacity = Math.min(1, 0.15 + k * 0.6);
      const sc = on ? 1 + pulse * 0.12 : 1;
      r.ring.scale.set(sc, sc, 1);
      r.inner.rotation.z = t * (on ? 3 : 0.6);
    });
    this.stageEdgeMat.color.setHex(0xffc46b).multiplyScalar(party ? 0.6 + 1.6 * pulse : 1.1);
    this.stageWash.forEach((l, i) => {
      l.intensity = party ? (35 + 150 * pulse) * heat : 0;
      if (party) l.color.copy(PARTY_HUES[(bar + i * 2) % PARTY_HUES.length]);
    });
    this.updateLasers(t, party, pulse, beats, heat);
    this.updatePyro(now, dt || 0.016);
  }

  updateLasers(t, party, pulse, beats, heat) {
    this.lasers.visible = this.laserPref !== false && party;
    if (!this.lasers.visible) return;
    const pattern = Math.floor(beats / 8) % 4;          // đổi kiểu quét mỗi 8 nhịp
    const bar = Math.floor(beats / 4);
    const half = Math.floor(beats * 2);                  // nửa nhịp (để chớp nhanh)
    const tgt = new THREE.Vector3();
    for (const b of this.beams) {
      const { side, k, ei, n } = b;
      const o = b.origin;
      const spread = (k - 2.5) / 2.5;                    // -1..1 trong cụm
      if (pattern === 0) {          // quạt toả xuống khán giả, lắc qua lại
        tgt.set(o.x * 0.2 + spread * 14 + Math.sin(t * 0.9 + ei) * 4, 2.5 + Math.sin(t * 1.7 + k) * 1.5, 13);
      } else if (pattern === 1) {   // bắt chéo hai bên, nảy lên xuống theo nhịp
        tgt.set(-side * (4 + k * 1.6), 3 + pulse * 6 + spread * 2, 13);
      } else if (pattern === 2) {   // xoáy lên trần
        const a = t * 1.6 + n * 0.55;
        tgt.set(o.x * 0.3 + Math.cos(a) * 9, 15, -2 + Math.sin(a) * 9);
      } else {                      // quét ngang song song, đổi độ cao theo nhịp
        tgt.set(o.x + spread * 3, 1.5 + ((Math.floor(beats) + ei) % 4) * 2.4 + Math.sin(t * 4) * 0.6, 13);
      }
      b.core.lookAt(tgt); b.halo.lookAt(tgt);
      // chớp: sáng bùng đầu nhịp; kiểu 3 chạy đuổi từng tia theo nửa nhịp
      let on = 0.35 + 0.65 * pulse;
      if (pattern === 3) on = (half % 6) === k ? 1 : 0.12;
      if (pattern === 1 && Math.floor(beats) % 2 === 1 && pulse < 0.3) on *= 0.3;
      const color = PARTY_HUES[(bar + ei + (pattern === 0 ? k % 2 : 0)) % PARTY_HUES.length];
      b.core.material.color.copy(color);
      b.halo.material.color.copy(color);
      b.core.material.opacity = Math.min(1, (0.35 + 0.65 * heat) * on * 1.2);
      b.halo.material.opacity = (0.08 + 0.22 * heat) * on;
    }
    this.emitters.forEach((e, i) => {
      e.flare.material.color.copy(PARTY_HUES[(bar + i) % PARTY_HUES.length]);
      e.flare.material.opacity = 0.4 + 0.6 * pulse;
    });
  }

  // Laser bật khi đang quẩy (người xem có thể tắt bằng nút ⚡)
  setLasers(on) { this.laserPref = on; }
  setParty(on, bpm, startAt) {
    this.party = { on: !!on, bpm: bpm || 128, startAt: startAt || Date.now() };
  }
  applyLasers() {}

  // ------------------------------------------------------------ PHÁO SÁNG
  buildPyro() {
    const per = 1400;
    this.pyroMax = PYRO_X.length * per;
    const g = new THREE.BufferGeometry();
    this.pyroPos = new Float32Array(this.pyroMax * 3);
    this.pyroCol = new Float32Array(this.pyroMax * 3);
    this.pyroVel = new Float32Array(this.pyroMax * 3);
    this.pyroLife = new Float32Array(this.pyroMax);   // thời gian còn lại
    this.pyroMaxLife = new Float32Array(this.pyroMax);
    g.setAttribute('position', new THREE.BufferAttribute(this.pyroPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pyroCol, 3));
    this.pyroPoints = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.21, map: this.glowTexture(), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true,
    }));
    this.pyroPoints.frustumCulled = false;
    this.pyroPoints.visible = false;
    this.scene.add(this.pyroPoints);
    this.pyroNext = 0;
    this.pyroBursts = [];  // { startAt, endAt } theo giờ máy chủ
    this.pyroLights = [0].map((x) => {
      const l = new THREE.PointLight(0xffb347, 0, 24, 1.2);
      l.position.set(x, 3, STAGE.front + 0.4);
      this.scene.add(l);
      return l;
    });
    // quầng sáng ở miệng máy phun
    this.pyroFlares = PYRO_X.map((x) => {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture(), color: 0xffd28a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      f.position.set(x, STAGE.top + 0.5, STAGE.front + 0.35);
      f.scale.set(1.6, 1.6, 1);
      this.scene.add(f);
      return f;
    });
    // cột sáng mờ dọc theo tia pháo (làm cột lửa trông đặc và rực hơn)
    this.pyroColumns = PYRO_X.map((x) => {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture(), color: 0xffb04a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      c.position.set(x, STAGE.top + 3.4, STAGE.front + 0.35);
      c.scale.set(1.3, 7.5, 1);
      this.scene.add(c);
      return c;
    });
  }

  // Phun pháo sáng (startAt: giờ máy chủ, ms) trong durationMs
  pyro(startAt, durationMs = 7000) {
    this.pyroBursts.push({ startAt, endAt: startAt + durationMs });
  }

  updatePyro(now, dt) {
    this.pyroBursts = this.pyroBursts.filter((b) => b.endAt > now - 3000);
    const firing = this.pyroBursts.some((b) => b.startAt <= now && b.endAt > now);
    const pos = this.pyroPos, vel = this.pyroVel, col = this.pyroCol, life = this.pyroLife, maxL = this.pyroMaxLife;
    // sinh tia lửa mới
    if (firing) {
      const rate = this.quality === 'smooth' ? 320 : 640;  // tia / giây / máy
      const nozzleY = STAGE.top + 0.42, nz = STAGE.front + 0.35;
      for (const x of PYRO_X) {
        const count = Math.round(rate * dt * (0.8 + Math.random() * 0.4));
        for (let c = 0; c < count; c++) {
          const i = this.pyroNext;
          this.pyroNext = (this.pyroNext + 1) % this.pyroMax;
          pos[i * 3] = x + (Math.random() - 0.5) * 0.08;
          pos[i * 3 + 1] = nozzleY;
          pos[i * 3 + 2] = nz + (Math.random() - 0.5) * 0.08;
          const sp = 0.35 + Math.random() * 0.55;
          const ang = Math.random() * Math.PI * 2;
          vel[i * 3] = Math.cos(ang) * sp;
          vel[i * 3 + 1] = 9.5 + Math.random() * 3.5;   // phun cao 5–8 m
          vel[i * 3 + 2] = Math.sin(ang) * sp;
          maxL[i] = life[i] = 1.1 + Math.random() * 0.9;
        }
      }
    }
    let alive = 0;
    for (let i = 0; i < this.pyroMax; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      alive++;
      life[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * dt * 0.75;                  // trọng lực (nhẹ hơn chút cho tia bay lâu)
      vel[i * 3] *= 0.995; vel[i * 3 + 2] *= 0.995;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const u = Math.max(0, life[i] / maxL[i]);           // 1 → 0
      const tw = 0.75 + Math.random() * 0.25;             // lấp lánh
      // trắng vàng lúc mới phun → cam → tắt dần
      col[i * 3] = (1.0) * u * tw * 1.4;
      col[i * 3 + 1] = (0.55 + 0.4 * u) * u * tw * 1.25;
      col[i * 3 + 2] = (0.15 + 0.55 * u * u) * u * tw;
    }
    this.pyroPoints.visible = alive > 0;
    if (alive) {
      this.pyroPoints.geometry.attributes.position.needsUpdate = true;
      this.pyroPoints.geometry.attributes.color.needsUpdate = true;
    }
    const flick = firing ? 0.75 + Math.random() * 0.25 : 0;
    this.pyroLights.forEach((l) => { l.intensity = firing ? 420 * flick : Math.max(0, l.intensity - dt * 900); });
    this.pyroFlares.forEach((f) => { f.material.opacity = firing ? 0.6 + Math.random() * 0.4 : Math.max(0, f.material.opacity - dt * 2); });
    this.pyroColumns.forEach((c) => { c.material.opacity = firing ? 0.28 + Math.random() * 0.12 : Math.max(0, c.material.opacity - dt * 0.6); });
  }

  // Độ nét: 'high' (đẹp) hoặc 'smooth' (mượt cho máy yếu)
  setQuality(q) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1));
    this.discoLights.forEach((l) => { l.visible = q === 'high'; });
    this.decor.setQuality(q);
    this.resize();
  }

  // ------------------------------------------------------------ CAMERA
  seatEye(i) {
    const { x, z, floorY } = seatInfo(i);
    return new THREE.Vector3(x, floorY + 2.5, z + 0.4); // cao hơn đầu nhân vật hàng trước (nhân vật đã phóng to)
  }

  flyTo(pos, look, duration = 1.2) {
    this.tween = {
      fromPos: this.camPos.clone(), toPos: pos.clone(),
      fromLook: this.camLook.clone(), toLook: look.clone(),
      t: 0, duration,
    };
  }

  // ---- 4 góc nhìn ----
  // overview: toàn cảnh rạp · seat: từ ghế của mình · screen: tập trung màn hình · audience: từ màn hình nhìn xuống khán giả
  viewPose(view) {
    if (view === 'seat' && this.mySeat >= 0) {
      // nhìn hơi thấp hơn tâm màn hình để thấy cả bạn bè ngồi phía trước
      return { pos: this.seatEye(this.mySeat), look: SCREEN_POS.clone().add(new THREE.Vector3(0, -2.2, 0)) };
    }
    if (view === 'screen') {
      // lùi camera vừa đủ để màn chiếu lấp đầy khung hình
      const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
      const dist = Math.max(SCREEN_H / 2 / t, SCREEN_W / 2 / (t * this.camera.aspect)) * 1.05;
      return { pos: new THREE.Vector3(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z + dist), look: SCREEN_POS.clone() };
    }
    if (view === 'audience') {
      return { pos: new THREE.Vector3(0, 5.4, -11.4), look: new THREE.Vector3(0, 3, 5) };
    }
    return { pos: OVERVIEW_POS.clone(), look: OVERVIEW_LOOK.clone() };
  }

  setView(view) {
    if (view === 'seat' && this.mySeat < 0) view = 'overview';
    this.view = view;
    this.yaw = 0; this.pitch = 0;
    const { pos, look } = this.viewPose(view);
    this.flyTo(pos, look, 1.1);
    // chỉ ẩn nhân vật của mình khi nhìn từ ghế (góc nhìn thứ nhất)
    for (const a of this.avatars.values()) this.placeAvatar(a);
  }

  // vào rạp: góc nhìn mặc định là toàn cảnh
  enterRoom(seat) {
    this.resize();
    this.yaw = 0; this.pitch = 0;
    this.mySeat = seat;
    this.setView('overview');
  }

  // đổi ghế: nếu đang nhìn từ ghế thì bay theo sang ghế mới
  viewFromSeat(i) {
    this.mySeat = i;
    if (this.view === 'seat') this.setView('seat');
  }

  viewOverview() {
    this.mySeat = -1;
    this.view = 'overview';
    this.yaw = 0; this.pitch = 0;
    this.flyTo(OVERVIEW_POS.clone(), OVERVIEW_LOOK.clone());
  }

  updateCamera(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const k = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
      this.camPos.lerpVectors(tw.fromPos, tw.toPos, k);
      this.camLook.lerpVectors(tw.fromLook, tw.toLook, k);
      if (tw.t >= 1) this.tween = null;
    }
    if (this.mySeat < 0 && !this.tween) {
      // màn hình chờ: camera lượn chậm
      const t = this.clock.elapsedTime * 0.12;
      this.camPos.set(Math.sin(t) * 4, OVERVIEW_POS.y + 0.6, OVERVIEW_POS.z - 1.2 + Math.cos(t) * 0.8);
    }
    this.camera.position.copy(this.camPos);
    const dir = this.camLook.clone().sub(this.camPos);
    const baseYaw = Math.atan2(dir.x, -dir.z);
    const basePitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    const yaw = baseYaw + this.yaw;
    const pitch = THREE.MathUtils.clamp(basePitch + this.pitch, -1.2, 1.2);
    const look = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).add(this.camPos);
    this.camera.lookAt(look);
  }

  // ------------------------------------------------------------ CHUỘT / CẢM ỨNG
  setupInput() {
    const el = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let down = null;
    // chụm / mở 2 ngón tay để thu nhỏ / phóng to (điện thoại, máy tính bảng)
    const pts = new Map();
    let pinch = null;
    const pinchDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };

    const toNdc = (e) => {
      const r = el.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    el.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      if (pts.size >= 2) {
        // ngón thứ 2 chạm vào: chuyển sang chụm để phóng to/thu nhỏ, huỷ kéo xoay
        pinch = { d: pinchDist(), z: this.zoom || 0 };
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
    });
    el.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) {
        if (pts.size >= 2) {
          // mở rộng 2 ngón = phóng to (giảm góc nhìn), chụm lại = thu nhỏ
          this.zoom = THREE.MathUtils.clamp(pinch.z + (pinch.d / pinchDist() - 1) * 45, -30, 15);
          this.applyFov();
        }
        return;
      }
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved && this.mySeat >= 0) {
          this.yaw = THREE.MathUtils.clamp(down.yaw - dx * 0.004, -1.6, 1.6);
          this.pitch = THREE.MathUtils.clamp(down.pitch + dy * 0.004, -0.7, 0.6);
        }
        return;
      }
      toNdc(e);
      const hit = this.pick(ptr);
      const canSit = hit && hit.seat !== null && (!hit.user || hit.user.bot);
      this.setHover(canSit ? hit.seat : -1);
      el.style.cursor = hit && hit.user?.id !== this.myId ? 'pointer' : 'grab';
      this.onHover(hit, e.clientX, e.clientY);
    });
    const endPointer = (e) => {
      pts.delete(e.pointerId);
      if (pinch) {
        if (pts.size < 2) { pinch = null; down = null; } // nhấc ngón: không tính là bấm chọn ghế
        return true;
      }
      return false;
    };
    el.addEventListener('pointerup', (e) => {
      if (endPointer(e)) return;
      if (down && !down.moved) {
        toNdc(e);
        const hit = this.pick(ptr);
        if (hit) this.onPick(hit);
      }
      down = null;
    });
    el.addEventListener('pointercancel', (e) => { endPointer(e); down = null; });
    el.addEventListener('pointerleave', () => { this.setHover(-1); this.onHover(null); });
    el.addEventListener('dblclick', () => { this.yaw = 0; this.pitch = 0; this.zoom = 0; this.applyFov(); }); // nhấp đúp: về góc nhìn và độ phóng mặc định
    // Safari trên iPhone/iPad: chặn cử chỉ phóng to cả trang, để 2 ngón tay chỉ phóng to rạp
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(ev, (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      this.zoom = THREE.MathUtils.clamp((this.zoom || 0) + e.deltaY * 0.03, -30, 15);
      this.applyFov();
    }, { passive: true });
  }

  // Trả về { seat, user }: seat = số ghế (hoặc null nếu bấm người trên sân khấu), user = người đang ngồi (hoặc null)
  pick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [this.seatCushion, this.seatBack];
    for (const a of this.avatars.values()) if (a.group.visible) targets.push(a.body);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const uid = h.object.userData.userId;
      if (uid) {
        const a = this.avatars.get(uid);
        if (!a) continue;
        return { seat: a.user.stage ? null : a.user.seat, user: a.user };
      }
      if (h.instanceId !== undefined) {
        const owner = [...this.avatars.values()].find((a) => a.user.seat === h.instanceId);
        return { seat: h.instanceId, user: owner ? owner.user : null };
      }
    }
    return null;
  }

  setHover(seat) {
    if (seat === this.hoverSeat) return;
    if (this.hoverSeat >= 0) this.colorSeat(this.hoverSeat, this.seatColor(this.hoverSeat));
    this.hoverSeat = seat;
    if (seat >= 0 && this.mySeat >= 0) this.colorSeat(seat, new THREE.Color(0xffd34d));
    else this.hoverSeat = -1;
  }

  // ------------------------------------------------------------ NGƯỜI XEM
  clearUsers() {
    for (const id of [...this.avatars.keys()]) this.removeUser(id);
  }

  // enter = true: người mới vào rạp — đi từ cửa sau vào ghế
  addUser(user, { enter = false } = {}) {
    this.removeUser(user.id);
    const a = new Avatar(user);
    a.group.scale.setScalar(AVATAR_SCALE);
    this.avatars.set(user.id, a);
    this.scene.add(a.group);
    if (enter && !user.stage) {
      const { x } = seatInfo(user.seat);
      const door = { type: 'door', side: x < 0 ? -1 : 1 };
      const d = this.locPoint(door);
      a.group.position.set(d.x, floorAt(d.z), d.z);
      a.loc = door;
      this.updateVisibility(a);
      this.walkTo(a, { type: 'seat', seat: user.seat });
    } else {
      this.placeAvatar(a);
    }
    return a;
  }

  updateVisibility(a) {
    a.group.visible = a.user.id !== this.myId || this.view !== 'seat' || !!a.user.stage; // ẩn nhân vật của mình khi nhìn từ ghế
  }

  placeAvatar(a) {
    if (a.walk) { this.updateVisibility(a); return; } // đang đi: chỉ cập nhật ẩn/hiện
    a.loc = a.user.stage ? { type: 'stage', spot: a.user.stage.spot } : { type: 'seat', seat: a.user.seat };
    if (a.user.stage) {
      // trên sân khấu: quay mặt xuống khán giả, mình cũng nhìn thấy mình
      a.group.position.copy(stageSpot(a.user.stage.spot));
      a.group.rotation.y = Math.PI;
      a.group.visible = true;
      return;
    }
    const { x, z, floorY } = seatInfo(a.user.seat);
    a.group.position.set(x, floorY + 0.42, z + 0.05);
    a.group.rotation.y = 0;
    a.group.visible = a.user.id !== this.myId || this.view !== 'seat'; // ẩn nhân vật của mình khi nhìn từ ghế
  }

  setStage(id, stage) {
    const a = this.avatars.get(id);
    if (!a || a.leaving) return;
    a.user.stage = stage;
    this.updateVisibility(a);
    this.walkTo(a, stage ? { type: 'stage', spot: stage.spot } : { type: 'seat', seat: a.user.seat }, STAGE_WALK_SPEED);
  }

  // ------------------------------------------------------------ ĐI LẠI
  // điểm đứng cuối cùng của một vị trí
  locPoint(loc) {
    if (loc.type === 'door') return P(loc.side * DOOR_X, BACK_Z);
    if (loc.type === 'stage') { const v = stageSpot(loc.spot); return P(v.x, v.z, v.y, Math.PI); }
    const { x, z, floorY } = seatInfo(loc.seat);
    return P(x, z + 0.05, floorY + 0.42, 0);
  }
  // chặng đi từ một vị trí ra tới lối đi dọc có toạ độ x = ax (thứ tự: từ vị trí → lối đi)
  legsTo(loc, ax) {
    if (loc.type === 'door') return [P(loc.side * DOOR_X, BACK_Z), P(ax, BACK_Z)];
    if (loc.type === 'stage') { const v = stageSpot(loc.spot); return [P(v.x, v.z, v.y, Math.PI), P(v.x, STAGE_FRONT_Z), P(ax, FRONT_Z)]; }
    const { r, x } = seatInfo(loc.seat);
    return [this.locPoint(loc), P(x, laneZ(r)), P(ax, laneZ(r))];
  }
  route(from, to) {
    // cùng một hàng ghế: đi ngang theo lối trước hàng
    if (from.type === 'seat' && to.type === 'seat') {
      const a = seatInfo(from.seat), b = seatInfo(to.seat);
      if (a.r === b.r) return [this.locPoint(from), P(a.x, laneZ(a.r)), P(b.x, laneZ(b.r)), this.locPoint(to)];
    }
    const xOf = (l) => (l.type === 'door' ? l.side * DOOR_X : l.type === 'stage' ? stageSpot(l.spot).x : seatInfo(l.seat).x);
    const xa = xOf(from), xb = xOf(to);
    const ax = AISLE_X.reduce((best, x) => (Math.abs(x - xa) + Math.abs(x - xb) < Math.abs(best - xa) + Math.abs(best - xb) ? x : best), AISLE_X[0]);
    return [...this.legsTo(from, ax), ...this.legsTo(to, ax).reverse()];
  }
  walkTo(a, dest, speed = WALK_SPEED, onDone = null) {
    const from = a.loc || dest;
    let pts = this.route(from, dest);
    const cur = a.group.position;
    // đang đi dở: đi tiếp từ chỗ đang đứng
    // đang đi dở: đi tiếp từ chỗ đang đứng (trên sàn); đang ngồi / đứng sân khấu: đứng dậy từ chỗ đó
    if (a.walk) pts = [P(cur.x, cur.z), ...pts.slice(1)];
    else pts[0] = P(cur.x, cur.z, pts[0].y === null ? null : cur.y, pts[0].face);
    a.loc = dest;
    a.walk = { pts, i: 0, s: 0, speed, onDone, groundY: cur.y };
    a.walking = true;
  }
  updateWalkers(dt) {
    for (const a of this.avatars.values()) {
      const w = a.walk;
      if (!w) continue;
      let move = w.speed * dt;
      while (move > 0 && w.i < w.pts.length - 1) {
        const p = w.pts[w.i], q = w.pts[w.i + 1];
        const len = Math.max(0.001, Math.hypot(q.x - p.x, q.z - p.z));
        const step = Math.min(move, len - w.s);
        w.s += step; move -= step;
        if (w.s >= len - 1e-6) { w.i++; w.s = 0; }
      }
      const done = w.i >= w.pts.length - 1;
      const p = w.pts[Math.min(w.i, w.pts.length - 1)], q = w.pts[Math.min(w.i + 1, w.pts.length - 1)];
      const len = Math.max(0.001, Math.hypot(q.x - p.x, q.z - p.z));
      const u = done ? 1 : w.s / len;
      const x = p.x + (q.x - p.x) * u, z = p.z + (q.z - p.z) * u;
      let y;
      if (p.y !== null || q.y !== null) {
        // ngồi xuống ghế / nhảy lên sân khấu: bật nhẹ một cái
        const y0 = p.y ?? floorAt(p.z), y1 = q.y ?? floorAt(q.z);
        y = y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * (0.22 + Math.abs(y1 - y0) * 0.5);
        w.groundY = y;
      } else {
        // đi trên sàn / bậc thang: bước lên xuống từng bậc
        w.groundY += (floorAt(z) - w.groundY) * Math.min(1, dt * 14);
        y = w.groundY;
      }
      a.group.position.set(x, y, z);
      // quay mặt theo hướng đi; chặng cuối vào ghế / lên sân khấu thì quay về hướng cố định
      const target = q.face !== null && q.y !== null ? q.face : Math.atan2(-(q.x - p.x), -(q.z - p.z));
      let diff = target - a.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.group.rotation.y += diff * Math.min(1, dt * 10);
      if (done) {
        const end = w.pts[w.pts.length - 1];
        if (end.face !== null) a.group.rotation.y = end.face;
        a.walk = null;
        a.walking = false;
        if (w.onDone) w.onDone();
        else { this.placeAvatar(a); a.hop(0.5); }
      }
    }
  }
  // nhân vật đang ngồi sẵn: cho đi lại từ cửa vào ghế (dùng khi chính mình vừa vào rạp)
  walkIn(id) {
    const a = this.avatars.get(id);
    if (!a || a.user.stage) return;
    const door = { type: 'door', side: a.group.position.x < 0 ? -1 : 1 };
    const d = this.locPoint(door);
    a.group.position.set(d.x, floorAt(d.z), d.z);
    a.loc = door;
    a.walk = null;
    this.walkTo(a, { type: 'seat', seat: a.user.seat });
  }
  // rời rạp: đi ra cửa rồi mới biến mất
  leaveUser(id) {
    const a = this.avatars.get(id);
    if (!a || a.leaving) return;
    if (!a.group.visible && id !== this.myId) { this.removeUser(id); return; }
    a.leaving = true;
    const x = a.group.position.x;
    this.walkTo(a, { type: 'door', side: x < 0 ? -1 : 1 }, WALK_SPEED * 1.15, () => {
      if (this.avatars.get(id) === a) this.removeUser(id);
    });
  }

  emote(id, kind, ms) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.emote(kind, ms);
    if (!a.group.visible) this.emoji(id, { dance: '💃', wave: '👋', clap: '👏' }[kind] || '✨');
  }

  removeUser(id) {
    const a = this.avatars.get(id);
    if (!a) return;
    this.scene.remove(a.group);
    a.dispose();
    this.avatars.delete(id);
  }

  // đổi tên / trang phục / hạng: dựng lại nhân vật tại chỗ
  updateUser(user) {
    const a = this.avatars.get(user.id);
    if (!a) return;
    Object.assign(a.user, user);
    const walk = a.walk, loc = a.loc, pos = a.group.position.clone(), rot = a.group.rotation.y;
    const b = this.addUser(a.user);
    if (walk) { b.walk = walk; b.walking = true; b.loc = loc; b.group.position.copy(pos); b.group.rotation.y = rot; }
    else b.hop(0.8);
  }

  moveUser(id, seat) {
    const a = this.avatars.get(id);
    if (!a || a.leaving) return;
    a.user.seat = seat;
    if (!a.user.stage) this.walkTo(a, { type: 'seat', seat });
    if (id === this.myId) this.viewFromSeat(seat);
  }

  say(id, text) {
    const a = this.avatars.get(id);
    if (a && a.group.visible) a.say(text);
  }

  // ------------------------------------------------------------ HIỆU ỨNG
  userHead(id) {
    const a = this.avatars.get(id);
    if (!a) return null;
    if (id === this.myId && !a.user.stage && this.view === 'seat') {
      // nhân vật của mình bị ẩn: lấy vị trí ngay trước mắt
      return this.seatEye(a.user.seat).add(new THREE.Vector3(0, -0.7, -1.1));
    }
    return a.headPosition();
  }

  emoji(id, emoji) {
    const from = this.userHead(id);
    if (!from) return;
    const count = 3;
    // emoji ở xa thì to hơn một chút để vẫn nhìn rõ, ở gần thì nhỏ lại
    const base = 0.55 * THREE.MathUtils.clamp(from.distanceTo(this.camera.position) / 7, 0.35, 1.8);
    for (let k = 0; k < count; k++) {
      const sp = makeEmojiSprite(emoji, base);
      sp.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.6, 0));
      this.scene.add(sp);
      const drift = (Math.random() - 0.5) * 0.6;
      const delay = k * 0.18;
      const start = sp.position.clone();
      sp.visible = false;
      this.effects.push({
        life: 2.2 + delay, t: 0,
        update: (t) => {
          const u = t - delay;
          if (u < 0) return;
          sp.visible = true;
          sp.position.set(start.x + Math.sin(u * 3) * 0.15 + drift * u, start.y + u * 0.9, start.z);
          sp.material.opacity = u < 1.5 ? 1 : 1 - (u - 1.5) / 0.7;
          const s = base * Math.min(1, u * 5);
          sp.scale.set(s, s, 1);
        },
        dispose: () => { this.scene.remove(sp); sp.material.map.dispose(); sp.material.dispose(); },
      });
    }
    this.avatars.get(id)?.hop(0.4);
  }

  popcorn(fromId, toId, seed) {
    const start = this.userHead(fromId);
    if (!start) return;
    const rand = rng(seed);
    let end, landY;
    if (toId && this.avatars.has(toId)) {
      end = this.userHead(toId);
      landY = seatInfo(this.avatars.get(toId).user.seat).floorY + 0.55;
    } else {
      end = SCREEN_POS.clone().add(new THREE.Vector3((rand() - 0.5) * 12, (rand() - 0.5) * 6, 0.1));
      landY = STAGE.top;
    }
    if (!this.popGeo) {
      this.popGeo = new THREE.IcosahedronGeometry(0.07, 0);
      this.popMats = [0xfff3c4, 0xffe08a, 0xffffff].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    }
    const dist = start.distanceTo(end);
    const N = 14;
    for (let k = 0; k < N; k++) {
      const m = new THREE.Mesh(this.popGeo, this.popMats[k % 3]);
      m.scale.setScalar(0.7 + rand() * 0.8);
      this.scene.add(m);
      const off = new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.5);
      const target = end.clone().add(off);
      const flight = 0.7 + dist * 0.035 + rand() * 0.25;
      const arc = 1.2 + dist * 0.12 + rand() * 0.6;
      const delay = rand() * 0.25;
      const spin = new THREE.Vector3(rand() * 10, rand() * 10, rand() * 10);
      const fall = { y: 0, vy: 0, vx: (rand() - 0.5) * 1.5, vz: (rand() - 0.5) * 1.5 };
      let hitDone = false;
      this.effects.push({
        life: delay + flight + 3.5, t: 0,
        update: (t, dt) => {
          const u = t - delay;
          if (u < 0) { m.visible = false; return; }
          m.visible = true;
          m.rotation.set(spin.x * u, spin.y * u, spin.z * u);
          if (u <= flight) {
            const p = u / flight;
            m.position.lerpVectors(start, target, p);
            m.position.y += Math.sin(p * Math.PI) * arc;
            fall.y = m.position.y;
          } else {
            if (!hitDone) {
              hitDone = true;
              if (k === 0 && toId) this.avatars.get(toId)?.hop(1);
              fall.vy = 1.5;
            }
            if (fall.y > landY) {
              fall.vy -= 9.8 * dt;
              fall.y = Math.max(landY, fall.y + fall.vy * dt);
              m.position.x += fall.vx * dt;
              m.position.z += fall.vz * dt;
              m.position.y = fall.y;
            }
            const left = delay + flight + 3.5 - t;
            if (left < 0.6) m.scale.setScalar(Math.max(0.001, left / 0.6));
          }
        },
        dispose: () => this.scene.remove(m),
      });
    }
    this.avatars.get(fromId)?.hop(0.5);
  }

  // Ném cà chua / hoa hồng lên màn hình: bay theo đường vòng, dính lên màn vài giây rồi trôi xuống
  throwAtScreen(fromId, item, seed) {
    const start = this.userHead(fromId);
    if (!start) return;
    const rand = rng(seed);
    const hit = SCREEN_POS.clone().add(new THREE.Vector3((rand() - 0.5) * 14, (rand() - 0.5) * 7, 0.12));
    const fly = makeEmojiSprite(item === 'rose' ? '🌹' : '🍅', 0.7);
    this.scene.add(fly);
    const dist = start.distanceTo(hit);
    const flight = 0.8 + dist * 0.03;
    const arc = 1.5 + dist * 0.12;
    let stuck = null;
    const stick = 3.2, slide = 2.2;
    this.effects.push({
      life: flight + stick + slide, t: 0,
      update: (t, dt) => {
        if (t <= flight) {
          const p = t / flight;
          fly.position.lerpVectors(start, hit, p);
          fly.position.y += Math.sin(p * Math.PI) * arc;
          fly.material.rotation = p * (item === 'rose' ? 6 : 10);
          const sc = 0.6 + p * 0.9; // to dần khi bay gần màn hình
          fly.scale.set(sc, sc, 1);
          return;
        }
        if (!stuck) {
          this.scene.remove(fly);
          stuck = item === 'rose' ? makeEmojiSprite('🌹', 2.1) : this.splatSprite(rand);
          stuck.position.copy(hit);
          stuck.material.rotation = (rand() - 0.5) * (item === 'rose' ? 1.2 : 3);
          stuck.material.depthTest = true;
          stuck.renderOrder = 5;
          this.scene.add(stuck);
          stuck.userData.base = stuck.scale.x;
        }
        const u = t - flight;
        if (u < 0.12) { const k = 1 + (0.12 - u) * 3; stuck.scale.set(stuck.userData.base * k, stuck.userData.base / k, 1); } // bẹp khi trúng
        else stuck.scale.set(stuck.userData.base, stuck.userData.base, 1);
        if (u > stick) {
          const v = (u - stick) / slide;              // trôi xuống và mờ dần
          stuck.position.y = hit.y - v * v * (item === 'rose' ? 5.5 : 2.4);
          if (item === 'rose') stuck.material.rotation += dt * 2;
          stuck.material.opacity = 1 - v;
        }
      },
      dispose: () => {
        this.scene.remove(fly);
        fly.material.map.dispose(); fly.material.dispose();
        if (stuck) { this.scene.remove(stuck); if (stuck.material.map !== this.splatTex) stuck.material.map.dispose(); stuck.material.dispose(); }
      },
    });
    this.avatars.get(fromId)?.hop(0.6);
  }
  // Quà bay từ người tặng tới người nhận, tới nơi thì toả lấp lánh
  giftFx(fromId, toId, icon) {
    const start = this.userHead(fromId), end = this.userHead(toId);
    if (!start || !end) return;
    const sp = makeEmojiSprite(icon, 0.8);
    this.scene.add(sp);
    const dist = start.distanceTo(end);
    const flight = 0.9 + dist * 0.05, arc = 1.4 + dist * 0.15;
    let burst = false;
    this.effects.push({
      life: flight + 0.6, t: 0,
      update: (t) => {
        if (t <= flight) {
          const p = t / flight;
          sp.position.lerpVectors(start, end, p);
          sp.position.y += Math.sin(p * Math.PI) * arc;
          const k = 0.8 + Math.sin(p * Math.PI) * 0.6;
          sp.scale.set(k, k, 1);
          return;
        }
        if (!burst) {
          burst = true;
          this.avatars.get(toId)?.hop(1);
          for (let i = 0; i < 3; i++) setTimeout(() => this.emoji(toId, ['✨', '💖', '🎉'][i]), i * 120);
        }
        const u = (t - flight) / 0.6;
        sp.material.opacity = 1 - u;
        sp.scale.set(1.4 + u, 1.4 + u, 1);
      },
      dispose: () => { this.scene.remove(sp); sp.material.map.dispose(); sp.material.dispose(); },
    });
    this.avatars.get(fromId)?.hop(0.6);
  }

  // vết cà chua vỡ (vẽ bằng canvas, dùng chung)
  splatSprite() {
    if (!this.splatTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const r = rng(7);
      g.fillStyle = '#c8201a';
      g.beginPath(); g.arc(128, 118, 62, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 16; i++) { // tia bắn
        const a = r() * Math.PI * 2, d = 60 + r() * 55, rr = 6 + r() * 16;
        g.beginPath(); g.arc(128 + Math.cos(a) * d, 118 + Math.sin(a) * d, rr, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 5; i++) { // vệt chảy
        const x = 80 + r() * 96, len = 40 + r() * 60;
        g.fillRect(x - 5, 150, 10, len);
        g.beginPath(); g.arc(x, 150 + len, 7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(255,170,150,.55)';
      g.beginPath(); g.ellipse(108, 98, 18, 10, -0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2d36b'; // hạt cà chua
      for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(100 + r() * 56, 100 + r() * 40, 3, 5, r() * 3, 0, Math.PI * 2); g.fill(); }
      this.splatTex = new THREE.CanvasTexture(c);
      this.splatTex.colorSpace = THREE.SRGBColorSpace;
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.splatTex, transparent: true, depthWrite: false }));
    sp.scale.set(2.8, 2.8, 1);
    return sp;
  }

  // ------------------------------------------------------------ ẢNH NHÂN VẬT CHO MÀN HÌNH CHỌN
  static renderThumbnails(types, size = 160, outfit = null) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(size, size);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x443355, 2.2));
    const dl = new THREE.DirectionalLight(0xffffff, 2);
    dl.position.set(-2, 3, -4);
    scene.add(dl);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    cam.position.set(1.0, 1.25, -3.1);
    cam.lookAt(0, 0.8, 0);
    const out = {};
    for (const t of types) {
      const g = outfit ? createDressed(t, outfit) : createCharacter(t);
      scene.add(g);
      r.render(scene, cam);
      out[t] = r.domElement.toDataURL('image/png');
      scene.remove(g);
    }
    r.dispose();
    r.forceContextLoss?.();
    return out;
  }

  // ------------------------------------------------------------ VÒNG LẶP
  resize() {
    // lấy kích thước khung chứa, nhưng không bao giờ lớn hơn cửa sổ (tránh khung 3D to gấp nhiều lần màn hình)
    let w = this.container.clientWidth || window.innerWidth;
    let h = this.container.clientHeight || window.innerHeight;
    w = Math.min(w, window.innerWidth || w); h = Math.min(h, window.innerHeight || h);
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.applyFov();
    this.renderer.setSize(w, h);
    this.cssRenderer.setSize(w, h);
    // góc "tập trung màn hình" phụ thuộc kích thước cửa sổ
    if (this.view === 'screen' && this.mySeat >= 0 && !this.tween) {
      const { pos, look } = this.viewPose('screen');
      this.camPos.copy(pos);
      this.camLook.copy(look);
    }
  }

  // Màn hình dọc (điện thoại): mở rộng góc nhìn để vẫn thấy gần hết màn chiếu
  applyFov() {
    const aspect = this.camera.aspect || 1;
    let base = 60;
    if (aspect < 1.4) base = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(42)) / aspect));
    base = Math.min(base, 100);
    if (this.discoBall) this.discoBall.visible = aspect >= 1; // màn hình dọc: ẩn quả cầu disco để không che màn chiếu
    this.camera.fov = THREE.MathUtils.clamp(base + (this.zoom || 0), 25, 110);
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    // mỗi giây kiểm tra 1 lần: khung 3D lệch cỡ so với khung chứa thì đo lại
    if (t - (this.sizeCheckAt || 0) > 1) {
      this.sizeCheckAt = t;
      const el = this.renderer.domElement;
      const cw = Math.min(this.container.clientWidth, window.innerWidth), ch = Math.min(this.container.clientHeight, window.innerHeight);
      if (cw && ch && (Math.abs(el.clientWidth - cw) > 2 || Math.abs(el.clientHeight - ch) > 2)) this.resize();
    }
    this.updateCamera(dt);
    this.updateDisco(t, dt);
    this.updateWalkers(dt);
    for (const a of this.avatars.values()) {
      a.update(dt, t);
      if (a.group.visible) a.setUiScale(a.group.position.distanceTo(this.camera.position));
    }
    this.effects = this.effects.filter((e) => {
      e.t += dt;
      if (e.t >= e.life) { e.dispose(); return false; }
      e.update(e.t, dt);
      return true;
    });
    this.renderer.render(this.scene, this.camera);
    this.cssRenderer.render(this.cssScene, this.camera);
  }
}

// ---------------- XEM TRƯỚC NHÂN VẬT TRONG TỦ ĐỒ (xoay tròn) ----------------
export class AvatarPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x443355, 2.2));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2);
    dl.position.set(-2, 3, -4);
    this.scene.add(dl);
    const back = new THREE.DirectionalLight(0xc9a7ff, 1.2);
    back.position.set(2, 2, 4);
    this.scene.add(back);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    this.camera.position.set(0, 1.15, -4.2);
    this.camera.lookAt(0, 0.85, 0);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.angle = Math.PI * 0.15;
    this.running = true;
    this.clock = new THREE.Clock();
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, a: this.angle }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (drag) this.angle = drag.a + (e.clientX - drag.x) * 0.01; });
    canvas.addEventListener('pointerup', () => { drag = null; });
    this.dragging = () => !!drag;
    const loop = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();
      if (!this.dragging()) this.angle += dt * 0.6;
      this.holder.rotation.y = this.angle;
      const t = this.clock.elapsedTime;
      for (const o of this.animated || []) {
        if (o.userData.wing) o.rotation.y = o.userData.wing * (0.25 + Math.sin(t * 3) * 0.2);
      }
      this.resize();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  show(type, outfit) {
    this.holder.clear();
    const g = createDressed(type, outfit);
    this.animated = g.userData.animated;
    this.holder.add(g);
  }

  dispose() {
    this.running = false;
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
