// Simulación headless de combates (node tests/battle-sim.js)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({ console, Math });
for (const f of ['data.js', 'battle.js', 'horror.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

vm.runInContext(`
  // Stubs del entorno
  const noop = () => {};
  globalThis.AudioFX = new Proxy({}, { get: () => noop });
  globalThis.Game = {
    party: [], box: [], bag: { POKEBALL: 5, POTION: 3, PARCEL: 0 }, money: 1000,
    lastOutcome: null,
    endBattle(o) { this.lastOutcome = o; },
  };

  function runBattle(policy, label) {
    Game.party = [makeMon('PIKACHU', 6), makeMon('PIDGEY', 4)];
    Game.bag = { POKEBALL: 5, POTION: 3, PARCEL: 0 };
    Game.lastOutcome = null;
    if (Math.random() < 0.5) Battle.startWild(makeMon('RATTATA', 3 + Math.floor(Math.random() * 3)));
    else Battle.startTrainer('AZUL', [makeMon('EEVEE', 5), makeMon('MANKEY', 4)], 280, null);
    let guard = 0;
    while (Battle.active) {
      if (++guard > 5000) throw new Error(label + ': combate atascado (texto=' + JSON.stringify(Battle.text) + ', menu=' + Battle.menu + ')');
      if (Battle.text !== null) Battle.key('confirm');
      else if (Battle.menu) Battle.key(policy());
      else throw new Error(label + ': sin texto ni menú pero activo');
    }
    if (!Game.lastOutcome) throw new Error(label + ': terminó sin resultado');
    return Game.lastOutcome;
  }

  // 1) Determinista: siempre LUCHA + primer movimiento
  for (let i = 0; i < 60; i++) {
    const o = runBattle(() => 'confirm', 'determinista#' + i);
    if (!['win', 'lose', 'catch', 'run'].includes(o)) throw new Error('resultado raro: ' + o);
  }

  // 2) Aleatorio: teclas al azar
  const keys = ['up', 'down', 'left', 'right', 'confirm', 'cancel'];
  for (let i = 0; i < 300; i++) {
    runBattle(() => keys[Math.floor(Math.random() * keys.length)], 'aleatorio#' + i);
  }

  console.log('OK: 360 combates simulados sin errores.');
`, ctx, { filename: 'battle-sim-body' });
