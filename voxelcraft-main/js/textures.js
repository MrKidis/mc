// Procedurally generated pixel-art texture atlas (all original textures).
// 8x8 grid of 16px tiles on a 128x128 canvas.
import * as THREE from 'three';

const UV_EPS = 1 / 256;

export function uvCoord(tl, u, v) {
  const tx = tl % 8, ty = Math.floor(tl / 8);
  return [tx * 0.125 + UV_EPS + u * (0.125 - 2 * UV_EPS), 1 - (ty + 1) * 0.125 + UV_EPS + v * (0.125 - 2 * UV_EPS)];
}

function px2(i, j, seed) {
  const n = Math.sin(i * 12.9898 + j * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function makeAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  function drawTile(tx, ty, fn) {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const c = fn(i, j);
      ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      ctx.fillRect(tx * 16 + i, ty * 16 + j, 1, 1);
    }
  }
  const stoneBase = (i, j) => {
    const v = px2(i, j, 4) * 30;
    const s = px2(i * 3, j * 3, 5) > 0.9 ? -25 : 0;
    return [120 + v + s, 120 + v + s, 122 + v + s];
  };
  const oreTile = (i, j, col, seed) => {
    if (px2(i, j, seed) > 0.82 && i > 1 && i < 14 && j > 1 && j < 14) return col;
    return stoneBase(i, j);
  };
  // Row 0
  drawTile(0, 0, (i, j) => { const v = px2(i, j, 1) * 30; return [80 + v, 150 + v * 1.2, 55 + v]; });
  drawTile(1, 0, (i, j) => {
    const edge = 3 + Math.floor(px2(i, 0, 2) * 3);
    if (j < edge) { const v = px2(i, j, 1) * 30; return [80 + v, 150 + v, 55 + v]; }
    const v = px2(i, j, 3) * 24; return [125 + v, 88 + v, 55 + v];
  });
  drawTile(2, 0, (i, j) => { const v = px2(i, j, 3) * 24; return [125 + v, 88 + v, 55 + v]; });
  drawTile(3, 0, stoneBase);
  drawTile(4, 0, (i, j) => { const v = px2(i, 0, 6) * 20 + (i % 4 === 0 ? -18 : 0); return [110 + v, 80 + v, 45 + v]; });
  drawTile(5, 0, (i, j) => {
    const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5));
    const ring = (Math.floor(d) % 2 === 0) ? 12 : -12;
    const v = px2(i, j, 7) * 10;
    return [150 + ring + v, 110 + ring + v, 65 + v];
  });
  drawTile(6, 0, (i, j) => { const v = px2(i, j, 8) * 40; if (px2(j, i, 9) > 0.86) return [20, 40, 15]; return [45 + v, 105 + v, 40 + v * 0.6]; });
  drawTile(7, 0, (i, j) => { const v = px2(i, j, 10) * 18; return [210 + v * 0.6, 198 + v * 0.6, 150 + v]; });
  // Row 1
  drawTile(0, 1, (i, j) => { const v = Math.sin((i + j * 0.5) * 1.2) * 10 + px2(i, j, 11) * 12; return [40 + v, 105 + v, 190 + v]; });
  drawTile(1, 1, (i, j) => { const v = px2(i, j, 12) * 14; return [235 - v, 238 - v, 245 - v * 0.5]; });
  drawTile(2, 1, (i, j) => {
    const edge = 3 + Math.floor(px2(i, 0, 13) * 3);
    if (j < edge) { const v = px2(i, j, 12) * 14; return [235 - v, 238 - v, 245 - v * 0.5]; }
    const v = px2(i, j, 3) * 24; return [125 + v, 88 + v, 55 + v];
  });
  drawTile(3, 1, (i, j) => {
    const stripe = (i % 4 === 1) ? 22 : 0;
    if (px2(i, j, 14) > 0.92) return [25, 55, 22];
    const v = px2(i, j, 15) * 14;
    return [55 + stripe + v, 115 + stripe + v, 48 + v];
  });
  drawTile(4, 1, (i, j) => {
    if (px2(Math.floor(i / 2), Math.floor(j / 3), 16) > 0.85) return [62, 56, 50];
    const v = px2(i, j, 17) * 12;
    return [205 - v, 200 - v, 190 - v];
  });
  drawTile(5, 1, (i, j) => { const v = px2(i, j, 18) * 36; if (px2(j, i, 19) > 0.88) return [30, 50, 20]; return [80 + v, 150 + v, 60 + v * 0.5]; });
  drawTile(6, 1, (i, j) => {
    const c = px2(Math.floor(i / 3), Math.floor(j / 3), 20) * 55;
    const v = px2(i, j, 21) * 15;
    return [95 + c + v, 95 + c + v, 97 + c + v];
  });
  drawTile(7, 1, (i, j) => oreTile(i, j, [35, 35, 38], 22));
  // Row 2
  drawTile(0, 2, (i, j) => oreTile(i, j, [190, 145, 105], 23));
  drawTile(1, 2, (i, j) => oreTile(i, j, [222, 178, 45], 24));
  drawTile(2, 2, (i, j) => oreTile(i, j, [85, 225, 225], 25));
  drawTile(3, 2, (i, j) => {
    const board = (j % 4 === 0) ? -30 : 0;
    const v = px2(i, Math.floor(j / 4), 26) * 16;
    return [170 + board + v, 136 + board + v, 82 + board * 0.5 + v];
  });
  drawTile(4, 2, (i, j) => {
    const c = px2(Math.floor(i / 4), Math.floor(j / 4), 27) * 45;
    const crackLine = (px2(i, j, 28) > 0.93) ? -35 : 0;
    return [105 + c + crackLine, 105 + c + crackLine, 108 + c + crackLine];
  });
  drawTile(5, 2, (i, j) => {
    const band = (j % 5 === 0) ? -14 : 0;
    const v = px2(i, j, 29) * 12;
    return [206 + band + v * 0.5, 192 + band + v * 0.5, 142 + band + v];
  });
  drawTile(6, 2, (i, j) => {
    const c = px2(Math.floor(i / 2), Math.floor(j / 2), 30) * 50;
    return [38 + c, 38 + c, 42 + c];
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
