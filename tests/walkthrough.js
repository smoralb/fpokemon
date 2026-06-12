// Recorrido completo de la historia con stubs de DOM (node tests/walkthrough.js)
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
const canvasStub = {
  width: 160, height: 144,
  getContext: () => ctxStub,
  addEventListener: noop,
  requestPointerLock: noop,
};
const handlers = {};
const store = {};
const sandbox = {
  console, Math,
  window: {
    addEventListener: (t, f) => { handlers[t] = handlers[t] || []; handlers[t].push(f); },
  },
  document: {
    getElementById: () => canvasStub,
    createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub }),
    pointerLockElement: null,
  },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  },
  performance: { now: () => 0 },
  requestAnimationFrame: noop,
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

for (const f of ['audio.js', 'data.js', 'maps.js', 'engine.js', 'battle.js', 'horror.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

const { Game: G, Battle: B, Horror: H, Engine: E } = vm.runInContext('({ Game, Battle, Horror, Engine })', ctx);
H.cooldown = 1e9; // sin sustos aleatorios durante el recorrido determinista
function press(key) {
  for (const f of handlers.keydown || []) f({ key, preventDefault: noop, repeat: false });
  for (const f of handlers.keyup || []) f({ key, preventDefault: noop });
}
function pressUntilWorld(label, max = 60) {
  for (let i = 0; i < max; i++) {
    if (G.state === 'world') return;
    if (G.state === 'battle') return fightToEnd(label);
    press('z');
  }
  throw new Error(label + ': nunca volvió a world (estado=' + G.state + ')');
}
function fightToEnd(label) {
  let guard = 0;
  while (G.state === 'battle' && B.active) {
    if (++guard > 3000) throw new Error(label + ': combate atascado');
    press('z');
  }
  pressUntilWorld(label + ' (post-combate)');
}
function goTo(map, x, y, ang) { G.map = map; G.x = x; G.y = y; G.ang = ang; G.bumpCooldown = 0; }
function expect(cond, msg) { if (!cond) throw new Error('FALLO: ' + msg + ' (estado=' + G.state + ', mapa=' + G.map + ')'); }

// --- Título → nueva partida ---
expect(G.state === 'title', 'empieza en título');
press('z');
pressUntilWorld('intro');
expect(G.map === 'home', 'empieza en casa');

// --- Salir de casa por la alfombra ---
goTo('home', 6.5, 7.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'pallet', 'la alfombra lleva a PUEBLO PALETA');

// --- Oak bloquea la salida norte sin Pikachu ---
goTo('pallet', 7.5, 0.5, -Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'pallet' && G.state === 'dialog', 'Oak bloquea la salida');
pressUntilWorld('aviso de Oak');

// --- Entrar al laboratorio por la puerta ---
goTo('pallet', 5.5, 8.4, -Math.PI / 2);
G.interact();
expect(G.map === 'lab', 'la puerta del laboratorio funciona');

// --- Hablar con Oak: recibir a Pikachu ---
goTo('lab', 7.5, 3.0, -Math.PI / 2);
G.interact();
pressUntilWorld('entrega de Pikachu');
expect(G.flags.hasPikachu && G.party.length === 1 && G.party[0].id === 'PIKACHU', 'recibiste a PIKACHU');
expect(G.bag.POKEBALL === 5, 'recibiste 5 POKÉ BALL');

// --- Intentar salir: el rival corta el paso (potenciamos a Pikachu para ganar seguro) ---
const pika = G.party[0];
pika.stats.atk = 250; pika.stats.spc = 250; pika.stats.spe = 250;
pika.maxhp = 200; pika.hp = 200;
goTo('lab', 7.5, 8.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.state === 'dialog', 'el rival te detiene al salir');
pressUntilWorld('combate contra AZUL');
expect(G.flags.rivalBeaten, 'venciste a AZUL');
expect(G.money > 3000, 'ganaste dinero del rival');

// --- Salir del laboratorio y del pueblo ---
goTo('lab', 7.5, 8.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'pallet', 'saliste del laboratorio');
goTo('pallet', 7.5, 0.5, -Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'route1', 'llegaste a la RUTA 1');

// --- Ruta 1 → Ciudad Verde ---
goTo('route1', 5.5, 0.5, -Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'viridian', 'llegaste a CIUDAD VERDE');

// --- Centro Pokémon: curar ---
G.party[0].hp = 1;
goTo('viridian', 4.5, 4.4, -Math.PI / 2);
G.interact();
expect(G.map === 'center', 'entraste al CENTRO POKéMON');
goTo('center', 8.5, 2.5, -Math.PI / 2);
G.interact();
pressUntilWorld('curación');
expect(G.party[0].hp === G.party[0].maxhp, 'la enfermera cura al equipo');
expect(G.respawn.map === 'center', 'el respawn quedó en el centro');
goTo('center', 7.5, 6.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'viridian', 'saliste del centro');

// --- Tienda: paquete de Oak + compra ---
goTo('viridian', 13.5, 4.4, -Math.PI / 2);
G.interact();
expect(G.map === 'mart', 'entraste a la TIENDA');
goTo('mart', 4.5, 3.5, -Math.PI / 2);
G.interact();
let guard = 0;
while (G.state === 'dialog') { press('z'); if (++guard > 60) throw new Error('diálogo del dependiente atascado'); }
expect(G.state === 'shop', 'se abre la tienda tras el diálogo');
expect(G.bag.PARCEL === 1, 'recibiste el PAQUETE OAK');
const moneyBefore = G.money;
press('z'); // comprar POKÉ BALL
expect(G.money === moneyBefore - 200 && G.bag.POKEBALL === 6, 'compra de POKÉ BALL');
press('x'); // salir de la tienda
expect(G.state === 'world', 'saliste del menú de tienda');
goTo('mart', 7.5, 6.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'viridian', 'saliste de la tienda');

// --- Volver con Oak y entregar el paquete ---
goTo('viridian', 5.5, 13.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'route1', 'vuelves a la RUTA 1');
goTo('route1', 5.5, 23.5, Math.PI / 2);
G.checkFloorWarp();
expect(G.map === 'pallet', 'vuelves a PUEBLO PALETA');
goTo('pallet', 5.5, 8.4, -Math.PI / 2);
G.interact();
expect(G.map === 'lab', 'vuelves al laboratorio');
goTo('lab', 7.5, 3.0, -Math.PI / 2);
G.interact();
pressUntilWorld('entrega del paquete');
expect(G.flags.parcelDelivered, '¡PAQUETE entregado: demo completada!');
expect(G.bag.PARCEL === 0, 'el paquete sale de la mochila');

// --- Atravesar puertas y alfombras ANDANDO (incluso desalineado) ---
function walkForward(label, maxFrames = 400) {
  const from = G.map;
  G.keys = { w: true };
  for (let i = 0; i < maxFrames && G.map === from && G.state === 'world'; i++) G.update(1 / 60);
  G.keys = {};
  expect(G.map !== from, label + ': no cruzó (sigue en ' + from + ')');
}
goTo('pallet', 3.7, 4.6, -Math.PI / 2);   // puerta de casa, desalineado a la derecha
walkForward('puerta de casa andando');
expect(G.map === 'home', 'andando entras en casa');
goTo('home', 6.15, 6.0, Math.PI / 2);     // alfombra de salida, desalineado a la izquierda
walkForward('alfombra de casa andando');
expect(G.map === 'pallet', 'andando sales de casa');
goTo('pallet', 5.3, 8.6, -Math.PI / 2);   // puerta del laboratorio, desalineado
walkForward('puerta del laboratorio andando');
expect(G.map === 'lab', 'andando entras al laboratorio');
goTo('lab', 7.8, 7.2, Math.PI / 2);       // alfombra del laboratorio, desalineado
walkForward('alfombra del laboratorio andando');
expect(G.map === 'pallet', 'andando sales del laboratorio');

// --- Encuentro salvaje en hierba alta ---
goTo('route1', 2.5, 2.5, 0);
let found = false;
for (let i = 0; i < 4000 && !found; i++) {
  G.checkEncounter(0.05);
  if (G.state === 'battle') { found = true; fightToEnd('encuentro salvaje'); }
}
expect(found, 'hay encuentros en la hierba alta');

// --- Asalto de terror: aparición, pregunta con opciones y desaparición ---
goTo('route1', 5.5, 12.5, -Math.PI / 2);
H.assault();
expect(G.state === 'dialog' && H.npc, 'el asalto abre diálogo con figura');
expect(E.vision, 'el asalto activa la visión de la realidad');
guard = 0;
while (G.state === 'dialog') { press('z'); if (++guard > 30) throw new Error('asalto atascado'); }
expect(G.state === 'choice', 'el asalto hace una pregunta con opciones');
press('s'); // bajar opción
press('z'); // responder
guard = 0;
while (G.state === 'dialog') { press('z'); if (++guard > 30) throw new Error('respuesta del asalto atascada'); }
expect(G.state === 'world' && !H.npc, 'la figura desaparece tras responder');
expect(!E.vision && H.vision === 0, 'la visión termina tras el asalto');

// --- Acariciar al POKéMON (ambas variantes posibles) ---
for (let i = 0; i < 10; i++) {
  H.pet(G.party[0]);
  expect(G.state === 'dialog', 'acariciar abre diálogo');
  pressUntilWorld('acariciar #' + i);
}
H.endVision();

// --- Guardar y cargar ---
expect(G.save(), 'guardar funciona');
const savedMoney = G.money;
G.money = 0;
expect(G.load() && G.money === savedMoney, 'cargar restaura la partida');

console.log('OK: historia completa jugable de principio a fin.');
