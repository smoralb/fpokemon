// Combate por turnos estilo Gen 1.
// Funciona con una cola de pasos: {t:'texto'} espera tecla, {f:fn} se ejecuta.

const Battle = {
  active: false, wild: true, trainerName: null, prize: 0,
  enemyParty: [], enemyIdx: 0, playerIdx: 0,
  stP: null, stE: null, // fases de stats
  steps: [], text: null,
  menu: null, sel: 0,
  outcome: null, onWin: null,

  pm() { return Game.party[this.playerIdx]; },
  em() { return this.enemyParty[this.enemyIdx]; },

  resetStages() {
    this.stP = { atk: 0, def: 0, spe: 0, acc: 0 };
    this.stE = { atk: 0, def: 0, spe: 0, acc: 0 };
  },

  startWild(mon) {
    this.common([mon], true);
    this.steps.push({ t: '¡Un ' + mon.name + ' salvaje\napareció!' });
    this.sendPlayerMon();
  },

  startTrainer(name, party, prize, onWin, onLose) {
    this.common(party, false);
    this.trainerName = name; this.prize = prize;
    this.onWin = onWin || null; this.onLose = onLose || null;
    this.steps.push({ t: '¡' + name + ' quiere luchar!' });
    this.steps.push({ t: '¡' + name + ' sacó a\n' + this.em().name + '!' });
    this.sendPlayerMon();
  },

  common(party, wild) {
    this.active = true; this.wild = wild; this.trainerName = null;
    this.enemyParty = party; this.enemyIdx = 0;
    this.playerIdx = Game.party.findIndex(m => m.hp > 0);
    this.steps = []; this.text = null; this.menu = null; this.sel = 0;
    this.outcome = null; this.prize = 0;
    // Limpia callbacks de cualquier combate anterior (evita diálogos colgados).
    this.onWin = null; this.onLose = null;
    this.resetStages();
    AudioFX.battleStart();
    if (typeof Music !== 'undefined') Music.play('battle');
  },

  sendPlayerMon() {
    const m = this.pm();
    this.steps.push({ t: '¡Adelante, ' + m.name + '!' });
    this.steps.push({ f: () => { AudioFX.cry(m.id); this.menu = 'main'; this.sel = 0; } });
    this.nextStep();
  },

  nextStep() {
    while (this.steps.length) {
      const s = this.steps.shift();
      if (s.f) { s.f(); if (this.text !== null || this.menu) return; }
      else { this.text = s.t; return; }
    }
    this.text = null;
  },

  // ---- Entrada ----
  key(k) {
    if (this.text !== null) {
      if (k === 'confirm') { AudioFX.blip(); this.text = null; this.nextStep(); }
      return;
    }
    if (!this.menu) return;
    const move = (d, max) => { this.sel = (this.sel + d + max) % max; AudioFX.blip(); };

    if (this.menu === 'main') {
      if (k === 'up' || k === 'down') move(2, 4);
      else if (k === 'left' || k === 'right') move(this.sel % 2 ? -1 : 1, 4);
      else if (k === 'confirm') {
        AudioFX.confirm();
        const opt = this.sel;
        if (opt === 0) { this.menu = 'moves'; this.sel = 0; }
        else if (opt === 1) { this.menu = 'bag'; this.sel = 0; }
        else if (opt === 2) { this.menu = 'pkmn'; this.sel = 0; }
        else this.doTurn({ type: 'run' });
      }
    } else if (this.menu === 'moves') {
      const mv = this.pm().moves;
      if (k === 'up') move(-1, mv.length);
      else if (k === 'down') move(1, mv.length);
      else if (k === 'cancel') { this.menu = 'main'; this.sel = 0; AudioFX.cancel(); }
      else if (k === 'confirm') {
        if (mv[this.sel].pp <= 0) { AudioFX.bump(); return; }
        AudioFX.confirm();
        this.doTurn({ type: 'move', i: this.sel });
      }
    } else if (this.menu === 'bag') {
      const items = this.bagItems();
      if (!items.length) { if (k === 'cancel' || k === 'confirm') { this.menu = 'main'; this.sel = 0; } return; }
      if (k === 'up') move(-1, items.length);
      else if (k === 'down') move(1, items.length);
      else if (k === 'cancel') { this.menu = 'main'; this.sel = 0; AudioFX.cancel(); }
      else if (k === 'confirm') { AudioFX.confirm(); this.doTurn({ type: 'item', key: items[this.sel][0] }); }
    } else if (this.menu === 'pkmn' || this.menu === 'forced') {
      const forced = this.menu === 'forced';
      if (k === 'up') move(-1, Game.party.length);
      else if (k === 'down') move(1, Game.party.length);
      else if (k === 'cancel' && !forced) { this.menu = 'main'; this.sel = 0; AudioFX.cancel(); }
      else if (k === 'confirm') {
        const m = Game.party[this.sel];
        if (m.hp <= 0 || (!forced && this.sel === this.playerIdx)) { AudioFX.bump(); return; }
        AudioFX.confirm();
        if (forced) {
          this.playerIdx = this.sel;
          this.menu = null;
          this.steps.push({ t: '¡Adelante, ' + m.name + '!' });
          this.steps.push({ f: () => { AudioFX.cry(m.id); this.stP = { atk: 0, def: 0, spe: 0, acc: 0 }; this.menu = 'main'; this.sel = 0; } });
          this.nextStep();
        } else this.doTurn({ type: 'switch', i: this.sel });
      }
    }
  },

  bagItems() {
    return Object.entries(Game.bag).filter(([k, n]) => n > 0 && ITEMS[k] && !ITEMS[k].key &&
      (k !== 'POKEBALL' || this.wild));
  },

  effSpe(mon, st) {
    let s = mon.stats.spe * stageMult(st.spe);
    if (mon.status === 'PAR') s *= 0.25;
    return s;
  },

  // ---- Resolución del turno ----
  doTurn(pa) {
    this.menu = null;
    this.steps = [];
    const p = this.pm(), e = this.em();
    const emove = this.pickEnemyMove(e);
    let enemyActs = true;

    if (pa.type === 'run') {
      const ok = Math.random() < (this.effSpe(p, this.stP) >= this.effSpe(e, this.stE) ? 0.9 : 0.45);
      if (!this.wild) { this.steps.push({ t: '¡No puedes huir de un\ncombate de entrenador!' }); this.afterActions(null); this.endQueue(); return; }
      if (ok) {
        this.steps.push({ t: '¡Escapaste sin problemas!' });
        this.steps.push({ f: () => this.end('run') });
        this.nextStep(); return;
      }
      this.steps.push({ t: '¡No has podido escapar!' });
      this.queueMove(e, p, emove, false);
    } else if (pa.type === 'item') {
      this.queueItem(pa.key);
      if (this.outcomePending) return;
      this.queueMove(e, p, emove, false);
    } else if (pa.type === 'switch') {
      const m = Game.party[pa.i];
      this.steps.push({ t: '¡Vuelve, ' + p.name + '!' });
      this.steps.push({ f: () => { this.playerIdx = pa.i; this.stP = { atk: 0, def: 0, spe: 0, acc: 0 }; } });
      this.steps.push({ t: '¡Adelante, ' + m.name + '!' });
      this.queueMove(e, () => this.pm(), emove, false);
    } else if (pa.type === 'move') {
      const pmove = p.moves[pa.i];
      const pFirst = (MOVES[pmove.key].prio || 0) > (MOVES[emove].prio || 0) ||
        ((MOVES[pmove.key].prio || 0) === (MOVES[emove].prio || 0) &&
         (this.effSpe(p, this.stP) > this.effSpe(e, this.stE) ||
          (this.effSpe(p, this.stP) === this.effSpe(e, this.stE) && Math.random() < 0.5)));
      if (pFirst) {
        this.queueMove(p, e, pmove.key, true, pmove);
        this.queueMove(e, p, emove, false, null, true);
      } else {
        this.queueMove(e, p, emove, false);
        this.queueMove(p, e, pmove.key, true, pmove, true);
      }
    }
    this.afterActions();
    this.endQueue();
  },

  pickEnemyMove(e) {
    const usable = e.moves.filter(m => m.pp > 0);
    if (!usable.length) return 'TACKLE';
    return usable[rnd(usable.length)].key;
  },

  // Encola la ejecución de un movimiento. target puede ser fn (cambio diferido).
  // skipIfOver: no actuar si el usuario o el rival ya están debilitados.
  queueMove(user, target, moveKey, isPlayer, ppRef, second) {
    this.steps.push({
      f: () => {
        const u = typeof user === 'function' ? user() : (isPlayer ? this.pm() : this.em());
        const t = typeof target === 'function' ? target() : (isPlayer ? this.em() : this.pm());
        if (u.hp <= 0 || t.hp <= 0) return; // el turno terminó antes
        const stU = isPlayer ? this.stP : this.stE;
        const stT = isPlayer ? this.stE : this.stP;
        const pre = [];
        if (u.status === 'PAR' && Math.random() < 0.25) {
          pre.push({ t: '¡' + u.name + ' está paralizado!\n¡No se puede mover!' });
          this.steps.unshift(...pre); return;
        }
        if (ppRef) ppRef.pp--;
        const mv = MOVES[moveKey];
        pre.push({ t: '¡' + u.name + ' usó\n' + mv.name + '!' });
        const hit = Math.random() < (mv.acc / 100) * stageMult(stU.acc);
        if (!hit) {
          pre.push({ f: () => AudioFX.miss() });
          pre.push({ t: '¡Pero falló!' });
          this.steps.unshift(...pre); return;
        }
        if (mv.pow > 0) {
          const nHits = mv.hits ? mv.hits[0] + rnd(mv.hits[1] - mv.hits[0] + 1) : 1;
          let total = 0, lastEff = 1, lastCrit = false;
          for (let i = 0; i < nHits && t.hp - total > 0; i++) {
            const r = calcDamage(u, t, moveKey, stU, stT);
            total += r.dmg; lastEff = r.eff; lastCrit = r.crit;
          }
          if (lastEff === 0) pre.push({ t: 'No afecta a\n' + t.name + '...' });
          else {
            pre.push({ f: () => { AudioFX.moveHit(moveKey, lastCrit, lastEff); t.hp = Math.max(0, t.hp - total); } });
            if (lastCrit) pre.push({ t: '¡Golpe crítico!' });
            if (nHits > 1) pre.push({ t: '¡Golpeó ' + nHits + ' veces!' });
            if (lastEff > 1) pre.push({ t: '¡Es muy eficaz!' });
            else if (lastEff < 1) pre.push({ t: 'No es muy eficaz...' });
            if (mv.drain) {
              const healed = Math.max(1, Math.floor(total * mv.drain));
              pre.push({ f: () => { u.hp = Math.min(u.maxhp, u.hp + healed); } });
              pre.push({ t: '¡' + u.name + ' robó\nenergía!' });
            }
            if (mv.sec && lastEff > 0 && Math.random() < mv.sec.ch) {
              pre.push({ f: () => { this.applyStatus(t, mv.sec.status, pre, true); } });
            }
          }
        } else if (mv.effect) {
          const ef = mv.effect;
          if (ef.stat) {
            stT[ef.stat] = Math.max(-6, Math.min(6, stT[ef.stat] + ef.delta));
            const nm = { atk: 'ATAQUE', def: 'DEFENSA', spe: 'VELOCIDAD', acc: 'PRECISIÓN' }[ef.stat];
            pre.push({ t: '¡' + nm + ' de ' + t.name + '\n' + (ef.delta < 0 ? 'bajó!' : 'subió!') });
          } else if (ef.status) {
            this.applyStatus(t, ef.status, pre, false);
          }
        }
        // Comprobación de debilitamiento del objetivo
        pre.push({ f: () => { if (t.hp <= 0) this.handleFaint(!isPlayer ? true : false, isPlayer); } });
        this.steps.unshift(...pre);
      },
    });
  },

  applyStatus(t, status, pre, silent) {
    if (t.status) { if (!silent) pre.push({ t: '¡Pero falló!' }); return; }
    t.status = status;
    pre.push({ f: () => AudioFX.statusSound(status) });
    pre.push({ t: '¡' + t.name + (status === 'PAR' ? ' está\nparalizado!' : ' fue\nenvenenado!') });
  },

  // faintIsPlayerSide: el que cayó es del jugador. attackerIsPlayer: quién pegó.
  handleFaint(faintIsPlayerSide, attackerIsPlayer) {
    const fainted = faintIsPlayerSide ? this.pm() : this.em();
    if (fainted.hp > 0) return;
    // purga acciones restantes del turno
    this.steps = this.steps.filter(s => s.keep);
    AudioFX.faint();
    this.steps.push({ t: '¡' + fainted.name + ' se\ndebilitó!' });
    if (!faintIsPlayerSide) {
      // Experiencia
      const xp = expGain(fainted);
      const p = this.pm();
      this.steps.push({ t: p.name + ' ganó\n' + xp + ' EXP.' });
      this.queueExp(p, xp);
      if (!this.wild && this.enemyIdx < this.enemyParty.length - 1) {
        this.steps.push({
          f: () => {
            this.enemyIdx++;
            this.stE = { atk: 0, def: 0, spe: 0, acc: 0 };
            this.steps.unshift({ t: '¡' + this.trainerName + ' sacó a\n' + this.em().name + '!' });
          },
        });
        this.steps.push({ f: () => { this.menu = 'main'; this.sel = 0; } });
      } else {
        if (!this.wild) {
          this.steps.push({ t: '¡Has derrotado a\n' + this.trainerName + '!' });
          this.steps.push({ f: () => { AudioFX.victory(); Game.money += this.prize; } });
          this.steps.push({ t: 'Ganaste ' + this.prize + '₽\npor la victoria.' });
        }
        this.steps.push({ f: () => this.end('win') });
      }
    } else {
      const alive = Game.party.filter(m => m.hp > 0);
      if (alive.length) {
        this.steps.push({ f: () => { this.menu = 'forced'; this.sel = Game.party.findIndex(m => m.hp > 0); } });
      } else {
        this.steps.push({ t: '¡No te quedan POKéMON!' });
        this.steps.push({ t: 'Todo se volvió oscuro...' });
        this.steps.push({ f: () => this.end('lose') });
      }
    }
  },

  queueExp(mon, xp) {
    this.steps.push({
      f: () => {
        mon.exp += xp;
        const ups = [];
        while (mon.exp >= expForLevel(mon.level + 1)) {
          mon.level++;
          const old = mon.maxhp;
          const ns = calcStats(mon.id, mon.level, mon.ivs);
          mon.maxhp = ns.maxhp; mon.stats = ns;
          mon.hp = Math.min(mon.maxhp, mon.hp + (ns.maxhp - old));
          ups.push({ t: '¡' + mon.name + ' subió al\nnivel ' + mon.level + '!', f0: () => AudioFX.levelUp() });
          for (const [lv, mv] of SPECIES[mon.id].learn) {
            if (lv === mon.level && !mon.moves.find(m => m.key === mv)) {
              if (mon.moves.length < 4) {
                mon.moves.push({ key: mv, pp: MOVES[mv].pp, maxpp: MOVES[mv].pp });
                ups.push({ t: '¡' + mon.name + ' aprendió\n' + MOVES[mv].name + '!' });
              } else {
                const old = mon.moves.shift();
                mon.moves.push({ key: mv, pp: MOVES[mv].pp, maxpp: MOVES[mv].pp });
                ups.push({ t: mon.name + ' olvidó ' + MOVES[old.key].name + '\ny aprendió ' + MOVES[mv].name + '!' });
              }
            }
          }
        }
        for (const u of ups) { if (u.f0) u.f0(); }
        this.steps.unshift(...ups.map(u => ({ t: u.t, keep: true })));
      },
      keep: true,
    });
  },

  queueItem(key) {
    this.outcomePending = false;
    if (key === 'POTION' || key === 'SUPERPOT') {
      const p = this.pm();
      Game.bag[key]--;
      const healed = Math.min(ITEMS[key].heal, p.maxhp - p.hp);
      this.steps.push({ f: () => { AudioFX.heal(); p.hp += healed; } });
      this.steps.push({ t: '¡' + p.name + ' recuperó\n' + healed + ' PS!' });
    } else if (key === 'POKEBALL') {
      Game.bag.POKEBALL--;
      const e = this.em();
      this.steps.push({ f: () => AudioFX.ball() });
      this.steps.push({ t: '¡Has lanzado una\nPOKÉ BALL!' });
      if (Math.random() < catchChance(e)) {
        for (let i = 0; i < 3; i++) this.steps.push({ t: '...clic...', f0: 1 });
        this.steps.push({ f: () => AudioFX.catchOk() });
        this.steps.push({ t: '¡Genial! ¡' + e.name + '\nfue atrapado!' });
        this.steps.push({
          f: () => {
            e.status = null;
            if (Game.party.length < 6) { Game.party.push(e); this.steps.unshift({ t: e.name + ' se unió\na tu equipo.' }); }
            else { Game.box.push(e); this.steps.unshift({ t: e.name + ' fue enviado\nal PC de BILL.' }); }
          },
        });
        this.steps.push({ f: () => this.end('catch') });
        this.outcomePending = true;
        this.nextStep();
      } else {
        const sh = 1 + rnd(2);
        for (let i = 0; i < sh; i++) this.steps.push({ t: '...clic...' });
        this.steps.push({ t: '¡Oh, no! ¡El POKéMON\nse ha escapado!' });
      }
    }
  },

  // Veneno al final del turno y vuelta al menú.
  afterActions() {
    this.steps.push({
      f: () => {
        const post = [];
        for (const [mon, isP] of [[this.pm(), true], [this.em(), false]]) {
          if (mon.hp > 0 && mon.status === 'PSN') {
            const d = Math.max(1, Math.floor(mon.maxhp / 16));
            mon.hp = Math.max(0, mon.hp - d);
            post.push({ t: '¡El veneno resta PS\na ' + mon.name + '!' });
            if (mon.hp <= 0) post.push({ f: () => this.handleFaint(isP, !isP) });
          }
        }
        this.steps.unshift(...post);
      },
    });
  },

  endQueue() {
    this.steps.push({ f: () => { if (this.active && !this.menu) { this.menu = 'main'; this.sel = 0; } } });
    this.nextStep();
  },

  end(outcome) {
    this.active = false;
    this.outcome = outcome;
    this.steps = []; this.text = null; this.menu = null;
    this.resetStages();
    Game.endBattle(outcome);
  },

  // ---- Dibujado ----
  draw(ctx) {
    ctx.fillStyle = PAL[0];
    ctx.fillRect(0, 0, SCR_W, SCR_H);
    const e = this.em(), p = this.pm();
    if (!e || !p) return;

    // Enemigo (escala según el tamaño del sprite para que mida ~48px)
    const esp = Horror.spriteFor(e.id);
    drawSprite(ctx, esp, 104, 6, 48 / spriteDim(esp), false);
    drawBox(ctx, 2, 2, 88, 28);
    uiText(ctx, e.name, 6, 12);
    uiText(ctx, 'N.' + e.level + (e.status ? ' ' + e.status : ''), 6, 20);
    drawHPBar(ctx, 8, 24, 70, e.hp, e.maxhp);

    // Jugador (escala según el tamaño del sprite para que mida ~48px)
    const psp = Horror.spriteFor(p.id);
    drawSprite(ctx, psp, 12, 50, 48 / spriteDim(psp), true);
    drawBox(ctx, 66, 62, 92, 34);
    uiText(ctx, p.name, 70, 72);
    uiText(ctx, 'N.' + p.level + (p.status ? ' ' + p.status : ''), 70, 80);
    drawHPBar(ctx, 72, 84, 70, p.hp, p.maxhp);
    uiText(ctx, p.hp + '/' + p.maxhp, 100, 93);

    // Caja de texto
    drawBox(ctx, 0, 98, 160, 46);
    if (this.text !== null) {
      const lines = this.text.split('\n');
      lines.forEach((l, i) => uiText(ctx, l, 8, 112 + i * 11));
      uiText(ctx, '▼', 146, 138);
    } else if (this.menu === 'main') {
      const opts = ['LUCHA', 'MOCHILA', 'PKMN', 'HUIR'];
      opts.forEach((o, i) => {
        const x = 14 + (i % 2) * 76, y = 114 + ((i / 2) | 0) * 14;
        uiText(ctx, o, x, y);
        if (this.sel === i) uiText(ctx, '►', x - 9, y);
      });
    } else if (this.menu === 'moves') {
      const mv = p.moves;
      mv.forEach((m, i) => {
        const y = 108 + i * 9;
        uiText(ctx, MOVES[m.key].name, 16, y);
        uiText(ctx, m.pp + '/' + m.maxpp, 122, y);
        if (this.sel === i) uiText(ctx, '►', 7, y);
      });
    } else if (this.menu === 'bag') {
      const items = this.bagItems();
      if (!items.length) uiText(ctx, 'No tienes objetos útiles.', 8, 114);
      items.forEach(([k, n], i) => {
        const y = 110 + i * 10;
        uiText(ctx, ITEMS[k].name + ' x' + n, 16, y);
        if (this.sel === i) uiText(ctx, '►', 7, y);
      });
    } else if (this.menu === 'pkmn' || this.menu === 'forced') {
      Game.party.forEach((m, i) => {
        const y = 108 + i * 9;
        uiText(ctx, m.name + ' N.' + m.level + ' ' + m.hp + '/' + m.maxhp + (m.hp <= 0 ? ' KO' : ''), 16, y);
        if (this.sel === i) uiText(ctx, '►', 7, y);
      });
    }
  },
};
