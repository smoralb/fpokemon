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

      // Tejado a cuatro aguas (hip roof) por encima del muro de los edificios.
      // Se "castea" el tejado: marchamos el rayo sobre la planta del edificio y
      // proyectamos la altura del faldón z = 0.5 + pitch*distAlBorde a pantalla,
      // pintando el faldón cercano con textura de teja hasta la cumbrera.
      if ((tile === 'B' || tile === 'D') && y0 > 0) {
        const info = getBuildings(mapKey)[mapX + ',' + mapY];
        if (info) {
          const EYE_TOP = 0.5, factor = SCR_H, STEP = 0.03, COURSES = 3; // hiladas por tile
          const tMax = dist + info.shortDim + 2 * ROOF_OVERHANG + 0.1;
          let prevY = y0;                         // arranque = alto del muro en pantalla
          let prevDb = Math.min(px + dist * rdx - info.ex0, info.ex1 - (px + dist * rdx),
                                py + dist * rdy - info.ey0, info.ey1 - (py + dist * rdy));
          let prevCourse = (prevDb * COURSES) | 0;
          for (let t = dist + STEP; t < tMax; t += STEP) {
            const wx = px + t * rdx, wy = py + t * rdy;
            const d = Math.min(wx - info.ex0, info.ex1 - wx, wy - info.ey0, info.ey1 - wy);
            if (d < 0) break;                     // salimos de la planta (con alero)
            if (d < prevDb - 1e-3) break;         // pasada la cumbrera -> solo faldón cercano
            const z = EYE_TOP + ROOF_PITCH * d;
            const curY = (H2 - z * factor / t) | 0;
            if (curY < prevY) {
              const sh = this.shadeFor(t);
              const course = (d * COURSES) | 0;
              const seamRow = course !== prevCourse;  // costura de hilada en este tramo
              const top = Math.max(0, curY);
              for (let y = top; y < prevY; y++) {
                let c;
                if (y === prevY - 1) c = 3;                       // alero / junta inferior
                else if (seamRow && y === top) c = 3;             // costura entre hiladas
                else if ((x + course * 2) % 6 === 0) c = 3;       // junta vertical escalonada
                else c = (course % 2 ? 1 : 2);                    // teja sombreada
                c += sh;
                buf[y * SCR_W + x] = c > 3 ? 3 : c;
              }
              prevY = curY;
              prevCourse = course;
            }
            prevDb = d;
          }
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
      const N = spriteDim(n.sprite);
      const shade = this.shadeFor(trY);
      for (let xs = 0; xs < size; xs++) {
        const x = x0 + xs;
        if (x < 0 || x >= SCR_W || trY >= this.zbuf[x]) continue;
        const tx = (xs * N / size) | 0;
        for (let ys = 0; ys < size; ys++) {
          const y = y0 + ys;
          if (y < 0 || y >= SCR_H) continue;
          const ty = (ys * N / size) | 0;
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
    ctx.font = '8px gbfont';
    ctx.fillText(map.name, ox, oy - 5);
  },
};

// Parámetros del tejado a cuatro aguas.
const ROOF_PITCH = 0.6;     // pendiente media (altura por tile de distancia al borde)
const ROOF_OVERHANG = 0.15; // alero: el tejado sobresale de la pared

// Detecta cada bloque rectangular de edificio (tiles 'B') y guarda, por tile,
// los bordes exteriores de la planta (extendidos por el alero). El tejado a cuatro
// aguas se deriva luego como z = z_alero + pitch * distancia_al_borde_más_cercano.
function getBuildings(mapKey) {
  const m = MAPS[mapKey];
  if (m._roof) return m._roof;
  const g = m.grid, H = g.length;
  const seen = {};
  const box = {};
  for (let y = 0; y < H; y++) {
    const row = g[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 'B' || seen[x + ',' + y]) continue;
      // flood fill 4-conexo del bloque
      const stack = [[x, y]], cells = [];
      seen[x + ',' + y] = true;
      let x0 = x, y0 = y, x1 = x, y1 = y;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
          // El bloque incluye las puertas ('D') para que tengan tejado encima.
          if (ny >= 0 && ny < H && nx >= 0 && nx < g[ny].length &&
              (g[ny][nx] === 'B' || g[ny][nx] === 'D') && !seen[k]) {
            seen[k] = true; stack.push([nx, ny]);
          }
        }
      }
      const wdt = x1 - x0 + 1, dpt = y1 - y0 + 1;
      const info = {
        // bordes exteriores de la planta, extendidos por el alero
        ex0: x0 - ROOF_OVERHANG, ey0: y0 - ROOF_OVERHANG,
        ex1: (x1 + 1) + ROOF_OVERHANG, ey1: (y1 + 1) + ROOF_OVERHANG,
        shortDim: Math.min(wdt, dpt),
      };
      for (const [cx, cy] of cells) box[cx + ',' + cy] = info;
    }
  }
  m._roof = box;
  return box;
}

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
  const N = spriteDim(key);
  c.width = N; c.height = N;
  const cx = c.getContext('2d');
  const pix = SPRITE_PIX[key];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = pix[y][x];
    if (v < 0) continue;
    cx.fillStyle = PAL[v];
    cx.fillRect(x, y, 1, 1);
  }
  SPRITE_CANVAS[key] = c;
  return c;
}

function spriteDim(key) {
  return (typeof SPRITE_DIM !== 'undefined' && SPRITE_DIM[key]) || 16;
}
// Dibuja un sprite centrado horizontalmente con una altura objetivo en px.
function drawSpriteCentered(ctx, key, desired, y) {
  const dim = spriteDim(key);
  drawSprite(ctx, key, (SCR_W - desired) / 2, y, desired / dim, false);
}

function drawSprite(ctx, key, x, y, scale, flip) {
  const c = spriteCanvas(key);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(x + spriteDim(key) * scale, y);
    ctx.scale(-scale, scale);
  } else {
    ctx.translate(x, y);
    ctx.scale(scale, scale);
  }
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
