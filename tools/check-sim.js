'use strict';
/*
 * Fase 4 de `npm test`: «Carrera sin pantalla».
 *
 * Corre carreras enteras de bots dentro de public/sim.mjs, sin navegador ni three.js, y comprueba
 * que la física se porta: que todo el mundo termina, que nadie se sale del mapa ni se queda
 * clavado, que los objetos se cogen y se usan, y que con la misma semilla salen dos carreras
 * idénticas. Debajo hay una lista de «escenarios»: reglas sueltas del juego, cada una con su
 * comprobación. Cada punto nuevo de IDEAS.md debería añadir aquí el suyo.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const geom = require(path.join(ROOT, 'public/geom.js'));
const trackDefs = require(path.join(ROOT, 'public/tracks.js'));

let failed = false;
const ok = (msg) => console.log('  ✓ ' + msg);
const bad = (msg) => { failed = true; console.log('  ✗ ' + msg); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

// generador con semilla: dos carreras con la misma semilla tienen que salir iguales
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

async function main() {
  const sim = await import(pathToFileURL(path.join(ROOT, 'public/sim.mjs')).href);

  console.log('Módulo');
  comprobarModulo(sim);

  console.log('Carreras');
  const tiempos = [];
  const t0 = Date.now();
  for (let i = 0; i < trackDefs.length; i++) tiempos.push(correrCircuito(sim, i));
  const total = (Date.now() - t0) / 1000;
  const hits = tiempos.reduce((a, t) => a + (t.hits || 0), 0);
  check(hits >= 1, `se reparten golpes entre karts (${hits} en total)`);
  check(total < 20, `las ${trackDefs.length} carreras tardan ${total.toFixed(1)} s (< 20 s)`);

  compararConLaReferencia(tiempos);

  console.log('Determinismo');
  {
    const a = correrCircuito(sim, 0, { silencioso: true });
    const b = correrCircuito(sim, 0, { silencioso: true });
    const mismos = JSON.stringify(a.finishTimes) === JSON.stringify(b.finishTimes);
    check(mismos, 'dos carreras con la misma semilla dan los mismos tiempos');
  }

  console.log('Escenarios');
  for (const esc of escenarios) {
    try {
      const err = esc.run(sim);
      if (err) bad(`${esc.nombre}: ${err}`); else ok(esc.nombre);
    } catch (e) { bad(`${esc.nombre}: ${e && e.stack ? e.stack.split('\n')[0] : e}`); }
  }

  console.log(failed ? '\nHAY FALLOS' : '\nSimulación correcta');
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------- el módulo por dentro
function comprobarModulo(sim) {
  const src = fs.readFileSync(path.join(ROOT, 'public/sim.mjs'), 'utf8');
  // la simulación no puede saber nada del navegador ni de las mallas
  const prohibidos = ['document', 'window', 'THREE', 'setTimeout', 'performance', '.mesh', '.model', 'Math.random('];
  const sucios = prohibidos.filter((p) => src.includes(p));
  check(!sucios.length, `sim.mjs no usa nada del navegador${sucios.length ? ' (encontrado: ' + sucios.join(', ') + ')' : ''}`);
  // la única mención a Math.random es el valor por defecto del azar inyectado
  const menciones = src.match(/Math\.random/g) || [];
  check(menciones.length === 1 && src.includes('random = Math.random'), 'todo el azar de la simulación pasa por `random`');
  // ningún hook inventado
  const usados = [...new Set((src.match(/hooks\.on[A-Za-z]+/g) || []).map((h) => h.slice(6)))];
  const faltan = usados.filter((h) => !(h in sim.DEFAULT_HOOKS));
  check(!faltan.length, `los ${usados.length} hooks usados existen en DEFAULT_HOOKS${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`);
  check(typeof sim.createSim === 'function', 'exporta createSim');
}

// ---------------------------------------------------------------- una carrera entera
/*
 * Cada circuito se corre dos veces:
 *  A) parrilla de 8 bots: nadie para la carrera antes de tiempo, así que se puede comprobar que
 *     los 8 terminan, las vueltas, el orden de llegada y que nadie se atasca ni se sale del mapa.
 *  B) 7 bots y un «pseudo-humano» (cuenta como persona, lo conduce la IA): comprueba el final de
 *     verdad, el de la fiesta, cuando la última persona cruza la meta.
 */
function correrCircuito(sim, index, opts = {}) {
  const silencioso = !!opts.silencioso;
  const laps = index === 0 ? 3 : 2;
  const nombre = trackDefs[index].name;
  const tope = 60 * laps + 30;
  const titulo = `${nombre} (${laps} vueltas)`;

  // ---- A) ocho bots hasta el final ----
  const s = sim.createSim({ geom, trackDefs, random: mulberry32(1000 + index) });
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + (i + 1), char: i });
  if (!s.startRace({ entries, trackIndex: index, laps })) { bad(`${nombre}: la carrera no arranca`); return { finishTimes: [] }; }

  const ventana = Math.round(10 / DT);            // 10 s de simulación
  const historial = new Map();                     // kart -> [muestras avanzadas, píxeles recorridos]
  for (const k of s.state.karts) historial.set(k, []);
  const vueltasAlLlegar = new Map();               // vueltas que llevaba cada uno al cruzar la meta
  let lapsPrevias = s.state.karts.map((k) => k.lapCount);
  let problema = null;
  const falla = (msg) => { if (!problema) problema = msg; };
  const inicio = Date.now();

  while (s.state.simTime < tope && s.state.phase !== 'results' && !s.allFinished()) {
    const antes = s.state.karts.map((k) => ({ dist: k.dist, x: k.x, y: k.y }));
    s.update(DT);

    const ks = s.state.karts;
    ks.forEach((k, i) => {
      for (const campo of ['x', 'y', 'z', 'vz', 'speed', 'angle']) {
        if (!Number.isFinite(k[campo])) falla(`${k.name}: ${campo} no es finito (${k[campo]})`);
      }
      if (k.x < 0 || k.x > 1920) falla(`${k.name}: x fuera del mapa (${k.x.toFixed(1)})`);
      if (k.y < 0 || k.y > 1080) falla(`${k.name}: y fuera del mapa (${k.y.toFixed(1)})`);
      if (Math.abs(k.speed) > 2.5 * sim.BASE_MAX_SPEED) falla(`${k.name}: velocidad disparada (${k.speed.toFixed(0)})`);
      if (k.lapCount < lapsPrevias[i]) falla(`${k.name}: la vuelta va hacia atrás`);
      if (k.finished && !vueltasAlLlegar.has(k)) vueltasAlLlegar.set(k, k.lapCount);
      // en cada ventana de 10 s, quien no ha terminado tiene que avanzar
      const h = historial.get(k);
      // el tercer número es lo que se ha movido *siguiendo el sentido del circuito* (px): es la
      // forma honrada de ver si alguien va al revés, sin que la engañe el contador de progreso,
      // que se congela cuando un kart vuela por un atajo (ver «Bugs conocidos» de IDEAS.md)
      const sm = s.state.track.samples[s.state.track.nearest(k.x, k.y).i];
      const conElCircuito = (k.x - antes[i].x) * Math.cos(sm.ang) + (k.y - antes[i].y) * Math.sin(sm.ang);
      h.push([k.dist - antes[i].dist, Math.hypot(k.x - antes[i].x, k.y - antes[i].y), conElCircuito]);
      if (h.length > ventana) h.shift();
      if (h.length === ventana && !k.finished) {
        const avance = h.reduce((a, b) => a + b[0], 0);
        const recorrido = h.reduce((a, b) => a + b[1], 0);
        const sentido = h.reduce((a, b) => a + b[2], 0);
        if (avance < 40 && recorrido < 400) falla(`${k.name}: atascado (${avance.toFixed(0)} muestras y ${recorrido.toFixed(0)} px en 10 s)`);
        else if (sentido < -200) falla(`${k.name}: se fue en dirección contraria hacia t=${s.state.simTime.toFixed(0)} s (${sentido.toFixed(0)} px a contramano en 10 s)`);
      }
    });
    lapsPrevias = ks.map((k) => k.lapCount);
    const rangos = ks.map((k) => k.rank).sort((a, b) => a - b);
    if (rangos.some((r, i) => r !== i + 1)) falla('las posiciones no son 1..n');
  }

  const dur = (Date.now() - inicio) / 1000;
  const ks = s.state.karts;
  const st = s.stats;
  if (silencioso) return { finishTimes: ks.map((k) => k.finishTime) };

  const todos = ks.every((k) => k.finished);
  // al cruzar la meta hay que llevar justo las vueltas de la carrera (después siguen rodando)
  const vueltasBien = ks.every((k) => vueltasAlLlegar.get(k) === laps);
  const porTiempo = ks.slice().sort((a, b) => a.finishTime - b.finishTime);
  const rankBien = porTiempo.every((k, i) => k.finishRank === i + 1);
  const vueltaMedia = ks.reduce((a, k) => a + k.finishTime, 0) / (ks.length * laps);

  check(todos, `${titulo}: los 8 terminan antes de ${tope} s`);
  check(vueltasBien, `${titulo}: todos acaban con ${laps} vueltas`);
  check(rankBien, `${titulo}: el orden de llegada coincide con los tiempos`);
  check(!problema, `${titulo}: la simulación se porta${problema ? ' → ' + problema : ''}`);
  check(st.jumps >= 1 && st.pads >= 1, `${titulo}: saltos ${st.jumps}, paneles ${st.pads}`);
  check(st.pickups >= 8 && st.itemsUsed >= 8, `${titulo}: objetos cogidos ${st.pickups}, usados ${st.itemsUsed}`);
  check(dur < 5, `${titulo}: vuelta media ${vueltaMedia.toFixed(1)} s · simulada en ${dur.toFixed(1)} s`);

  // ---- B) con una persona en la parrilla ----
  const s2 = sim.createSim({ geom, trackDefs, random: mulberry32(2000 + index) });
  const entries2 = [{ playerId: 1, name: 'Humano', char: 0 }];
  for (let i = 1; i < 8; i++) entries2.push({ playerId: null, bot: true, name: 'Bot ' + i, char: i });
  s2.startRace({ entries: entries2, trackIndex: index, laps });
  while (s2.state.simTime < tope && s2.state.phase !== 'results') {
    for (const k of s2.state.karts) if (!k.isBot && !k.finished) s2.setInput(k, s2.aiInput(k));
    s2.update(DT);
  }
  const persona = s2.state.karts.find((k) => !k.isBot);
  check(s2.state.phase === 'results' && persona.finished && persona.lapCount === laps,
    `${titulo}: con una persona, la carrera acaba cuando esta llega a meta (${persona.finishTime.toFixed(1)} s)`);

  return { nombre, hits: st.hits, finishTimes: ks.map((k) => k.finishTime), vueltaMedia };
}

// Los tiempos de vuelta de referencia (tools/referencia.json) son la vara de medir de los cambios
// de física: si los bots empeoran más de un 10 %, el cambio ha roto algo. Para volver a medir (solo
// cuando el cambio es a propósito y está justificado): `KART_REFERENCIA=escribir node tools/check-sim.js`.
const REFERENCIA = path.join(ROOT, 'tools/referencia.json');
const MARGEN = 1.10;

function compararConLaReferencia(tiempos) {
  console.log('Tiempos de vuelta');
  const medidos = {};
  for (const t of tiempos) medidos[t.nombre] = Number(t.vueltaMedia.toFixed(2));
  if (process.env.KART_REFERENCIA === 'escribir') {
    fs.writeFileSync(REFERENCIA, JSON.stringify({
      que: 'Vuelta media de los bots en la fase 4 de npm test, circuito a circuito (segundos).',
      comoRehacerlo: 'KART_REFERENCIA=escribir node tools/check-sim.js',
      fecha: new Date().toISOString().slice(0, 10),
      vueltaMedia: medidos,
    }, null, 2) + '\n');
    ok('referencia reescrita a propósito (KART_REFERENCIA=escribir)');
    return;
  }
  if (!fs.existsSync(REFERENCIA)) { bad('falta tools/referencia.json (créalo con KART_REFERENCIA=escribir)'); return; }
  const ref = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8')).vueltaMedia || {};
  for (const [nombre, medido] of Object.entries(medidos)) {
    const antes = ref[nombre];
    if (antes == null) { bad(`${nombre}: no está en la referencia`); continue; }
    const dif = ((medido - antes) / antes) * 100;
    check(medido <= antes * MARGEN,
      `${nombre}: vuelta media ${medido.toFixed(2)} s (referencia ${antes.toFixed(2)} s, ${dif >= 0 ? '+' : ''}${dif.toFixed(1)} %)`);
  }
}

// ---------------------------------------------------------------- escenarios sueltos
// Monta una carrera ya empezada (sin cuenta atrás) para poder forzar situaciones concretas.
function carrera(sim, { bots = 1, laps = 3, trackIndex = 0, seed = 7, hooks } = {}) {
  const s = sim.createSim({ geom, trackDefs, random: mulberry32(seed), hooks });
  const entries = [{ playerId: 1, name: 'Humano', char: 0 }];
  for (let i = 1; i <= bots; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + i, char: i });
  s.startRace({ entries, trackIndex, laps });
  for (let i = 0; i < 185; i++) s.update(DT);   // se come la cuenta atrás (3 s)
  return s;
}
const humano = (s) => s.state.karts.find((k) => !k.isBot);

// Busca en el circuito los dos tramos que pasan más cerca sin ser el mismo (la horquilla) y planta
// al humano encima del tramo de enfrente, con el progreso del tramo por el que iba: es lo que le
// pasa a un kart que sale despedido en la horquilla de Volcán Disco.
function enElTramoDeEnfrente(sim, { bots, seed, hooks, trackIndex = 2 } = {}) {
  const s = carrera(sim, { bots, seed, hooks, trackIndex });
  const k = humano(s);
  const t = s.state.track;
  for (let f = 0; f < 60 * 2; f++) { s.setInput(k, s.aiInput(k)); s.update(DT); }   // cruza la meta
  let mejor = null;
  for (let i = 0; i < t.N; i += 2) {
    for (let j = i + t.win + 10; j <= i + t.N / 2 - 10; j += 2) {
      const a = t.samples[i], b = t.samples[j % t.N];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!mejor || d < mejor.d) mejor = { i, j: j % t.N, d };
    }
  }
  if (!mejor || mejor.d > t.halfW + 400) return { error: 'este circuito no tiene dos tramos lo bastante cerca' };
  const cur = ((k.dist % t.N) + t.N) % t.N;
  const base = k.dist - cur;                     // vueltas ya contadas, en muestras
  k.dist = base + mejor.i;
  const sj = t.samples[mejor.j];
  k.x = sj.x; k.y = sj.y; k.z = sj.h; k.ground = sj.h; k.vz = 0; k.air = false;
  k.angle = sj.ang; k.moveAngle = sj.ang; k.speed = 200; k.stuckT = 0;
  return { s, k, t, i: mejor.i, j: mejor.j, base };
}

const escenarios = [
  {
    nombre: 'la cuenta atrás dura 3 s y nadie sale antes',
    run(sim) {
      const s = sim.createSim({ geom, trackDefs, random: mulberry32(3) });
      s.startRace({ entries: [{ playerId: 1, name: 'Humano', char: 0 }, { playerId: null, bot: true, name: 'Bot', char: 1 }], trackIndex: 0, laps: 1 });
      const k = humano(s);
      const x0 = k.x, y0 = k.y;
      for (let i = 0; i < 170; i++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (s.state.phase !== 'countdown') return 'la cuenta atrás se ha acabado antes de tiempo';
      if (Math.hypot(k.x - x0, k.y - y0) > 0.001) return 'el kart se ha movido durante la cuenta atrás';
      for (let i = 0; i < 20; i++) s.update(DT);
      return s.state.phase === 'race' ? null : 'la carrera no arranca a los 3 s';
    },
  },
  {
    // el bug de los bots que salían disparados en dirección contraria tras un golpe: el que va de
    // espaldas tiene que frenar y encararse, no acelerar hacia atrás perdiendo medio circuito
    nombre: 'un kart puesto del revés se encara y recupera su avance en menos de 2,5 s',
    run(sim) {
      for (let pista = 0; pista < 4; pista++) {
        const s = carrera(sim, { bots: 1, trackIndex: pista });
        const k = humano(s);
        const t = s.state.track;
        // lo plantamos en mitad de la carretera, a buena velocidad y mirando justo al revés
        const m = t.samples[t.nearest(k.x, k.y).i];
        k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
        k.angle = m.ang + Math.PI; k.moveAngle = k.angle; k.speed = 300;
        k.stuckT = 0; k.rescueUntil = 0;
        const avance0 = k.dist;
        let peor = 0, recupera = null;
        for (let i = 0; i < 60 * 4; i++) {
          s.setInput(k, s.aiInput(k));
          s.update(DT);
          peor = Math.min(peor, k.dist - avance0);
          if (recupera === null && k.dist >= avance0) recupera = (i + 1) / 60;
        }
        if (k.rescueUntil > s.state.simTime) return `pista ${pista}: ha tenido que venir el rescate a recogerlo`;
        if (peor < -25) return `pista ${pista}: pierde ${peor.toFixed(0)} muestras yendo al revés`;
        if (recupera === null || recupera > 2.5) return `pista ${pista}: tarda ${recupera === null ? 'más de 4' : recupera.toFixed(2)} s en recuperar su avance`;
      }
      return null;
    },
  },
  {
    // el contador de progreso se congelaba media vuelta cuando un kart aterrizaba muy por delante
    nombre: 'volar por encima de un atajo no congela la clasificación',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      const t = s.state.track, N = t.N;
      // lo ponemos de golpe muy por delante en la carretera, como quien cae de una rampa larga
      const i0 = t.nearest(k.x, k.y).i;
      const destino = t.samples[(i0 + t.win + 25) % N];
      const antes = k.dist;
      k.x = destino.x; k.y = destino.y; k.z = destino.h; k.ground = destino.h; k.air = false; k.vz = 0;
      k.angle = destino.ang; k.moveAngle = destino.ang; k.speed = 200;
      // de entrada no se le regala el avance (si no, cortar el circuito saldría gratis)
      for (let i = 0; i < 20; i++) { s.setInput(k, s.aiInput(k)); s.update(DT); }
      if (k.dist - antes > t.win) return 'el salto cuenta al momento: cortar el circuito sale gratis';
      // pero en cuanto se ve que está ahí de verdad, se le cuenta y deja de mentir la clasificación
      for (let i = 0; i < 90; i++) { s.setInput(k, s.aiInput(k)); s.update(DT); }
      const avance = k.dist - antes;
      if (avance < t.win) return `sigue congelado: solo ha avanzado ${avance.toFixed(0)} muestras en 1,8 s`;
      return null;
    },
  },
  {
    nombre: 'un plátano hace girar al que lo pisa',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      s.state.bananas.push({ x: k.x + 8, y: k.y, z: null, owner: 'nadie', bornAt: 0, view: null });
      s.update(DT);
      return k.spinUntil > s.state.simTime ? null : 'el plátano no ha hecho nada';
    },
  },
  {
    nombre: 'la estrella protege de los golpes',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      k.starUntil = s.state.simTime + 5;
      const golpeado = s.hitKart(k);
      if (golpeado) return 'la estrella no ha protegido';
      k.starUntil = 0;
      return s.hitKart(k) ? null : 'sin estrella, el golpe tendría que entrar';
    },
  },
  {
    nombre: 'una caja da un objeto tras la ruleta',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      const caja = s.state.track.boxes[0];
      k.x = caja.x; k.y = caja.y; k.z = caja.h; k.item = null; k.rolling = null;
      s.update(DT);
      if (!k.rolling) return 'la caja no ha dado la ruleta';
      for (let i = 0; i < 120; i++) s.update(DT);
      return k.item || k.rolling === null ? null : 'la ruleta no termina';
    },
  },
  {
    nombre: 'aguantar el giro entra en derrape solo, sube de nivel y da turbo al soltar',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      const t = s.state.track;
      // lo ponemos lanzado en el centro de la carretera y mantenemos el giro, sin tocar nada más
      const m = t.samples[t.nearest(k.x, k.y).i];
      k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
      k.angle = m.ang; k.moveAngle = m.ang; k.speed = sim.BASE_MAX_SPEED;
      const avisos = [];
      let nivelMax = 0, empezoEn = null;
      for (let i = 0; i < Math.round(60 * (sim.DRIFT_L1 + 0.35)); i++) {
        s.setInput(k, { s: 1, g: 1, b: 0, d: 0 });
        s.update(DT);
        if (empezoEn === null && k.driftT > 0) empezoEn = (i + 1) / 60;
        nivelMax = Math.max(nivelMax, k.driftLevel);
      }
      if (empezoEn === null) return 'aguantando el giro no ha entrado en derrape';
      if (empezoEn > sim.DRIFT_START + 0.1) return `tarda ${empezoEn.toFixed(2)} s en derrapar (debería ser ${sim.DRIFT_START} s)`;
      if (nivelMax < 1) return 'el derrape no llega al nivel 1';
      // al soltar el giro, turbo
      s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
      s.update(DT);
      if (!(k.boostUntil > s.state.simTime)) return 'soltar el derrape no ha dado turbo';
      if (k.driftT !== 0 || k.driftLevel !== 0) return 'el derrape no se ha soltado del todo';

      // un toque corto de giro no derrapa ni da nada
      const s2 = carrera(sim, { seed: 11 });
      const k2 = humano(s2);
      const m2 = s2.state.track.samples[s2.state.track.nearest(k2.x, k2.y).i];
      k2.x = m2.x; k2.y = m2.y; k2.z = m2.h; k2.ground = m2.h; k2.air = false;
      k2.angle = m2.ang; k2.moveAngle = m2.ang; k2.speed = sim.BASE_MAX_SPEED;
      k2.boostUntil = 0;
      for (let i = 0; i < 12; i++) { s2.setInput(k2, { s: -1, g: 1, b: 0, d: 0 }); s2.update(DT); }   // 0,2 s
      if (k2.driftT > 0) return 'un toque de 0,2 s ya derrapa';
      s2.setInput(k2, { s: 0, g: 1, b: 0, d: 0 });
      s2.update(DT);
      if (k2.boostUntil > s2.state.simTime) return 'un toque de 0,2 s ha dado turbo';

      // el viejo botón de derrape ya no hace nada
      const s3 = carrera(sim, { seed: 13 });
      const k3 = humano(s3);
      for (let i = 0; i < 60; i++) { s3.setInput(k3, { s: 0, g: 1, b: 0, d: 1 }); s3.update(DT); }
      if (k3.driftT > 0) return 'el botón `d` sigue derrapando';
      return avisos.length ? avisos.join('; ') : null;
    },
  },
  {
    nombre: 'los tres niveles de derrape dan turbos cada vez más largos',
    run(sim) {
      const turbos = [];
      for (let nivel = 1; nivel <= 3; nivel++) {
        const s = carrera(sim, { seed: 20 + nivel });
        const k = humano(s);
        const t = s.state.track;
        const m = t.samples[t.nearest(k.x, k.y).i];
        k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
        k.angle = m.ang; k.moveAngle = m.ang; k.speed = sim.BASE_MAX_SPEED;
        // giro mantenido, pero sin salirse: lo recolocamos en la carretera en cada paso
        const objetivo = [sim.DRIFT_L1, sim.DRIFT_L2, sim.DRIFT_L3][nivel - 1] + 0.1;
        for (let i = 0; i < Math.round(60 * objetivo); i++) {
          s.setInput(k, { s: 1, g: 1, b: 0, d: 0 });
          s.update(DT);
          const mm = t.samples[t.nearest(k.x, k.y).i];
          k.x = mm.x; k.y = mm.y; k.z = mm.h; k.ground = mm.h; k.air = false;   // lo mantenemos en pista
          k.speed = Math.max(k.speed, sim.BASE_MAX_SPEED * 0.8);
        }
        if (k.driftLevel !== nivel) return `aguantando ${objetivo.toFixed(2)} s el nivel es ${k.driftLevel} y no ${nivel}`;
        const antes = s.state.simTime;
        s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
        s.update(DT);
        turbos.push(k.boostUntil - antes);
      }
      if (!(turbos[0] < turbos[1] && turbos[1] < turbos[2])) return `los turbos no crecen con el nivel (${turbos.map((t) => t.toFixed(2)).join(', ')})`;
      const esperado = sim.DRIFT_BOOST;
      for (let i = 0; i < 3; i++) if (Math.abs(turbos[i] - esperado[i]) > 0.1) return `el turbo del nivel ${i + 1} dura ${turbos[i].toFixed(2)} s y no ${esperado[i]} s`;
      return null;
    },
  },
  {
    nombre: 'el rayo encoge a los demás y no al que lo usa',
    run(sim) {
      const s = carrera(sim, { bots: 3 });
      const k = humano(s);
      k.item = 'lightning';
      s.useItem(k);
      const now = s.state.simTime;
      if (k.shrinkUntil > now) return 'el rayo ha encogido a quien lo usa';
      const otros = s.state.karts.filter((o) => o !== k);
      return otros.every((o) => o.shrinkUntil > now) ? null : 'algún rival no ha encogido';
    },
  },
  {
    nombre: 'cuando todas las personas llegan, la carrera acaba en resultados',
    run(sim) {
      const s = carrera(sim, { bots: 2, laps: 1 });
      for (const k of s.state.karts) if (!k.isBot) { k.dist = s.state.track.N * 1 - 2; }
      let guardia = 0;
      while (s.state.phase === 'race' && guardia++ < 60 * 30) {
        for (const k of s.state.karts) if (!k.isBot && !k.finished) s.setInput(k, s.aiInput(k));
        s.update(DT);
      }
      if (s.state.phase !== 'results') return 'la carrera no ha terminado';
      return s.state.results && s.state.results.length === 3 ? null : 'la clasificación final no está completa';
    },
  },
  {
    nombre: 'a quien se sale de la pista lo recogen y lo devuelven a la carretera',
    run(sim) {
      let recogido = null;
      const s = carrera(sim, { bots: 2, laps: 2, hooks: { onRescue: (k) => { recogido = k; } } });
      const k = humano(s);
      const t = s.state.track;
      // lo plantamos en el rincón más alejado de la carretera (el circuito da vueltas: no vale
      // con apartarse en perpendicular, se acaba cayendo al lado de otro tramo)
      let lejos = null;
      for (let x = 60; x < 1920; x += 40) for (let y = 60; y < 1080; y += 40) {
        const d = t.nearest(x, y).d;
        if (!lejos || d > lejos.d) lejos = { x, y, d };
      }
      if (lejos.d < t.halfW + 200) return 'este circuito no tiene ningún sitio lo bastante apartado';
      k.x = lejos.x; k.y = lejos.y;
      k.z = t.groundAt(k.x, k.y); k.ground = k.z; k.vz = 0; k.air = false;
      k.speed = 0; k.angle = 0;
      const t0 = s.state.simTime;
      let vueltas = 0;
      while (!recogido && vueltas++ < 60 * 6) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (!recogido) return 'nadie lo ha ido a buscar';
      const tardanza = s.state.simTime - t0;
      if (tardanza > 4) return `han tardado ${tardanza.toFixed(1)} s en recogerlo (más de 4)`;
      if (t.nearest(k.x, k.y).d > t.halfW) return 'lo han dejado fuera de la carretera';
      if (Math.abs(sim.wrapAngle(k.angle - t.samples[t.nearest(k.x, k.y).i].ang)) > 0.2) return 'lo han dejado mirando al revés';
      // y puede terminar la carrera
      let guardia = 0;
      while (s.state.phase === 'race' && guardia++ < 60 * 90) {
        for (const q of s.state.karts) if (!q.isBot && !q.finished) s.setInput(q, s.aiInput(q));
        s.update(DT);
      }
      return k.finished ? null : 'después del rescate no ha llegado a meta';
    },
  },
  {
    nombre: 'a quien se queda clavado contra un muro también lo recogen',
    run(sim) {
      let recogido = false;
      const s = carrera(sim, { bots: 2, hooks: { onRescue: () => { recogido = true; } } });
      const k = humano(s);
      // acelera pero no avanza (como si estuviera encajado en un bumper)
      for (let i = 0; i < 60 * 5 && !recogido; i++) {
        s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
        s.update(DT);
        k.speed = 0;
      }
      return recogido ? null : 'se ha quedado ahí clavado para siempre';
    },
  },
  {
    nombre: 'quien está parado en la carretera sin tocar nada no molesta a nadie',
    run(sim) {
      let recogido = false;
      const s = carrera(sim, { bots: 2, hooks: { onRescue: () => { recogido = true; } } });
      const k = humano(s);
      k.speed = 0;
      for (let i = 0; i < 60 * 5; i++) { s.setInput(k, { s: 0, g: 0, b: 0, d: 0 }); k.speed = 0; s.update(DT); }
      return recogido ? 'lo han recogido sin hacer falta (estaba en la pista, parado a propósito)' : null;
    },
  },
  {
    nombre: 'un toque de giro en el aire hace el truco',
    run(sim) {
      const s = carrera(sim);
      const k = humano(s);
      // lo lanzamos hacia arriba sin tocar nada
      k.vz = 600; k.air = true; k.z = k.ground + 40; k.speed = 300;
      for (let i = 0; i < 12; i++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (k.trick) return 'ha hecho el truco sin tocar ningún botón';
      s.setInput(k, { s: 1, g: 1, b: 0, d: 0 });
      s.update(DT);
      return k.trick ? null : 'tocar el giro en el aire no ha hecho el truco';
    },
  },
  {
    // el otro medio bug de la horquilla: la carretera «más cercana» a un kart que sale despedido
    // puede ser el tramo de enfrente, 80 muestras por delante. Si se sube a él, el antiatajos no
    // se lo cuenta y al pasar de media vuelta pierde la vuelta entera.
    nombre: 'un bot que cae en el tramo de enfrente de una horquilla vuelve al suyo sin perder la vuelta',
    run(sim) {
      const r = enElTramoDeEnfrente(sim, { bots: 1, seed: 23 });
      if (r.error) return r.error;
      const { s, k, t, i } = r;
      let minDist = k.dist;
      for (let f = 0; f < 60 * 12 && k.dist < r.base + i + 60; f++) {
        s.setInput(k, s.aiInput(k)); s.update(DT);
        minDist = Math.min(minDist, k.dist);
      }
      if (minDist < r.base + i - 30) return `ha perdido progreso (de ${r.base + i} a ${minDist})`;
      if (k.dist < r.base + i + 60) return 'doce segundos después sigue sin retomar su tramo';
      for (let f = 0; f < 60 * 4 && t.nearest(k.x, k.y).d > t.halfW + 3; f++) { s.setInput(k, s.aiInput(k)); s.update(DT); }
      return t.nearest(k.x, k.y).d <= t.halfW + 3 ? null : 'ha recuperado el progreso pero no vuelve a la carretera';
    },
  },
  {
    nombre: 'a quien acaba en el tramo de enfrente lo recogen y lo devuelven a SU tramo',
    run(sim) {
      let recogido = false;
      const r = enElTramoDeEnfrente(sim, { bots: 1, seed: 24, hooks: { onRescue: () => { recogido = true; } } });
      if (r.error) return r.error;
      const { s, k, t, i } = r;
      // sigue a todo gas por el tramo equivocado, como haría una persona despistada
      for (let f = 0; f < 60 * 6 && !recogido; f++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (!recogido) return 'nadie lo ha recogido';
      const n = t.nearest(k.x, k.y);
      let delta = n.i - i; if (delta > t.N / 2) delta -= t.N; if (delta < -t.N / 2) delta += t.N;
      if (Math.abs(delta) > t.win) return `lo han dejado en el tramo equivocado (muestra ${n.i}, la suya era la ${i})`;
      return k.dist >= r.base + i - 5 ? null : `al recogerlo ha perdido progreso (${k.dist} < ${r.base + i})`;
    },
  },
  {
    nombre: 'los hooks avisan de lo que pasa en la carrera',
    run(sim) {
      const vistos = new Set();
      const hooks = {};
      for (const nombre of Object.keys(sim.DEFAULT_HOOKS)) hooks[nombre] = () => vistos.add(nombre);
      const s = carrera(sim, { bots: 7, laps: 1, hooks });
      for (let i = 0; i < 60 * 40 && s.state.phase !== 'results'; i++) {
        for (const k of s.state.karts) if (!k.isBot && !k.finished) s.setInput(k, s.aiInput(k));
        s.update(DT);
      }
      const imprescindibles = ['onPhase', 'onCountdown', 'onGo', 'onKartAdded', 'onSfx', 'onParticles', 'onStatus', 'onResults'];
      const faltan = imprescindibles.filter((h) => !vistos.has(h));
      return faltan.length ? 'no se han llamado: ' + faltan.join(', ') : null;
    },
  },
];

main().catch((e) => { console.error(e); process.exit(1); });
