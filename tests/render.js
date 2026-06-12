// Prueba de humo del renderizador (node tests/render.js)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const noop = () => {};
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (p in t) return t[p];
    return noop;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const sandbox = {
  console, Math,
  window: { addEventListener: noop },
  document: {
    getElementById: () => ({ width: 160, height: 144, getContext: () => ctxStub, addEventListener: noop }),
    createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub }),
  },
};
const ctx = vm.createContext(sandbox);
for (const f of ['audio.js', 'data.js', 'maps.js', 'engine.js', 'battle.js', 'horror.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

vm.runInContext(`
  const noop2 = () => {};
  globalThis.AudioFX = new Proxy({}, { get: () => noop2 });
  globalThis.Game = { party: [makeMon('PIKACHU', 8)], box: [], bag: { POKEBALL: 3, POTION: 1 }, money: 500, endBattle: noop2 };
  globalThis.uiText = noop2; globalThis.drawBox = noop2; globalThis.drawHPBar = noop2;

  Engine.init(document.getElementById('screen'));

  // Renderiza varios puntos de vista en cada mapa
  for (const mk of Object.keys(MAPS)) {
    const m = MAPS[mk];
    const npcs = m.npcs;
    for (let i = 0; i < 8; i++) {
      const x = 1.5 + Math.random() * (m.grid[0].length - 3);
      const y = 1.5 + Math.random() * (m.grid.length - 3);
      Engine.render(mk, x, y, Math.random() * Math.PI * 2, npcs);
    }
  }
  const tones = new Set(Engine.buf);
  if (tones.size < 3) throw new Error('imagen plana: solo ' + tones.size + ' tonos');
  for (const v of Engine.buf) if (v < 0 || v > 3) throw new Error('índice de paleta fuera de rango: ' + v);

  // Modo visión: paleta de la realidad + texturas alternativas + sprites cambiados
  setPalette(HORROR_PAL);
  Engine.vision = true;
  for (const mk of Object.keys(MAPS)) {
    const m = MAPS[mk];
    const npcs = m.npcs.map(n => ({ ...n, sprite: Horror.spriteFor(n.sprite) }));
    Engine.render(mk, 2.5, 2.5, 0.7, npcs);
  }
  if (Horror.spriteFor('PIKACHU') !== 'PIKACHU') throw new Error('spriteFor cambia sprites sin visión activa');
  Horror.vision = 5;
  if (Horror.spriteFor('PIKACHU') !== 'DEADRAT') throw new Error('PIKACHU debería verse como DEADRAT en visión');
  if (Horror.spriteFor('NURSE') !== 'DOCTOR') throw new Error('NURSE debería verse como DOCTOR en visión');
  Horror.vision = 0;
  Engine.vision = false;
  setPalette(BASE_PAL);

  // Pantalla de combate
  Battle.startWild(makeMon('PIDGEY', 4));
  const c2 = document.createElement('canvas').getContext('2d');
  Battle.draw(c2);
  Battle.key('confirm'); Battle.draw(c2);
  Battle.key('confirm'); Battle.draw(c2);

  console.log('OK: render del mundo y del combate sin errores (' + tones.size + ' tonos).');
`, ctx, { filename: 'render-body' });
