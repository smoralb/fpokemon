// Sistema de terror: visiones de la "realidad", asaltos y diálogos turbios.
// El mundo Pokémon es la ilusión de un niño ingresado en un psiquiátrico.
// Los asaltos tienen dos tipos:
//   - Aleatorios: solo cuando el jugador está en movimiento activo (keys)
//   - Scriptados: atados a flags de la historia (ver SCRIPTED_ASSAULTS)

const VISION_SPRITE = {
  NURSE: 'DOCTOR', OAK: 'DOCTOR', CLERK: 'DOCTOR',
  MOM: 'PATIENT', GIRL: 'PATIENT', RIVAL: 'PATIENT', MISTY: 'PATIENT',
  BOY: 'CORPSE', BROCK: 'DOCTOR',
};

const VISION_NAMES = {
  pallet: 'PABELLÓN INFANTIL',
  route1: 'ALCANTARILLADO',
  viridian: 'ALA ESTE',
  home: 'HABITACIÓN 9',
  lab: 'CONSULTA 2',
  center: 'SALA DE OBSERVACIÓN',
  mart: 'FARMACIA',
  forest: 'CORREDOR B',
  route2: 'PASILLO EXTERIOR',
  pewter: 'ALA NORTE',
  gym: 'SALA DE CONTENCIÓN',
  pewter_center: 'ENFERMERÍA NORTE',
  pewter_mart: 'ALMACÉN',
  route3: 'CORREDOR C',
  mtmoon: 'ESCALERA DE SERVICIO',
  route4: 'PASILLO EXTERIOR (NORTE)',
  cerulean: 'ALA OESTE',
  crimehouse: 'HABITACIÓN 12',
  cerulean_gym: 'SALA DE HIDROTERAPIA',
  cerulean_center: 'ENFERMERÍA OESTE',
  cerulean_mart: 'ALMACÉN OESTE',
  sewers_a: 'SUBSUELO - A',
  sewers_b: 'SUBSUELO - B',
  sewers_exit: 'SALIDA DE EMERGENCIA',
  palletneighbor: 'HABITACIÓN 7',
  cerulean_house: 'DESPACHO DEL DR. BRICE',
};

const VISION_NARRATIONS = {
  pallet:    ['PABELLÓN INFANTIL', 'Las camas están ancladas al suelo.', 'Huele a lejía.'],
  home:      ['HABITACIÓN 9', 'Tu habitación es más pequeña.', 'Solo hay una cama.'],
  route1:    ['ALCANTARILLADO', 'Un rastro oscuro en las baldosas.', 'El eco de tus pasos.'],
  lab:       ['CONSULTA 2', 'Las estanterías están llenas de carpetas.', 'La tuya es la más gruesa.'],
  forest:    ['CORREDOR B', 'Las puertas tienen ranuras pequeñas.', 'Hay ojos detrás.', 'Cuentas las baldosas. 47.'],
  route2:    ['PASILLO EXTERIOR', 'Fría. Hace frío aquí fuera.', 'Nadie sale nunca al patio.'],
  pewter:    ['ALA NORTE', 'Esta ala lleva meses cerrada.', 'El Dr. Brice trabajaba aquí.'],
  gym:       ['SALA DE CONTENCIÓN', 'Las paredes son de espuma.', 'Las marcas en la espuma son tuyas.'],
  route3:    ['CORREDOR C', 'Más largo que el B.', 'Hay ventanas pero no se ven bien.'],
  mtmoon:    ['ESCALERA DE SERVICIO', 'Cuatro tramos. Siempre subes.', 'Nunca bajas.', 'Hay algo en el último rellano.'],
  route4:    ['PASILLO EXTERIOR (NORTE)', 'El suelo está mojado.', 'No llueve.'],
  cerulean:  ['ALA OESTE', 'Esta ala lleva meses cerrada.', 'Tres camas vacías.', 'La Dra. Marina trabajaba aquí.'],
  cerulean_gym: ['SALA DE HIDROTERAPIA', 'Las camillas tienen correas.', 'Las correas están rotas.'],
  crimehouse: ['HABITACIÓN 12', 'Tres personas vivían aquí.', 'Uno de ellos conocía este pasillo.'],
  route4: ['PASILLO EXTERIOR (NORTE)', 'El suelo está mojado.', 'No llueve dentro.', 'Nunca.'],
};

// Pool de frases turbias que sueltan NPCs normales.
const DARK_POOL = [
  ['No deberías estar fuera de', 'tu habitación a estas horas.'],
  ['Las paredes son blandas', 'si las tocas mucho rato.'],
  ['¿Otra vez hablando solo?', 'Qué niño tan simpático.'],
  ['Ayer te vi dormir.', 'No parpadeas nunca.'],
  ['Aquí siempre hace sol.', 'SIEMPRE hace sol.', '¿No te parece raro?'],
  ['Tu PIKACHU es precioso.', '¿Desde cuándo lo tienes...', 'flotando en ese frasco?'],
  ['El médico dice que mejoras.', 'El médico miente mucho.'],
  ['Cuenta hasta diez si vuelven', 'las luces blancas.', 'A mí me funciona.'],
  ['Llevas aquí tres años.', 'Aunque tú creas que es un día.'],
  ['Nadie ha salido por esa puerta', 'desde que yo recuerde.'],
  // nuevas
  ['¿Sabes qué día es hoy?', '...', 'Ni yo.', 'Aquí los días no cuentan.'],
  ['Tu madre firmó los papeles.', 'Eso es lo único que sé.', 'Los demás, no sé.'],
  ['El niño de la cama 7', 'dejó de hablar hace semanas.', 'Antes hablaba de POKéMON también.'],
  ['Hay una foto en tu mesilla.', 'Una persona y un niño pequeño.', 'El niño sonríe mucho.', '...¿Sigues sonriendo así?'],
  ['¿Cuándo fue la última vez', 'que dormiste de verdad?', 'Aquí el sueño no cuenta.', 'Aquí todo es sueño.'],
  ['Huele diferente hoy.', 'Como cuando cambian', 'la medicación.', '¿Notas algo raro?'],
];

// Asaltos aleatorios (pool para cuando el jugador se mueve).
const RANDOM_ASSAULTS = [
  {
    sprite: 'PATIENT',
    lines: ['...', '¿TAMBIÉN LOS OYES?'],
    prompt: '¿LOS OYES?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['ENTONCES AÚN ESTÁS AQUÍ.', 'BIEN. NO TE VAYAS NUNCA.'],
      ['MIENTES.', 'SIEMPRE MIENTES, ROJO.'],
    ],
    sanity: [-1, +1], // [si elige SÍ, si elige NO]
  },
  {
    sprite: 'DOCTOR',
    lines: ['Buenas tardes.', '¿TE HAS TOMADO LA MEDICACIÓN?'],
    prompt: '¿MEDICACIÓN?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['Buen chico.', 'Sigue soñando entonces.'],
      ['Por eso sigues viendo', 'todo esto.'],
    ],
    sanity: [-1, +1],
  },
  {
    sprite: 'PATIENT',
    lines: ['T-tú... tú...', '¿CÓMO SE LLAMA TU MADRE?'],
    prompt: '¿LO RECUERDAS?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['QUÉ RARO.', 'ELLA NO VIENE A VERTE', 'DESDE HACE TRES AÑOS.'],
      ['NO PASA NADA.', 'NADIE RECUERDA NADA AQUÍ.'],
    ],
    sanity: [0, +1],
  },
  {
    sprite: 'DOCTOR',
    lines: ['Sujeto 9, sesión 41.', '¿SABES DÓNDE ESTÁS?'],
    prompt: '¿DÓNDE ESTÁS?',
    opts: ['PUEBLO PALETA', 'NO LO SÉ'],
    replies: [
      ['...anota: sin cambios.', 'Seguimos mañana.'],
      ['Interesante.', 'Eso es un avance, ¿sabes?'],
    ],
    sanity: [-1, +1],
  },
  {
    sprite: 'PATIENT',
    lines: ['Eh, psst.', '¿QUIERES SALIR DE AQUÍ?'],
    prompt: '¿QUIERES SALIR?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['Yo también.', 'Yo también quería.', '...'],
      ['Eso dicen todos al principio.'],
    ],
    sanity: [+1, -1],
  },
];

// Asaltos scriptados (se disparan una vez por flag de historia).
// Cada uno tiene: flag (nombre del flag), cond (función), y los datos del asalto.
const SCRIPTED_ASSAULTS = [
  {
    flag: 'assaultRoute1',
    cond: f => f.hasPikachu && !f.assaultRoute1 && !f.rivalBeaten,
    maps: ['route1'],
    sprite: 'DOCTOR',
    lines: ['Para.', '¿Sabes dónde estás, ROJO?'],
    prompt: '¿DÓNDE ESTÁS?',
    opts: ['RUTA 1', 'NO LO SÉ'],
    replies: [
      ['Sigue imaginando.', 'Es lo que mejor se te da.'],
      ['Eso sí es un avance.', 'La semana que viene', 'te enseño el jardín.'],
    ],
    sanity: [-1, +1],
  },
  {
    flag: 'assaultParcel',
    cond: f => f.hasPikachu && f.rivalBeaten && !f.assaultParcel && !f.parcelDelivered,
    maps: ['route1', 'viridian'],
    sprite: 'PATIENT',
    lines: ['Llevas un rato corriendo', 'de un lado a otro.', '¿A QUÉ JUEGAS?'],
    prompt: '¿A QUÉ JUEGAS?',
    opts: ['A POKÉMON', 'NO LO SÉ'],
    replies: [
      ['Claro.', 'Tú siempre a lo mismo.', 'Siempre.'],
      ['Llevas tres años', 'sin saberlo.', '¿Y eso no te preocupa?'],
    ],
    sanity: [-1, +1],
  },
  {
    flag: 'assaultForest',
    cond: f => f.hasPikachu && !f.assaultForest,
    maps: ['forest'],
    sprite: 'PATIENT',
    lines: ['...', 'Este bosque huele raro.', '¿LO NOTAS TÚ TAMBIÉN?'],
    prompt: '¿LO NOTAS?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['La humedad.', 'El olor a desinfectante', 'disfrazado de tierra.'],
      ['Normal.', 'Llevas aquí tanto tiempo', 'que ya no lo notas.'],
    ],
    sanity: [+1, -1],
  },
  {
    flag: 'assaultDeepForest',
    cond: f => f.assaultForest && !f.assaultDeepForest,
    maps: ['forest'],
    sprite: 'DOCTOR',
    lines: ['Sujeto 9.', 'Hoy ha recorrido el', 'Corredor B dos veces.', '¿SABES POR QUÉ LO HACES?'],
    prompt: '¿POR QUÉ?',
    opts: ['ME GUSTA CAMINAR', 'NO LO SÉ'],
    replies: [
      ['Anota: respuesta positiva.', 'Continuar estimulación', 'con el entorno simulado.'],
      ['Anota: desorientación.', 'Aumentar dosis mañana.', '...'],
    ],
    sanity: [-1, +1],
  },
  {
    flag: 'assaultPewter',
    cond: f => !f.assaultPewter && f.arrivedPewter,
    maps: ['pewter'],
    sprite: 'PATIENT',
    lines: ['Oye.', 'Esta ciudad tampoco es real.', '¿LO SABÍAS?'],
    prompt: '¿LO SABÍAS?',
    opts: ['SÍ', 'NO LO SÉ'],
    replies: [
      ['Eso es nuevo.', 'Antes nunca lo reconocías.', 'Estás mejorando, ROJO.'],
      ['No pasa nada.', 'Yo tampoco lo supe', 'durante mucho tiempo.'],
    ],
    sanity: [+1, 0],
  },
  {
    flag: 'assaultPreGym',
    cond: f => f.arrivedPewter && !f.assaultPreGym && !f.brickBadge,
    maps: ['gym', 'pewter'],
    sprite: 'DOCTOR',
    lines: ['ROJO.', 'No tienes que luchar', 'contra nadie.', '¿ENTIENDES?'],
    prompt: '¿LO ENTIENDES?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['Bien.', '...pero lo harás de todos modos.', 'Siempre lo haces.'],
      ['Está bien.', 'La compulsión es parte', 'del proceso.'],
    ],
    sanity: [+1, -1],
  },
  {
    flag: 'assaultMoon',
    cond: f => f.hasPikachu && !f.assaultMoon,
    maps: ['mtmoon'],
    sprite: 'DOCTOR',
    lines: ['Sujeto 9.', 'Esta es la escalera de servicio.', 'No deberías estar aquí.', '¿CÓMO HAS LLEGADO HASTA ACÁ?'],
    prompt: '¿CÓMO LLEGASTE?',
    opts: ['POR EL CAMINO', 'NO LO SÉ'],
    replies: [
      ['Curioso.', 'El camino estaba cerrado.', '¿O no?'],
      ['Lo sabía.', 'Anota: desorientación espacial.', 'Incrementar supervisión.'],
    ],
    sanity: [-1, +1],
  },
  {
    flag: 'assaultCerulean',
    cond: f => !f.assaultCerulean && f.arrivedCerulean,
    maps: ['cerulean'],
    sprite: 'PATIENT',
    lines: ['Oye.', '¿Tú también lo viste?', 'En esa casa.', '¿LO VISTE?'],
    prompt: '¿LO VISTE?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['Yo también.', 'Ya nadie lo menciona.', 'Pero todos lo vimos.'],
      ['Claro que no.', 'Aquí nadie ve nada.', 'Eso es lo peor.'],
    ],
    sanity: [+1, -1],
  },
  {
    flag: 'assaultPreMisty',
    cond: f => f.arrivedCerulean && !f.assaultPreMisty && !f.mistyDefeated,
    maps: ['cerulean_gym', 'cerulean'],
    sprite: 'DOCTOR',
    lines: ['ROJO.', 'La Dra. Marina lleva cuatro meses', 'de baja médica.', '¿SABES POR QUÉ?'],
    prompt: '¿POR QUÉ?',
    opts: ['NO LO SÉ', 'FUI YO'],
    replies: [
      ['Está bien.', 'Está bien no saberlo.', 'Todavía.'],
      ['...', 'Eso es la primera vez', 'que lo dices.', 'Anota: conciencia emergente.'],
    ],
    sanity: [0, +2],
  },
  {
    flag: 'assaultCharmander',
    cond: f => f.charmanderSaved && !f.assaultCharmander,
    maps: ['route3', 'mtmoon', 'route4'],
    sprite: 'DOCTOR',
    lines: ['Sujeto 9.', 'Hoy ha adoptado', 'un objeto del suelo.', 'Una figurita de plástico.', '¿LO SABES?'],
    prompt: '¿LO SABES?',
    opts: ['ES MI CHARMANDER', 'NO LO SÉ'],
    replies: [
      ['...', 'Está bien.', 'Puedes guardar tus cosas.', 'Nadie te las quitará.'],
      ['El objeto es una figurita', 'de un lagarto naranja.', 'Anota: apego objetal.', 'Continuar observación.'],
    ],
    sanity: [+1, 0],
  },
  {
    flag: 'assaultBulbasaur',
    cond: f => f.bulbasaurGot && !f.assaultBulbasaur,
    maps: ['cerulean', 'route4', 'cerulean_gym'],
    sprite: 'PATIENT',
    lines: ['Oye.', 'La chica del ala oeste', '¿te habló?', '¿QUÉ TE DIJO?'],
    prompt: '¿QUÉ TE DIJO?',
    opts: ['ME DIO ALGO', 'NADA'],
    replies: [
      ['...Una planta de plástico.', 'Ella siempre da cosas.', 'Es su manera de decir', 'que te ve.'],
      ['...', 'Mentira piadosa.', 'Todos nos mentimos aquí.', 'Es lo que nos queda.'],
    ],
    sanity: [+1, -1],
  },
  {
    flag: 'assaultRoute4',
    cond: f => f.mistyDefeated && f.rivalRoute4 && !f.assaultRoute4,
    maps: ['route4', 'cerulean', 'mtmoon'],
    sprite: 'DOCTOR',
    lines: ['Sesión 47.', 'El sujeto ha empezado', 'a preguntarse', 'si otros comparten', 'su ilusión.', '¿ES BUENA SEÑAL?'],
    prompt: '¿ES BUENA SEÑAL?',
    opts: ['SÍ', 'NO LO SÉ'],
    replies: [
      ['Quizás.', 'La conciencia compartida', 'es el primer paso.', 'O el último.', '...'],
      ['Nos preguntamos lo mismo.', 'Llevamos tres años', 'sin saberlo.'],
    ],
    sanity: [+1, 0],
  },
  {
    flag: 'assaultFinal',
    cond: f => f.mistyDefeated && !f.assaultFinal,
    maps: ['cerulean', 'cerulean_gym', 'route4', 'mtmoon', 'route3', 'pewter', 'gym'],
    sprite: 'DOCTOR',
    lines: ['Sesión completada.', 'Has llegado muy lejos hoy, ROJO.', '¿QUIERES DESPERTAR?'],
    prompt: '¿DESPERTAR?',
    opts: ['SÍ', 'NO'],
    replies: [
      ['...', 'Vamos a intentarlo.', 'Cierra los ojos.'],
      ['De acuerdo.', 'Descansa.', 'Aquí estaremos cuando cambies', 'de opinión.'],
    ],
    sanity: [+2, -2],
    isFinal: true,
  },
];

const Horror = {
  vision: 0,
  cooldown: 60,
  npc: null,
  phase: 0,

  active() { return this.vision > 0; },

  updatePhase() {
    const f = Game.flags;
    if (f.mistyDefeated) this.phase = 5;
    else if (f.brickBadge) this.phase = 4;
    else if (f.arrivedPewter) this.phase = 3;
    else if (f.hasPikachu && f.rivalBeaten) this.phase = 2;
    else if (f.hasPikachu) this.phase = 1;
    else this.phase = 0;
  },

  spriteFor(key) {
    if (!this.active()) return key;
    if (SPECIES[key]) return 'DEADRAT';
    return VISION_SPRITE[key] || key;
  },

  update(dt) {
    this.updatePhase();
    if (this.vision > 0) {
      this.vision -= dt;
      if (this.vision <= 0) this.endVision();
    }
    if (Engine.glitchT > 0) Engine.glitchT -= dt;

    const st = Game.state;
    if (st !== 'world' || !Game.flags.hasPikachu || this.npc) return;

    // Asaltos scriptados: comprueban condición independientemente del movimiento.
    for (const sa of SCRIPTED_ASSAULTS) {
      if (sa.cond(Game.flags) && (!sa.maps || sa.maps.includes(Game.map))) {
        Game.flags[sa.flag] = true;
        this._doAssault(sa);
        return;
      }
    }

    if (this.phase <= 1) return; // sin asaltos aleatorios en fase 0-1

    // Asaltos aleatorios: solo cuando el jugador está andando.
    const moving = Game.keys['w'] || Game.keys['s'] || Game.keys['arrowup'] || Game.keys['arrowdown'];
    if (!moving) { this.cooldown = Math.max(this.cooldown, 8); return; }

    // Cooldown según fase
    const phaseCooldowns = [180, 180, 90, 60, 45, 30];
    const baseCooldown = phaseCooldowns[this.phase] || 60;

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = baseCooldown * (0.7 + Math.random() * 0.6);
      const visionChances = [0, 0, 0.20, 0.35, 0.40, 0.50];
      const visionMaxDurs = [0, 0, 3, 8, 20, 40];
      if (Math.random() < (visionChances[this.phase] || 0.35)) {
        this.startVision((visionMaxDurs[this.phase] || 3) * (0.5 + Math.random() * 0.5));
      } else {
        this._doAssault(RANDOM_ASSAULTS[rnd(RANDOM_ASSAULTS.length)]);
      }
    }
  },

  startVision(dur) {
    this.vision = Math.max(this.vision, dur);
    Engine.vision = true;
    Engine.glitchT = 0.45;
    setPalette(HORROR_PAL);
    AudioFX.droneStart();
    Music.setHorror(true);
  },

  endVision() {
    if (!Engine.vision) return;
    if (Game.flags && Game.flags.inSewers) return;
    this.vision = 0;
    Engine.vision = false;
    Engine.glitchT = 0.45;
    setPalette(BASE_PAL);
    AudioFX.droneStop();
    Music.setHorror(false);
  },

  _doAssault(q) {
    const ax = Game.x + Math.cos(Game.ang) * 1.5;
    const ay = Game.y + Math.sin(Game.ang) * 1.5;
    if (isWallTile(tileAt(Game.map, ax | 0, ay | 0))) return;
    this.npc = { x: ax, y: ay, sprite: q.sprite, temp: true };
    AudioFX.sting();
    this.startVision(30);
    Engine.glitchT = 0.6;
    Game.say(q.lines, () => {
      Game.choose(q.prompt, q.opts, i => {
        // Actualizar cordura
        const delta = q.sanity ? q.sanity[i] : 0;
        Game.flags.sanity = Math.max(0, Math.min(4, (Game.flags.sanity || 0) + delta));
        // Final alternativo
        if (q.isFinal) {
          Game.flags.endingChoice = i === 0 ? 'wake' : 'stay';
          this._triggerEnding(i);
          return;
        }
        Game.say(q.replies[i], () => { this.npc = null; this.endVision(); });
      });
    });
  },

  // Cuatro finales según cordura + elección del asalto final.
  _triggerEnding(choice) {
    const sanity = Game.flags.sanity || 0;
    const endVision = () => this.endVision();
    const clearNpc = () => { this.npc = null; };

    if (choice === 0 && sanity >= 3) {
      // FINAL D — La Fuga: cordura alta + quiso salir → alcantarillas.
      Game.say(['...', '...Abres los ojos.', 'De verdad esta vez.', 'No es el PUEBLO PALETA.',
        'El techo tiene manchas de humedad.', 'Huele a hospital.', 'Hay una puerta.', '¿La hay?'], () => {
        clearNpc(); endVision();
        Game.flags.ending = 'D';
        Game.flags.inSewers = true;
        Game.warpTo({ to: 'sewers_a', x: 6.5, y: 2.5, ang: Math.PI / 2 });
      });
    } else if (choice === 0 && sanity < 3) {
      // FINAL C — Intento fallido: quiso despertar pero no estaba listo.
      Game.say(['Cierras los ojos.', '...', '...', 'Cuando los abres,',
        'sigues en PUEBLO PALETA.', 'PIKACHU te mira.', '¿Y qué ibas a hacer?'], () => {
        clearNpc(); endVision();
        Game.flags.ending = 'C';
        Game.say(['* FIN C: AÚN NO *',
          'La ilusión sigue en pie.',
          'Quizás la próxima vez.']);
      });
    } else if (choice === 0) {
      // FINAL B — Despertar: quiso salir pero cordura media (fallback).
      Game.say(['...', '...', 'La habitación huele a desinfectante.', 'Una mano sostiene la tuya.',
        'Afuera hay luz.', 'Hoy es el primer día que lo ves.'], () => {
        clearNpc(); endVision();
        Game.flags.ending = 'B';
        Game.say(['* FIN B: LA GRIETA *',
          'Saliste de la ilusión.',
          'O eso crees.']);
      });
    } else {
      // FINAL A — La ilusión perfecta: eligió quedarse.
      Game.say(['De acuerdo.', '...', 'El sol brilla sobre PUEBLO PALETA.',
        'PIKACHU corre delante de ti.',
        'Todo está bien.', 'Todo está bien.', 'TODO ESTÁ BIEN.'], () => {
        clearNpc(); endVision();
        Game.flags.ending = 'A';
        Game.say(['* FIN A: LA ILUSIÓN PERFECTA *',
          'Elegiste quedarte.',
          '...puedes seguir jugando.']);
      });
    }
  },

  twist(npc) {
    if (!Game.flags.hasPikachu) return npc.lines;
    const r = Math.random();
    let lines = npc.lines;
    if (npc.dark && r < 0.25) lines = npc.dark;
    else if (r < 0.35) lines = DARK_POOL[rnd(DARK_POOL.length)];
    if (Math.random() < 0.08) lines = lines.map(l => this.corrupt(l));
    return lines;
  },

  corrupt(line) {
    let out = '';
    for (const ch of line) out += (ch !== ' ' && Math.random() < 0.12) ? '█' : ch;
    return out;
  },

  pet(mon) {
    const sanity = Game.flags.sanity || 0;
    if (Math.random() < 0.3 || sanity <= 1) {
      this.startVision(5);
      const dark = sanity <= 1
        ? ['Acaricias algo frío.', 'No se mueve.', 'Hace mucho que no se mueve.', '...']
        : ['Acaricias a ' + mon.name + '...', 'El pelaje está frío y húmedo.', 'No se mueve.', 'Hace mucho que no se mueve.'];
      Game.say(dark);
    } else {
      AudioFX.cry(mon.id);
      Game.say(['Acaricias a ' + mon.name + '.', '¡' + mon.name + ' parece contento!']);
    }
  },

  // Indicador visual de cordura: una grieta sutil en la esquina.
  drawSanityHint(ctx) {
    const s = Game.flags.sanity || 0;
    if (s <= 0) return;
    ctx.fillStyle = PAL[3];
    ctx.font = '6px monospace';
    // Dibuja 's' píxeles rotos en la esquina superior izquierda, casi ilegibles.
    for (let i = 0; i < s; i++) {
      ctx.fillText('█', 2 + i * 4, 6 + (rnd(3) - 1));
    }
  },

  draw(ctx) {
    this.drawSanityHint(ctx);
    if (this.active() && VISION_NAMES[Game.map] && rnd(10) < 8) {
      ctx.fillStyle = PAL[3];
      ctx.font = '7px monospace';
      ctx.fillText(VISION_NAMES[Game.map], 4 + rnd(2), 10 + rnd(2));
    }
    if (this.active() && this.phase >= 3) {
      const narr = VISION_NARRATIONS[Game.map];
      if (narr && narr.length > 0) {
        const idx = Math.floor(Game.time * 0.4) % narr.length;
        ctx.fillStyle = PAL[3];
        ctx.font = '7px monospace';
        ctx.fillText(narr[idx], 4, 20);
      }
    }
  },

  // Asalto scriptado externo (llamado desde main.js si se necesita).
  assault() {
    this._doAssault(RANDOM_ASSAULTS[rnd(RANDOM_ASSAULTS.length)]);
  },
};
