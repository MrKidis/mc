import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, WATER,
  SNOWY_GRASS, SNOW, CACTUS, BIRCH, BIRCH_LEAVES, GRAVEL,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
  PLANKS, COBBLE, SANDSTONE, BEDROCK,
  SLOT_TYPES, SLOT_NAMES, PART_COL, tileFor,
} from './blocks.js';
import { makeAtlas, uvCoord } from './textures.js';
import { sfx } from './audio.js';

// ================= Constants =================
const CH = 16, H = 80, R = 4, SEA = 12;
const MINE_TIME = 0.35;

// ================= Noise =================
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const s = t => t * t * (3 - 2 * t);
  const u = s(x - xi), v = s(z - zi);
  return hash(xi, zi) * (1 - u) * (1 - v)
       + hash(xi + 1, zi) * u * (1 - v)
       + hash(xi, zi + 1) * (1 - u) * v
       + hash(xi + 1, zi + 1) * u * v;
}
function smoothNoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = t => t * t * (3 - 2 * t);
  const u = s(x - xi), v = s(y - yi), w = s(z - zi);
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function heightAt(x, z) {
  let h = 0, amp = 1, f = 0.008, norm = 0;
  for (let o = 0; o < 5; o++) {
    h += smoothNoise(x * f + 100, z * f + 100) * amp;
    norm += amp; amp *= 0.55; f *= 2.3;
  }
  h /= norm;
  return Math.floor(4 + h * h * 52);
}

// ================= Biomes =================
function tempAt(x, z) { return smoothNoise(x * 0.004 + 700, z * 0.004 + 700); }
function moistAt(x, z) { return smoothNoise(x * 0.004 - 300, z * 0.004 - 300); }
function biomeAt(x, z) {
  const t = tempAt(x, z), m = moistAt(x, z);
  if (t < 0.32) return 'snow';
  if (t > 0.68 && m < 0.45) return 'desert';
  if (m > 0.62) return 'forest';
  return 'plains';
}
function vegRand(x, z) { return hash(x * 1.23 + 45.6, z * 7.89 + 12.3); }

// ================= Scene =================
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 45, 105);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const atlasTex = makeAtlas();
const solidMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
const waterMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });

// ================= Chunk storage =================
const chunks = new Map();
const editsByChunk = new Map();
const dirty = new Set();
const ck = (cx, cz) => `${cx},${cz}`;
const lidx = (lx, y, lz) => (y * CH + lz) * CH + lx;

function getBlock(x, y, z) {
  if (y < 0) return STONE;
  if (y >= H) return AIR;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const c = chunks.get(ck(cx, cz));
  if (!c) return AIR;
  return c.data[lidx(x - cx * CH, y, z - cz * CH)];
}
function solidAt(x, y, z) {
  const b = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  return b !== AIR && b !== WATER;
}
function occ(x, y, z) {
  const b = getBlock(x, y, z);
  return (b !== AIR && b !== WATER) ? 1 : 0;
}
function markDirty(cx, cz) {
  if (chunks.has(ck(cx, cz))) dirty.add(ck(cx, cz));
}
function setBlock(x, y, z, t) {
  if (y < 0 || y >= H) return;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const lx = x - cx * CH, lz = z - cz * CH;
  const k = ck(cx, cz);
  let em = editsByChunk.get(k);
  if (!em) { em = new Map(); editsByChunk.set(k, em); }
  em.set(`${lx},${y},${lz}`, t);
  const c = chunks.get(k);
  if (!c) return;
  c.data[lidx(lx, y, lz)] = t;
  markDirty(cx, cz);
  if (lx === 0) markDirty(cx - 1, cz);
  if (lx === CH - 1) markDirty(cx + 1, cz);
  if (lz === 0) markDirty(cx, cz - 1);
  if (lz === CH - 1) markDirty(cx, cz + 1);
}

// ================= Chunk generation =================
function genChunk(cx, cz) {
  const data = new Uint8Array(CH * H * CH);
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const gx = cx * CH + lx, gz = cz * CH + lz;
    const h = Math.min(heightAt(gx, gz), H - 8);
    const biome = biomeAt(gx, gz);
    const beach = h <= SEA + 1;
    for (let y = 0; y <= h; y++) {
      let t = STONE;
      if (beach) {
        if (y >= h - 3) t = SAND;
      } else if (biome === 'desert') {
        if (y >= h - 2) t = SAND;
        else if (y >= h - 5) t = SANDSTONE;
      } else if (biome === 'snow') {
        if (y === h) t = SNOWY_GRASS;
        else if (y >= h - 3) t = DIRT;
      } else {
        if (y === h) t = GRASS;
        else if (y >= h - 3) t = DIRT;
      }
      // Ores by depth
      if (t === STONE) {
        const r = hash3(gx + 911, y + 37, gz + 541);
        if (y < 12 && r < 0.004) t = DIAMOND_ORE;
        else if (y < 20 && r < 0.006) t = GOLD_ORE;
        else if (y < 32 && r < 0.012) t = IRON_ORE;
        else if (y < 45 && r < 0.02) t = COAL_ORE;
        else if (r > 0.96 && r < 0.975) t = GRAVEL;
      }
      // Carve caves (not under shallow water, never at y=0)
      if (y > 0 && y < h - 2 && h > SEA + 2 && smoothNoise3(gx * 0.09, y * 0.12, gz * 0.09) > 0.74) {
        t = AIR;
      }
      if (y === 0) t = BEDROCK;
      data[lidx(lx, y, lz)] = t;
    }
    for (let y = h + 1; y <= SEA; y++) data[lidx(lx, y, lz)] = WATER;
  }
  // Vegetation (scan margin so trees cross chunk borders seamlessly)
  for (let tx = cx * CH - 2; tx < (cx + 1) * CH + 2; tx++) {
    for (let tz = cz * CH - 2; tz < (cz + 1) * CH + 2; tz++) {
      const r = vegRand(tx, tz);
      const th = heightAt(tx, tz);
      if (th <= SEA + 1 || th >= H - 10) continue;
      const biome = biomeAt(tx, tz);
      const put = (x, y, z, t, keepExisting) => {
        const lx = x - cx * CH, lz = z - cz * CH;
        if (lx < 0 || lx >= CH || lz < 0 || lz >= CH || y < 0 || y >= H) return;
        const i = lidx(lx, y, lz);
        if (keepExisting && data[i] !== AIR) return;
        data[i] = t;
      };
      if (biome === 'desert') {
        if (r < 0.012) {
          const chh = 1 + (Math.floor(r * 1000) % 3);
          for (let y = th + 1; y <= th + chh; y++) put(tx, y, tz, CACTUS, false);
        }
        continue;
      }
      const thresh = biome === 'forest' ? 0.05 : biome === 'plains' ? 0.012 : 0.02;
      if (r >= thresh) continue;
      const birch = biome === 'forest' && hash(tx * 3.7, tz * 5.1) > 0.5;
      const trunk = birch ? BIRCH : WOOD;
      const leaf = birch ? BIRCH_LEAVES : LEAVES;
      for (let y = th + 1; y <= th + 4; y++) put(tx, y, tz, trunk, false);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 4; dy <= 6; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + (dy - 4) > 3) continue;
        put(tx + dx, th + dy, tz + dz, leaf, true);
      }
    }
  }
  const em = editsByChunk.get(ck(cx, cz));
  if (em) for (const [lk, t] of em) {
    const [lx, y, lz] = lk.split(',').map(Number);
    data[lidx(lx, y, lz)] = t;
  }
  chunks.set(ck(cx, cz), { data, mesh: null, wmesh: null });
  markDirty(cx, cz);
  markDirty(cx - 1, cz); markDirty(cx + 1, cz);
  markDirty(cx, cz - 1); markDirty(cx, cz + 1);
}

// ================= Meshing =================
const FACES = [
  { dir: [-1, 0, 0], corners: [{ pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
  { dir: [1, 0, 0],  corners: [{ pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
  { dir: [0, -1, 0], corners: [{ pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
  { dir: [0, 1, 0],  corners: [{ pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
  { dir: [0, 0, -1], corners: [{ pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
  { dir: [0, 0, 1],  corners: [{ pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] },
];
function faceShade(dir) {
  if (dir[1] === 1) return 1.0;
  if (dir[1] === -1) return 0.5;
  if (dir[0] !== 0) return 0.8;
  return 0.65;
}
function aoAxes(dir) {
  if (dir[0]) return [[0, 1, 0], [0, 0, 1]];
  if (dir[1]) return [[1, 0, 0], [0, 0, 1]];
  return [[1, 0, 0], [0, 1, 0]];
}
function buildChunkMesh(cx, cz) {
  const c = chunks.get(ck(cx, cz));
  if (!c) return;
  const pos = [], uv = [], col = [], ind = [];
  const wpos = [], wuv = [], wcol = [], wind = [];
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const t = c.data[lidx(lx, y, lz)];
    if (t === AIR) continue;
    const gx = cx * CH + lx, gz = cz * CH + lz;
    const isWater = t === WATER;
    const surfaced = isWater && getBlock(gx, y + 1, gz) !== WATER;
    for (const f of FACES) {
      const nb = getBlock(gx + f.dir[0], y + f.dir[1], gz + f.dir[2]);
      if (isWater) { if (nb !== AIR) continue; }
      else if (nb !== AIR && nb !== WATER) continue;
      const tl = tileFor(t, f.dir);
      const shade = faceShade(f.dir);
      const [a1, a2] = aoAxes(f.dir);
      const ai1 = a1.findIndex(v => v), ai2 = a2.findIndex(v => v);
      const bx = gx + f.dir[0], by = y + f.dir[1], bz = gz + f.dir[2];
      const P = isWater ? wpos : pos, U = isWater ? wuv : uv, C = isWater ? wcol : col, I = isWater ? wind : ind;
      const base = P.length / 3;
      for (const corner of f.corners) {
        let ao = 1;
        if (!isWater) {
          const s1 = corner.pos[ai1] ? 1 : -1, s2 = corner.pos[ai2] ? 1 : -1;
          const o1 = occ(bx + a1[0] * s1, by + a1[1] * s1, bz + a1[2] * s1);
          const o2 = occ(bx + a2[0] * s2, by + a2[1] * s2, bz + a2[2] * s2);
          const oc = occ(bx + a1[0] * s1 + a2[0] * s2, by + a1[1] * s1 + a2[1] * s2, bz + a1[2] * s1 + a2[2] * s2);
          ao = (o1 && o2) ? 0.4 : 1 - 0.2 * (o1 + o2 + oc);
        }
        let py = y + corner.pos[1];
        if (isWater && surfaced && corner.pos[1] === 1) py = y + 0.88;
        P.push(gx + corner.pos[0], py, gz + corner.pos[2]);
        const [uu, vv] = uvCoord(tl, corner.uv[0], corner.uv[1]);
        U.push(uu, vv);
        const l = shade * ao;
        C.push(l, l, l);
      }
      I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
  if (c.wmesh) { scene.remove(c.wmesh); c.wmesh.geometry.dispose(); c.wmesh = null; }
  if (ind.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(ind);
    c.mesh = new THREE.Mesh(g, solidMat);
    scene.add(c.mesh);
  }
  if (wind.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
    g.setIndex(wind);
    c.wmesh = new THREE.Mesh(g, waterMat);
    scene.add(c.wmesh);
  }
}

// ================= Chunk streaming =================
const OFFS = [];
for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) OFFS.push([dx, dz]);
OFFS.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
let frame = 0;
function updateChunks(pcx, pcz) {
  let budget = 2;
  for (const [dx, dz] of OFFS) {
    const k = ck(pcx + dx, pcz + dz);
    if (!chunks.has(k)) {
      genChunk(pcx + dx, pcz + dz);
      if (--budget <= 0) break;
    }
  }
  if (frame % 120 === 0) {
    for (const [k, c] of chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > R + 2) {
        if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
        if (c.wmesh) { scene.remove(c.wmesh); c.wmesh.geometry.dispose(); }
        chunks.delete(k); dirty.delete(k);
      }
    }
  }
}
function remeshDirty() {
  let budget = 3;
  for (const k of dirty) {
    dirty.delete(k);
    const [cx, cz] = k.split(',').map(Number);
    buildChunkMesh(cx, cz);
    if (--budget <= 0) break;
  }
}

// ================= Player =================
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => { sfx.resume(); controls.lock(); });
controls.addEventListener('lock', () => overlay.style.display = 'none');
controls.addEventListener('unlock', () => overlay.style.display = 'flex');

let spawnX = 8;
for (let r = 0; r < 400; r += 4) {
  if (heightAt(8 + r, 8) > SEA + 2) { spawnX = 8 + r; break; }
}
const player = { pos: new THREE.Vector3(spawnX + 0.5, H, 8.5), vel: new THREE.Vector3(), onGround: false };
let spawned = false, prevInWater = false;
const EYE = 1.6, RADIUS = 0.3, HEIGHT = 1.8;
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyQ') { equipped = !equipped; updateHand(); }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5)) - 1;
    if (n >= 0 && n < SLOT_TYPES.length) setSlot(n);
  }
});
addEventListener('keyup', e => keys[e.code] = false);

function collides(px, py, pz) {
  for (const dx of [-RADIUS, RADIUS])
    for (const dz of [-RADIUS, RADIUS])
      for (const dy of [0.05, 0.9, HEIGHT - 0.05])
        if (solidAt(px + dx, py + dy, pz + dz)) return true;
  return false;
}

// ================= Hotbar (keys + scroll wheel) =================
let slot = 0;
const hotbar = document.getElementById('hotbar');
SLOT_TYPES.forEach((t, i) => {
  const d = document.createElement('div');
  d.className = 'slot';
  d.textContent = `${i + 1} ${SLOT_NAMES[i]}`;
  d.style.borderBottom = `4px solid #${(PART_COL[t] || 0x999999).toString(16).padStart(6, '0')}`;
  hotbar.appendChild(d);
});
function setSlot(n) {
  slot = n;
  equipped = true;
  [...hotbar.children].forEach((d, i) => d.classList.toggle('active', i === n));
  updateHand();
}
addEventListener('wheel', e => {
  if (!controls.isLocked) return;
  const d = Math.sign(e.deltaY);
  setSlot((slot + d + SLOT_TYPES.length) % SLOT_TYPES.length);
});

// ================= Held block in hand =================
function buildCubeGeometry(t) {
  const pos = [], uv = [], col = [], ind = [];
  for (const f of FACES) {
    const tl = tileFor(t, f.dir);
    const s = faceShade(f.dir);
    const base = pos.length / 3;
    for (const c of f.corners) {
      pos.push(c.pos[0] - 0.5, c.pos[1] - 0.5, c.pos[2] - 0.5);
      const [uu, vv] = uvCoord(tl, c.uv[0], c.uv[1]);
      uv.push(uu, vv);
      col.push(s, s, s);
    }
    ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  return g;
}
const handBase = new THREE.Vector3(0.5, -0.45, -0.8);
let hand = null, equipped = true;
const armMat = new THREE.MeshBasicMaterial({ color: 0xd8a07a });
function updateHand() {
  if (hand) { camera.remove(hand); hand.geometry.dispose(); }
  if (equipped) {
    hand = new THREE.Mesh(buildCubeGeometry(SLOT_TYPES[slot]), solidMat);
    hand.scale.setScalar(0.35);
    hand.rotation.set(0, Math.PI / 5, 0);
  } else {
    hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.75), armMat);
    hand.rotation.set(0.2, -0.3, 0);
  }
  hand.position.copy(handBase);
  camera.add(hand);
}
setSlot(0);
let swingT = 0;
function swing() { if (swingT <= 0) swingT = 0.25; }

// ================= Voxel raycast (DDA) =================
function voxelRay(o, d, maxDist) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const tdx = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
  const tdy = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
  const tdz = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
  let tmx = d.x !== 0 ? Math.abs(((sx > 0 ? x + 1 : x) - o.x) / d.x) : Infinity;
  let tmy = d.y !== 0 ? Math.abs(((sy > 0 ? y + 1 : y) - o.y) / d.y) : Infinity;
  let tmz = d.z !== 0 ? Math.abs(((sz > 0 ? z + 1 : z) - o.z) / d.z) : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0, first = true;
  while (t <= maxDist) {
    if (!first && solidAt(x, y, z)) return { x, y, z, nx, ny, nz };
    first = false;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}

// ================= Highlight + mining crack =================
const hl = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
hl.visible = false;
scene.add(hl);
const crack = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
);
crack.visible = false;
scene.add(crack);

// ================= Mining / placing =================
const lookDir = new THREE.Vector3();
let miningHeld = false, mineTarget = null, mineProgress = 0, mineTick = 0;
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  if (!controls.isLocked) return;
  if (e.button === 0) {
    miningHeld = true;
    swing();
  } else if (e.button === 2) {
    camera.getWorldDirection(lookDir);
    const hit = voxelRay(camera.position, lookDir, 6);
    if (!hit) return;
    const nx = hit.x + hit.nx, ny = hit.y + hit.ny, nz = hit.z + hit.nz;
    const pp = player.pos;
    const inPlayer = nx === Math.floor(pp.x) && nz === Math.floor(pp.z)
      && ny >= Math.floor(pp.y) && ny <= Math.floor(pp.y + HEIGHT);
    const existing = getBlock(nx, ny, nz);
    if (equipped && !inPlayer && (existing === AIR || existing === WATER)) {
      setBlock(nx, ny, nz, SLOT_TYPES[slot]);
      sfx.place();
      swing();
    }
  }
});
addEventListener('mouseup', e => {
  if (e.button === 0) {
    miningHeld = false; mineTarget = null; mineProgress = 0;
    crack.visible = false;
  }
});

// ================= Particles =================
const particles = [];
const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const partMats = {};
function spawnParticles(x, y, z, t) {
  if (!partMats[t]) partMats[t] = new THREE.MeshBasicMaterial({ color: PART_COL[t] || 0x999999 });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(partGeo, partMats[t]);
    m.position.set(x + Math.random(), y + Math.random(), z + Math.random());
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
    m.userData.life = 0.6 + Math.random() * 0.3;
    scene.add(m);
    particles.push(m);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const m = particles[i];
    m.userData.v.y -= 12 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.userData.life -= dt;
    if (m.userData.life <= 0) { scene.remove(m); particles.splice(i, 1); }
  }
}

// ================= Clouds =================
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
const clouds = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(8 + Math.random() * 16, 2, 6 + Math.random() * 10),
    cloudMat
  );
  m.position.set((Math.random() - 0.5) * 440, 92 + Math.random() * 6, (Math.random() - 0.5) * 440);
  scene.add(m);
  clouds.push(m);
}
function updateClouds(dt) {
  for (const m of clouds) {
    m.position.x += 1.5 * dt;
    if (m.position.x > player.pos.x + 220) m.position.x = player.pos.x - 220;
    if (m.position.x < player.pos.x - 220) m.position.x = player.pos.x + 220;
    if (m.position.z > player.pos.z + 220) m.position.z = player.pos.z - 220;
    if (m.position.z < player.pos.z - 220) m.position.z = player.pos.z + 220;
  }
}

// ================= Day / night, sun, moon and stars =================
const dayC = new THREE.Color(0x87ceeb), nightC = new THREE.Color(0x0b1026), skyC = new THREE.Color();
let time = 45;
const sun = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.MeshBasicMaterial({ color: 0xffdd66, fog: false })
);
const moon = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false })
);
scene.add(sun); scene.add(moon);
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 300; i++) {
  const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
  const r = 180;
  starPos.push(r * Math.sin(p) * Math.cos(t), Math.abs(r * Math.cos(p)) + 10, r * Math.sin(p) * Math.sin(t));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);
function updateDayNight() {
  const cycle = (time / 180) % 1;
  const b = THREE.MathUtils.clamp(Math.sin(cycle * Math.PI * 2) * 0.5 + 0.55, 0.12, 1);
  skyC.lerpColors(nightC, dayC, b);
  scene.background = skyC;
  scene.fog.color.copy(skyC);
  solidMat.color.setScalar(0.35 + 0.65 * b);
  waterMat.color.setScalar(0.35 + 0.65 * b);
  cloudMat.color.setScalar(0.4 + 0.6 * b);
  const ang = cycle * Math.PI * 2;
  const rad = 150;
  sun.position.set(player.pos.x + Math.cos(ang) * rad, Math.sin(ang) * rad + 10, player.pos.z);
  moon.position.set(player.pos.x - Math.cos(ang) * rad, -Math.sin(ang) * rad + 10, player.pos.z);
  sun.lookAt(camera.position);
  moon.lookAt(camera.position);
  stars.position.set(player.pos.x, 0, player.pos.z);
  starMat.opacity = Math.max(0, 1 - b * 1.4);
}
scene.background = dayC;

// ================= Main loop =================
const waterTint = document.getElementById('water-tint');
const clock = new THREE.Clock();
let bob = 0, stepAcc = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt; frame++;

  const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
  updateChunks(pcx, pcz);
  remeshDirty();

  if (!spawned && chunks.has(ck(pcx, pcz))) {
    let y = H - 1;
    while (y > 0 && !solidAt(player.pos.x, y, player.pos.z)) y--;
    player.pos.y = y + 1.2;
    spawned = true;
  }

  if (controls.isLocked && spawned) {
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = sprint ? 8.5 : 5.5;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(fwd);
    if (keys['KeyS']) move.sub(fwd);
    if (keys['KeyD']) move.add(right);
    if (keys['KeyA']) move.sub(right);
    const moving = move.lengthSq() > 0;
    move.normalize().multiplyScalar(speed * dt);

    const p = player.pos;
    const inWater = getBlock(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === WATER;
    if (inWater && !prevInWater && player.vel.y < -3) sfx.splash();
    prevInWater = inWater;
    if (inWater) {
      player.vel.y -= 4 * dt;
      player.vel.y = Math.max(player.vel.y, -2.5);
      if (keys['Space']) player.vel.y = 3;
    } else {
      player.vel.y -= 20 * dt;
      if (keys['Space'] && player.onGround) {
        player.vel.y = 8; player.onGround = false;
        sfx.jump();
      }
    }

    if (!collides(p.x + move.x, p.y, p.z)) p.x += move.x;
    if (!collides(p.x, p.y, p.z + move.z)) p.z += move.z;
    const dy = player.vel.y * dt;
    if (!collides(p.x, p.y + dy, p.z)) {
      p.y += dy;
      player.onGround = false;
    } else {
      if (player.vel.y < 0) player.onGround = true;
      player.vel.y = 0;
    }
    if (p.y < -30) { p.y = H; player.vel.set(0, 0, 0); spawned = false; }

    if (moving && player.onGround) {
      bob += dt * 9;
      stepAcc += speed * dt;
      if (stepAcc > 2.2) { sfx.step(); stepAcc = 0; }
    }
    camera.position.set(p.x, p.y + EYE + Math.sin(bob) * 0.06, p.z);

    if (hand) {
      if (swingT > 0) {
        swingT -= dt;
        const k = Math.sin((1 - Math.max(swingT, 0) / 0.25) * Math.PI);
        hand.rotation.x = -0.9 * k;
        hand.position.z = handBase.z - 0.15 * k;
      } else {
        hand.rotation.x = 0;
        hand.position.z = handBase.z;
      }
      hand.position.y = handBase.y + Math.sin(bob) * 0.02;
    }

    camera.getWorldDirection(lookDir);
    const hit = voxelRay(camera.position, lookDir, 6);
    hl.visible = !!hit;
    if (hit) hl.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    if (miningHeld && hit) {
      const tt = getBlock(hit.x, hit.y, hit.z);
      if (tt === BEDROCK) {
        crack.visible = false; mineTarget = null; mineProgress = 0;
      } else {
        swing();
        if (mineTarget && mineTarget.x === hit.x && mineTarget.y === hit.y && mineTarget.z === hit.z) {
          mineProgress += dt / MINE_TIME;
        } else {
          mineTarget = { x: hit.x, y: hit.y, z: hit.z };
          mineProgress = 0;
        }
        crack.visible = true;
        crack.position.copy(hl.position);
        crack.material.opacity = Math.min(mineProgress, 1) * 0.5;
        mineTick += dt;
        if (mineTick > 0.12) { sfx.mine(); mineTick = 0; }
        if (mineProgress >= 1) {
          setBlock(hit.x, hit.y, hit.z, AIR);
          spawnParticles(hit.x, hit.y, hit.z, tt);
          sfx.blockBreak();
          mineTarget = null; mineProgress = 0;
          crack.visible = false;
        }
      }
    } else {
      crack.visible = false;
      if (!miningHeld) { mineTarget = null; mineProgress = 0; }
    }

    waterTint.style.display =
      getBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)) === WATER
        ? 'block' : 'none';
  }

  updateParticles(dt);
  updateClouds(dt);
  updateDayNight();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
