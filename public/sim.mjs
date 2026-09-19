/*
 * Kart Party — simulación sin pantalla.
 *
 * Aquí vive toda la física del juego: circuitos, karts, saltos, objetos, bots, vueltas y
 * clasificación. Este archivo no dibuja nada y no sabe nada del navegador: cada cosa que se ve,
 * se oye o se envía a los móviles sale por un «hook» (ver DEFAULT_HOOKS). Así la misma simulación
 * corre en la tele (`screen.js` le pone las mallas de three.js) y en las pruebas de `npm test`,
 * que la hacen correr carreras de bots a toda velocidad sin abrir un navegador.
 *
 * Es `.mjs` (y no `.js`) a propósito: `package.json` no tiene `"type": "module"`, así que Node
 * trataría un `.js` como CommonJS al importarlo desde las herramientas.
 *
 * Coordenadas: el plano del circuito es (x, y) en 1920x1080; la altura del kart es `z`.
 * Cada objeto de la simulación tiene una ranura `view` que la simulación nunca lee: ahí guarda
 * `screen.js` su malla.
 */

// ===================== Constantes =====================
export const MAP_W = 1920, MAP_H = 1080;
export const DT = 1 / 60;
export const KART_R = 15;
export const BASE_MAX_SPEED = 420;   // unidades/s (sube o baja este número para karts más rápidos o más lentos)
export const ACCEL = 460, BRAKE = 750, COAST = 240;
export const GRAVITY = 950;          // unidades/s²
export const SPIN_TIME = 1.0;
// Tras un golpe, este rato sin que te puedan volver a dar (se suma al trompo). Con 2,5 s, lo más
// que te pueden pegar son 3 golpes en 10 s: nadie se queda sin jugar a base de caparazones.
export const HIT_IMMUNITY = 2.5;
export const ROULETTE_TIME = 1.6;
export const BOX_RESPAWN = 5;
// Rescate automático (el «Lakitu»): si un kart se queda clavado o muy lejos de la carretera,
// se le recoloca en la pista mirando bien, y pierde un momento: esa es toda la penalización.
export const RESCUE_AFTER = 3;    // segundos perdido o atascado antes de que lo recojan
export const RESCUE_TIME = 1.2;   // lo que tarda la maniobra (el kart no se mueve)
export const RESCUE_FAR = 140;    // a esta distancia del borde de la carretera ya está «perdido»
export const RESCUE_SLOW = 40;    // por debajo de esta velocidad se considera parado
// Bots: si el morro apunta a más de este ángulo (radianes) del camino, el bot va de espaldas;
// suelta el gas y frena hasta encararse, y solo da marcha atrás cuando ya casi está parado.
export const AI_WRONG_ANGLE = 2.0;
// Derrape automático (sin botón): mantener el giro en la misma dirección a buena velocidad entra
// solo en derrape, y cuanto más se aguante, más turbo al soltar. Los tiempos se cuentan desde que
// se empieza a girar, así que DRIFT_START es «cuándo empieza a deslizar» y DRIFT_L1..3 «qué nivel
// lleva». Subir estos números hace el derrape más difícil de cargar; bajarlos, más regalado.
export const DRIFT_START = 0.30;     // s girando igual antes de que el kart empiece a deslizar
export const DRIFT_MIN_SPEED = 0.55; // fracción de la velocidad máxima por debajo de la cual no se derrapa
export const DRIFT_L1 = 0.5;         // s para el nivel 1 (chispas azules)
export const DRIFT_L2 = 0.9;         // s para el nivel 2 (naranjas)
export const DRIFT_L3 = 1.4;         // s para el nivel 3 (rosas)
export const DRIFT_BOOST = [0.6, 1.0, 1.6];  // s de turbo al soltar, por nivel
export const DRIFT_TURN = 1.4;       // cuánto gira de más mientras derrapa
// Progreso: cuando un kart aparece de golpe muy por delante (ha volado por encima de un atajo), su
// avance no se cuenta… pero solo durante este rato. Pasado eso se acepta, para no dejarle la
// clasificación congelada media vuelta.
export const PROGRESS_JUMP_WAIT = 1.0;   // segundos
// Rayo: a quien le cae no le puede volver a caer en este rato. Sin esto, dos rayos seguidos dejaban
// al líder encogido media carrera y sin nada que hacer, que es justo lo que no queremos en la fiesta.
export const LIGHTNING_IMMUNITY = 30;   // segundos
export const MAX_KARTS = 8;
export const SAMPLE_SPACING = 8;

export const CHARS = [
  { name: 'Rana', emoji: '🐸', color: '#39ff88', accent: '#ff2d95' },
  { name: 'Zorro', emoji: '🦊', color: '#ff8a00', accent: '#00e5ff' },
  { name: 'Panda', emoji: '🐼', color: '#ffffff', accent: '#ff2d95' },
  { name: 'Tigre', emoji: '🐯', color: '#ffe600', accent: '#9b3bff' },
  { name: 'Unicornio', emoji: '🦄', color: '#ff5ec8', accent: '#00e5ff' },
  { name: 'Pulpo', emoji: '🐙', color: '#9b3bff', accent: '#ffe600' },
  { name: 'Pingüino', emoji: '🐧', color: '#00e5ff', accent: '#ffe600' },
  { name: 'Dino', emoji: '🦖', color: '#ff3d3d', accent: '#39ff88' },
];
export const ITEMS = {
  mushroom: { icon: '🍄', name: 'Champiñón' },
  banana: { icon: '🍌', name: 'Plátano' },
  green: { icon: '🐢', name: 'Caparazón verde' },
  red: { icon: '🎯', name: 'Caparazón rojo' },
  star: { icon: '⭐', name: 'Estrella' },
  lightning: { icon: '⚡', name: 'Rayo' },
};
export const ITEM_IDS = Object.keys(ITEMS);

// ===================== Utilidades =====================
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function ordinal(n) { return `${n}º`; }

// malla de alturas del terreno que rodea la carretera
export const TER = { x0: -700, y0: -600, cell: 24, cols: 0, rows: 0 };
TER.cols = Math.ceil((MAP_W + 1400) / TER.cell) + 1;
TER.rows = Math.ceil((MAP_H + 1200) / TER.cell) + 1;

// ===================== Circuitos =====================
// `geom` es el módulo compartido public/geom.js (spline + remuestreo).
export function buildTrack(def, index, geom) {
  const samples = geom.buildSamples(def.points, SAMPLE_SPACING);
  const N = samples.length;
  const halfW = def.width / 2;
  const elev = new Float32Array(N);
  for (const f of def.features || []) {
    const start = Math.floor(f.at * N);
    const len = Math.max(2, Math.round(f.length / SAMPLE_SPACING));
    for (let j = 0; j < len; j++) {
      const i = (start + j) % N, u = j / len;
      if (f.type === 'hill') elev[i] += f.height * 0.5 * (1 - Math.cos(u * Math.PI * 2));
      else if (f.type === 'ramp') elev[i] += f.height * u;
    }
  }
  samples.forEach((s, i) => { s.nx = -Math.sin(s.ang); s.ny = Math.cos(s.ang); s.h = elev[i]; });

  const t = {
    def, index, name: def.name, samples, N, halfW, width: def.width, gravity: def.gravity || 1,
    win: Math.floor(N / 8), boxes: [], grid: [], pads: [], barriers: [], ramps: [], world: null,
    nearest(x, y) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < N; i++) {
        const dx = samples[i].x - x, dy = samples[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      const s = samples[bi];
      return { i: bi, d: Math.sqrt(bd), lat: (x - s.x) * s.nx + (y - s.y) * s.ny };
    },
    // Muestra más cercana mirando solo alrededor del índice `i0` (±win). Sirve para no confundir
    // dos tramos de carretera que pasan cerca (una horquilla): a cada kart se le busca su tramo.
    nearestNear(x, y, i0, win) {
      let bi = ((i0 % N) + N) % N, bd = Infinity;
      for (let j = -win; j <= win; j++) {
        const i = (((i0 + j) % N) + N) % N;
        const dx = samples[i].x - x, dy = samples[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      const s = samples[bi];
      return { i: bi, d: Math.sqrt(bd), lat: (x - s.x) * s.nx + (y - s.y) * s.ny };
    },
    groundAt(x, y) {
      const near = this.nearest(x, y);
      if (near.d <= halfW + 14) return samples[near.i].h;
      return this.terrainAt(x, y);
    },
    terrainAt(x, y) {
      const gx = clamp((x - TER.x0) / TER.cell, 0, TER.cols - 1.001), gy = clamp((y - TER.y0) / TER.cell, 0, TER.rows - 1.001);
      const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const h = this.terrain;
      const a = h[iy * TER.cols + ix], b = h[iy * TER.cols + ix + 1], c = h[(iy + 1) * TER.cols + ix], d = h[(iy + 1) * TER.cols + ix + 1];
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    },
    inRange(i, from, to) { return from <= to ? (i >= from && i <= to) : (i >= from || i <= to); },
  };
  for (const f of def.boxes) {
    const i = Math.floor(f * N) % N, s = samples[i];
    for (const off of [-halfW * 0.6, 0, halfW * 0.6]) t.boxes.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, respawnAt: 0, view: null });
  }
  for (const f of def.pads || []) t.pads.push(Math.floor(f * N) % N);
  for (const b of def.barriers || []) {
    const from = Math.floor(b.from * N) % N, to = Math.floor(b.to * N) % N;
    let side = 0;
    if (b.side === 'outer') {
      let sum = 0;
      for (let i = from; i !== to; i = (i + 1) % N) sum += wrapAngle(samples[(i + 1) % N].ang - samples[i].ang);
      side = sum > 0 ? -1 : 1; // el exterior de la curva es el lado contrario al giro
    }
    t.barriers.push({ from, to, side });
  }
  for (const f of (def.features || []).filter((q) => q.type === 'ramp')) {
    const start = Math.floor(f.at * N);
    t.ramps.push({ start, end: (start + Math.round(f.length / SAMPLE_SPACING)) % N, height: f.height });
  }
  for (let k = 0; k < MAX_KARTS; k++) {
    const row = Math.floor(k / 2), col = k % 2;
    const idx = N - 8 - row * 7 - col * 3;
    const s = samples[idx];
    const off = (col === 0 ? -1 : 1) * halfW * 0.45;
    t.grid.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, ang: s.ang, dist: idx - N });
  }
  // relieve del terreno alrededor de la carretera
  const rnd = mulberry32(77 + index * 31);
  t.terrain = new Float32Array(TER.cols * TER.rows);
  for (let iy = 0; iy < TER.rows; iy++) {
    for (let ix = 0; ix < TER.cols; ix++) {
      const x = TER.x0 + ix * TER.cell, y = TER.y0 + iy * TER.cell;
      const near = t.nearest(x, y);
      const w = 1 - smoothstep(halfW + 40, halfW + 220, near.d);
      const hills = 12 * (Math.sin(x * 0.0065 + 0.4) * Math.cos(y * 0.0079) + 0.6 * Math.sin(x * 0.013 + 1.7) * Math.sin(y * 0.011 + 0.9));
      t.terrain[iy * TER.cols + ix] = lerp(hills, samples[near.i].h, w);
    }
  }
  t.rnd = rnd;
  return t;
}

// ===================== Hooks =====================
/*
 * Todo lo que la simulación «hace hacia fuera» pasa por aquí. Todos son opcionales y no hacen nada
 * por defecto: quien no los pasa (las pruebas) simplemente no ve ni oye nada.
 */
export const DEFAULT_HOOKS = {
  onPhase() {},                 // (fase) cambio de fase: 'lobby' | 'countdown' | 'race' | 'results'
  onCountdown() {},             // (n) 3, 2, 1
  onGo() {},                    // ¡YA!
  onTrackChanged() {},          // (circuito)
  onKartAdded() {},             // (kart) aquí screen.js le cuelga el modelo en k.view
  onKartRemoved() {},           // (kart)
  onSfx() {},                   // (nombre, kart)
  onParticles() {},             // (x, altura, y, opciones)
  onToast() {},                 // (texto, segundos)
  onStatus() {},                // (kart) hay que reenviar su estado al móvil
  onFx() {},                    // (kart, tipo) aviso al móvil: vibración, color…
  onHit() {},                   // (kart, causa) le han dado; causa = { id, tipo } de quien se lo ha hecho
  onShake() {},                 // (intensidad, kart)
  onFlash() {},                 // fogonazo de pantalla (rayo)
  onSquash() {},                // (kart, impulso) aplasta el kart
  onStretch() {},               // (kart, impulso) estira el kart
  onProjectileAdded() {},       // (proyectil)
  onProjectileRemoved() {},     // (proyectil)
  onBananaAdded() {},           // (plátano)
  onBananaRemoved() {},         // (plátano)
  onDrift() {},                 // (kart, nivel) 1, 2, 3 al subir de nivel; -1 cuando suelta el derrape
  onRescue() {},                // (kart) lo han recogido y devuelto a la pista
  onResults() {},               // (clasificación final)
};

// ===================== La simulación =====================
/*
 * `random` es la única fuente de azar de la simulación (parrilla, maña de los bots, ruleta de
 * objetos…): pasándole una semilla, dos carreras iguales salen idénticas. El valor por defecto es
 * la referencia a la función del sistema; la simulación nunca la llama directamente.
 */
export function createSim({ geom, trackDefs, hooks: userHooks = {}, random = Math.random } = {}) {
  const hooks = { ...DEFAULT_HOOKS, ...(userHooks || {}) };
  const tracks = trackDefs.map((def, i) => buildTrack(def, i, geom));

  const state = {
    phase: 'lobby',
    track: tracks[0],
    laps: 3,
    karts: [], projectiles: [], bananas: [],
    countdownT: 0, cdStep: -1, raceTime: 0, goFlash: 0,
    firstFinish: 0, finishedCount: 0, endAt: 0, results: null,
    simTime: 0,
  };
  // `itemsByPos[posición][objeto]` = cuántas veces ha salido ese objeto a quien iba en esa posición:
  // es la forma de comprobar que el reparto por posición hace lo que dice `rollItem`.
  const stats = { jumps: 0, tricks: 0, boings: 0, bumps: 0, pads: 0, maxAir: 0, pickups: 0, itemsUsed: 0, hits: 0, rescues: 0, itemsByPos: {} };
  let simTime = 0;
  let statusTimer = 0;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ===================== Karts =====================
  function displayLap(k) { return clamp(k.lapCount + 1, 1, state.laps); }

  function makeKart(e, g) {
    const ch = CHARS[e.char];
    return {
      id: e.playerId != null ? 'p' + e.playerId : e.kb ? 'kb' : 'bot' + e.char,
      playerId: e.playerId != null ? e.playerId : null,
      isKb: !!e.kb, isBot: !!e.bot, isHuman: !e.bot,
      name: e.name, char: e.char, emoji: ch.emoji, color: ch.color,
      skill: 0.86 + random() * 0.1,
      lane: (random() * 2 - 1) * state.track.halfW * 0.5,
      x: g.x, y: g.y, z: g.h, vz: 0, air: false, ground: g.h, angle: g.ang, moveAngle: g.ang, speed: 0,
      dist: g.dist, lapCount: -1, rank: 1, offroad: false,
      item: null, rolling: null, itemUseAt: 0,
      boostUntil: 0, starUntil: 0, spinUntil: 0, invUntil: 0, shrinkUntil: 0,
      zapUntil: 0, hitsTaken: 0, aheadT: 0, driftT: 0, driftDir: 0, driftLevel: 0, steerT: 0, steerDir: 0, trick: false, trickAngle: 0, sPrev: 0, stuckT: 0, rescueUntil: 0, airT: 0, lastPad: -1, lastPadAt: 0, lastBoing: 0, dustT: 0,
      finished: false, finishTime: 0, finishRank: 0,
      input: { s: 0, g: 0, b: 0, d: 0 },
      view: null,
    };
  }

  function setInput(k, input) {
    if (!k || !input) return;
    k.input.s = input.s || 0; k.input.g = input.g || 0; k.input.b = input.b || 0; k.input.d = input.d || 0;
  }

  // Circuito que se ve en la sala (solo antes de empezar)
  function setTrack(index) {
    if (state.phase !== 'lobby') return;
    const i = ((index % tracks.length) + tracks.length) % tracks.length;
    state.track = tracks[i];
    hooks.onTrackChanged(state.track);
  }

  function startRace({ entries, trackIndex, laps } = {}) {
    if (state.phase !== 'lobby') return false;
    const list = (entries || []).slice(0, MAX_KARTS);
    if (!list.length) return false;
    for (const k of state.karts) hooks.onKartRemoved(k);
    if (Number.isInteger(trackIndex)) state.track = tracks[((trackIndex % tracks.length) + tracks.length) % tracks.length];
    hooks.onTrackChanged(state.track);
    if (Number.isInteger(laps)) state.laps = clamp(laps, 1, 9);
    for (const b of state.track.boxes) b.respawnAt = 0;
    shuffle(list);
    state.karts = list.map((e, i) => makeKart(e, state.track.grid[i]));
    state.projectiles = []; state.bananas = [];
    state.countdownT = 0; state.cdStep = -1; state.raceTime = 0; state.goFlash = 0;
    state.firstFinish = 0; state.finishedCount = 0; state.endAt = 0; state.results = null;
    state.phase = 'countdown';
    updateRanking();
    for (const k of state.karts) hooks.onKartAdded(k);
    hooks.onPhase('countdown');
    for (const k of state.karts) hooks.onStatus(k);
    return true;
  }

  function showResults() {
    state.phase = 'results';
    updateRanking();
    const sorted = state.karts.slice().sort((a, b) => a.rank - b.rank);
    state.results = sorted.map((k) => ({ pos: k.rank, name: k.name, emoji: k.emoji, color: k.color, finished: k.finished, time: k.finishTime, lap: displayLap(k) }));
    hooks.onResults(state.results);
    hooks.onPhase('results');
    for (const k of state.karts) hooks.onStatus(k);
    hooks.onSfx('finish');
  }

  function backToLobby() {
    state.phase = 'lobby';
    for (const k of state.karts) hooks.onKartRemoved(k);
    for (const p of state.projectiles) hooks.onProjectileRemoved(p);
    for (const b of state.bananas) hooks.onBananaRemoved(b);
    state.karts = []; state.projectiles = []; state.bananas = []; state.results = null;
    hooks.onPhase('lobby');
  }

  // Saca a un kart de la carrera (su móvil se ha ido)
  function removeKart(k) {
    const idx = state.karts.indexOf(k);
    if (idx < 0) return;
    hooks.onKartRemoved(k);
    state.karts.splice(idx, 1);
  }

  function allFinished() { return state.karts.length > 0 && state.karts.every((k) => k.finished); }

  // ===================== Física =====================
  function boost(k, dur) {
    k.boostUntil = Math.max(k.boostUntil, simTime + dur);
    hooks.onStretch(k, 6);
    hooks.onSfx('boost', k);
  }

  // `causa` ({ id, tipo }) dice quién se lo ha hecho: sirve para las estadísticas de `npm run race`
  function hitKart(k, causa) {
    const now = simTime;
    if (k.starUntil > now || k.invUntil > now || k.spinUntil > now) return false;
    k.spinUntil = now + SPIN_TIME;
    k.invUntil = now + SPIN_TIME + HIT_IMMUNITY;
    k.speed *= 0.25;
    k.driftT = 0; k.driftLevel = 0; k.steerT = 0; k.boostUntil = 0; k.trick = false;
    k.vz = Math.max(k.vz, 230); k.air = true;
    hooks.onParticles(k.x, k.z + 14, k.y, { n: 14, color: ['#ffe600', '#ffffff', '#ff2d95'], spread: 220, vy: 120, life: 0.7, size: 6 });
    hooks.onShake(6, k);
    hooks.onSfx('hit', k);
    hooks.onFx(k, 'hit');
    hooks.onHit(k, causa || null);
    stats.hits++;
    k.hitsTaken++;
    return true;
  }

  // El tramo de carretera «propio» del kart: la muestra más cercana buscando solo alrededor de su
  // progreso. Con la búsqueda global, un kart que sale despedido en una horquilla se encontraba
  // más cerca del tramo de enfrente, se subía a él (los bots) o lo dejaban allí (el rescate), el
  // antiatajos no le daba crédito y perdía la vuelta entera.
  function tramoDe(k) {
    const t = state.track;
    return t.nearestNear(k.x, k.y, ((k.dist % t.N) + t.N) % t.N, t.win);
  }

  function aiInput(k) {
    const t = state.track, N = t.N;
    const near = tramoDe(k);
    let target;
    if (near.d > t.halfW * 1.6) target = t.samples[near.i];
    else {
      const s = t.samples[(near.i + 24) % N];
      target = { x: s.x + s.nx * k.lane, y: s.y + s.ny * k.lane };
    }
    const desired = Math.atan2(target.y - k.y, target.x - k.x);
    const diff = wrapAngle(desired - k.angle);
    const steer = Math.abs(diff) < 0.05 ? 0 : diff > 0 ? 1 : -1;
    const ahead = t.samples[(near.i + 40) % N];
    const curve = Math.abs(wrapAngle(ahead.ang - t.samples[near.i].ang));
    const brake = curve > 1.5 && k.speed > 340 ? 1 : 0;

    // de espaldas al camino: lo primero es encararse. Con carrerilla, frenar; ya parado, marcha atrás
    const alReves = Math.abs(diff) > AI_WRONG_ANGLE;
    const reverse = alReves && k.speed < 60;
    const frena = brake || alReves;
    return { s: reverse ? -steer : steer, g: frena ? 0 : 1, b: frena ? 1 : 0, d: 0 };
  }

  // Lo recogen y lo dejan en el punto más cercano de la carretera, mirando en el sentido correcto
  function rescatar(k, near) {
    const s = state.track.samples[near.i];
    k.x = s.x; k.y = s.y; k.z = s.h; k.ground = s.h; k.vz = 0; k.air = false; k.airT = 0;
    k.angle = s.ang; k.moveAngle = s.ang; k.speed = 0;
    k.driftT = 0; k.driftLevel = 0; k.steerT = 0; k.steerDir = 0;
    k.boostUntil = 0; k.trick = false; k.trickAngle = 0; k.offroad = false;
    k.stuckT = 0;
    k.rescueUntil = simTime + RESCUE_TIME;
    k.invUntil = Math.max(k.invUntil, simTime + RESCUE_TIME + 0.5);
    stats.rescues++;
    hooks.onRescue(k);
    hooks.onSfx('rescue', k);
    hooks.onFx(k, 'rescue');
    hooks.onToast(`${k.emoji} ${k.name}: ¡de vuelta a la pista!`, 2);
  }

  function stepKart(k, inp, dt) {
    const t = state.track, now = simTime;
    // mientras lo recogen se queda quieto: es la penalización por salirse
    if (k.rescueUntil > now) { k.speed = 0; k.vz = 0; k.air = false; k.driftT = 0; k.driftLevel = 0; return; }
    const spinning = k.spinUntil > now;
    const active = state.phase === 'race' && !spinning;
    // `inp.d` (el viejo botón de derrape) ya no se usa: el derrape sale solo. Se sigue aceptando en
    // el protocolo para no romper los móviles que lleven la página cargada de antes.
    const s = active ? inp.s : 0, g = active ? inp.g : 0, b = active ? inp.b : 0;

    const near = t.nearest(k.x, k.y);
    const onRoad = near.d <= t.halfW + 3;
    k.offroad = !onRoad && !k.air;
    const boosting = k.boostUntil > now, star = k.starUntil > now, small = k.shrinkUntil > now;
    let maxS = BASE_MAX_SPEED * (k.isBot ? k.skill : 1);
    if (boosting) maxS *= 1.5;
    if (star) maxS *= 1.25;
    if (small) maxS *= 0.7;
    if (k.offroad && !boosting && !star) maxS *= 0.45;

    if (!k.air) {
      if (g) k.speed += ACCEL * dt;
      else if (b) k.speed -= (k.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
      else { const c = COAST * dt; if (Math.abs(k.speed) <= c) k.speed = 0; else k.speed -= Math.sign(k.speed) * c; }
      if (boosting && k.speed < maxS * 0.85) k.speed = maxS * 0.85;
      if (k.speed > maxS) k.speed = Math.max(maxS, k.speed - (k.offroad ? 1100 : 700) * dt);
      const minS = -maxS * 0.35;
      if (k.speed < minS) k.speed = minS;
      if (spinning) k.speed *= Math.pow(0.02, dt);
    } else if (k.speed > maxS * 1.1) k.speed = Math.max(maxS * 1.1, k.speed - 300 * dt);

    const spd = Math.abs(k.speed);
    let turn = 2.7 * clamp(spd / 140, 0, 1);
    if (spd > 320) turn *= 1 - 0.3 * clamp((spd - 320) / 250, 0, 1);
    if (k.air) turn *= 0.35;
    // ---- derrape automático: lo dispara mantener el giro, no un botón ----
    if (s !== 0 && s === k.steerDir) k.steerT += dt;
    else { k.steerDir = s; k.steerT = s !== 0 ? dt : 0; }
    const puedeDerrapar = spd > maxS * DRIFT_MIN_SPEED && !k.offroad && !k.air;
    const seguia = k.driftT > 0;
    const drifting = seguia ? (puedeDerrapar && s === k.driftDir) : (puedeDerrapar && s !== 0 && k.steerT >= DRIFT_START);
    if (drifting) {
      turn *= DRIFT_TURN;
      // el reloj del derrape es el del giro: quien lleva 0,8 s girando va por el nivel 1
      k.driftT = seguia ? k.driftT + dt : k.steerT;
      k.driftDir = s;
      const nivel = k.driftT >= DRIFT_L3 ? 3 : k.driftT >= DRIFT_L2 ? 2 : k.driftT >= DRIFT_L1 ? 1 : 0;
      if (nivel !== k.driftLevel) {
        k.driftLevel = nivel;
        if (nivel > 0) { hooks.onDrift(k, nivel); hooks.onFx(k, 'drift' + nivel); }
      }
    } else if (seguia && !k.air) {
      // en el aire el derrape se queda en pausa (un salto no te quita la carga)
      if (k.driftLevel > 0) boost(k, DRIFT_BOOST[k.driftLevel - 1]);
      k.driftT = 0; k.driftLevel = 0;
      hooks.onDrift(k, -1);
      hooks.onFx(k, 'drift0');
    }
    // truco en el aire: en un salto de verdad (no en un botecito), tocar un botón de girar
    const tocaTruco = s !== 0 && k.sPrev === 0;
    if (k.air && tocaTruco && !k.trick && k.z - k.ground > 16 && k.airT > 0.12) { k.trick = true; k.trickAngle = 0; hooks.onSfx('trick', k); }
    k.sPrev = s;

    k.angle += s * turn * dt * (k.speed >= 0 ? 1 : -1);
    const lag = drifting ? 3.2 : k.air ? 2 : 11;
    k.moveAngle = k.angle + wrapAngle(k.moveAngle - k.angle) * Math.exp(-lag * dt);
    k.x += Math.cos(k.moveAngle) * k.speed * dt;
    k.y += Math.sin(k.moveAngle) * k.speed * dt;

    if (k.x < KART_R) { k.x = KART_R; k.speed *= 0.5; }
    if (k.x > MAP_W - KART_R) { k.x = MAP_W - KART_R; k.speed *= 0.5; }
    if (k.y < KART_R) { k.y = KART_R; k.speed *= 0.5; }
    if (k.y > MAP_H - KART_R) { k.y = MAP_H - KART_R; k.speed *= 0.5; }

    // bumpers elásticos
    const near2 = t.nearest(k.x, k.y);
    for (const br of t.barriers) {
      if (!t.inRange(near2.i, br.from, br.to)) continue;
      const sideSign = Math.sign(near2.lat) || 1;
      if (br.side !== 0 && sideSign !== br.side) continue;
      const limit = t.halfW + 4;
      if (Math.abs(near2.lat) > limit && !(k.z - k.ground > 30)) {
        const sm = t.samples[near2.i];
        k.x = sm.x + sm.nx * limit * sideSign; k.y = sm.y + sm.ny * limit * sideSign;
        const vx = Math.cos(k.moveAngle) * k.speed, vy = Math.sin(k.moveAngle) * k.speed;
        const vn = vx * sm.nx + vy * sm.ny;
        if (vn * sideSign > 0) {
          setVel(k, vx - vn * sm.nx * 1.7, vy - vn * sm.ny * 1.7);
          k.vz = Math.max(k.vz, 90); k.air = true;
          hooks.onSquash(k, 5);
          hooks.onParticles(k.x, k.z + 8, k.y, { n: 8, color: t.def.theme.bumper, spread: 160, vy: 80, life: 0.5, size: 4 });
          stats.boings++;
          if (now - k.lastBoing > 0.25) { hooks.onSfx('boing', k); k.lastBoing = now; }
          hooks.onShake(3, k);
        }
      }
    }
    // paneles turbo
    if (!k.air) {
      for (const pi of t.pads) {
        let di = near2.i - pi; if (di > t.N / 2) di -= t.N; if (di < -t.N / 2) di += t.N;
        if (Math.abs(di) <= 3 && Math.abs(near2.lat) < t.halfW * 0.8 && (k.lastPad !== pi || now - k.lastPadAt > 2)) {
          k.lastPad = pi; k.lastPadAt = now;
          boost(k, 1.0);
          stats.pads++;
          hooks.onSfx('pad', k);
          hooks.onParticles(k.x, k.z + 6, k.y, { n: 10, color: t.def.theme.pad, spread: 120, vy: 100, life: 0.5, size: 4 });
        }
      }
    }

    // vertical: gravedad, suelo, saltos y aterrizajes
    const gOld = k.ground;
    const gNew = t.groundAt(k.x, k.y);
    k.ground = gNew;
    const grav = GRAVITY * t.gravity;
    k.vz -= grav * dt;
    k.z += k.vz * dt;
    if (k.z <= gNew) {
      if (k.air) land(k, -k.vz);
      k.z = gNew;
      k.vz = Math.max(k.vz, (gNew - gOld) / dt);
      if (k.vz > 40 && (gNew - gOld) / dt < 40) k.vz = 0;
      k.air = false;
    } else {
      if (!k.air && k.z - gNew > 2) { k.air = true; if (k.vz > 60) hooks.onSfx('jump', k); }
    }
    k.airT = k.air ? k.airT + dt : 0;
    if (k.air && k.trick) k.trickAngle = Math.min(Math.PI * 2, k.trickAngle + dt * 9);
    if (k.air) stats.maxAir = Math.max(stats.maxAir, k.z - k.ground);
    if (k.offroad && spd > 60) { k.dustT += dt; if (k.dustT > 0.06) { k.dustT = 0; hooks.onParticles(k.x, k.z + 3, k.y, { n: 2, color: [t.def.theme.groundAlt, t.def.theme.ground], spread: 40, vy: 50, life: 0.6, size: 6, g: 60 }); } }

    // ¿perdido o clavado? a los RESCUE_AFTER segundos, de vuelta a la carretera
    if (state.phase === 'race' && !k.finished && !spinning) {
      const propio = tramoDe(k);                   // su tramo, no el que le pille más cerca
      const lento = Math.abs(k.speed) < RESCUE_SLOW && !k.air;
      const perdido = propio.d > t.halfW + RESCUE_FAR;
      const atascado = lento && (g || b);          // pisa el gas y no se mueve: contra un muro
      const abandonado = lento && k.offroad;       // parado fuera de la pista
      if (perdido || atascado || abandonado) k.stuckT += dt; else k.stuckT = 0;
      if (k.stuckT >= RESCUE_AFTER) { rescatar(k, propio); return; }
    }

    updateProgress(k, near2, dt);
  }

  function land(k, impact) {
    stats.jumps++;
    hooks.onSquash(k, clamp(impact / 60, 1, 8));
    if (impact > 120) hooks.onParticles(k.x, k.z + 2, k.y, { n: 8, color: ['#ffffff', state.track.def.theme.groundAlt], spread: 120, vy: 60, life: 0.5, size: 4, g: 200 });
    if (impact > 420) { k.vz = impact * 0.28; k.air = true; }
    if (k.trick) {
      k.trick = false; k.trickAngle = 0;
      if (k.airT >= 0.4) { stats.tricks++; boost(k, 0.9); if (k.isHuman) hooks.onToast(`${k.emoji} ${k.name}: ¡truco! 🤸`, 1.5); }
    }
    if (impact > 80) hooks.onSfx('land', k);
  }

  function updateProgress(k, near, dt) {
    const t = state.track, N = t.N;
    if (near.d > t.halfW * 2.5) return;
    const cur = ((k.dist % N) + N) % N;
    let delta = near.i - cur;
    if (delta > N / 2) delta -= N; else if (delta < -N / 2) delta += N;
    // Un salto adelante grande suele ser un vuelo por encima de un trozo de pista, y no cuenta: si
    // no, cortar el circuito saldría gratis. Pero si el kart sigue ahí un rato, es que de verdad
    // está ahí, y congelarle el progreso una vuelta entera (y mentir en la clasificación) es mucho
    // peor que el atajo: a los PROGRESS_JUMP_WAIT segundos se le acepta el salto.
    if (Math.abs(delta) > t.win) {
      k.aheadT += dt;
      if (k.aheadT < PROGRESS_JUMP_WAIT) return;
    }
    k.aheadT = 0;
    k.dist += delta;
    const lap = Math.floor(k.dist / N);
    if (lap > k.lapCount) {
      k.lapCount = lap;
      if (!k.finished && state.phase === 'race') {
        if (lap >= state.laps) finishKart(k);
        else if (lap > 0) {
          hooks.onSfx('lap', k);
          if (k.isHuman && lap === state.laps - 1) hooks.onToast(`${k.emoji} ${k.name}: ¡última vuelta!`, 2.5);
        }
      }
    }
  }

  function finishKart(k) {
    k.finished = true;
    k.finishTime = state.raceTime;
    k.finishRank = ++state.finishedCount;
    k.item = null; k.rolling = null;
    if (!state.firstFinish) state.firstFinish = state.raceTime;
    hooks.onToast(`🏁 ${k.emoji} ${k.name} termina ${ordinal(k.finishRank)}`, 3.5);
    hooks.onParticles(k.x, k.z + 60, k.y, { n: 40, color: 'rainbow', spread: 260, vy: 160, life: 1.6, size: 5, g: 300, flat: true });
    hooks.onSfx('finishKart', k);
    hooks.onStatus(k);
  }

  function setVel(k, vx, vy) {
    const sp = Math.hypot(vx, vy);
    if (sp < 1) { k.speed = 0; return; }
    const ang = Math.atan2(vy, vx);
    const forward = Math.cos(wrapAngle(ang - k.angle)) >= 0;
    k.speed = forward ? sp : -sp;
    k.moveAngle = forward ? ang : ang + Math.PI;
  }

  function collideKarts() {
    const ks = state.karts, now = simTime;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (Math.abs(a.z - b.z) > 24) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy, minD = KART_R * 2;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = minD - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const avx = Math.cos(a.moveAngle) * a.speed, avy = Math.sin(a.moveAngle) * a.speed;
        const bvx = Math.cos(b.moveAngle) * b.speed, bvy = Math.sin(b.moveAngle) * b.speed;
        const rel = (avx - bvx) * nx + (avy - bvy) * ny;
        if (rel > 0) {
          const imp = rel * 0.9;
          setVel(a, avx - imp * nx, avy - imp * ny);
          setVel(b, bvx + imp * nx, bvy + imp * ny);
          if (rel > 120) {
            const hop = clamp(rel * 0.45, 40, 160);
            a.vz = Math.max(a.vz, hop * 0.6); b.vz = Math.max(b.vz, hop); a.air = b.air = true;
            hooks.onSquash(a, 3); hooks.onSquash(b, 3);
            hooks.onParticles((a.x + b.x) / 2, (a.z + b.z) / 2 + 10, (a.y + b.y) / 2, { n: 8, color: ['#ffffff', '#ffe600'], spread: 160, vy: 80, life: 0.4, size: 4 });
            stats.bumps++;
            if (now - a.lastBoing > 0.25) { hooks.onSfx('bump', a); a.lastBoing = now; }
          }
        }
        const aStar = a.starUntil > now, bStar = b.starUntil > now;
        if (aStar && !bStar) hitKart(b, { id: a.id, tipo: 'star' });
        if (bStar && !aStar) hitKart(a, { id: b.id, tipo: 'star' });
      }
    }
  }

  // ===================== Objetos =====================
  function rollItem(rank, n) {
    const r = n > 1 ? (rank - 1) / (n - 1) : 0.5;
    const w = [
      ['mushroom', 2 + 3 * r], ['banana', 3 - 2 * r], ['green', 3 - 1.5 * r],
      ['red', rank === 1 ? 0 : 1 + 3 * r], ['star', 4 * r * r], ['lightning', n >= 3 ? 3 * r * r * r : 0],
    ];
    const total = w.reduce((acc, [, x]) => acc + x, 0);
    let x = random() * total;
    for (const [id, wt] of w) { x -= wt; if (x <= 0) return id; }
    return 'mushroom';
  }

  function checkBoxes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.item || k.rolling || k.finished) continue;
      for (const box of state.track.boxes) {
        if (box.respawnAt > now) continue;
        const dx = box.x - k.x, dy = box.y - k.y;
        if (dx * dx + dy * dy < 26 * 26 && Math.abs(k.z - box.h) < 45) {
          box.respawnAt = now + BOX_RESPAWN;
          k.rolling = { until: now + ROULETTE_TIME, result: rollItem(k.rank, state.karts.length) };
          stats.pickups++;
          const fila = stats.itemsByPos[k.rank] || (stats.itemsByPos[k.rank] = {});
          fila[k.rolling.result] = (fila[k.rolling.result] || 0) + 1;
          hooks.onParticles(box.x, box.h + 18, box.y, { n: 16, color: 'rainbow', spread: 200, vy: 120, life: 0.7, size: 5 });
          hooks.onSfx('pickup', k);
          hooks.onStatus(k);
          break;
        }
      }
    }
  }

  function finishRoulettes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.rolling && now >= k.rolling.until) {
        k.item = k.rolling.result; k.rolling = null;
        k.itemUseAt = now + 0.8 + random() * 2.5;
        hooks.onStatus(k);
      }
      if (k.isBot && k.item && now >= k.itemUseAt) {
        if (k.item === 'banana' && now < k.itemUseAt + 6) {
          const behind = state.karts.some((o) => o !== k && o.dist < k.dist && k.dist - o.dist < 60);
          if (!behind) continue;
        }
        useItem(k);
      }
    }
  }

  function useItem(k) {
    const now = simTime;
    if (!k.item || k.spinUntil > now || k.finished || state.phase !== 'race') return;
    const it = k.item;
    k.item = null;
    stats.itemsUsed++;
    const cos = Math.cos(k.angle), sin = Math.sin(k.angle);
    switch (it) {
      case 'mushroom': boost(k, 1.2); break;
      case 'banana': {
        const bn = { x: k.x - cos * 34, y: k.y - sin * 34, z: null, owner: k.id, bornAt: now, view: null };
        state.bananas.push(bn);
        hooks.onBananaAdded(bn);
        if (state.bananas.length > 30) hooks.onBananaRemoved(state.bananas.shift());
        hooks.onSfx('drop', k);
        break;
      }
      case 'green': {
        const p = { type: 'green', x: k.x + cos * 28, y: k.y + sin * 28, z: 0, angle: k.angle, speed: 700, owner: k.id, bornAt: now, life: 5, targetId: null, dead: false, view: null };
        state.projectiles.push(p);
        hooks.onProjectileAdded(p);
        hooks.onSfx('shell', k);
        break;
      }
      case 'red': {
        const ahead = state.karts.find((o) => o.rank === k.rank - 1) || null;
        const p = { type: 'red', x: k.x + cos * 28, y: k.y + sin * 28, z: 0, angle: k.angle, speed: 660, owner: k.id, bornAt: now, life: 9, targetId: ahead ? ahead.id : null, dead: false, view: null };
        state.projectiles.push(p);
        hooks.onProjectileAdded(p);
        hooks.onSfx('shell', k);
        break;
      }
      case 'star':
        k.starUntil = now + 7; k.spinUntil = 0;
        hooks.onFx(k, 'star');
        hooks.onParticles(k.x, k.z + 20, k.y, { n: 24, color: 'rainbow', spread: 240, vy: 150, life: 0.9, size: 5 });
        hooks.onSfx('star', k);
        break;
      case 'lightning':
        for (const o of state.karts) {
          if (o === k || o.starUntil > now || o.zapUntil > now) continue;
          o.zapUntil = now + LIGHTNING_IMMUNITY;
          o.shrinkUntil = now + 5;
          if (o.spinUntil <= now && o.invUntil <= now) { o.spinUntil = now + 0.6; o.speed *= 0.4; o.vz = Math.max(o.vz, 120); o.air = true; hooks.onHit(o, { id: k.id, tipo: 'lightning' }); }
          hooks.onParticles(o.x, o.z + 30, o.y, { n: 10, color: ['#ffe600', '#00e5ff'], spread: 100, vy: -200, life: 0.5, size: 4, g: 0 });
          hooks.onFx(o, 'zap');
        }
        hooks.onFlash();
        hooks.onShake(10, k);
        hooks.onSfx('lightning', k);
        break;
      default: break;
    }
    hooks.onStatus(k);
  }

  function stepProjectiles(dt) {
    const t = state.track, now = simTime;
    for (const p of state.projectiles) {
      if (p.dead) continue;
      let homing = false;
      if (p.type === 'red' && p.targetId) {
        const tgt = state.karts.find((k) => k.id === p.targetId);
        if (tgt) {
          homing = true;
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          let desired;
          if (Math.hypot(dx, dy) < 260) desired = Math.atan2(dy, dx);
          else { const near = t.nearest(p.x, p.y); const s = t.samples[(near.i + 16) % t.N]; desired = Math.atan2(s.y - p.y, s.x - p.x); }
          const diff = wrapAngle(desired - p.angle), maxTurn = 7 * dt;
          p.angle += clamp(diff, -maxTurn, maxTurn);
        }
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.z = t.groundAt(p.x, p.y) + 8;
      const age = now - p.bornAt;
      if (age > p.life || p.x < 0 || p.x > MAP_W || p.y < 0 || p.y > MAP_H) { p.dead = true; continue; }
      if (!homing && t.nearest(p.x, p.y).d > t.halfW + 30) { p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); continue; }
      for (const k of state.karts) {
        if (k.id === p.owner && (p.type === 'red' || age < 0.5)) continue;
        if (k.z - p.z > 22) continue; // saltando por encima
        const dx = k.x - p.x, dy = k.y - p.y;
        if (dx * dx + dy * dy < (KART_R + 10) * (KART_R + 10)) {
          if (k.starUntil > now) { p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); }
          else if (hitKart(k, { id: p.owner, tipo: p.type })) p.dead = true;
          break;
        }
      }
      if (p.dead) continue;
      for (let i = state.bananas.length - 1; i >= 0; i--) {
        const bn = state.bananas[i];
        const dx = bn.x - p.x, dy = bn.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) { hooks.onBananaRemoved(bn); state.bananas.splice(i, 1); p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
      }
    }
    for (const p of state.projectiles) if (p.dead) hooks.onProjectileRemoved(p);
    state.projectiles = state.projectiles.filter((p) => !p.dead);
  }

  function checkBananas() {
    const now = simTime;
    for (let i = state.bananas.length - 1; i >= 0; i--) {
      const bn = state.bananas[i];
      for (const k of state.karts) {
        if (bn.owner === k.id && now < bn.bornAt + 0.7) continue;
        if (k.z - k.ground > 22) continue;
        const dx = bn.x - k.x, dy = bn.y - k.y;
        if (dx * dx + dy * dy < (KART_R + 10) * (KART_R + 10)) {
          if (k.starUntil > now || hitKart(k, { id: bn.owner, tipo: 'banana' })) { hooks.onBananaRemoved(bn); state.bananas.splice(i, 1); hooks.onParticles(bn.x, k.z + 6, bn.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
        }
      }
    }
  }

  // ===================== Bucle de simulación =====================
  function updateRanking() {
    const arr = state.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
    arr.forEach((k, i) => { k.rank = i + 1; });
  }

  function update(dt) {
    simTime += dt;
    state.simTime = simTime;
    if (state.phase === 'countdown') {
      state.countdownT += dt;
      const step = Math.floor(state.countdownT);
      if (step !== state.cdStep) {
        state.cdStep = step;
        if (step < 3) { hooks.onSfx('beep'); hooks.onCountdown(3 - step); }
      }
      if (state.countdownT >= 3) {
        state.phase = 'race'; state.raceTime = 0; state.goFlash = 1.2;
        hooks.onGo();
        hooks.onSfx('go');
        hooks.onPhase('race');
      }
      return;
    }
    if (state.phase !== 'race') return;

    state.raceTime += dt;
    for (const k of state.karts) {
      // los bots y quien ya ha terminado van solos; a los demás les mueve lo último que mandó su móvil
      const inp = (k.isBot || k.finished) ? aiInput(k) : k.input;
      stepKart(k, inp, dt);
    }
    collideKarts();
    stepProjectiles(dt);
    checkBananas();
    checkBoxes();
    finishRoulettes();
    updateRanking();

    statusTimer += dt;
    if (statusTimer >= 0.3) { statusTimer = 0; for (const k of state.karts) hooks.onStatus(k); }

    const humans = state.karts.filter((k) => k.isHuman);
    if (!state.endAt) {
      if (humans.length && humans.every((k) => k.finished)) state.endAt = simTime + 2.5;
      else if (state.firstFinish && state.raceTime - state.firstFinish > 60) state.endAt = simTime;
      else if (state.raceTime > 60 * 8) state.endAt = simTime;
    }
    if (state.endAt && simTime >= state.endAt) showResults();
  }

  return {
    tracks, state, stats,
    startRace, update, setInput, useItem, aiInput, hitKart, boost, backToLobby, removeKart, rollItem,
    setTrack, displayLap, updateRanking, allFinished,
    now: () => simTime,
  };
}
