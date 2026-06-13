// Motor raycasting estilo Game Boy: 160x144, 4 tonos, texturas procedurales.

const SCR_W = 160, SCR_H = 144;
// El 3D se renderiza a 160x144 y se escala; la interfaz se dibuja nítida a x3.
const UI_SCALE = 3;

const Engine = {
  canvas: null, ctx: null, img: null, buf: null, // buf: índices de paleta
  off: null, offCtx: null,
  pal32: new Uint32Array(4),
  zbuf: new Float32Array(SCR_W),
  time: 0,
  vision: false,  // true durante una visión de la "realidad"
  glitchT: 0,     // segundos restantes de distorsión de líneas

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.off = document.createElement('canvas');
    this.off.width = SCR_W; this.off.height = SCR_H;
    this.offCtx = this.off.getContext('2d');
    this.img = this.offCtx.createImageData(SCR_W, SCR_H);
    this.buf = new Uint8Array(SCR_W * SCR_H);
    this.computePal32();
    genTextures();
  },

  computePal32() {
    for (let i = 0; i < 4; i++) {
      const c = PAL[i];
      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      this.pal32[i] = (255 << 24) | (b << 16) | (g << 8) | r; // little-endian ABGR
    }
  },

  // Vuelca el buffer de índices al canvas, escalado con píxeles nítidos.
  flush() {
    const d = new Uint32Array(this.img.data.buffer);
    for (let i = 0; i < this.buf.length; i++) d[i] = this.pal32[this.buf[i]];
    this.offCtx.putImageData(this.img, 0, 0);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.off, 0, 0, SCR_W * UI_SCALE, SCR_H * UI_SCALE);
    // Glitch: franjas horizontales desplazadas al azar
    if (this.glitchT > 0) {
      for (let i = 0; i < 7; i++) {
        const y = rnd(SCR_H - 5), h = 1 + rnd(4), dx = rnd(17) - 8;
        this.ctx.drawImage(this.off, 0, y, SCR_W, h,
          dx * UI_SCALE, y * UI_SCALE, SCR_W * UI_SCALE, h * UI_SCALE);
      }
    }
  },

  shadeFor(dist) { return dist > 8 ? 2 : dist > 4 ? 1 : 0; },

  render(mapKey, px, py, ang, npcs) {
    const map = MAPS[mapKey];
    const buf = this.buf;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const planeX = -Math.sin(ang) * 0.66, planeY = Math.cos(ang) * 0.66;
    const H2 = SCR_H >> 1;

    // Cielo / techo
    for (let y = 0; y < H2; y++) {
      let c;
      if (map.outdoor) {
        c = y > H2 - 10 ? 1 : 0;
        buf.fill(c, y * SCR_W, (y + 1) * SCR_W);
      } else {
        // Techo interior: liso con puntos dispersos (gotelé) para notar relieve
        for (let x = 0; x < SCR_W; x++) {
          const h = (x * 31 + y * 71 + x * y * 13) & 255;
          c = h < 6 ? 1 : h === 200 ? 2 : 0;
          buf[y * SCR_W + x] = c;
        }
      }
    }

    // Suelo (floorcasting)
    const rd0x = dirX - planeX, rd0y = dirY - planeY;
    const rd1x = dirX + planeX, rd1y = dirY + planeY;
    for (let y = H2 + 1; y < SCR_H; y++) {
      const rowDist = (0.5 * SCR_H) / (y - H2);
      const stepX = rowDist * (rd1x - rd0x) / SCR_W;
      const stepY = rowDist * (rd1y - rd0y) / SCR_W;
      let fx = px + rowDist * rd0x;
      let fy = py + rowDist * rd0y;
      const shade = this.shadeFor(rowDist);
      const row = y * SCR_W;
      const FT = this.vision ? FLOOR_TEX_H : FLOOR_TEX;
      for (let x = 0; x < SCR_W; x++) {
        const cx = fx | 0, cy = fy | 0;
        const t = tileAt(mapKey, cx, cy);
        const tex = FT[t] || FT['.'];
        const tx = ((fx - cx) * 16) | 0, ty = ((fy - cy) * 16) | 0;
        let c = tex[ty * 16 + tx] + shade;
        buf[row + x] = c > 3 ? 3 : c;
        fx += stepX; fy += stepY;
      }
    }

    // Muros (DDA)
    for (let x = 0; x < SCR_W; x++) {
      const camX = 2 * x / SCR_W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mapX = px | 0, mapY = py | 0;
      const dDX = Math.abs(1 / (rdx || 1e-9)), dDY = Math.abs(1 / (rdy || 1e-9));
      let stepX, stepY, sideX, sideY;
      if (rdx < 0) { stepX = -1; sideX = (px - mapX) * dDX; } else { stepX = 1; sideX = (mapX + 1 - px) * dDX; }
      if (rdy < 0) { stepY = -1; sideY = (py - mapY) * dDY; } else { stepY = 1; sideY = (mapY + 1 - py) * dDY; }
      let side = 0, tile = 'T', guard = 0;
      while (guard++ < 64) {
        if (sideX < sideY) { sideX += dDX; mapX += stepX; side = 0; }
        else { sideY += dDY; mapY += stepY; side = 1; }
        tile = tileAt(mapKey, mapX, mapY);
        if (isWallTile(tile)) break;
      }
      const dist = Math.max(0.05, side === 0 ? sideX - dDX : sideY - dDY);
      this.zbuf[x] = dist;
      const lineH = (SCR_H / dist) | 0;
      let y0 = H2 - (lineH >> 1), y1 = H2 + (lineH >> 1);
      const WT = this.vision ? WALL_TEX_H : WALL_TEX;
      const texArr = WT[tile] || WT['T'];
      let wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
      wallX -= wallX | 0;
      let texX = (wallX * 16) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 15 - texX;
      const shade = this.shadeFor(dist) + (side === 1 ? 1 : 0);
      const dy0 = Math.max(0, y0), dy1 = Math.min(SCR_H - 1, y1);
      const step = 16 / lineH;
      let texPos = (dy0 - y0) * step;
      for (let y = dy0; y <= dy1; y++) {
        const texY = Math.min(15, texPos | 0);
        texPos += step;
        let c = texArr[texY * 16 + texX] + shade;
        buf[y * SCR_W + x] = c > 3 ? 3 : c;
      }

      // Tejado a dos aguas por encima del muro de los edificios.
      // La altura varía con la posición a lo largo de la fachada (mundo),
      // formando cumbreras y aleros -> silueta diagonal continua.
      if (tile === 'B' && y0 > 0) {
        const fpos = side === 0 ? (py + dist * rdy) : (px + dist * rdx);
        const u = ((fpos % 2) + 2) % 2;        // 0..2 por cada "casa"
        const tri = 1 - Math.abs(u - 1);        // 1 en la cumbrera, 0 en el alero
        const roofH = Math.max(3, (lineH * (0.18 + 0.34 * tri)) | 0);
        const top = Math.max(0, y0 - roofH);
        const eave = Math.min(SCR_H - 1, y0 - 1);
        const sh = this.shadeFor(dist) + (side === 1 ? 1 : 0);
        for (let y = top; y <= eave; y++) {
          const ti = eave - y;                  // 0 alero, sube hacia la cumbrera
          let c;
          if (y === eave) c = 3;                // línea de alero
          else if (ti % 3 === 0) c = 3;         // junta entre hiladas de tejas
          else c = (ti % 3 === 1) ? 2 : 1;      // teja sombreada
          c += sh;
          buf[y * SCR_W + x] = c > 3 ? 3 : c;
        }
      }
    }

    // NPCs / carteles (billboards) ordenados de lejos a cerca
    const sorted = npcs.slice().sort((a, b) =>
      ((b.x - px) ** 2 + (b.y - py) ** 2) - ((a.x - px) ** 2 + (a.y - py) ** 2));
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const n of sorted) {
      const sx = n.x - px, sy = n.y - py;
      const trX = invDet * (dirY * sx - dirX * sy);
      const trY = invDet * (-planeY * sx + planeX * sy);
      if (trY < 0.2) continue;
      const screenX = ((SCR_W / 2) * (1 + trX / trY)) | 0;
      const wallH = (SCR_H / trY) | 0;
      const size = (wallH * 0.7) | 0;
      if (size < 2) continue;
      const bottom = H2 + (wallH >> 1);
      const y0 = bottom - size, x0 = screenX - (size >> 1);
      const pix = SPRITE_PIX[n.sprite];
      if (!pix) continue;
      const shade = this.shadeFor(trY);
      for (let xs = 0; xs < size; xs++) {
        const x = x0 + xs;
        if (x < 0 || x >= SCR_W || trY >= this.zbuf[x]) continue;
        const tx = (xs * 16 / size) | 0;
        for (let ys = 0; ys < size; ys++) {
          const y = y0 + ys;
          if (y < 0 || y >= SCR_H) continue;
          const ty = (ys * 16 / size) | 0;
          const v = pix[ty][tx];
          if (v < 0) continue;
          let c = v + shade;
          buf[y * SCR_W + x] = c > 3 ? 3 : c;
        }
      }
    }

    this.flush();
  },

  // Minimapa superpuesto (tras flush, con el contexto 2D).
  drawMinimap(mapKey, px, py, ang, npcs) {
    const map = MAPS[mapKey];
    const g = map.grid;
    const s = 4;
    const w = g[0].length * s, h = g.length * s;
    const ox = (SCR_W - w) >> 1, oy = (SCR_H - h) >> 1;
    const ctx = this.ctx;
    ctx.fillStyle = PAL[0];
    ctx.fillRect(ox - 3, oy - 3, w + 6, h + 6);
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
      const t = g[y][x];
      ctx.fillStyle = isWallTile(t) ? PAL[3] : t === ',' ? PAL[2] : t === 'e' || t === 'm' ? PAL[1] : PAL[0];
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
    for (const n of npcs) {
      ctx.fillStyle = PAL[2];
      ctx.fillRect(ox + n.x * s - 1, oy + n.y * s - 1, 2, 2);
    }
    // Jugador: punto + dirección
    ctx.fillStyle = PAL[3];
    ctx.fillRect(ox + px * s - 1.5, oy + py * s - 1.5, 3, 3);
    ctx.fillRect(ox + (px + Math.cos(ang) * 0.8) * s - 1, oy + (py + Math.sin(ang) * 0.8) * s - 1, 2, 2);
    ctx.fillStyle = PAL[3];
    ctx.font = '7px monospace';
    ctx.fillText(map.name, ox, oy - 5);
  },
};

// ---- Texturas procedurales 16x16 ----
const WALL_TEX = {};
const FLOOR_TEX = {};
// Variantes de la "realidad" (visiones)
const WALL_TEX_H = {};
const FLOOR_TEX_H = {};

// Cambia la paleta activa (juego <-> realidad) y regenera cachés de color.
function setPalette(p) {
  for (let i = 0; i < 4; i++) PAL[i] = p[i];
  if (Engine.buf) Engine.computePal32();
  for (const k in SPRITE_CANVAS) delete SPRITE_CANVAS[k];
}

function genTextures() {
  const mk = fn => {
    const t = new Uint8Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t[y * 16 + x] = fn(x, y);
    return t;
  };
  const hash = (x, y) => ((x * 73 + y * 149 + x * y * 31) % 23);

  // Árbol: follaje moteado con tronco abajo
  WALL_TEX['T'] = mk((x, y) => {
    if (y > 11 && x > 5 && x < 10) return x === 6 || x === 9 ? 3 : 2;
    const h = hash(x, y);
    return h < 6 ? 3 : h < 13 ? 2 : 1;
  });
  // Edificio: ladrillo claro (la pared entera; el tejado se dibuja aparte)
  WALL_TEX['B'] = mk((x, y) => {
    if (y % 4 === 0) return 2;
    const off = ((y / 4) | 0) % 2 ? 4 : 0;
    if ((x + off) % 8 === 0) return 2;
    return hash(x, y) < 2 ? 1 : 0;
  });
  // Puerta
  WALL_TEX['D'] = mk((x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return 3;
    if (x < 2 || x > 13 || y < 2) return 1;
    if (x === 11 && y === 8) return 0; // pomo
    return y > 13 ? 3 : 2;
  });
  // Valla
  WALL_TEX['F'] = mk((x, y) => {
    if (y === 4 || y === 10) return 3;
    if (x % 4 === 0) return 2;
    return y % 2 ? 1 : 0;
  });
  // Agua
  WALL_TEX['W'] = mk((x, y) => {
    const v = (x + y * 3) % 8;
    return v < 2 ? 0 : v < 3 ? 2 : 1;
  });
  // Pared interior
  WALL_TEX['X'] = mk((x, y) => (y < 2 || y > 13 ? 2 : hash(x, y) < 2 ? 1 : 0));
  // Estantería con libros
  WALL_TEX['L'] = mk((x, y) => {
    if (y % 5 === 0 || x === 0 || x === 15) return 3;
    return (x % 3 === 0) ? 2 : ((x + y) % 3 ? 1 : 2);
  });
  // Mostrador
  WALL_TEX['K'] = mk((x, y) => (y === 3 ? 3 : y < 3 ? 0 : hash(x, y) < 3 ? 2 : 1));

  // Suelos
  FLOOR_TEX['.'] = mk((x, y) => (hash(x, y) < 3 ? 0 : hash(x, y) > 19 ? 2 : 1));
  FLOOR_TEX['e'] = FLOOR_TEX['.'];
  FLOOR_TEX[','] = mk((x, y) => {
    const h = hash(x, y);
    return h < 5 ? 3 : h < 12 ? 2 : 1; // hierba alta oscura
  });
  FLOOR_TEX[':'] = mk((x, y) => {
    if ((x % 8 === 3 && y % 8 === 3) || (x % 8 === 6 && y % 8 === 6)) return 3;
    if ((x % 8 === 3 && y % 8 === 2) || (x % 8 === 2 && y % 8 === 3)) return 0;
    return hash(x, y) < 4 ? 0 : 1;
  });
  FLOOR_TEX['-'] = mk((x, y) => (((x >> 3) + (y >> 3)) % 2 ? 1 : 0));
  FLOOR_TEX['m'] = mk((x, y) => (x < 2 || x > 13 || y < 2 || y > 13 ? 2 : 1));

  // ---- La "realidad": muros que gotean, lodo, baldosas manchadas ----
  // Árboles -> tuberías y hormigón que gotea
  WALL_TEX_H['T'] = mk((x, y) => {
    if (x % 8 < 2) return x % 8 === 0 ? 3 : 2; // tuberías verticales
    if ((x * 13 + 7) % 16 === y % 16) return 3; // goteos
    return hash(x, y) < 4 ? 2 : 1;
  });
  // Edificios -> ladrillo manchado
  WALL_TEX_H['B'] = mk((x, y) => {
    if (y % 5 === 0) return 3;
    const off = ((y / 5) | 0) % 2 ? 4 : 0;
    if ((x + off) % 8 === 0) return 3;
    return hash(x, y) < 7 ? 2 : 1;
  });
  // Puerta -> puerta metálica oxidada con ventanilla
  WALL_TEX_H['D'] = mk((x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return 3;
    if (y >= 3 && y <= 6 && x >= 5 && x <= 10) return (y === 3 || y === 6 || x === 5 || x === 10) ? 3 : 0;
    return hash(x, y) < 5 ? 3 : 2;
  });
  // Valla -> barrotes
  WALL_TEX_H['F'] = mk((x, y) => (x % 3 === 0 ? 3 : y % 8 === 0 ? 3 : 2));
  // Agua -> aguas fecales
  WALL_TEX_H['W'] = mk((x, y) => {
    const v = (x + y * 3) % 9;
    return v < 1 ? 1 : v < 4 ? 3 : 2;
  });
  // Pared interior -> azulejos sucios con churretes
  WALL_TEX_H['X'] = mk((x, y) => {
    if ((x * 11 + 3) % 16 === (y + x) % 16) return 3;
    if (y > 12) return 2;
    return hash(x, y) < 4 ? 2 : hash(x, y) < 7 ? 1 : 0;
  });
  // Estantería -> frascos y expedientes
  WALL_TEX_H['L'] = mk((x, y) => {
    if (y % 5 === 0 || x === 0 || x === 15) return 3;
    if (x % 4 === 1 && y % 5 === 2) return 0; // brillos de frascos
    return x % 4 < 2 ? 2 : 3;
  });
  WALL_TEX_H['K'] = mk((x, y) => (y === 3 ? 3 : y < 3 ? 1 : hash(x, y) < 6 ? 3 : 2));

  // Suelos de la realidad
  FLOOR_TEX_H['.'] = mk((x, y) => (hash(x, y) < 3 ? 3 : hash(x, y) < 14 ? 2 : 1)); // hormigón húmedo
  FLOOR_TEX_H['e'] = FLOOR_TEX_H['.'];
  FLOOR_TEX_H[','] = mk((x, y) => (hash(x, y) < 9 ? 3 : 2)); // lodo
  FLOOR_TEX_H[':'] = mk((x, y) => {
    if ((x % 8 === 3 && y % 8 === 3) || (x % 8 === 6 && y % 8 === 6)) return 0; // restos brillantes
    return hash(x, y) < 8 ? 3 : 2;
  });
  FLOOR_TEX_H['-'] = mk((x, y) => {
    const base = ((x >> 3) + (y >> 3)) % 2 ? 2 : 1;
    return hash(x, y) < 3 ? 3 : base; // baldosas con manchas
  });
  FLOOR_TEX_H['m'] = mk((x, y) => (y % 4 < 2 ? 3 : 2)); // rejilla de desagüe
}

// ---- Sprites pre-renderizados a canvas (para UI/combate) ----
const SPRITE_CANVAS = {};
function spriteCanvas(key) {
  if (SPRITE_CANVAS[key]) return SPRITE_CANVAS[key];
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const cx = c.getContext('2d');
  const pix = SPRITE_PIX[key];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = pix[y][x];
    if (v < 0) continue;
    cx.fillStyle = PAL[v];
    cx.fillRect(x, y, 1, 1);
  }
  SPRITE_CANVAS[key] = c;
  return c;
}

function drawSprite(ctx, key, x, y, scale, flip) {
  const c = spriteCanvas(key);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(x + 16 * scale, y);
    ctx.scale(-scale, scale);
  } else {
    ctx.translate(x, y);
    ctx.scale(scale, scale);
  }
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
