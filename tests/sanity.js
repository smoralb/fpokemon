// Validación de coherencia de datos (ejecutar con: node tests/sanity.js)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({ console, Math, window: {} });
for (const f of ['data.js', 'maps.js', 'horror.js']) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}

const { SPECIES, MOVES, SPRITE_PIX, MAPS, ITEMS, VISION_SPRITE, VISION_NAMES, RANDOM_ASSAULTS, SCRIPTED_ASSAULTS } = vm.runInContext(
  '({SPECIES, MOVES, SPRITE_PIX, MAPS, ITEMS, VISION_SPRITE, VISION_NAMES, RANDOM_ASSAULTS, SCRIPTED_ASSAULTS})', ctx);

let errors = 0;
const fail = msg => { console.error('FALLO: ' + msg); errors++; };

// Aprendizajes apuntan a movimientos existentes; cada especie tiene sprite y movimiento de nivel 1
for (const [k, sp] of Object.entries(SPECIES)) {
  if (!SPRITE_PIX[k]) fail(`especie ${k} sin sprite`);
  if (!sp.learn.some(([lv]) => lv === 1)) fail(`especie ${k} sin movimiento de nivel 1`);
  for (const [lv, mv] of sp.learn) if (!MOVES[mv]) fail(`especie ${k} aprende movimiento inexistente ${mv}`);
}

// Mapas: encuentros, warps y NPCs coherentes
for (const [mk, m] of Object.entries(MAPS)) {
  const g = m.grid;
  const w = g[0].length;
  for (let y = 0; y < g.length; y++) {
    if (g[y].length !== w) fail(`mapa ${mk} fila ${y}: ancho ${g[y].length} != ${w}`);
  }
  if (m.encounters) for (const [sp] of m.encounters.table) {
    if (!SPECIES[sp]) fail(`mapa ${mk}: encuentro con especie inexistente ${sp}`);
  }
  for (const [coord, wp] of Object.entries(m.warps)) {
    const [x, y] = coord.split(',').map(Number);
    const t = g[y] && g[y][x];
    if (t === undefined) fail(`mapa ${mk}: warp ${coord} fuera del mapa`);
    if (wp.to) {
      if (!MAPS[wp.to]) { fail(`mapa ${mk}: warp ${coord} hacia mapa inexistente ${wp.to}`); continue; }
      const dg = MAPS[wp.to].grid;
      const dt = dg[wp.y | 0] && dg[wp.y | 0][wp.x | 0];
      if (dt === undefined || 'TBDFWXLK'.includes(dt)) fail(`mapa ${mk}: warp ${coord} aterriza en tile no transitable '${dt}' de ${wp.to} (${wp.x},${wp.y})`);
      if (!'Dme'.includes(t)) fail(`mapa ${mk}: warp ${coord} sobre tile '${t}' (esperaba D, m o e)`);
    }
  }
  for (const n of m.npcs) {
    if (!SPRITE_PIX[n.sprite]) fail(`mapa ${mk}: NPC con sprite inexistente ${n.sprite}`);
    const t = g[n.y | 0] && g[n.y | 0][n.x | 0];
    if (t === undefined || 'TBDFWXLK'.includes(t)) fail(`mapa ${mk}: NPC ${n.sprite} sobre tile no transitable '${t}' en (${n.x},${n.y})`);
  }
}

// Terror: sprites de visiones y asaltos coherentes
for (const s of ['DEADRAT', 'CORPSE', 'PATIENT', 'DOCTOR']) {
  if (!SPRITE_PIX[s]) fail(`falta el sprite de terror ${s}`);
}
for (const [k, v] of Object.entries(VISION_SPRITE)) {
  if (!SPRITE_PIX[k]) fail(`VISION_SPRITE: origen ${k} sin sprite`);
  if (!SPRITE_PIX[v]) fail(`VISION_SPRITE: destino ${v} sin sprite`);
}
for (const mk of Object.keys(VISION_NAMES)) {
  if (!MAPS[mk]) fail(`VISION_NAMES: mapa inexistente ${mk}`);
}
for (const mk of Object.keys(MAPS)) {
  if (!VISION_NAMES[mk]) fail(`VISION_NAMES: falta el nombre real de ${mk}`);
}
for (const a of [...RANDOM_ASSAULTS, ...SCRIPTED_ASSAULTS]) {
  if (!SPRITE_PIX[a.sprite]) fail(`asalto con sprite inexistente ${a.sprite}`);
  if (a.opts.length !== 2 || a.replies.length !== 2) fail('asalto sin 2 opciones/respuestas');
}

// Fórmulas básicas
const mk2 = vm.runInContext('makeMon("PIKACHU", 5)', ctx);
if (mk2.maxhp <= 0 || !mk2.moves.length) fail('makeMon genera un PIKACHU inválido');
const dmg = vm.runInContext(
  'calcDamage(makeMon("PIKACHU",5), makeMon("PIDGEY",3), "THUNDERSHOCK", {atk:0,def:0,spe:0,acc:0}, {atk:0,def:0,spe:0,acc:0})', ctx);
if (!(dmg.dmg > 0)) fail('calcDamage devuelve daño no positivo');
if (dmg.eff !== 2) fail(`IMPACTRUENO contra PIDGEY debería ser x2, fue x${dmg.eff}`);

if (errors) { console.error(errors + ' fallos'); process.exit(1); }
console.log('OK: datos y mapas coherentes.');
