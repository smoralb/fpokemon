// Lógica principal: estados, movimiento, interacción, menús y guiones.

// ---- Helpers de UI (usados también por battle.js) ----
// La interfaz se dibuja en coordenadas 160x144 pero con el contexto escalado
// x3, de modo que el texto se rasteriza nítido a tamaño real.
function uiBegin(ctx) { ctx.setTransform(UI_SCALE, 0, 0, UI_SCALE, 0, 0); }
function uiEnd(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); }

function uiText(ctx, s, x, y) {
  ctx.fillStyle = PAL[3];
  ctx.font = '7px monospace';
  ctx.fillText(s, x, y);
}
function drawBox(ctx, x, y, w, h) {
  ctx.fillStyle = PAL[0];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL[3];
  ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
}
function drawHPBar(ctx, x, y, w, hp, max) {
  ctx.fillStyle = PAL[3];
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = PAL[0];
  ctx.fillRect(x, y, w, 3);
  const r = Math.max(0, hp / max);
  ctx.fillStyle = r > 0.2 ? PAL[2] : PAL[3];
  if (hp > 0) ctx.fillRect(x, y, Math.max(1, w * r), 3);
}

const NAMING_INTRO_PAGES = [
  ['Este mundo está lleno', 'de criaturas.'],
  ['Las llamamos POKéMON.', '¿O eso recuerdas?'],
  ['Algunos saben vivir', 'junto a ellas.'],
  ['Otros...', 'no pueden.'],
  ['Yo soy el PROF. OAK.', ''],
  ['Antes de comenzar,', '¿cuál es tu nombre?'],
];
const NAMING_PRESETS = ['ROJO', 'AZUL', 'GARY', 'VERA', '...'];
const NAMING_GRID = [
  ['A','B','C','D','E','F','G','H','I'],
  ['J','K','L','M','N','O','P','Q','R'],
  ['S','T','U','V','W','X','Y','Z','-'],
  ['DEL','','','','','','','','FIN'],
];

const Game = {
  state: 'title',
  map: 'home', x: 4.5, y: 2.8, ang: Math.PI / 2,
  party: [], box: [], bag: { POKEBALL: 0, POTION: 0, PARCEL: 0 }, money: 3000,
  flags: {},
  respawn: { map: 'home', x: 4.5, y: 2.8, ang: Math.PI / 2 },
  dialog: null,
  menuSel: 0, partySel: 0, bagSel: 0, shopSel: 0, titleSel: 0,
  keys: {},
  bumpCooldown: 0,
  time: 0,
  _crimeTimer: 0,
  _crimeRevealTimer: 0,
  playerName: 'ROJO',
  namingIntroIdx: 0,
  namingSel: 0,
  namingCx: 0, namingCy: 0,
  namingText: '',

  visibleNpcs() {
    const list = MAPS[this.map].npcs.filter(n => !n.cond || n.cond(this.flags));
    if (typeof Horror !== 'undefined' && Horror.npc) list.push(Horror.npc);
    return list;
  },

  say(lines, cb) {
    const pages = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
    this.dialog = { pages, idx: 0, cb: cb || null };
    this.state = 'dialog';
  },

  // Pregunta con opciones (usada por los asaltos).
  choose(prompt, opts, cb) {
    this.choice = { prompt, opts, sel: 0, cb };
    this.state = 'choice';
  },

  startNaming() {
    this.namingIntroIdx = 0;
    this.namingSel = 0;
    this.namingText = '';
    this.namingCx = 0; this.namingCy = 0;
    this.state = 'naming_intro';
  },

  _finishNaming() {
    let name = this.namingText.trim() || NAMING_PRESETS[this.namingSel] || 'ROJO';
    if (name === '...') name = 'ROJO';
    this.playerName = name.slice(0, 7).toUpperCase();
    this.newGame();
  },

  newGame() {
    this.party = []; this.box = [];
    this.bag = { POKEBALL: 0, POTION: 0, SUPERPOT: 0, PARCEL: 0, BADGE1: 0, BADGE2: 0 };
    this.money = 3000; this.flags = {};
    this.map = 'home'; this.x = 7.5; this.y = 4.5; this.ang = Math.PI / 2;
    this.respawn = { map: 'home', x: 7.5, y: 4.5, ang: Math.PI / 2 };
    this.state = 'world';
    Music.playForMap(this.map);
    const name = this.playerName || 'ROJO';
    this.say(['¡' + name + '! Ya estás despierto.',
      'El PROF. OAK te estaba buscando.',
      'Está en su LABORATORIO,',
      'al sur del pueblo.',
      '(Las paredes vuelven a ser',
      'verdes. Eso es bueno.)']);
  },

  save() {
    const d = {
      map: this.map, x: this.x, y: this.y, ang: this.ang,
      party: this.party, box: this.box, bag: this.bag,
      money: this.money, flags: this.flags, respawn: this.respawn,
    };
    try { localStorage.setItem('fpokemon_save', JSON.stringify(d)); return true; }
    catch (e) { return false; }
  },

  load() {
    try {
      const d = JSON.parse(localStorage.getItem('fpokemon_save'));
      if (!d) return false;
      Object.assign(this, {
        map: d.map, x: d.x, y: d.y, ang: d.ang,
        party: d.party, box: d.box || [], bag: d.bag,
        money: d.money, flags: d.flags, respawn: d.respawn,
      });
      this.state = 'world';
      Music.playForMap(this.map);
      return true;
    } catch (e) { return false; }
  },

  // ---- Movimiento ----
  _prevState: null,
  update(dt) {
    // Gestión de música al salir de combate
    if (this._prevState === 'battle' && this.state !== 'battle') {
      Music.playForMap(this.map);
    }
    this._prevState = this.state;
    // Crime house reveal timers (run regardless of state)
    if (this._crimeTimer > 0) {
      this._crimeTimer -= dt;
      if (this._crimeTimer <= 0) { this._crimeTimer = 0; Engine.glitchT = 1.8; }
    }
    if (this._crimeRevealTimer > 0) {
      this._crimeRevealTimer -= dt;
      if (this._crimeRevealTimer <= 0) {
        this._crimeRevealTimer = 0;
        Horror.endVision();
        this.flags.crimeHouseRevealed = true;
      }
    }
    if (this.state !== 'world') return;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    const k = this.keys;
    const turn = (k['a'] || k['arrowleft'] ? -1 : 0) + (k['d'] || k['arrowright'] ? 1 : 0);
    this.ang += turn * 2.6 * dt;
    let mx = 0, my = 0;
    const fwd = (k['w'] || k['arrowup'] ? 1 : 0) + (k['s'] || k['arrowdown'] ? -1 : 0);
    const str = (k['e'] ? 1 : 0) + (k['q'] ? -1 : 0);
    if (fwd) { mx += Math.cos(this.ang) * fwd; my += Math.sin(this.ang) * fwd; }
    if (str) { mx += -Math.sin(this.ang) * str; my += Math.cos(this.ang) * str; }
    const len = Math.hypot(mx, my);
    if (len > 0.001) {
      const spd = 2.3 * dt / len;
      const stepX = mx * spd, stepY = my * spd;
      const ox = this.x, oy = this.y;
      this.tryMove(stepX, 0);
      this.tryMove(0, stepY);
      let moved = Math.hypot(this.x - ox, this.y - oy);
      // Asistencia de paso: si avanzas de frente y estás casi bloqueado,
      // pero el tile justo delante es transitable (hueco/alfombra) o una
      // puerta, te alinea o la cruza.
      if (fwd > 0 && moved < 2.3 * dt * 0.35) {
        const fx = this.x + Math.cos(this.ang) * 0.8;
        const fy = this.y + Math.sin(this.ang) * 0.8;
        const tx = fx | 0, ty = fy | 0;
        const t = tileAt(this.map, tx, ty);
        if (t === 'D' && this.bumpCooldown <= 0) {
          this.bumpCooldown = 0.6;
          this.useDoor(tx, ty);
        } else if (!isWallTile(t)) {
          const horiz = Math.abs(Math.cos(this.ang)) > Math.abs(Math.sin(this.ang));
          if (horiz) {
            const dy2 = ty + 0.5 - this.y;
            this.tryMove(0, Math.sign(dy2) * Math.min(Math.abs(dy2), 2.3 * dt));
          } else {
            const dx2 = tx + 0.5 - this.x;
            this.tryMove(Math.sign(dx2) * Math.min(Math.abs(dx2), 2.3 * dt), 0);
          }
          moved = Math.hypot(this.x - ox, this.y - oy);
        }
      }
      this.checkFloorWarp();
      this.checkEncounter(Math.min(moved, 0.1));
    }
  },

  blockedAt(x, y) {
    const r = 0.22;
    for (const dx of [-r, r]) for (const dy of [-r, r]) {
      const t = tileAt(this.map, (x + dx) | 0, (y + dy) | 0);
      if (isWallTile(t)) return { wall: t, tx: (x + dx) | 0, ty: (y + dy) | 0 };
    }
    for (const n of this.visibleNpcs()) {
      const rr = n.r || 0.5;
      if ((n.x - x) ** 2 + (n.y - y) ** 2 < rr * rr) return { npc: n };
    }
    return null;
  },

  tryMove(dx, dy) {
    const nx = this.x + dx, ny = this.y + dy;
    const b = this.blockedAt(nx, ny);
    if (!b) { this.x = nx; this.y = ny; return; }
    if (b.wall === 'D' && this.bumpCooldown <= 0) {
      this.bumpCooldown = 0.6;
      this.useDoor(b.tx, b.ty);
    }
  },

  useDoor(tx, ty) {
    const w = MAPS[this.map].warps[tx + ',' + ty];
    if (!w) return;
    if (w.locked) { this.say([w.locked]); return; }
    AudioFX.confirm();
    this.warpTo(w);
  },

  warpTo(w) {
    const from = this.map;
    this.map = w.to; this.x = w.x; this.y = w.y;
    if (w.ang !== undefined) this.ang = w.ang;
    this.bumpCooldown = 0.4;
    if (from !== this.map) this._onMapEnter(this.map);
  },

  _onMapEnter(map) {
    Music.playForMap(map);
    if (map === 'crimehouse' && !this.flags.crimeHouseVisited) {
      this.flags.crimeHouseVisited = true;
      this._crimeTimer = 4.5;
      this._crimeRevealTimer = 5.5;
      Horror.startVision(5.5);
      AudioFX.droneStart();
    }
    if (map === 'cerulean' && !this.flags.arrivedCerulean) {
      this.flags.approachingCerulean = true;
    }
    if (map === 'sewers_a' || map === 'sewers_b' || map === 'sewers_exit') {
      Horror.startVision(9999);
      this.flags.inSewers = true;
    }
  },

  checkFloorWarp() {
    const tx = this.x | 0, ty = this.y | 0;
    const t = tileAt(this.map, tx, ty);
    if (t !== 'm' && t !== 'e') return;
    // Oak no te deja salir del pueblo sin POKéMON
    if (this.map === 'pallet' && t === 'e' && !this.flags.hasPikachu) {
      this.y += 0.8;
      AudioFX.bump();
      SCRIPTS.oakBlock();
      return;
    }
    // El rival te corta el paso al salir del laboratorio
    if (this.map === 'lab' && t === 'm' && this.flags.hasPikachu && !this.flags.rivalBeaten) {
      this.y -= 0.8;
      SCRIPTS.rivalStop();
      return;
    }
    if (this.bumpCooldown <= 0) {
      const w = MAPS[this.map].warps[tx + ',' + ty];
      if (w && w.to) { AudioFX.blip(); this.warpTo(w); }
    }
  },

  checkEncounter(dist) {
    const enc = MAPS[this.map].encounters;
    if (!enc || !this.party.some(m => m.hp > 0)) return;
    const t = tileAt(this.map, this.x | 0, this.y | 0);
    if (t !== ',') return;
    if (Math.random() < dist * 0.13) {
      const total = enc.table.reduce((a, e) => a + e[1], 0);
      let r = Math.random() * total, pick = enc.table[0][0];
      for (const [sp, wgt] of enc.table) { r -= wgt; if (r <= 0) { pick = sp; break; } }
      const lv = enc.lv[0] + rnd(enc.lv[1] - enc.lv[0] + 1);
      const mon = makeMon(pick, lv);
      AudioFX.cry(pick);
      this.state = 'battle';
      Battle.startWild(mon);
    }
  },

  // ---- Interacción ----
  interact() {
    // NPC delante
    let best = null, bestD = 1.5;
    for (const n of this.visibleNpcs()) {
      const dx = n.x - this.x, dy = n.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        const dot = (dx * Math.cos(this.ang) + dy * Math.sin(this.ang)) / (d || 1);
        if (dot > 0.55) { best = n; bestD = d; }
      }
    }
    if (best) {
      AudioFX.blip();
      if (best.script) SCRIPTS[best.script]();
      else if (best.lines) this.say(Horror.twist(best));
      return;
    }
    // Puerta delante
    for (const dd of [0.7, 1.2]) {
      const tx = (this.x + Math.cos(this.ang) * dd) | 0;
      const ty = (this.y + Math.sin(this.ang) * dd) | 0;
      if (tileAt(this.map, tx, ty) === 'D') { this.useDoor(tx, ty); return; }
    }
  },

  endBattle(outcome) {
    this.state = 'world';
    if (outcome === 'win' && Battle.onWin) { const f = Battle.onWin; Battle.onWin = null; f(); }
    if (outcome === 'lose') {
      for (const m of this.party) {
        m.hp = m.maxhp; m.status = null;
        for (const mv of m.moves) mv.pp = mv.maxpp;
      }
      this.money = Math.floor(this.money / 2);
      this.map = this.respawn.map; this.x = this.respawn.x; this.y = this.respawn.y; this.ang = this.respawn.ang;
      this.say(['Corriste a un lugar seguro...',
        'Tus POKéMON fueron curados.']);
    }
  },

  healParty() {
    for (const m of this.party) {
      m.hp = m.maxhp; m.status = null;
      for (const mv of m.moves) mv.pp = mv.maxpp;
    }
  },
};

// ---- Guiones de NPCs ----
const SCRIPTS = {
  oakBlock() {
    Game.say(['¡OAK: Espera! ¡No vayas a la',
      'hierba alta sin un POKéMON!',
      '¡Es muy peligroso!',
      'Ven a mi LABORATORIO,',
      'el edificio grande del pueblo.']);
  },

  oakLab() {
    const f = Game.flags;
    if (!f.hasPikachu) {
      Game.say(['OAK: ¡Hola, ROJO!',
        'Hace poco atrapé un POKéMON',
        'muy especial...',
        'Es un poco arisco, pero sé',
        'que os llevaréis bien.',
        '¡ROJO recibió un PIKACHU!'], () => {
        const pika = makeMon('PIKACHU', 5);
        Game.party.push(pika);
        Game.bag.POKEBALL += 5;
        Game.bag.POTION += 1;
        f.hasPikachu = true;
        AudioFX.cry('PIKACHU');
        AudioFX.heal();
        Game.say(['¡PIKACHU! ¡Pika, pika!',
          'OAK: Toma también 5 POKÉ BALL',
          'y una POCIÓN.',
          'PIKACHU odia su POKÉ BALL,',
          'así que irá contigo a tu lado.',
          'Tu rival AZUL quiere ponerte',
          'a prueba antes de que salgas...']);
      });
    } else if (f.hasPikachu && !f.rivalBeaten) {
      Game.say(['OAK: AZUL te está esperando.',
        '¡Demuéstrale lo que sabéis',
        'PIKACHU y tú!']);
    } else if (Game.bag.PARCEL > 0 && !f.parcelDelivered) {
      Game.say(['OAK: ¡Anda! ¿Eso es para mí?',
        '¡Mi PAQUETE personalizado de la',
        'TIENDA de CIUDAD VERDE!',
        '¡Muchísimas gracias, ROJO!'], () => {
        Game.bag.PARCEL = 0;
        Game.flags.parcelDelivered = true;
        Game.bag.POKEBALL += 5;
        AudioFX.victory();
        Game.say(['OAK: Toma 5 POKÉ BALL como',
          'agradecimiento.',
          '¡Sal ahí fuera, entrena a tu',
          'PIKACHU y captura POKéMON!',
          'Tu siguiente objetivo:',
          'CIUDAD PLATEADA, al norte.',
          'Cruza el BOSQUE VERDE.'], () => {
          // La ilusión se agrieta un momento.
          Horror.startVision(9);
          AudioFX.sting();
          Game.say(['DR. OAK: ...sigue igual.',
            'Hoy ha vuelto a entregarme',
            'una caja vacía.',
            'Sonreía mucho al hacerlo.',
            'Anota: mañana repetimos la',
            'prueba del paquete.',
            '(La habitación huele a lejía.)'], () => Horror.endVision());
        });
      });
    } else if (f.parcelDelivered) {
      Game.say(['OAK: ¿Qué tal tu PIKACHU?',
        'Recuerda: CIUDAD PLATEADA',
        'está al norte, tras el BOSQUE VERDE.',
        'BROCK, el líder del GIMNASIO,',
        'te espera allí.']);
    } else {
      Game.say(['OAK: Casi lo olvido...',
        'Pedí un PAQUETE en la TIENDA',
        'de CIUDAD VERDE, al norte.',
        '¿Me lo traes? La RUTA 1 te',
        'servirá de entrenamiento.']);
    }
  },

  _rivalBattle() {
    Game.state = 'battle';
    Battle.startTrainer('AZUL', [makeMon('EEVEE', 5)], 280, () => {
      Game.flags.rivalBeaten = true;
      Game.say(['AZUL: ¡Bah! Solo ha sido',
        'suerte. ¡Sigue así y verás!',
        'OAK: Je, je... AZUL siempre',
        'ha sido un mal perdedor.']);
    });
  },

  rival() {
    Game.say(['AZUL: ¡Eh, ROJO! Mi EEVEE es',
      'mil veces mejor que esa rata',
      'eléctrica. ¡Te lo demuestro!'], () => SCRIPTS._rivalBattle());
  },

  rivalStop() {
    Game.say(['AZUL: ¡Alto ahí, ROJO!',
      '¿Creías que ibas a irte sin',
      'luchar? ¡EEVEE, a por ellos!'], () => SCRIPTS._rivalBattle());
  },

  homeTV() {
    const v = (Game.flags.tvVisits || 0);
    Game.flags.tvVisits = v + 1;
    const lines = [
      ['Una televisión apagada.',
        'Refleja algo raro', 'cuando te acercas.'],
      ['Juras que antes',
        'no estaba enchufada.',
        '...', 'La pantalla parpadea.'],
      ['En la pantalla apagada',
        'hay un niño que te mira.',
        'No se mueve.'],
    ];
    if (v >= 2) Horror.startVision(5);
    Game.say(lines[Math.min(v, lines.length - 1)]);
  },

  homeTable() {
    const v = (Game.flags.tableVisits || 0);
    Game.flags.tableVisits = v + 1;
    const lines = [
      ['Una mesa con dos sillas.',
        'Hay un plato sin recoger.'],
      ['El plato lleva semanas así.',
        'Ya no hay nadie', 'que lo recoja.'],
      ['La silla de enfrente',
        'se ha movido sola.',
        'Nadie ha entrado.'],
    ];
    Game.say(lines[Math.min(v, lines.length - 1)]);
  },

  nurse() {
    const done = () => {
      Game.healParty();
      AudioFX.heal();
      Game.respawn = { map: 'center', x: 5.5, y: 3.5, ang: -Math.PI / 2 };
    };
    const v = (Game.flags.nurseVisits || 0);
    Game.flags.nurseVisits = v + 1;
    const msgs = [
      ['ENFERMERA: ¡Bienvenido al',
        'CENTRO POKéMON!',
        '...', '¡Ya están como nuevos!',
        '¡Vuelve cuando quieras!'],
      ['ENFERMERA: Tú otra vez.',
        '¿Todo bien por ahí fuera?',
        '...', 'Tus POKéMON ya están.',
        'Pareces cansado tú también.'],
      ['ENFERMERA: ...',
        '¿Cuánto tiempo llevas', 'aquí dentro?',
        'Tus POKéMON están curados.',
        'Descansa tú también.'],
    ];
    if (v >= 2 && Math.random() < 0.4) {
      Horror.startVision(7);
      Game.say(['ENFERMERA: Sujeto 9.',
        'Tus constantes son estables.',
        'Llevas aquí cuatro días.',
        '¿Recuerdas cómo llegaste?',
        '...',
        '¡Ya están como nuevos!'], done);
    } else {
      Game.say(msgs[Math.min(v, msgs.length - 1)], done);
    }
  },

  mom() {
    const done = () => { Game.healParty(); AudioFX.heal(); };
    const v = (Game.flags.momVisits || 0);
    Game.flags.momVisits = v + 1;
    const name = Game.playerName || 'ROJO';
    const lines = [
      // visita 0: normal, cura el equipo
      ['MAMÁ: ¡' + name + ', cariño!',
        'Descansa un poco, anda...',
        '¡Listo! Tus POKéMON están',
        'llenos de energía.'],
      // visita 1: algo no cuadra
      ['MAMÁ: ' + name + '...',
        '¿Cuántos días llevas fuera?',
        'Ya no sé cuántos días son.',
        'Las paredes siguen verdes.',
        'Eso es bueno, ¿no?'],
      // visita 2+: la madre real
      ['MAMÁ: ¿Puedes oírme?',
        'Los médicos dicen', 'que respondes a sonidos.',
        '...', 'Despierta. Por favor.'],
    ];
    const idx = Math.min(v, lines.length - 1);
    Game.say(lines[idx], idx === 0 ? done : null);
  },

  bugCatcher1() {
    if (Game.flags.bc1beaten) {
      Game.say(['Ya te gané antes.', '¡Mis CATERPIE son los mejores!']);
      return;
    }
    Game.say(['¡Oye! ¡Tú tienes POKéMON!', '¡CAPTURADOR vs CAPTURADOR!', '¡PELEA!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('CAPTURADOR', [makeMon('CATERPIE', 7), makeMon('CATERPIE', 7)], 280, () => {
        Game.flags.bc1beaten = true;
        Game.say(['¡No puede ser!', 'Mis CATERPIE...', '¡La próxima vez ganaré yo!']);
      });
    });
  },

  bugCatcher2() {
    if (Game.flags.bc2beaten) {
      Game.say(['Que sepas que mi METAPOD', 'está endureciendo su armadura.', '¡La próxima te gano!']);
      return;
    }
    Game.say(['¡Alto ahí, forastero!', '¡Mi METAPOD y mi KAKUNA', 'son invencibles!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('CAPTURADOR', [makeMon('METAPOD', 9), makeMon('KAKUNA', 8)], 320, () => {
        Game.flags.bc2beaten = true;
        Game.say(['¡Imposible...!', 'Son muy tenaces aunque', 'solo sepan FORTALEZA...']);
      });
    });
  },

  forestLass() {
    if (Game.flags.lassbeaten) {
      Game.say(['Deberías tener más cuidado', 'en este bosque...', '...a veces lo veo raro.']);
      return;
    }
    Game.say(['¡Ei! ¿Hacia CIUDAD PLATEADA?', '¡Yo también quiero ir!', '¡Pero primero, combate!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('CHICA', [makeMon('RATTATA', 8), makeMon('PIDGEY', 8)], 320, () => {
        Game.flags.lassbeaten = true;
        Game.say(['Eres muy bueno...', '¡CIUDAD PLATEADA está al norte!', '¡Buena suerte con BROCK!']);
      });
    });
  },

  pewterBoy() {
    Game.flags.arrivedPewter = true;
    Game.say(['¡Bienvenido a CIUDAD PLATEADA!', '¿Vienes a retar al GIMNASIO?', 'BROCK es muy duro.', 'Usa ataques de Agua o Planta.', 'Están en el edificio grande', 'de la izquierda.']);
  },

  gymTrainer1() {
    if (Game.flags.gt1beaten) {
      Game.say(['Tus POKéMON son fuertes...', '¡BROCK os aplastará!']);
      return;
    }
    Game.say(['¡Este GIMNASIO es solo para', 'los más fuertes!', '¡DEMUÉSTRALO!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('LUCHADOR', [makeMon('GEODUDE', 10), makeMon('GEODUDE', 10)], 400, () => {
        Game.flags.gt1beaten = true;
        Game.say(['Buen combate...', '¡Pero BROCK es otro nivel!']);
      });
    });
  },

  gymTrainer2() {
    if (Game.flags.gt2beaten) {
      Game.say(['Ya viste lo que hacen mis', 'GEODUDE. ¡BROCK es peor!']);
      return;
    }
    Game.say(['¡Nadie pasa al LÍDER', 'sin pasar por mí!', '¡VAMOS!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('LUCHADOR', [makeMon('GEODUDE', 11), makeMon('ONIX', 10)], 440, () => {
        Game.flags.gt2beaten = true;
        Game.say(['...Eres fuerte.', '¡BROCK te está esperando!']);
      });
    });
  },

  brock() {
    if (Game.flags.brickBadge) {
      Game.say(['BROCK: Tu PIKACHU es impresionante.', 'La MEDALLA ROCA es tuya.', 'El siguiente GIMNASIO está', 'en CIUDAD AZULONA.']);
      return;
    }
    Game.say(['BROCK: Soy BROCK.', 'Líder del GIMNASIO de PEWTER.', 'Mis POKéMON de Roca son', 'duros como la piedra.', '¡No pasarás!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('BROCK', [makeMon('GEODUDE', 12), makeMon('ONIX', 14)], 1400, () => {
        Game.flags.brickBadge = true;
        Game.bag.BADGE1 = (Game.bag.BADGE1 || 0) + 1;
        AudioFX.victory();
        Game.say(['BROCK: ...Increíble.', 'Toma la MEDALLA ROCA.', '¡ROJO recibió la MEDALLA ROCA!', 'Con ella, los POKéMON de nivel 30', 'o menos siempre obedecerán.'], () => {
          Horror.startVision(12);
          AudioFX.sting();
          Game.say(['DR. BROCK: Sujeto 9 ha', 'completado el ejercicio de', 'simulación de combate.', 'Respuesta emocional: elevada.', 'Recomendación: reducir', 'la intensidad de la próxima sesión.', '(Fuera, empieza a llover.)'], () => Horror.endVision());
        });
      });
    });
  },

  clerk() {
    if (Game.bag.PARCEL === 0 && !Game.flags.parcelDelivered && Game.flags.hasPikachu) {
      Game.say(['DEPENDIENTE: ¡Anda, vienes de',
        'PUEBLO PALETA!',
        '¿Conoces al PROF. OAK?',
        'Su encargo acaba de llegar.',
        '¿Se lo llevas de mi parte?',
        '¡ROJO recibió el PAQUETE OAK!'], () => {
        Game.bag.PARCEL = 1;
        AudioFX.confirm();
        Game.say(['DEPENDIENTE: ¡Gracias!',
          'Echa un vistazo a la tienda',
          'antes de irte.'], () => { Game.state = 'shop'; Game.shopSel = 0; });
      });
    } else {
      Game.say(['DEPENDIENTE: ¡Bienvenido!',
        '¿En qué puedo ayudarte?'], () => { Game.state = 'shop'; Game.shopSel = 0; });
    }
  },

  route3Trainer1() {
    if (Game.flags.r3t1) { Game.say(['¡Buen combate!', '¡CIUDAD AZULONA está al norte!']); return; }
    Game.say(['¡Oye! ¿Vienes de PEWTER?', '¡Yo también quiero medallas!', '¡VAMOS!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('EXPLORADOR', [makeMon('SPEAROW', 13), makeMon('RATTATA', 13)], 520, () => {
        Game.flags.r3t1 = true;
        Game.say(['¡Eres muy bueno!', '¡No me rendí!']);
      });
    });
  },

  route3Trainer2() {
    if (Game.flags.r3t2) { Game.say(['Mis POKéMON aún se recuperan...']); return; }
    Game.say(['¡Espera ahí!', '¡El camino es mío!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('CHICA', [makeMon('JIGGLYPUFF', 14), makeMon('CLEFAIRY', 13)], 560, () => {
        Game.flags.r3t2 = true;
        Game.say(['¡Mis POKéMON Normales son fuertes!', '...Casi.']);
      });
    });
  },

  route3Trainer3() {
    if (Game.flags.r3t3) { Game.say(['Sigue recto hasta el MONTE LUNA.']); return; }
    Game.say(['¡Las rutas son peligrosas!', '¡Yo te lo demuestro!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('EXPLORADOR', [makeMon('MANKEY', 15), makeMon('PIDGEY', 14), makeMon('SPEAROW', 13)], 600, () => {
        Game.flags.r3t3 = true;
        Game.say(['¡Madre mía...!', '¡Qué PIKACHU tan fuerte!']);
      });
    });
  },

  charmanderTrainer() {
    if (Game.flags.charmanderSaved) return;
    Game.say([
      'MARIO: Yo lo dejé aquí.',
      'Era demasiado débil.',
      'Los fuertes sobreviven solos, ¿no?',
      '...', '¿Por qué me miras así?',
      'No lo miré antes de irme.',
      'No quería ver si la llama', 'seguía encendida.',
    ], () => {
      Horror.startVision(6);
      Game.say([
        'Hay personas así.',
        'Que se van sin mirar atrás.',
        'Que dejan cosas encendidas', 'en la oscuridad.',
        '...esperando.',
      ], () => Horror.endVision());
    });
  },

  charmanderRescue() {
    if (Game.flags.charmanderSaved) return;
    if (Game.party.length >= 6) {
      Game.say(['CHARMANDER te mira.', 'La llama de su cola tiembla.', 'No tienes sitio en tu equipo.']); return;
    }
    Game.say([
      'Un CHARMANDER solo.',
      'Sentado en la hierba.',
      'La llama de su cola', 'brilla débilmente.',
      'Te mira sin moverse.',
      'Lleva aquí mucho tiempo.', '¿Lo llevas contigo?',
    ], () => {
      Game.choose('¿LLEVAS AL CHARMANDER?', ['SÍ', 'NO'], i => {
        if (i === 0) {
          const ch = makeMon('CHARMANDER', 10);
          Game.party.push(ch);
          Game.flags.charmanderSaved = true;
          AudioFX.cry('CHARMANDER');
          AudioFX.heal();
          Game.say([
            '¡' + Game.playerName + ' recibió\nun CHARMANDER!',
            'CHARMANDER: Char...',
            'Por primera vez en mucho rato,', 'la llama arde con fuerza.',
          ]);
        } else {
          Game.say([
            'CHARMANDER baja la cabeza.',
            'La llama apenas parpadea.',
            '...', 'Sigue esperando.',
          ]);
        }
      });
    });
  },

  bulbasaurGirl() {
    if (Game.flags.bulbasaurGot) return;
    if (!Game.flags.mistyDefeated) {
      Game.say([
        'ANA: Este es mi BULBASAUR.',
        'Lo cuido desde que era pequeño.',
        'Busco a alguien que merezca', 'llevarlo con él.',
        'Alguien que haya demostrado', 'ser un buen entrenador.',
        '...Demuéstramelo primero.',
        'El GIMNASIO está al norte.',
      ]); return;
    }
    Game.say([
      'ANA: Has derrotado a MISTY.',
      'Eres lo que buscaba.',
      'BULBASAUR lleva tiempo esperando', 'a alguien así.',
      '...Demasiado tiempo, en realidad.',
      '¿Te lo quedas?',
    ], () => {
      Game.choose('¿ACEPTAS AL BULBASAUR?', ['SÍ', 'NO'], i => {
        if (i === 0) {
          if (Game.party.length >= 6) {
            Game.say(['ANA: ...Tu equipo está lleno.', 'Vuelve cuando tengas sitio.']); return;
          }
          const bul = makeMon('BULBASAUR', 12);
          Game.party.push(bul);
          Game.flags.bulbasaurGot = true;
          AudioFX.cry('BULBASAUR');
          AudioFX.heal();
          Game.say([
            '¡' + Game.playerName + ' recibió\nun BULBASAUR!',
            'BULBASAUR: Bulba...',
            'ANA: Cuídalo bien.',
            '...Ha esperado mucho para', 'encontrar a alguien como tú.',
          ], () => {
            Horror.startVision(8);
            Game.say([
              'ANA: ¿Sabes cuánto tiempo', 'es demasiado tiempo esperando?',
              '...', 'Tú lo sabes.',
              'Llevas meses mirando', 'una pared blanca.',
              'Esperando que alguien entre.', 'Esperando que alguien te vea.',
              '...', 'Bulbasaur y tú', 'tenéis eso en común.',
            ], () => Horror.endVision());
          });
        } else {
          Game.say([
            'ANA: ...De acuerdo.',
            'BULBASAUR sigue aquí.',
            'Como siempre.',
          ]);
        }
      });
    });
  },

  bulbasaurOffer() {
    SCRIPTS.bulbasaurGirl();
  },

  moonTrainer1() {
    if (Game.flags.mt1) { Game.say(['¡CLEFAIRY es muy difícil de capturar!', '¡Pero merece la pena!']); return; }
    Game.say(['¡Eh! ¿Buscas a CLEFAIRY?', '¡Primero tendrás que vérmelas conmigo!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('LUNAR', [makeMon('ZUBAT', 14), makeMon('GEODUDE', 13)], 560, () => {
        Game.flags.mt1 = true;
        Game.say(['¡Las cuevas son muy traicioneras...!']);
      });
    });
  },

  moonTrainer2() {
    if (Game.flags.mt2) { Game.say(['Sigue por el corredor este.', '¡No te pierdas!']); return; }
    Game.say(['¡Este camino es solo para los que', 'conozcan el MONTE LUNA!', '¡DEMUESTRA QUE PUEDES!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('LUNAR', [makeMon('CLEFAIRY', 15), makeMon('ZUBAT', 14)], 600, () => {
        Game.flags.mt2 = true;
        Game.say(['Eso ha sido...', '...inesperado.']);
      });
    });
  },

  moonTrainer3() {
    if (Game.flags.mt3) { Game.say(['La salida está un poco más arriba.']); return; }
    Game.say(['¡Alto!', '¡Quiero ese CLEFAIRY que llevas!', "¡LET'S GO!"], () => {
      Game.state = 'battle';
      Battle.startTrainer('LUNAR', [makeMon('GEODUDE', 16), makeMon('CLEFAIRY', 15), makeMon('ZUBAT', 15)], 640, () => {
        Game.flags.mt3 = true;
        Game.say(['...Bien jugado.', 'La salida está arriba.', '¡No te rindas!']);
      });
    });
  },

  route4Trainer1() {
    if (Game.flags.r4t1) { Game.say(['¡CIUDAD AZULONA está justo aquí!']); return; }
    Game.say(['¡Por fin alguien en esta ruta!', '¡COMBATE!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('EXPLORADOR', [makeMon('PIDGEY', 16), makeMon('MANKEY', 16)], 640, () => {
        Game.flags.r4t1 = true;
        Game.say(['¡Tienes mucho potencial!', '¡CIUDAD AZULONA está al norte!']);
      });
    });
  },

  route4Trainer2() {
    if (Game.flags.r4t2) { Game.say(['Entrenar en rutas es lo mejor.']); return; }
    Game.say(['¡RUTA 4, la última antes de AZULONA!', '¡Yo soy su guardiana!', '¡PELEA!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('CHICA', [makeMon('JIGGLYPUFF', 17), makeMon('CLEFAIRY', 16)], 680, () => {
        Game.flags.r4t2 = true;
        Game.say(['¡Eres muy bueno para venir del MONTE LUNA!', '¡Cuídate!']);
      });
    });
  },

  ceruleanBoy() {
    Game.flags.arrivedCerulean = true;
    Game.say(['¡Bienvenido a CIUDAD AZULONA!', '¡La ciudad del agua!',
      '¿Vienes a retar a MISTY?', 'Cuidado con la casa de los JENKINS.',
      '...desde el mes pasado está rara.', 'Nadie habla de ello.']);
  },

  ceruleanGirl() {
    Game.say(['MISTY es la líder del GIMNASIO.', 'Usa STARYU y STARMIE.',
      'Son POKéMON de Agua muy rápidos.', 'El IMPACTRUENO de PIKACHU', 'debería funcionar bien.']);
  },

  ceruleanGymTrainer1() {
    if (Game.flags.cgt1) { Game.say(['¡MISTY te aplastará!']); return; }
    Game.say(['¡El agua es la fuerza primordial!', '¡Yo lo demuestro!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('NADADOR', [makeMon('STARYU', 18), makeMon('GOLDEEN', 17)], 720, () => {
        Game.flags.cgt1 = true;
        Game.say(['...Bien.', '¡MISTY no te lo pondrá tan fácil!']);
      });
    });
  },

  ceruleanGymTrainer2() {
    if (Game.flags.cgt2) { Game.say(['MISTY lleva esperándote.']); return; }
    Game.say(['¡Nadie supera mi defensa de agua!', '¡VAMOS!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('NADADORA', [makeMon('GOLDEEN', 18), makeMon('STARYU', 18)], 720, () => {
        Game.flags.cgt2 = true;
        Game.say(['¡No puede ser...!', '¡MISTY vengará esta derrota!']);
      });
    });
  },

  misty() {
    if (Game.flags.mistyDefeated) {
      Game.say(['MISTY: Tu POKéMON es increíble.', 'La MEDALLA CASCADA es tuya.',
        'El siguiente GIMNASIO está', 'en CIUDAD BERMELLÓN.']);
      return;
    }
    Game.say(['MISTY: Soy MISTY.', 'Líder del GIMNASIO de AZULONA.',
      'Mis POKéMON de Agua son', 'los más elegantes y poderosos.', '¡Prepárate!'], () => {
      Game.state = 'battle';
      Battle.startTrainer('MISTY', [makeMon('STARYU', 18), makeMon('STARMIE', 21)], 2100, () => {
        Game.flags.mistyDefeated = true;
        Game.bag.BADGE2 = (Game.bag.BADGE2 || 0) + 1;
        AudioFX.victory();
        Game.say(['MISTY: ...No puede ser.', 'Has ganado la MEDALLA CASCADA.',
          '¡ROJO recibió la MEDALLA CASCADA!', 'Con ella tus POKéMON de nivel 50',
          'o menos obedecerán siempre.'], () => {
          Horror.startVision(20);
          AudioFX.sting();
          Game.say(['DRA. MARINA: Sujeto 9...', 'Para.', 'Para.', 'PARA.',
            '...', 'Anota:', 'Incidente número 7.',
            'La Dra. Marina ha tenido que salir.', 'No volverá a esta sala.',
            'El señor Brice tampoco volvió.', 'Ni el Dr. Álvarez.',
            'Ni la enfermera Celia.',
            'Todos los que han entrado', 'a intentar ayudarle...',
            '...', 'Necesitamos otro enfoque.',
            'El niño está perdido en su mundo.', 'Y es peligroso para los dos.'], () => {
            Horror.endVision();
          });
        });
      });
    });
  },

  sewerOrderly() {
    Game.say(['¡Eh!', '¿Adónde vas?', '¡Vuelve a tu habitación!'], () => {
      Game.choose('¿QUÉ HACES?', ['CORRER', 'ESCONDERTE'], i => {
        if (i === 0) {
          Game.flags.sanity = Math.max(0, (Game.flags.sanity || 0) - 1);
          Game.say(['Corres.', 'Oyes pasos detrás de ti.', 'Se pierden en la oscuridad.']);
        } else {
          if (Math.random() < 0.35) {
            Game.say(['Te encuentran.', '...', '...', 'Despiertas más atrás.'], () => {
              Game.warpTo({ to: 'sewers_a', x: 6.5, y: 2.5, ang: Math.PI / 2 });
            });
          } else {
            Game.say(['Te quedas quieto.', 'Los pasos pasan.', 'Respiras.', 'Sigues.']);
          }
        }
      });
    });
  },

  sewersExit() {
    Game.say(['Una puerta metálica.', 'La empujas.', 'Pesa más de lo que recuerdas.', '...'], () => {
      Game.say(['Hay luz.', 'No del tipo de los fluorescentes.', 'Sol de verdad.',
        'No lo recordabas.', 'Tres años sin verlo.', '...', 'PIKACHU no está en tu bolsillo.',
        'Nunca estuvo.', 'Solo un peluche pequeño.',
        'Tu madre lo dejó en la mesilla', 'el día que te ingresaron.', '...', 'Hace tres años.', '...'], () => {
        Game.say(['* FIN D: LA FUGA *', 'Saliste.', 'El sol existe.', 'Tú también.']);
      });
    });
  },
};

// ---- Entrada ----
function navKeyOf(e) {
  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'w') return 'up';
  if (k === 'arrowdown' || k === 's') return 'down';
  if (k === 'arrowleft' || k === 'a') return 'left';
  if (k === 'arrowright' || k === 'd') return 'right';
  if (k === 'z' || k === ' ' || k === 'enter') return 'confirm';
  if (k === 'x' || k === 'escape') return 'cancel';
  return null;
}

window.addEventListener('keydown', e => {
  AudioFX.init();
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  Game.keys[k] = true;
  if (e.repeat) return;
  const nav = navKeyOf(e);
  const G = Game;

  switch (G.state) {
    case 'title':
      if (nav === 'confirm') {
        AudioFX.confirm();
        if (localStorage.getItem('fpokemon_save')) { G.state = 'menuStart'; G.titleSel = 0; }
        else G.startNaming();
      }
      break;

    case 'menuStart':
      if (nav === 'up' || nav === 'down') { G.titleSel = 1 - G.titleSel; AudioFX.blip(); }
      else if (nav === 'confirm') {
        AudioFX.confirm();
        if (G.titleSel === 0) { if (!G.load()) G.startNaming(); }
        else G.startNaming();
      } else if (nav === 'cancel') G.state = 'title';
      break;

    case 'naming_intro':
      if (nav === 'confirm') {
        AudioFX.blip();
        G.namingIntroIdx++;
        if (G.namingIntroIdx >= NAMING_INTRO_PAGES.length) {
          G.namingIntroIdx = 0;
          G.state = 'naming';
        }
      }
      break;

    case 'naming':
      if (nav === 'up') { G.namingSel = (G.namingSel - 1 + NAMING_PRESETS.length) % NAMING_PRESETS.length; AudioFX.blip(); }
      else if (nav === 'down') { G.namingSel = (G.namingSel + 1) % NAMING_PRESETS.length; AudioFX.blip(); }
      else if (nav === 'confirm') {
        AudioFX.confirm();
        if (NAMING_PRESETS[G.namingSel] === '...') {
          G.namingText = '';
          G.namingCx = 0; G.namingCy = 0;
          G.state = 'naming_grid';
        } else {
          G._finishNaming();
        }
      }
      break;

    case 'naming_grid': {
      const cols = NAMING_GRID[0].length;
      const rows = NAMING_GRID.length;
      if (nav === 'up') { G.namingCy = (G.namingCy - 1 + rows) % rows; AudioFX.blip(); }
      else if (nav === 'down') { G.namingCy = (G.namingCy + 1) % rows; AudioFX.blip(); }
      else if (nav === 'left') { G.namingCx = (G.namingCx - 1 + cols) % cols; AudioFX.blip(); }
      else if (nav === 'right') { G.namingCx = (G.namingCx + 1) % cols; AudioFX.blip(); }
      else if (nav === 'confirm') {
        const ch = NAMING_GRID[G.namingCy][G.namingCx];
        if (ch === 'DEL') { G.namingText = G.namingText.slice(0, -1); AudioFX.blip(); }
        else if (ch === 'FIN') {
          if (G.namingText.length > 0) { AudioFX.confirm(); G._finishNaming(); }
          else AudioFX.blip();
        } else if (ch && G.namingText.length < 7) { G.namingText += ch; AudioFX.blip(); }
      } else if (nav === 'cancel') {
        if (G.namingText.length > 0) { G.namingText = G.namingText.slice(0, -1); AudioFX.blip(); }
        else { G.state = 'naming'; AudioFX.cancel(); }
      }
      break;
    }

    case 'world':
      if (nav === 'confirm') G.interact();
      else if (nav === 'cancel') { G.state = 'menu'; G.menuSel = 0; AudioFX.confirm(); }
      else if (k === 'm') { G.state = 'map'; }
      break;

    case 'map':
      G.state = 'world';
      break;

    case 'dialog':
      if (nav === 'confirm') {
        AudioFX.blip();
        const d = G.dialog;
        d.idx++;
        if (d.idx >= d.pages.length) {
          G.dialog = null;
          if (G.state === 'dialog') G.state = 'world';
          if (d.cb) d.cb();
        }
      }
      break;

    case 'menu': {
      const opts = 4;
      if (nav === 'up') { G.menuSel = (G.menuSel + 3) % opts; AudioFX.blip(); }
      else if (nav === 'down') { G.menuSel = (G.menuSel + 1) % opts; AudioFX.blip(); }
      else if (nav === 'cancel') { G.state = 'world'; AudioFX.cancel(); }
      else if (nav === 'confirm') {
        AudioFX.confirm();
        if (G.menuSel === 0) { G.state = 'party'; G.partySel = 0; }
        else if (G.menuSel === 1) { G.state = 'bag'; G.bagSel = 0; }
        else if (G.menuSel === 2) { G.state = 'world'; G.say([G.save() ? 'Partida guardada.' : 'No se pudo guardar.']); }
        else G.state = 'world';
      }
      break;
    }

    case 'party': {
      const n = G.party.length;
      if (!n) { if (nav) { G.state = 'menu'; } break; }
      if (nav === 'up') { G.partySel = (G.partySel + n - 1) % n; AudioFX.blip(); }
      else if (nav === 'down') { G.partySel = (G.partySel + 1) % n; AudioFX.blip(); }
      else if (nav === 'cancel') { G.state = 'menu'; AudioFX.cancel(); }
      else if (nav === 'confirm' && G.partySel > 0) {
        const m = G.party.splice(G.partySel, 1)[0];
        G.party.unshift(m);
        G.partySel = 0;
        AudioFX.confirm();
      } else if (nav === 'confirm' && G.partySel === 0) {
        // Acariciar a tu POKéMON
        G.state = 'world';
        Horror.pet(G.party[0]);
      }
      break;
    }

    case 'bag': {
      const items = Object.entries(G.bag).filter(([, v]) => v > 0);
      if (!items.length) { if (nav) G.state = 'menu'; break; }
      if (nav === 'up') { G.bagSel = (G.bagSel + items.length - 1) % items.length; AudioFX.blip(); }
      else if (nav === 'down') { G.bagSel = (G.bagSel + 1) % items.length; AudioFX.blip(); }
      else if (nav === 'cancel') { G.state = 'menu'; AudioFX.cancel(); }
      else if (nav === 'confirm') {
        const key = items[Math.min(G.bagSel, items.length - 1)][0];
        if ((key === 'POTION' || key === 'SUPERPOT') && G.party.length) { G.state = 'usePotion'; G.partySel = 0; AudioFX.confirm(); }
        else if (key === 'PARCEL') { G.state = 'world'; G.say(['Un paquete para el PROF. OAK.', 'Hay que llevárselo.']); }
        else { G.state = 'world'; G.say(['Ahora no es el momento', 'de usar eso.']); }
      }
      break;
    }

    case 'usePotion': {
      const n = G.party.length;
      if (nav === 'up') { G.partySel = (G.partySel + n - 1) % n; AudioFX.blip(); }
      else if (nav === 'down') { G.partySel = (G.partySel + 1) % n; AudioFX.blip(); }
      else if (nav === 'cancel') { G.state = 'bag'; AudioFX.cancel(); }
      else if (nav === 'confirm') {
        const m = G.party[G.partySel];
        if (m.hp <= 0 || m.hp >= m.maxhp) { AudioFX.bump(); break; }
        // Determine which potion to use (SUPERPOT preferred if selected from bag)
        const bagItems2 = Object.entries(G.bag).filter(([, v]) => v > 0);
        const selKey = bagItems2[Math.min(G.bagSel, bagItems2.length - 1)];
        const potKey = selKey && (selKey[0] === 'SUPERPOT') ? 'SUPERPOT' : 'POTION';
        const potItem = ITEMS[potKey];
        if (!potItem || !potItem.heal) { AudioFX.bump(); break; }
        const healed = Math.min(potItem.heal, m.maxhp - m.hp);
        m.hp += healed; G.bag[potKey]--;
        AudioFX.heal();
        G.state = 'world';
        G.say(['¡' + m.name + ' recuperó', healed + ' PS!']);
      }
      break;
    }

    case 'shop': {
      const goods = ['POKEBALL', 'POTION', null];
      if (nav === 'up') { G.shopSel = (G.shopSel + 2) % 3; AudioFX.blip(); }
      else if (nav === 'down') { G.shopSel = (G.shopSel + 1) % 3; AudioFX.blip(); }
      else if (nav === 'cancel') { G.state = 'world'; AudioFX.cancel(); }
      else if (nav === 'confirm') {
        const it = goods[G.shopSel];
        if (!it) { G.state = 'world'; AudioFX.cancel(); break; }
        if (G.money >= ITEMS[it].price) {
          G.money -= ITEMS[it].price;
          G.bag[it]++;
          AudioFX.confirm();
        } else AudioFX.bump();
      }
      break;
    }

    case 'choice': {
      const c = G.choice;
      if (!c) break;
      if (nav === 'up' || nav === 'down') { c.sel = 1 - c.sel; AudioFX.blip(); }
      else if (nav === 'confirm') {
        AudioFX.confirm();
        G.choice = null;
        G.state = 'world';
        c.cb(c.sel);
      }
      break;
    }

    case 'battle':
      if (nav) Battle.key(nav);
      break;
  }
});

window.addEventListener('keyup', e => { Game.keys[e.key.toLowerCase()] = false; });

// Ratón opcional (pointer lock para girar)
const screenEl = document.getElementById('screen');
screenEl.addEventListener('click', () => {
  if (Game.state === 'world') screenEl.requestPointerLock();
});
window.addEventListener('mousemove', e => {
  if (document.pointerLockElement === screenEl && Game.state === 'world') {
    Game.ang += e.movementX * 0.004;
  }
});

// ---- Dibujado de UI del mundo ----
function drawDialog(ctx) {
  const d = Game.dialog;
  if (!d) return;
  drawBox(ctx, 0, 106, 160, 38);
  const page = d.pages[d.idx] || [];
  page.forEach((l, i) => uiText(ctx, l, 6, 119 + i * 11));
  if (Math.floor(Game.time * 2) % 2) uiText(ctx, '▼', 148, 140);
}

function drawChoice(ctx) {
  const c = Game.choice;
  if (!c) return;
  // Caja de diálogo: hasta 2 líneas del prompt (partido en 18 chars)
  drawBox(ctx, 0, 96, 160, 48);
  const words = c.prompt.split(' ');
  let line = '', lines = [];
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 20) { lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => uiText(ctx, l, 6, 110 + i * 11));
  // Caja de opciones: ancho suficiente para el texto más largo
  const maxLen = Math.max(...c.opts.map(o => o.length));
  const boxW = Math.max(52, maxLen * 6 + 24);
  const boxX = 160 - boxW - 4;
  drawBox(ctx, boxX, 58, boxW, 10 + c.opts.length * 13);
  c.opts.forEach((o, i) => {
    uiText(ctx, o, boxX + 16, 69 + i * 13);
    if (c.sel === i) uiText(ctx, '►', boxX + 6, 69 + i * 13);
  });
}

function drawPauseMenu(ctx) {
  drawBox(ctx, 92, 2, 66, 58);
  const opts = ['POKéMON', 'MOCHILA', 'GUARDAR', 'CERRAR'];
  opts.forEach((o, i) => {
    uiText(ctx, o, 108, 14 + i * 11);
    if (Game.menuSel === i) uiText(ctx, '►', 99, 14 + i * 11);
  });
  drawBox(ctx, 92, 62, 66, 16);
  uiText(ctx, Game.money + '₽', 100, 73);
}

function drawParty(ctx, title) {
  drawBox(ctx, 4, 4, 152, 110);
  uiText(ctx, title, 12, 15);
  if (!Game.party.length) uiText(ctx, 'No tienes POKéMON.', 14, 36);
  Game.party.forEach((m, i) => {
    const y = 26 + i * 14;
    uiText(ctx, m.name + ' N.' + m.level + (m.status ? ' ' + m.status : ''), 24, y);
    drawHPBar(ctx, 24, y + 2, 60, m.hp, m.maxhp);
    uiText(ctx, m.hp + '/' + m.maxhp, 92, y + 6);
    if (Game.partySel === i) uiText(ctx, '►', 12, y);
  });
  drawBox(ctx, 4, 116, 152, 26);
  uiText(ctx, title === 'EQUIPO' ? 'Z: 1º acaricia/resto lidera' : 'Z: usar POCIÓN  X: volver', 10, 131);
}

function drawBag(ctx) {
  drawBox(ctx, 4, 4, 152, 110);
  uiText(ctx, 'MOCHILA', 12, 15);
  const items = Object.entries(Game.bag).filter(([, v]) => v > 0);
  if (!items.length) uiText(ctx, 'La mochila está vacía.', 14, 36);
  items.forEach(([key, n], i) => {
    const y = 30 + i * 13;
    uiText(ctx, ITEMS[key].name + '  x' + n, 24, y);
    if (Game.bagSel === i) uiText(ctx, '►', 12, y);
  });
  drawBox(ctx, 4, 116, 152, 26);
  const sel = items[Math.min(Game.bagSel, Math.max(0, items.length - 1))];
  uiText(ctx, sel ? ITEMS[sel[0]].desc : '', 10, 131);
}

function drawShop(ctx) {
  drawBox(ctx, 10, 10, 140, 84);
  uiText(ctx, 'TIENDA      ' + Game.money + '₽', 20, 24);
  const goods = [['POKEBALL', 'POKÉ BALL'], ['POTION', 'POCIÓN'], [null, 'SALIR']];
  goods.forEach(([key, label], i) => {
    const y = 42 + i * 14;
    uiText(ctx, label, 34, y);
    if (key) uiText(ctx, ITEMS[key].price + '₽', 104, y);
    if (Game.shopSel === i) uiText(ctx, '►', 24, y);
  });
  drawBox(ctx, 10, 98, 140, 24);
  uiText(ctx, 'Tienes: ' + (Game.bag.POKEBALL | 0) + ' BALL, ' + (Game.bag.POTION | 0) + ' POCIÓN', 16, 112);
}

function drawTitle(ctx) {
  ctx.fillStyle = PAL[0];
  ctx.fillRect(0, 0, SCR_W, SCR_H);
  ctx.fillStyle = PAL[3];
  ctx.font = 'bold 16px monospace';
  ctx.fillText('POKéMON', 36, 30);
  ctx.font = 'bold 11px monospace';
  ctx.fillText('AMARILLO FP', 40, 46);
  drawSprite(ctx, 'PIKACHU', 48, 56, 4, false);
  ctx.font = '7px monospace';
  ctx.fillText('Demake fan en 1ª persona', 22, 130);
  if (Math.floor(Game.time * 2) % 2) ctx.fillText('- PULSA Z -', 56, 140);
}

function drawStartMenu(ctx) {
  drawTitle(ctx);
  drawBox(ctx, 40, 60, 80, 36);
  const opts = ['CONTINUAR', 'NUEVA PARTIDA'];
  opts.forEach((o, i) => {
    uiText(ctx, o, 56, 74 + i * 12);
    if (Game.titleSel === i) uiText(ctx, '►', 47, 74 + i * 12);
  });
}

function drawNamingIntro(ctx) {
  ctx.fillStyle = PAL[0];
  ctx.fillRect(0, 0, SCR_W, SCR_H);
  // Oak sprite centrado en la mitad superior
  drawSprite(ctx, 'OAK', 56, 8, 3, false);
  // Caja de diálogo
  drawBox(ctx, 0, 100, 160, 44);
  const page = NAMING_INTRO_PAGES[Game.namingIntroIdx] || [];
  page.forEach((l, i) => { if (l) uiText(ctx, l, 6, 113 + i * 11); });
  if (Math.floor(Game.time * 2) % 2) uiText(ctx, '▼', 148, 140);
}

function drawNaming(ctx) {
  ctx.fillStyle = PAL[0];
  ctx.fillRect(0, 0, SCR_W, SCR_H);
  if (Game.state === 'naming_grid') {
    // Caja con nombre actual
    drawBox(ctx, 0, 0, 160, 22);
    const display = (Game.namingText + '_').slice(0, 8);
    uiText(ctx, 'NOMBRE:', 6, 10);
    uiText(ctx, display, 58, 10);
    // Rejilla de caracteres
    const CW = 17, CH = 28, OX = 3, OY = 28;
    for (let r = 0; r < NAMING_GRID.length; r++) {
      for (let c = 0; c < NAMING_GRID[r].length; c++) {
        const ch = NAMING_GRID[r][c];
        if (!ch) continue;
        const x = OX + c * CW, y = OY + r * CH;
        if (Game.namingCy === r && Game.namingCx === c) {
          ctx.fillStyle = PAL[3];
          ctx.fillRect(x - 1, y - 8, ch.length > 1 ? 19 : 10, 11);
          ctx.fillStyle = PAL[0];
          ctx.font = '7px monospace';
          ctx.fillText(ch, x, y);
          ctx.fillStyle = PAL[3];
        } else {
          uiText(ctx, ch, x, y);
        }
      }
    }
  } else {
    // Vista de presets: Oak a la derecha, lista a la izquierda
    drawSprite(ctx, 'OAK', 88, 10, 3, false);
    drawBox(ctx, 2, 2, 82, 18);
    uiText(ctx, '¿CUÁL ES TU', 8, 10);
    uiText(ctx, 'NOMBRE?', 8, 19);
    drawBox(ctx, 2, 26, 82, NAMING_PRESETS.length * 13 + 6);
    NAMING_PRESETS.forEach((name, i) => {
      const y = 36 + i * 13;
      uiText(ctx, name, 20, y);
      if (Game.namingSel === i) uiText(ctx, '►', 10, y);
    });
  }
}

// ---- Bucle principal ----
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  Game.time += dt;
  Game.update(dt);
  Horror.update(dt);

  const ctx = Engine.ctx;
  const G = Game;
  if (G.state === 'title') { uiBegin(ctx); drawTitle(ctx); uiEnd(ctx); }
  else if (G.state === 'menuStart') { uiBegin(ctx); drawStartMenu(ctx); uiEnd(ctx); }
  else if (G.state === 'naming_intro') { uiBegin(ctx); drawNamingIntro(ctx); uiEnd(ctx); }
  else if (G.state === 'naming' || G.state === 'naming_grid') { uiBegin(ctx); drawNaming(ctx); uiEnd(ctx); }
  else if (G.state === 'battle') { uiBegin(ctx); Battle.draw(ctx); uiEnd(ctx); }
  else {
    // Durante una visión, los habitantes se ven como son de verdad.
    let npcs = G.visibleNpcs();
    if (Horror.active()) npcs = npcs.map(n => ({ ...n, sprite: Horror.spriteFor(n.sprite) }));
    Engine.render(G.map, G.x, G.y, G.ang, npcs);
    uiBegin(ctx);
    // Indicador de hierba
    if (tileAt(G.map, G.x | 0, G.y | 0) === ',' && !Horror.active()) {
      ctx.fillStyle = PAL[3];
      ctx.font = '7px monospace';
      ctx.fillText('~hierba alta~', 54, 10);
    }
    if (G.state === 'dialog') drawDialog(ctx);
    else if (G.state === 'choice') drawChoice(ctx);
    else if (G.state === 'menu') drawPauseMenu(ctx);
    else if (G.state === 'party') drawParty(ctx, 'EQUIPO');
    else if (G.state === 'usePotion') drawParty(ctx, 'USAR POCIÓN');
    else if (G.state === 'bag') drawBag(ctx);
    else if (G.state === 'shop') drawShop(ctx);
    else if (G.state === 'map') Engine.drawMinimap(G.map, G.x, G.y, G.ang, npcs);
    uiEnd(ctx);
  }
  // Capa de terror (rótulo de la realidad durante visiones), sobre todo lo demás
  uiBegin(ctx);
  Horror.draw(ctx);
  uiEnd(ctx);
  requestAnimationFrame(tick);
}

Engine.init(document.getElementById('screen'));
requestAnimationFrame(tick);
