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
const volante = require(path.join(ROOT, 'public/volante.js'));

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
  comprobarDuracionDeVuelta(tiempos);

  console.log('Determinismo');
  {
    const a = correrCircuito(sim, 0, { silencioso: true });
    const b = correrCircuito(sim, 0, { silencioso: true });
    const mismos = JSON.stringify(a.finishTimes) === JSON.stringify(b.finishTimes);
    check(mismos, 'dos carreras con la misma semilla dan los mismos tiempos');
  }

  console.log('Volante');
  comprobarVolante();
  console.log('Paneles');
  const layout = await import(pathToFileURL(path.join(ROOT, 'public/layout.mjs')).href);
  comprobarPaneles(layout);

  console.log('Torneo');
  const torneo = await import(pathToFileURL(path.join(ROOT, 'public/torneo.mjs')).href);
  comprobarTorneo(torneo);

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

// ---------------------------------------------------------------- el volante del móvil
/*
 * El mando gira inclinando el móvil. Las cuentas están en public/volante.js y aquí se comprueban
 * contra situaciones físicas conocidas, sin navegador.
 *
 * `deviceorientation` da beta y gamma en grados. La gravedad en coordenadas del móvil sale de
 * ahí, y girar el móvil como un volante (alrededor del eje que sale de la pantalla) hace girar
 * ese vector dentro del plano de la pantalla: ese giro es el del volante.
 */
function comprobarVolante() {
  const grados = (r) => (r * 180) / Math.PI;
  // El camino de vuelta, escrito aparte a propósito: de una gravedad en coordenadas del móvil,
  // qué beta y gamma la producirían. Sirve para montar poses concretas del móvil.
  const anglesDe = (g) => ({
    beta: grados(Math.asin(-g.y)),
    gamma: grados(Math.atan2(g.x, -g.z)),
  });
  // Pose: móvil en horizontal, inclinado `cabeceo` grados hacia atrás, girado `giro` grados
  // como un volante (positivo = en el sentido de las agujas del reloj = a la derecha).
  function pose(giroGrados, cabeceoGrados) {
    const c = (cabeceoGrados * Math.PI) / 180, t = (giroGrados * Math.PI) / 180;
    // De pie en horizontal la gravedad cae hacia el borde que queda abajo (+x del móvil). Al
    // girar el móvil a la derecha (agujas del reloj), la gravedad gira al revés dentro de la
    // pantalla: por eso el seno va con signo positivo.
    const plano = Math.cos(c), fuera = -Math.sin(c);
    const g = { x: plano * Math.cos(t), y: plano * Math.sin(t), z: fuera };
    return anglesDe(g);
  }
  const lee = (giro, cabeceo = 0) => {
    const a = pose(giro, cabeceo);
    return volante.gravedad(a.beta, a.gamma);
  };

  // --- la gravedad, contra dos poses que se saben de memoria ---
  {
    const dePie = volante.gravedad(90, 0);     // móvil vertical en retrato: la gravedad cae hacia abajo (-y)
    const tumbado = volante.gravedad(0, 0);    // móvil plano boca arriba: no hay gravedad en el plano
    const horizontal = volante.gravedad(0, 90); // girado 90º a la derecha: la gravedad cae hacia +x
    const cerca = (v, x, y) => Math.abs(v.x - x) < 0.001 && Math.abs(v.y - y) < 0.001;
    check(cerca(dePie, 0, -1) && cerca(tumbado, 0, 0) && cerca(horizontal, 1, 0),
      'la gravedad en el móvil sale bien (de pie, tumbado y en horizontal)');
    check(!volante.hayGravedad(tumbado) && volante.hayGravedad(dePie),
      'con el móvil plano boca arriba avisa de que no puede medir el giro');
  }

  // --- girar el móvil como un volante da ese mismo ángulo ---
  {
    const centro = lee(0, 30);
    let peor = 0;
    for (const giro of [-40, -25, -10, 0, 10, 25, 40]) {
      const medido = grados(volante.angulo(centro, lee(giro, 30)));
      peor = Math.max(peor, Math.abs(medido - giro));
    }
    check(peor < 0.5, `girar el móvil N grados se mide como N grados (el peor falla ${peor.toFixed(2)}º)`);
  }

  // --- da igual cómo de inclinado lo sujetes ---
  {
    let peor = 0;
    for (const cabeceo of [0, 15, 30, 45, 60, 75]) {
      const centro = lee(0, cabeceo);
      for (const giro of [-30, -12, 12, 30]) {
        peor = Math.max(peor, Math.abs(grados(volante.angulo(centro, lee(giro, cabeceo))) - giro));
      }
    }
    check(peor < 0.5, `el volante mide igual con el móvil de pie o tumbado (el peor falla ${peor.toFixed(2)}º)`);
  }

  // --- zona muerta, tope, sentido y progresividad ---
  {
    const dir = (g) => volante.direccion((g * Math.PI) / 180);
    const muerta = grados(volante.MUERTA), tope = grados(volante.TOPE);
    const quieto = dir(0) === 0 && dir(muerta - 1) === 0 && dir(-(muerta - 1)) === 0;
    const aTope = dir(tope) === 1 && dir(-tope) === -1 && dir(tope + 40) === 1;
    const derecha = dir(20) > 0 && dir(-20) < 0;     // a la derecha como un volante de verdad
    check(quieto && aTope && derecha, `zona muerta de ${muerta.toFixed(0)}º, tope a ${tope.toFixed(0)}º y girar a la derecha manda a la derecha`);
    /*
     * Un pelín progresiva, no del todo recta: cerca del centro el temblor de la mano no puede dar
     * un volantazo. Pero tampoco pasarse, que con mucha curva el dueño sintió que el kart no
     * giraba. A mitad de recorrido tiene que salir algo menos de medio giro, no mucho menos. Y
     * nunca puede haber saltos: cuanto más giras, más gira, siempre.
     */
    const mitad = dir((muerta + tope) / 2);
    let crece = true, previo = -1;
    for (let g = 0; g <= tope + 5; g += 1) { const d = dir(g); if (d < previo - 1e-9) crece = false; previo = d; }
    check(mitad > 0.33 && mitad < 0.48, `a mitad de recorrido gira casi la mitad (${mitad.toFixed(2)}: ni brusco ni blando)`);
    check(crece, 'la respuesta sube siempre: más volante, más giro');
  }

  // --- el filtro se acerca al valor nuevo sin pasarse ---
  {
    let v = 0;
    for (let i = 0; i < 20; i++) v = volante.suaviza(v, 1);
    check(v > 0.99 && v <= 1 && volante.suaviza(0, 1) < 0.6,
      'el filtro quita el temblor pero llega al valor en unas décimas');
  }
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
  // las vueltas: 3 en el primero, 2 en los demás… salvo que el circuito fije las suyas (Last Dance)
  const laps = trackDefs[index].vueltas || (index === 0 ? 3 : 2);
  const nombre = trackDefs[index].name;
  // el tope de tiempo se calcula con la longitud del circuito, no a ojo: Last Dance mide 73.000 px
  // y una vuelta se va a los tres minutos
  const largoPx = geom.buildSamples(trackDefs[index].points, 8).length * 8;
  const tope = Math.max(90, (largoPx / 320) * laps * 1.8 + 30);
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
      if (k.x < 0 || k.x > s.state.track.W) falla(`${k.name}: x fuera del mundo (${k.x.toFixed(1)} de ${s.state.track.W})`);
      if (k.y < 0 || k.y > s.state.track.H) falla(`${k.name}: y fuera del mundo (${k.y.toFixed(1)} de ${s.state.track.H})`);
      if (Math.abs(k.speed) > 2.5 * sim.BASE_MAX_SPEED) falla(`${k.name}: velocidad disparada (${k.speed.toFixed(0)})`);
      if (k.lapCount < lapsPrevias[i]) falla(`${k.name}: la vuelta va hacia atrás`);
      if (k.finished && !vueltasAlLlegar.has(k)) vueltasAlLlegar.set(k, k.lapCount);
      /*
       * En cada ventana de 10 s, quien no ha terminado tiene que avanzar. Pero los frames en los
       * que **la carrera está parada** (alguien está eligiendo víctima del caracol) no cuentan: ahí
       * no se mueve nadie a propósito, el reloj de la simulación tampoco corre, y sin esta salvedad
       * el aviso de «atascado» saltaba solo porque la partida estaba en pausa.
       */
      if (s.state.eligiendo) return;
      const h = historial.get(k);
      // el tercer número es lo que se ha movido *siguiendo el sentido del circuito* (px): es la
      // forma honrada de ver si alguien va al revés, sin que la engañe el contador de progreso,
      // que se congela cuando un kart vuela por un atajo (ver «Bugs conocidos» de IDEAS.md)
      const sm = s.state.track.samples[s.state.track.nearest(k.x, k.y).i];
      const conElCircuito = (k.x - antes[i].x) * Math.cos(sm.ang) + (k.y - antes[i].y) * Math.sin(sm.ang);
      // El cuarto dice si en ese instante estaba pagando algo del juego: trompo, rescate, rayo
      // (encogido) o caracol. Al que le cae encima media caja de objetos tampoco avanza, y eso
      // **no** es estar atascado, es la partida; sin esta distinción el aviso salta por mala suerte
      // y no por un fallo (pasó con el Bot 1 de Chicle: caracol + rayo + dos caparazones en 10 s).
      const castigado = (k.spinUntil > s.state.simTime || k.rescueUntil > s.state.simTime
        || k.shrinkUntil > s.state.simTime || k.slowUntil > s.state.simTime) ? 1 : 0;
      h.push([k.dist - antes[i].dist, Math.hypot(k.x - antes[i].x, k.y - antes[i].y), conElCircuito, castigado]);
      if (h.length > ventana) h.shift();
      if (h.length === ventana && !k.finished) {
        const avance = h.reduce((a, b) => a + b[0], 0);
        const recorrido = h.reduce((a, b) => a + b[1], 0);
        const sentido = h.reduce((a, b) => a + b[2], 0);
        const castigo = h.reduce((a, b) => a + b[3], 0) * DT;     // segundos de trompo, rescate, rayo o caracol
        if (avance < 40 && recorrido < 400 && castigo < 2) falla(`${k.name}: atascado (${avance.toFixed(0)} muestras y ${recorrido.toFixed(0)} px en 10 s, ${castigo.toFixed(1)} s de castigo)`);
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

/*
 * Una vuelta tiene que durar entre 25 y 60 s (IDEAS.md, «Mejorar los circuitos para la vista en
 * tercera persona»). Los cinco circuitos se rehicieron por esto: con vueltas de 9-12 s el circuito
 * se acababa antes de aprendértelo, y con la cámara de detrás no daba tiempo ni a mirar el paisaje.
 *
 * Esto no es lo mismo que la referencia de arriba: la referencia vigila que la física no empeore
 * (un 10 % de margen sobre lo medido), y esto vigila que un circuito nuevo —o un retoque de uno de
 * ahora— no vuelva a dejar vueltas de bolsillo. Se mide sobre los tiempos que ya se han corrido,
 * así que no cuesta ni un segundo más.
 */
const VUELTA_MIN = 25, VUELTA_MAX = 60;
// Un circuito puede salirse de esa horquilla **si fija sus propias vueltas**: es el caso de «Last
// Dance», que es una vuelta única de tres minutos a propósito. Ahí lo que se mira es que la carrera
// entera (vuelta × vueltas) no se vaya de madre.
const CARRERA_MAX = 260;

function comprobarDuracionDeVuelta(tiempos) {
  console.log('Duración de la vuelta');
  for (const t of tiempos) {
    const def = trackDefs.find((d) => d.name === t.nombre);
    if (def && def.vueltas) {
      const carrera = t.vueltaMedia * def.vueltas;
      check(carrera <= CARRERA_MAX,
        `${t.nombre}: una vuelta de ${t.vueltaMedia.toFixed(0)} s y ${def.vueltas} vuelta(s) = ${carrera.toFixed(0)} s de carrera (tope ${CARRERA_MAX} s)`);
      continue;
    }
    check(t.vueltaMedia >= VUELTA_MIN && t.vueltaMedia <= VUELTA_MAX,
      `${t.nombre}: vuelta media ${t.vueltaMedia.toFixed(1)} s (tiene que estar entre ${VUELTA_MIN} y ${VUELTA_MAX} s)`);
  }
}

// ---------------------------------------------------------------- paneles de la pantalla dividida
// La tabla que manda (IDEAS.md): 1 → completa, 2 → dos anchos, 3-4 → 2×2, 5-6 → 3×2, 7-8 → 4×2.
const FILAS_ESPERADAS = { 1: [1], 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4] };

/*
 * El modo torneo: varias carreras seguidas, puntos por puesto, la última doble, y entre carrera y
 * carrera se vota el circuito siguiente. Las cuentas viven en public/torneo.mjs.
 */
function comprobarTorneo(T) {
  const corredor = (char, nombre) => ({ char, nombre, emoji: '🏎️', color: '#fff' });
  const A = corredor(0, 'Ana'), B = corredor(1, 'Bea'), C = corredor(2, 'Cris');

  check(T.PUNTOS.join('-') === '10-8-6-4-3-2-1', `los puntos por puesto son 10-8-6-4-3-2-1 (${T.PUNTOS.join('-')})`);
  check(T.puntosDe(1) === 10 && T.puntosDe(7) === 1 && T.puntosDe(8) === 0,
    'del primero al séptimo puntúan, del octavo para abajo no');
  check(T.puntosDe(1, true) === 20 && T.puntosDe(4, true) === 8, 'la última carrera vale el doble');
  check(T.esUltima(3, 4) && !T.esUltima(2, 4), 'la última carrera de cuatro es la cuarta');

  // dos carreras: Ana gana la primera, Bea la segunda
  let tabla = T.sumarCarrera(new Map(), [A, B, C]);
  const tras1 = T.clasificacion(tabla);
  check(tras1[0].char === 0 && tras1[0].puntos === 10 && tras1[2].puntos === 6,
    `tras la primera carrera manda Ana con 10 puntos (${tras1.map((f) => f.nombre + ' ' + f.puntos).join(', ')})`);
  const antes = tabla;
  tabla = T.sumarCarrera(tabla, [B, C, A]);
  const tras2 = T.clasificacion(tabla, antes);
  check(tras2[0].char === 1 && tras2[0].puntos === 18, `Bea se pone primera con 18 (${tras2[0].nombre} ${tras2[0].puntos})`);
  check(tras2[0].sube === 1 && tras2.find((f) => f.char === 0).sube === -1,
    'la tabla dice quién sube y quién baja de puesto');
  // la última, doble: Cris gana y se lleva 20
  const tras3 = T.clasificacion(T.sumarCarrera(tabla, [C, A, B], true));
  check(tras3.find((f) => f.char === 2).puntos === 6 + 8 + 20, 'la última carrera dobla los puntos de verdad');

  // votación del circuito
  const votos = new Map([[1, 3], [2, 3], [3, 0]]);
  const g = T.circuitoGanador(votos, [], 6, () => 0);
  check(g.indice === 3 && g.votos === 2 && !g.porSorteo, `gana el más votado (salió ${g.indice} con ${g.votos} votos)`);
  const empate = T.circuitoGanador(new Map([[1, 2], [2, 5]]), [], 6, () => 0.99);
  check([2, 5].includes(empate.indice) && empate.porSorteo, 'con empate se echa a suertes entre los empatados');
  const sinVotos = T.circuitoGanador(new Map(), [0, 1, 2], 5, () => 0);
  check([3, 4].includes(sinVotos.indice) && sinVotos.porSorteo,
    `sin votos sale uno de los que no se han jugado (salió ${sinVotos.indice})`);
  const todosJugados = T.circuitoGanador(new Map(), [0, 1, 2, 3, 4], 5, () => 0.5);
  check(todosJugados.indice >= 0 && todosJugados.indice < 5, 'si ya se han jugado todos, vale cualquiera');
  const basura = T.circuitoGanador(new Map([[1, 99], [2, -3]]), [0], 4, () => 0);
  check(basura.indice >= 0 && basura.indice < 4, 'los votos con basura no rompen la votación');
}

function comprobarPaneles(layout) {
  for (let n = 1; n <= 8; n++) {
    const rects = layout.panelLayout(n);
    const filas = layout.filasDePaneles(n);
    const problemas = [];
    if (rects.length !== n) problemas.push(`devuelve ${rects.length} paneles y no ${n}`);
    if (JSON.stringify(filas) !== JSON.stringify(FILAS_ESPERADAS[n])) problemas.push(`las filas son ${JSON.stringify(filas)} y no ${JSON.stringify(FILAS_ESPERADAS[n])}`);
    let area = 0;
    for (const r of rects) {
      if (!(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9)) {
        problemas.push(`un panel se sale de la pantalla (${JSON.stringify(r)})`);
      }
      area += r.w * r.h;
    }
    if (Math.abs(area - 1) > 1e-9) problemas.push(`los paneles cubren ${(area * 100).toFixed(1)} % de la pantalla`);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const solape = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
          * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if (solape > 1e-9) problemas.push(`los paneles ${i + 1} y ${j + 1} se solapan`);
      }
    }
    if (n % 2 === 0 && n > 2) {
      const iguales = rects.every((r) => Math.abs(r.w - rects[0].w) < 1e-9 && Math.abs(r.h - rects[0].h) < 1e-9);
      if (!iguales) problemas.push('con un número par, los paneles deberían ser todos iguales');
    }
    check(problemas.length === 0, `${n} jugador${n > 1 ? 'es' : ''}: ${filas.join(' + ')} panel(es) por fila${problemas.length ? ' → ' + problemas.join('; ') : ''}`);
  }
  // en píxeles, con el origen abajo (lo que quiere three.js)
  const [arriba, abajo] = layout.panelLayout(2);
  const pa = layout.panelEnPixeles(arriba, 1920, 1080), pb = layout.panelEnPixeles(abajo, 1920, 1080);
  check(pa.x === 0 && pa.y === 540 && pa.w === 1920 && pa.h === 540 && pb.y === 0,
    'en píxeles, el panel de arriba queda arriba (origen abajo, como three.js)');
}

// ---------------------------------------------------------------- escenarios sueltos
// Monta una carrera ya empezada (sin cuenta atrás) para poder forzar situaciones concretas.
function carrera(sim, { bots = 1, laps = 3, trackIndex = pista('Chicle'), seed = 7, hooks, defs = trackDefs } = {}) {
  const s = sim.createSim({ geom, trackDefs: defs, random: mulberry32(seed), hooks });
  const entries = [{ playerId: 1, name: 'Humano', char: 0 }];
  for (let i = 1; i <= bots; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + i, char: i });
  s.startRace({ entries, trackIndex, laps });
  for (let i = 0; i < 185; i++) s.update(DT);   // se come la cuenta atrás (3 s)
  return s;
}
const humano = (s) => s.state.karts.find((k) => !k.isBot);
// Los circuitos se piden por nombre: el orden de la lista cambia (Arcoíris pasó a ser el primero)
// y un escenario que necesita una horquilla no puede depender de que siga siendo el número 2.
const pista = (nombre) => trackDefs.findIndex((d) => d.name === nombre);

/*
 * Una pista de pruebas con horquilla, **solo para este escenario**: dos rectas paralelas a 360 px
 * unidas por dos curvas de 180º. No es un circuito de la fiesta y no sale en `tracks.js`.
 *
 * Antes este escenario cogía Volcán Disco, que tenía una horquilla de verdad. Al rehacer los cinco
 * circuitos en mundos tres veces más grandes (generados con `tools/traza.js`, que no sabe hacer un
 * giro de 180º sin curvas ilegales) ya no queda ninguna horquilla, y sin dos tramos pegados no hay
 * manera de montar la situación que se quiere probar. Atar una prueba de regresión a la forma de
 * un circuito era el error: la forma cambia cuando el dueño pide otra cosa, el bug no.
 */
const PISTA_HORQUILLA = [{
  /*
   * Es el trazado que tenía Volcán Disco hasta el 2026-09-20, con su horquilla: dos tramos que se
   * cruzan a 255 px, que es lo que hace falta para montar la situación. Se guarda aquí, y no en
   * `tracks.js`, porque ya no es un circuito de la fiesta: Volcán Disco se rehizo en un mundo tres
   * veces más grande y sin horquillas (el generador de `tools/traza.js` no sabe hacer un giro de
   * 180º sin curvas ilegales).
   *
   * Atar una prueba de regresión a la forma de un circuito era el error de antes: la forma cambia
   * cuando el dueño pide otra cosa, y el bug que se arregló no. Con la pista aquí dentro, el
   * escenario sigue midiendo lo mismo pase lo que pase con los cinco circuitos.
   */
  name: 'Horquilla de pruebas (el Volcán Disco de antes)', width: 110, gravity: 1,
  boxes: [], pads: [], features: [], barriers: [],
  theme: { sky: ['#2b0040', '#ff3d00'], fog: '#7a1c7a', ground: '#7a1fb8', groundAlt: '#4b0a80',
    road: '#1c1c2e', curb: ['#ffea00', '#1a1a1a'], bumper: ['#ff2d95', '#00e5ff'], pad: '#ffea00',
    decor: [], palette: ['#00e5ff'], clouds: null, sun: null, stars: false },
  points: [
    { x: 450, y: 250 }, { x: 900, y: 230 }, { x: 1350, y: 250 }, { x: 1680, y: 350 },
    { x: 1760, y: 600 }, { x: 1720, y: 790 }, { x: 1630, y: 915 }, { x: 1520, y: 935 },
    { x: 1430, y: 860 }, { x: 1410, y: 760 }, { x: 1405, y: 690 }, { x: 1388, y: 625 },
    { x: 1340, y: 577 }, { x: 1275, y: 560 }, { x: 1210, y: 577 }, { x: 1162, y: 625 },
    { x: 1145, y: 690 }, { x: 1140, y: 760 }, { x: 1115, y: 860 }, { x: 1020, y: 935 },
    { x: 750, y: 950 }, { x: 400, y: 900 }, { x: 190, y: 720 }, { x: 170, y: 470 },
    { x: 260, y: 300 },
  ],
}];

/*
 * Busca en la pista los dos tramos que pasan más cerca sin ser el mismo (la horquilla) y planta al
 * humano encima del tramo de enfrente, con el progreso del tramo por el que iba: es lo que le pasa
 * a un kart que sale despedido en una horquilla.
 */
function enElTramoDeEnfrente(sim, { bots, seed, hooks } = {}) {
  const s = carrera(sim, { bots, seed, hooks, defs: PISTA_HORQUILLA, trackIndex: 0 });
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
  if (!mejor || mejor.d > t.halfW + 400) return { error: 'la pista de pruebas no tiene dos tramos lo bastante cerca' };
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
      s.startRace({ entries: [{ playerId: 1, name: 'Humano', char: 0 }, { playerId: null, bot: true, name: 'Bot', char: 1 }], trackIndex: pista('Chicle'), laps: 1 });
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
      for (const nombre of ['Chicle', 'Playa Neón', 'Volcán Disco', 'Luna Loca']) {
        const s = carrera(sim, { bots: 1, trackIndex: pista(nombre) });
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
    nombre: 'ir al revés más de 1,5 s dispara el aviso, y girarse lo apaga',
    run(sim) {
      const avisos = [];
      const s = carrera(sim, { bots: 1, hooks: { onWrongWay: (k, va) => avisos.push([k.name, va]) } });
      const k = humano(s);
      const t = s.state.track;
      const m = t.samples[t.nearest(k.x, k.y).i];
      // marcha atrás a conciencia: mirando bien pero moviéndose hacia atrás
      k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
      k.angle = m.ang; k.moveAngle = m.ang + Math.PI; k.speed = 200;
      for (let i = 0; i < 60 * 1.2; i++) {
        s.setInput(k, { s: 0, g: 0, b: 0, d: 0 });
        k.moveAngle = t.samples[t.nearest(k.x, k.y).i].ang + Math.PI; k.speed = 200;   // sigue yendo al revés
        s.update(DT);
      }
      if (k.wrongWay) return `avisa a los ${k.wrongT.toFixed(2)} s, antes de ${sim.WRONG_WAY_TIME}`;
      for (let i = 0; i < 60 * 0.6; i++) {
        s.setInput(k, { s: 0, g: 0, b: 0, d: 0 });
        k.moveAngle = t.samples[t.nearest(k.x, k.y).i].ang + Math.PI; k.speed = 200;
        s.update(DT);
      }
      if (!k.wrongWay) return `no avisa ni a los ${k.wrongT.toFixed(2)} s`;
      if (!avisos.some(([, va]) => va === true)) return 'el hook onWrongWay no ha saltado';
      // se gira: el aviso se apaga
      for (let i = 0; i < 60; i++) {
        const mm = t.samples[t.nearest(k.x, k.y).i];
        k.moveAngle = mm.ang; k.angle = mm.ang; k.speed = 200;
        s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
        s.update(DT);
      }
      if (k.wrongWay) return 'sigue avisando después de darse la vuelta';
      return avisos.some(([, va]) => va === false) ? null : 'el hook no avisa de que ya va bien';
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
    // el reparto por posición es la regla de oro del juego: el último tiene que remontar y el
    // primero no puede sentirse robado. Si se tocan los pesos de `rollItem`, esta tabla cambia a
    // propósito (y aquí se ve cuánto).
    nombre: 'el reparto de objetos por posición es el declarado',
    run(sim) {
      /*
       * Porcentajes declarados con siete corredores, de la posición 1 a la 7. La idea del reparto:
       * el que va delante solo saca cosas de defensa (y de vez en cuando le estalla un calamarazo),
       * y cuanto más atrás vas, mejores cosas: el **cohete** y el **caparazón azul** son de la mitad
       * de atrás para abajo, y el último es el que más los ve.
       */
      const DECLARADO = {
        1: { mushroom: 45.7, banana: 45.9, inkSelf: 8.5, red: 0, blue: 0, rocket: 0, lightning: 0, snail: 0 },
        2: { mushroom: 33.4, banana: 27.4, ink: 22.5, red: 14.9, star: 1.1, blue: 0, rocket: 0 },
        4: { mushroom: 28.2, ink: 19.3, red: 17.7, banana: 15.9, star: 7.1, blue: 5.7, snail: 3.5, lightning: 2.7, rocket: 0 },
        6: { mushroom: 19.3, red: 14.3, ink: 13.4, rocket: 12.0, star: 11.5, blue: 9.3, lightning: 7.2, banana: 7.2, snail: 5.8 },
        7: { mushroom: 16.0, rocket: 16.0, star: 12.9, red: 12.7, ink: 11.1, blue: 10.4, lightning: 9.6, snail: 6.4, banana: 4.8 },
      };
      const TIRADAS = 20000, MARGEN = 2.5;   // puntos porcentuales
      const s = sim.createSim({ geom, trackDefs, random: mulberry32(99) });
      for (const [pos, esperado] of Object.entries(DECLARADO)) {
        const cuenta = {};
        for (let i = 0; i < TIRADAS; i++) {
          const id = s.rollItem(Number(pos), 7);
          cuenta[id] = (cuenta[id] || 0) + 1;
        }
        for (const [id, pct] of Object.entries(esperado)) {
          const medido = ((cuenta[id] || 0) / TIRADAS) * 100;
          if (Math.abs(medido - pct) > MARGEN) {
            return `en la posición ${pos}, ${id} sale el ${medido.toFixed(1)} % y lo declarado es ${pct} %`;
          }
        }
      }
      // al primero no le puede salir nada de atacar, y al segundo tampoco lo gordo
      for (let i = 0; i < 4000; i++) {
        const id = s.rollItem(1, 7);
        if (['lightning', 'red', 'snail', 'blue', 'rocket', 'ink'].includes(id)) return `al primero le ha salido ${id}`;
        const id2 = s.rollItem(2, 7);
        if (id2 === 'blue' || id2 === 'rocket') return `al segundo le ha salido ${id2}`;
      }
      return null;
    },
  },
  {
    nombre: 'el rayo no encoge dos veces al mismo en menos de 30 s',
    run(sim) {
      const s = carrera(sim, { bots: 3 });
      const k = humano(s);
      const victimas = s.state.karts.filter((o) => o !== k);
      k.item = 'lightning';
      s.useItem(k);
      const encogidos = victimas.filter((o) => o.shrinkUntil > s.state.simTime);
      if (encogidos.length !== victimas.length) return 'el primer rayo no ha encogido a todos';
      const antes = victimas.map((o) => o.shrinkUntil);
      // cinco segundos después, otro rayo: a los mismos no les puede volver a caer
      for (let i = 0; i < 60 * 5; i++) s.update(DT);
      const otro = victimas[0];
      otro.item = 'lightning';
      s.useItem(otro);
      const t = s.state.simTime;
      for (let i = 1; i < victimas.length; i++) {
        if (victimas[i].shrinkUntil > antes[i] && victimas[i].shrinkUntil > t) {
          return `${victimas[i].name} se ha comido dos rayos en ${sim.LIGHTNING_IMMUNITY} s`;
        }
      }
      // pasada la inmunidad, el rayo vuelve a funcionar
      for (const o of victimas) o.zapUntil = 0;
      otro.item = 'lightning';
      s.useItem(otro);
      return victimas[1].shrinkUntil > s.state.simTime ? null : 'pasada la inmunidad, el rayo ya no encoge';
    },
  },
  {
    nombre: 'por muchos golpes que te tiren, no te dan más de 3 en 10 s',
    run(sim) {
      const s = carrera(sim, { bots: 1 });
      const k = humano(s);
      let golpes = 0;
      for (let i = 0; i < 60 * 10; i++) {
        if (s.hitKart(k, { id: 0, tipo: 'prueba' })) golpes++;
        s.update(DT);
      }
      if (golpes > 3) return `le han dado ${golpes} veces en 10 s`;
      if (golpes < 2) return `solo le han dado ${golpes} veces en 10 s: la inmunidad es demasiado larga`;
      return k.hitsTaken === golpes ? null : `el contador del kart dice ${k.hitsTaken} golpes y han sido ${golpes}`;
    },
  },
  {
    nombre: 'el último de la parrilla sube al podio alguna vez (8 carreras)',
    run(sim) {
      let podios = 0, terminan = 0;
      for (let ronda = 0; ronda < 8; ronda++) {
        const s = sim.createSim({ geom, trackDefs, random: mulberry32(700 + ronda) });
        const entries = [];
        for (let i = 0; i < 8; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + (i + 1), char: i });
        // los circuitos cortos: el monstruo («Last Dance») dura tres minutos por vuelta y aquí se
        // corren ocho carreras, así que se queda fuera de esta prueba
        const cortos = trackDefs.map((d, i) => (d.vueltas ? -1 : i)).filter((i) => i >= 0);
        s.startRace({ entries, trackIndex: cortos[ronda % cortos.length], laps: 2 });
        while (s.state.simTime < 150 && s.state.phase !== 'results' && !s.allFinished()) s.update(DT);
        const ks = s.state.karts;
        if (ks.every((k) => k.finished)) terminan++;
        const ultimo = ks[ks.length - 1];
        if (ultimo.finishRank <= 3) podios++;
        // y de paso: el reparto por posición queda registrado en las estadísticas
        if (ronda === 0 && !Object.keys(s.stats.itemsByPos).length) return 'las estadísticas no apuntan los objetos por posición';
      }
      if (terminan < 8) return `en ${8 - terminan} de 8 carreras no terminan los 8 bots`;
      return podios > 0 ? null : 'el último de la parrilla no sube al podio ni una vez en 8 carreras';
    },
  },
  {
    // la fiesta también existe con dos: los objetos y el reparto tienen que funcionar igual
    nombre: 'con solo dos corredores la carrera también acaba (y sin rayos)',
    run(sim) {
      const s = sim.createSim({ geom, trackDefs, random: mulberry32(77) });
      s.startRace({ entries: [{ playerId: null, bot: true, name: 'Bot 1', char: 0 }, { playerId: null, bot: true, name: 'Bot 2', char: 1 }], trackIndex: pista('Playa Neón'), laps: 2 });
      while (s.state.simTime < 150 && s.state.phase !== 'results' && !s.allFinished()) s.update(DT);
      if (!s.state.karts.every((k) => k.finished)) return 'con dos corredores alguno no termina';
      for (let i = 0; i < 2000; i++) if (s.rollItem(2, 2) === 'lightning') return 'con dos corredores sale el rayo (no debería)';
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
      for (let x = 60; x < t.W; x += 40) for (let y = 60; y < t.H; y += 40) {
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
    // El atasco más molesto de la fiesta: entrabas en diagonal al quitamiedos, rebotabas, seguías
    // apuntando al muro y volvías a entrar, una y otra vez sin avanzar (y sin que el rescate te
    // salvara, porque técnicamente te movías). Ver BUMPER_ENDEREZA en sim.mjs.
    nombre: 'quien se come el quitamiedos en diagonal vuelve a rodar en menos de 1,5 s',
    run(sim) {
      // Arcoíris es el que lleva quitamiedos en los dos lados de todo el recorrido
      const s = carrera(sim, { bots: 0, trackIndex: pista('Arcoíris') });
      const k = humano(s);
      const t = s.state.track;
      const sm = t.samples[t.nearest(k.x, k.y).i];
      const lado = 1;
      k.x = sm.x + sm.nx * (t.halfW - 10) * lado;
      k.y = sm.y + sm.ny * (t.halfW - 10) * lado;
      k.z = t.groundAt(k.x, k.y); k.ground = k.z; k.vz = 0; k.air = false;
      k.angle = sm.ang + 1.1 * lado;    // ~63º contra el muro
      k.moveAngle = k.angle; k.speed = 300; k.stuckT = 0;
      const d0 = k.dist;
      let libre = -1;
      for (let f = 0; f < 60 * 3; f++) {
        s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
        s.update(DT);
        if (libre < 0) {
          const n = t.nearest(k.x, k.y);
          const desvio = Math.abs(sim.wrapAngle(k.angle - t.samples[n.i].ang));
          if (desvio < 0.5 && Math.abs(n.lat) < t.halfW - 20 && k.speed > 150) libre = (f + 1) / 60;
        }
      }
      const avance = (k.dist - d0) * 8;
      if (libre < 0) return 'se ha quedado picoteando el muro: nunca vuelve a rodar recto';
      if (libre > 1.5) return `tarda ${libre.toFixed(2)} s en volver a rodar (más de 1,5)`;
      if (avance < 600) return `solo ha avanzado ${avance.toFixed(0)}px en 3 s (se ha quedado pegado al muro)`;
      return null;
    },
  },
  {
    // «Que te reencaminen al chocar»: tras el trompo de un caparazón, el kart sale mirando hacia
    // donde le pilló el golpe. Ver GOLPE_ENDEREZA en sim.mjs.
    nombre: 'después de un golpe el kart sale encarado hacia la carretera',
    run(sim) {
      const s = carrera(sim, { bots: 1 });
      const k = humano(s);
      const t = s.state.track;
      // mirando de lado a la carretera y a buena velocidad, le cae un caparazón
      const m = t.samples[t.nearest(k.x, k.y).i];
      k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
      k.angle = m.ang + 1.4; k.moveAngle = k.angle; k.speed = 300; k.invUntil = 0;
      if (!s.hitKart(k, null)) return 'el golpe no ha entrado';
      const antes = Math.abs(sim.wrapAngle(k.angle - m.ang));
      for (let f = 0; f < 60 * 2; f++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      const n = t.nearest(k.x, k.y);
      const desvio = Math.abs(sim.wrapAngle(k.angle - t.samples[n.i].ang));
      if (antes < 1) return 'la prueba no ha llegado a torcerlo';
      if (desvio > 0.6) return `tras el golpe sigue torcido ${(desvio * 180 / Math.PI).toFixed(0)}º respecto a la carretera`;
      return null;
    },
  },
  {
    // El salto tiene que ser un salto: al despegar del filo de una rampa se regala turbo
    // (RAMPA_TURBO), y con él se vuela lejos en vez de caer donde despegaste.
    nombre: 'saltar una rampa da turbo y hace volar de verdad',
    run(sim) {
      const medir = (conTurbo) => {
        const s = carrera(sim, { bots: 0, trackIndex: pista('Arcoíris') });
        const k = humano(s);
        const t = s.state.track;
        const rampa = t.ramps.reduce((a, b) => (b.height > a.height ? b : a));
        const i0 = ((rampa.start - 40) % t.N + t.N) % t.N;
        const sm = t.samples[i0];
        k.x = sm.x; k.y = sm.y; k.z = sm.h; k.ground = sm.h; k.vz = 0; k.air = false;
        k.angle = sm.ang; k.moveAngle = sm.ang; k.speed = 420; k.dist = i0; k.stuckT = 0;
        if (!conTurbo) k.lastRamp = rampa.start, k.lastRampAt = s.state.simTime;   // como si ya la hubiera cobrado
        // se mide el vuelo más largo de los 6 s: el kart da botecitos por el relieve y no vale
        // quedarse con el primero que salga
        let mejor = { vuelo: 0, alto: 0, alcance: 0 };
        let vuelo = 0, alto = 0, x0 = null;
        for (let f = 0; f < 60 * 6; f++) {
          s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
          s.update(DT);
          if (k.air) {
            if (x0 === null) { x0 = { x: k.x, y: k.y }; vuelo = 0; alto = 0; }
            vuelo += DT;
            alto = Math.max(alto, k.z - k.ground);
            const alcance = Math.hypot(k.x - x0.x, k.y - x0.y);
            if (vuelo > mejor.vuelo) mejor = { vuelo, alto, alcance };
          } else x0 = null;
        }
        return { ...mejor, turbos: s.stats.rampBoosts };
      };
      const con = medir(true), sin = medir(false);
      if (con.turbos !== 1) return `el turbo de salto no ha entrado (${con.turbos} veces)`;
      if (sin.turbos !== 0) return 'ha cobrado turbo dos veces en la misma rampa';
      if (con.vuelo < 0.8) return `vuela solo ${con.vuelo.toFixed(2)} s: el salto sigue siendo enano`;
      if (con.alto < 120) return `sube solo ${con.alto.toFixed(0)} px en el salto`;
      if (con.alcance < 350) return `salta solo ${con.alcance.toFixed(0)} px`;
      if (con.alcance < sin.alcance * 1.15) return `con turbo salta ${con.alcance.toFixed(0)} px y sin turbo ${sin.alcance.toFixed(0)}: no se nota`;
      return null;
    },
  },
  {
    // Arcoíris tiene cuestas: el circuito sube y baja de verdad, no es una mesa
    nombre: 'Arcoíris sube y baja (y sin pendientes imposibles)',
    run(sim) {
      const s = carrera(sim, { bots: 0, trackIndex: pista('Arcoíris') });
      const t = s.state.track;
      const enRampa = new Set();
      for (const r of t.ramps) for (let j = -2; j < 30; j++) enRampa.add(((r.start + j) % t.N + t.N) % t.N);
      let min = Infinity, max = -Infinity, peor = 0;
      for (let i = 0; i < t.N; i++) {
        min = Math.min(min, t.samples[i].h); max = Math.max(max, t.samples[i].h);
        if (enRampa.has(i) || enRampa.has((i + 1) % t.N)) continue;
        peor = Math.max(peor, Math.abs(t.samples[(i + 1) % t.N].h - t.samples[i].h) / 8);
      }
      if (max - min < 150) return `apenas hay desnivel (${(max - min).toFixed(0)} px de arriba abajo)`;
      if (peor > 0.45) return `hay una pendiente del ${(peor * 100).toFixed(0)} %: eso ya no es una cuesta, es un muro`;
      if (Math.abs(t.samples[0].h - t.samples[t.N - 1].h) > 12) return 'la meta no cierra: hay un escalón al dar la vuelta';
      return null;
    },
  },
  {
    // Si ni con el aviso te das la vuelta, te recogen: es la última red para no penar a contramano
    nombre: 'a quien corre al revés mucho rato lo recogen y lo ponen mirando bien',
    run(sim) {
      let recogido = false;
      const s = carrera(sim, { bots: 1, hooks: { onRescue: () => { recogido = true; } } });
      const k = humano(s);
      const t = s.state.track;
      const m = t.samples[t.nearest(k.x, k.y).i];
      k.x = m.x; k.y = m.y; k.z = m.h; k.ground = m.h; k.air = false; k.vz = 0;
      k.angle = m.ang + Math.PI; k.moveAngle = k.angle; k.speed = 300;
      const t0 = s.state.simTime;
      for (let f = 0; f < 60 * 12 && !recogido; f++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (!recogido) return 'sigue corriendo al revés y nadie lo recoge';
      const tardanza = s.state.simTime - t0;
      if (tardanza > 7) return `han tardado ${tardanza.toFixed(1)} s en recogerlo`;
      const n = t.nearest(k.x, k.y);
      if (Math.abs(sim.wrapAngle(k.angle - t.samples[n.i].ang)) > 0.2) return 'lo han dejado mirando al revés otra vez';
      return null;
    },
  },
  {
    // El cohete 🚀 es el premio del último: te dispara por el centro y atropella a quien pille
    nombre: 'el cohete dispara al que lo usa y atropella por el camino',
    run(sim) {
      const s = carrera(sim, { bots: 2, laps: 3 });
      const k = humano(s);
      const t = s.state.track;
      // al humano, al fondo de la parrilla y en marcha; delante, un bot en mitad de la carretera
      const i0 = Math.floor(0.10 * t.N), sm = t.samples[i0];
      k.x = sm.x; k.y = sm.y; k.z = sm.h; k.ground = sm.h; k.air = false; k.vz = 0;
      k.angle = sm.ang; k.moveAngle = sm.ang; k.speed = 300; k.dist = i0;
      const victima = s.state.karts.find((o) => o !== k);
      const sv = t.samples[(i0 + 90) % t.N];
      victima.x = sv.x; victima.y = sv.y; victima.z = sv.h; victima.ground = sv.h; victima.air = false;
      victima.angle = sv.ang; victima.moveAngle = sv.ang; victima.speed = 0; victima.dist = i0 + 90;
      victima.invUntil = 0;
      const d0 = k.dist, golpes0 = victima.hitsTaken;
      k.item = 'rocket';
      s.useItem(k);
      let masRapido = 0;
      for (let f = 0; f < 60 * 5; f++) {
        s.setInput(k, { s: 0, g: 0, b: 0, d: 0 });   // sin tocar nada: el cohete conduce
        s.update(DT);
        masRapido = Math.max(masRapido, Math.abs(k.speed));
        victima.speed = 0;
      }
      const avance = (k.dist - d0) * 8;
      if (masRapido < sim.BASE_MAX_SPEED * 1.8) return `el cohete solo llega a ${masRapido.toFixed(0)} de velocidad`;
      if (avance < 2500) return `con el cohete solo avanza ${avance.toFixed(0)}px en 5 s`;
      if (victima.hitsTaken === golpes0) return 'ha pasado por encima de otro kart y no le ha hecho nada';
      if (s.stats.rockets !== 1) return 'el cohete no se ha contado en las estadísticas';
      return null;
    },
  },
  {
    /*
     * El caparazón azul 🔵 va a por el primero **por el centro de la carretera**, y su camino es
     * fino: si el primero se abre, se libra. Se comprueban las dos cosas.
     */
    nombre: 'el caparazón azul va a por el primero, pero por un camino fino',
    run(sim) {
      const tiro = (apartarse) => {
        const s = carrera(sim, { bots: 1, laps: 3 });
        const t = s.state.track;
        const k = humano(s);                       // el que dispara, atrás
        const lider = s.state.karts.find((o) => o !== k);
        const i0 = Math.floor(0.10 * t.N);
        const colocar = (q, idx, lat) => {
          const sm = t.samples[idx % t.N];
          q.x = sm.x + sm.nx * lat; q.y = sm.y + sm.ny * lat;
          q.z = sm.h; q.ground = sm.h; q.air = false; q.vz = 0;
          q.angle = sm.ang; q.moveAngle = sm.ang; q.speed = 0; q.dist = idx; q.invUntil = 0;
        };
        colocar(k, i0, 0);
        colocar(lider, i0 + 120, apartarse ? t.halfW - 20 : 0);
        s.updateRanking();
        const golpes0 = lider.hitsTaken;
        k.item = 'blue';
        s.useItem(k);
        for (let f = 0; f < 60 * 4; f++) {
          s.setInput(k, { s: 0, g: 0, b: 0, d: 0 });
          s.update(DT);
          k.speed = 0;
          if (!apartarse) { lider.speed = 0; } else { lider.speed = 0; }
        }
        return lider.hitsTaken > golpes0;
      };
      if (!tiro(false)) return 'al primero, en mitad de la carretera, no le ha dado';
      if (tiro(true)) return 'le ha dado al primero aunque estaba pegado al quitamiedos: el camino no es fino';
      return null;
    },
  },
  {
    // La tinta 🦑 mancha a los demás, no a quien la usa. Y al primero le puede estallar sola.
    nombre: 'la tinta mancha a los demás y al primero le estalla en la cara',
    run(sim) {
      const s = carrera(sim, { bots: 2, laps: 3 });
      const k = humano(s);
      k.item = 'ink';
      s.useItem(k);
      if (k.inkUntil > s.state.simTime) return 'se ha manchado el que la usa';
      const otros = s.state.karts.filter((o) => o !== k);
      if (!otros.every((o) => o.inkUntil > s.state.simTime)) return 'no ha manchado a todos los demás';
      if (s.stats.inks !== 1) return 'la tinta no se ha contado';
      // y el calamarazo del líder: sale de la caja, no se lleva objeto y se queda ciego un rato
      const s2 = carrera(sim, { bots: 2, laps: 3, seed: 5 });
      const lider = humano(s2);
      lider.rank = 1;
      lider.rolling = { until: s2.state.simTime, result: 'inkSelf' };
      s2.update(DT);
      if (lider.item) return 'el calamarazo del primero le ha dado un objeto además de mancharle';
      if (!(lider.inkUntil > s2.state.simTime)) return 'al primero no le ha manchado su propio calamarazo';
      if (s2.stats.inkSelf !== 1) return 'el calamarazo del primero no se ha contado';
      return null;
    },
  },
  {
    // `nearest` va por una rejilla para que un circuito largo no se coma el frame: tiene que dar
    // exactamente lo mismo que mirar las muestras una a una
    nombre: 'la rejilla de la carretera encuentra lo mismo que buscar a lo bruto',
    run(sim) {
      for (let pista = 0; pista < trackDefs.length; pista++) {
        const s = carrera(sim, { bots: 0, trackIndex: pista });
        const t = s.state.track;
        const aLoBruto = (x, y) => {
          let bi = 0, bd = Infinity;
          for (let i = 0; i < t.N; i++) {
            const dx = t.samples[i].x - x, dy = t.samples[i].y - y;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; bi = i; }
          }
          return { i: bi, d: Math.sqrt(bd) };
        };
        const azar = mulberry32(4000 + pista);
        for (let k = 0; k < 400; k++) {
          const x = azar() * t.W, y = azar() * t.H;
          const a = t.nearest(x, y), b = aLoBruto(x, y);
          if (Math.abs(a.d - b.d) > 0.01) {
            return `en ${t.name}, en (${x.toFixed(0)},${y.toFixed(0)}) la rejilla dice ${a.d.toFixed(1)}px y lo bruto ${b.d.toFixed(1)}px`;
          }
        }
      }
      return null;
    },
  },
  {
    // Las tres habilidades de «Last Dance», que solo salen en ese circuito
    nombre: 'la liana engancha al de delante y te planta detrás de él',
    run(sim) {
      const s = carrera(sim, { bots: 1, trackIndex: pista('Last Dance'), laps: 1 });
      const k = humano(s);
      const t = s.state.track;
      const otro = s.state.karts.find((o) => o !== k);
      const colocar = (q, idx) => {
        const sm = t.samples[idx % t.N];
        q.x = sm.x; q.y = sm.y; q.z = sm.h; q.ground = sm.h; q.air = false; q.vz = 0;
        q.angle = sm.ang; q.moveAngle = sm.ang; q.speed = 0; q.dist = idx;
      };
      const i0 = Math.floor(0.05 * t.N);
      colocar(k, i0);
      colocar(otro, i0 + 120);          // ~960 px por delante, dentro del alcance
      s.updateRanking();
      k.item = 'liana';
      s.useItem(k);
      if (!k.liana) return 'la liana no ha enganchado a nadie';
      for (let f = 0; f < 60 * 2; f++) { s.setInput(k, { s: 0, g: 0, b: 0, d: 0 }); s.update(DT); otro.speed = 0; }
      const separacion = (otro.dist - k.dist) * 8;
      if (separacion > 220) return `la liana lo ha dejado a ${separacion.toFixed(0)}px del otro, no pegado a él`;
      if (s.stats.lianas !== 1) return 'la liana no se ha contado';
      // y si no hay nadie delante, al menos da un turbo (no se desperdicia)
      const s2 = carrera(sim, { bots: 0, trackIndex: pista('Last Dance'), laps: 1 });
      const solo = humano(s2);
      solo.item = 'liana';
      s2.useItem(solo);
      if (!(solo.boostUntil > s2.state.simTime)) return 'sin nadie delante, la liana no da ni el turbo de consolación';
      return null;
    },
  },
  {
    nombre: 'el terremoto manda por los aires a los demás, no a quien lo usa',
    run(sim) {
      const s = carrera(sim, { bots: 3, trackIndex: pista('Last Dance'), laps: 1 });
      const k = humano(s);
      for (const o of s.state.karts) { o.air = false; o.vz = 0; o.starUntil = 0; }
      const antes = s.state.karts.filter((o) => o !== k).map((o) => o.speed);
      k.item = 'terremoto';
      s.useItem(k);
      const otros = s.state.karts.filter((o) => o !== k);
      if (!otros.every((o) => o.air && o.vz > 100)) return 'no ha mandado a todos por los aires';
      if (k.air || k.vz > 0) return 'el terremoto ha levantado también a quien lo usa';
      if (!otros.every((o, i) => Math.abs(o.speed) < Math.abs(antes[i]) + 1)) return 'a los sacudidos no les ha frenado';
      if (s.stats.terremotos !== 1) return 'el terremoto no se ha contado';
      return null;
    },
  },
  {
    nombre: 'el portal te adelanta por la pista sin colarte una vuelta',
    run(sim) {
      const s = carrera(sim, { bots: 1, trackIndex: pista('Last Dance'), laps: 1 });
      const k = humano(s);
      const t = s.state.track;
      // a mitad de circuito: en la parrilla, a dos metros de la meta, el salto la cruzaría (y eso
      // está bien: el portal adelanta por la pista, no se salta el recorrido)
      const i0 = Math.floor(0.3 * t.N), sm = t.samples[i0];
      k.x = sm.x; k.y = sm.y; k.z = sm.h; k.ground = sm.h; k.air = false; k.vz = 0;
      k.angle = sm.ang; k.moveAngle = sm.ang; k.speed = 300; k.dist = i0;
      k.lapCount = Math.floor(k.dist / t.N);   // al colocarlo a mano hay que poner su vuelta al día
      const antes = k.dist, vueltas = k.lapCount;
      k.item = 'portal';
      s.useItem(k);
      const saltado = (k.dist - antes) * 8;
      if (Math.abs(saltado - sim.PORTAL_SALTO) > 200) return `el portal ha saltado ${saltado.toFixed(0)}px y tenía que saltar ${sim.PORTAL_SALTO}`;
      if (t.nearest(k.x, k.y).d > t.halfW) return 'el portal te deja fuera de la carretera';
      for (let f = 0; f < 60; f++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (k.lapCount !== vueltas) return 'el portal ha colado una vuelta';
      if (s.stats.portales !== 1) return 'el portal no se ha contado';
      return null;
    },
  },
  {
    nombre: 'las habilidades de la jungla solo salen en la jungla',
    run(sim) {
      const propias = ['liana', 'terremoto', 'portal'];
      // en Last Dance salen…
      const s = carrera(sim, { bots: 0, trackIndex: pista('Last Dance'), laps: 1 });
      const vistas = new Set();
      for (let i = 0; i < 20000; i++) vistas.add(s.rollItem(4, 7));
      if (!propias.every((id) => vistas.has(id))) return `en Last Dance no salen todas: ${propias.filter((id) => !vistas.has(id)).join(', ')}`;
      // …y en los demás, no
      for (const nombre of ['Arcoíris', 'Chicle']) {
        const s2 = carrera(sim, { bots: 0, trackIndex: pista(nombre) });
        for (let i = 0; i < 8000; i++) {
          const id = s2.rollItem(1 + (i % 7), 7);
          if (propias.includes(id)) return `en ${nombre} ha salido ${id}, que es de la jungla`;
        }
      }
      return null;
    },
  },
  {
    // Los dos caminos: la pared del medio no se puede atravesar
    nombre: 'la pared que parte la carretera en dos caminos no se puede cruzar',
    run(sim) {
      const s = carrera(sim, { bots: 0, trackIndex: pista('Last Dance'), laps: 1 });
      const k = humano(s);
      const t = s.state.track;
      if (!t.paredes.length) return 'este circuito no tiene paredes centrales';
      const w = t.paredes[0];
      // lejos de un cruce: ahí sí se puede cambiar de carril, y a propósito (ver el escenario de abajo)
      const cruce = (t.cruces || []).find((c) => t.inRange(c, w.from, w.to));
      const i0 = ((cruce != null ? cruce + 25 : w.from + 30) % t.N + t.N) % t.N;
      const sm = t.samples[i0];
      // entra de lado, apuntando al muro desde el carril de la derecha
      k.x = sm.x + sm.nx * 130; k.y = sm.y + sm.ny * 130;
      k.z = sm.h; k.ground = sm.h; k.air = false; k.vz = 0;
      k.angle = sm.ang - 1.2; k.moveAngle = k.angle; k.speed = 420; k.dist = i0;
      let cruzado = false;
      for (let f = 0; f < 60 * 2; f++) {
        s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
        s.update(DT);
        const n = t.nearest(k.x, k.y);
        if (t.inRange(n.i, w.from, w.to) && n.lat < -w.ancho / 2) { cruzado = true; break; }
      }
      return cruzado ? 'ha atravesado la pared y se ha pasado al otro camino' : null;
    },
  },
  {
    /*
     * Los cruces de carril: la rampa pegada al muro te tiene que dejar en el otro camino, y la
     * misma curva por fuera te tiene que dejar donde estabas. Si saltara siempre, cambiar de
     * carril dejaría de ser una decisión; si no saltara nunca, los dos caminos serían dos raíles.
     */
    nombre: 'la rampa del cruce salta al otro carril, y por fuera se pasa de largo',
    run(sim) {
      const salto = (lat0) => {
        const s = carrera(sim, { bots: 0, trackIndex: pista('Last Dance'), laps: 1 });
        const k = humano(s);
        const t = s.state.track;
        if (!(t.cruces || []).length) return { error: 'este circuito no tiene cruces de carril' };
        const ci = t.cruces[0];
        const i0 = (ci - 8 + t.N) % t.N;
        const sm = t.samples[i0];
        k.x = sm.x + sm.nx * lat0; k.y = sm.y + sm.ny * lat0;
        k.z = sm.h; k.ground = sm.h; k.air = false; k.vz = 0;
        k.angle = sm.ang; k.moveAngle = k.angle; k.speed = 430; k.dist = i0;
        let volado = false, lat = lat0;
        for (let f = 0; f < 75; f++) {
          s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
          s.update(DT);
          if (k.air) { volado = true; continue; }
          lat = t.nearest(k.x, k.y).lat;
          if (volado) break;                 // ya ha aterrizado: este es el carril en el que se queda
        }
        return { volado, lat };
      };
      const dentro = salto(110);             // pegado al muro: por ahí pasa la rampa
      if (dentro.error) return dentro.error;
      if (!dentro.volado) return 'pasando pegado al muro no ha saltado';
      if (dentro.lat > -20) return `ha saltado pero se ha quedado en su carril (lat ${dentro.lat.toFixed(0)})`;
      const fuera = salto(180);              // por fuera, casi rozando el quitamiedos
      if (fuera.volado) return 'pasando por fuera también le ha tirado por el aire';
      if (fuera.lat < 40) return `pasando por fuera le ha cambiado de carril (lat ${fuera.lat.toFixed(0)})`;
      return null;
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
    /*
     * Presupuesto de partículas (IDEAS.md, Fase 4 «Estelas y marcas»). La tele tiene **un solo saco
     * de 900 partículas** en un único dibujado: cuando se llena, las nuevas pisan a las viejas. Eso
     * hace imposible una fuga de memoria, pero no que una carrera pida tantas que las cosas se
     * borren antes de verse. Aquí se cuenta, con el mismo reloj de la simulación, cuántas estarían
     * vivas a la vez en una carrera llena de golpes: si algún día un efecto nuevo se dispara, esto
     * se pone rojo antes que los fps de la fiesta.
     */
    nombre: 'una carrera de 8 karts no pide más partículas de las que caben en la tele',
    run(sim) {
      const SACO = 900;                 // el tamaño del saco en screen.js (MAX en `particles`)
      const vivas = [];                 // cuándo muere cada una
      let pico = 0, total = 0;
      const s = sim.createSim({
        geom, trackDefs, random: mulberry32(61),
        hooks: {
          onParticles: (x, h, z, o) => {
            const n = (o && o.n) || 1, vida = (o && o.life) || 0.5;
            total += n;
            for (let i = 0; i < n; i++) vivas.push(s.now() + vida * 1.3);   // 1,3 = lo que alarga el azar
          },
        },
      });
      const entries = [];
      for (let i = 0; i < 8; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + (i + 1), char: i });
      s.startRace({ entries, trackIndex: pista('Volcán Disco'), laps: 1 });
      for (let f = 0; f < 60 * 90 && !s.allFinished(); f++) {
        s.update(DT);
        const ahora = s.now();
        for (let i = vivas.length - 1; i >= 0; i--) if (vivas[i] <= ahora) vivas.splice(i, 1);
        if (vivas.length > pico) pico = vivas.length;
      }
      if (!total) return 'no se ha emitido ni una partícula en toda la carrera';
      if (pico > SACO) return `hacen falta ${pico} partículas a la vez y en la tele solo caben ${SACO}`;
      return null;
    },
  },
  {
    /*
     * Calentamiento (IDEAS.md, Fase 3): mientras el anfitrión no pulsa EMPEZAR, quien ya está en la
     * sala puede conducir su kart en la parrilla para aprender los botones. Se conduce y se choca,
     * y nada más: ni vueltas, ni cajas, ni objetos, ni clasificación. Y al empezar la carrera, todo
     * el mundo vuelve a su sitio en la parrilla, que si no el que ha calentado saldría con ventaja.
     */
    nombre: 'en el calentamiento se conduce pero no se juega, y al empezar todos vuelven a la parrilla',
    run(sim) {
      const s = sim.createSim({ geom, trackDefs, random: mulberry32(51) });
      const dos = [{ playerId: 1, name: 'A', char: 0 }, { playerId: 2, name: 'B', char: 1 }];
      if (!s.warmup({ entries: dos, trackIndex: pista('Chicle') })) return 'no se puede empezar el calentamiento desde la sala';
      if (s.state.phase !== 'warmup') return `la fase es «${s.state.phase}» y no «warmup»`;
      if (s.state.karts.length !== 2) return `hay ${s.state.karts.length} karts y no 2`;
      const k = s.state.karts.find((q) => q.playerId === 1);
      const salida = { x: k.x, y: k.y, dist: k.dist };
      // 45 s dando gas: da más de una vuelta al circuito y no tiene que contarle nada
      for (let f = 0; f < 60 * 45; f++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (k.dist - salida.dist < 400) return `el kart no se mueve en el calentamiento (${(k.dist - salida.dist).toFixed(0)} muestras)`;
      if (k.lapCount >= 0) return `le han contado ${k.lapCount + 1} vuelta(s) calentando`;
      if (k.item) return `ha cogido un objeto (${k.item}) calentando`;
      if (k.finished) return 'ha «terminado» la carrera calentando';
      // entra alguien más: al que ya conducía no se le mueve de sitio
      const antes = { x: k.x, y: k.y };
      s.warmup({ entries: dos.concat([{ playerId: 3, name: 'C', char: 2 }]) });
      if (s.state.karts.length !== 3) return 'el que entra nuevo no aparece en el calentamiento';
      if (k.x !== antes.x || k.y !== antes.y) return 'al entrar alguien, a quien estaba conduciendo lo han teletransportado';
      // y al empezar la carrera, todos a la parrilla
      if (!s.startRace({ entries: dos, trackIndex: pista('Chicle'), laps: 2 })) return 'la carrera no arranca desde el calentamiento';
      if (s.state.phase !== 'countdown') return `tras EMPEZAR la fase es «${s.state.phase}»`;
      for (const q of s.state.karts) {
        if (q.dist !== q.gridDist || q.lapCount !== -1 || q.speed !== 0) return `${q.name} no ha vuelto a la parrilla`;
      }
      return null;
    },
  },
  {
    /*
     * Modo fácil (IDEAS.md, Fase 3): el kart acelera solo y el volante ayuda a no salirse. La
     * prueba es la que pide el punto, y es la buena: **sin tocar el mando** tiene que dar la vuelta
     * entera y llegar, porque para eso está —que quien nunca ha jugado no se quede de cara al
     * quitamiedos—, y tiene que llegar **por detrás** de un bot, para que nadie lo encienda
     * buscando ir más rápido.
     */
    nombre: 'un kart en modo fácil, sin que nadie toque el mando, termina la carrera por detrás del bot',
    run(sim) {
      for (const nombre of ['Chicle', 'Volcán Disco']) {
        const s = sim.createSim({ geom, trackDefs, random: mulberry32(41) });
        s.startRace({
          entries: [{ playerId: 1, name: 'Fácil', char: 0, easy: true }, { playerId: null, bot: true, name: 'Bot', char: 1 }],
          trackIndex: pista(nombre), laps: 1,
        });
        const k = s.state.karts.find((q) => q.playerId === 1), bot = s.state.karts.find((q) => q.isBot);
        let fuera = 0;
        for (let f = 0; f < 60 * 120 && !s.allFinished(); f++) {
          s.setInput(k, { s: 0, g: 0, b: 0, d: 0 });        // nadie toca nada
          s.setInput(bot, s.aiInput(bot));
          s.update(DT);
          if (k.offroad) fuera += DT;
        }
        if (!k.finished) return `${nombre}: no termina la vuelta solo (se queda en la ${k.lapCount})`;
        if (!bot.finished) return `${nombre}: el bot no termina, así que no hay con qué comparar`;
        if (k.finishTime <= bot.finishTime) return `${nombre}: el modo fácil llega antes que el bot (${k.finishTime.toFixed(1)} s contra ${bot.finishTime.toFixed(1)} s)`;
        if (fuera > 8) return `${nombre}: se pasa ${fuera.toFixed(1)} s fuera de la pista, no es tan fácil`;
      }
      return null;
    },
  },
  {
    /*
     * «Curvas largas para derrapar al nivel 3» (IDEAS.md). El nivel 3 pide **1,4 s girando hacia el
     * mismo lado sin soltar**, así que hace falta un curvón que dure eso a velocidad de carrera.
     *
     * Ojo con cómo se mide: los bots no valen para esto. Un bot sigue la línea corrigiendo sesenta
     * veces por segundo, y cada corrección cruza el centro del volante y le rompe el derrape; por
     * eso en una carrera de bots no sale **ni un** nivel 3, ni en los circuitos de ahora ni en los
     * de antes. Una persona no conduce así: mueve el volante despacio y lo **sostiene** dentro de
     * la curva. Eso es lo que imita el conductor de aquí abajo (el volante se mueve como mucho
     * 0,06 por fotograma), y con él el nivel 3 sale en los circuitos que tienen curvón.
     */
    nombre: 'una persona que sostiene el volante llega al nivel 3 de derrape en algún circuito',
    run(sim) {
      const medidas = [];
      for (const nombre of ['Playa Neón', 'Volcán Disco']) {
        const s = carrera(sim, { bots: 0, laps: 2, trackIndex: pista(nombre) });
        const k = humano(s);
        const t = s.state.track;
        let mejorT = 0, nivel = 0, val = 0;
        for (let f = 0; f < 60 * 80 && k.lapCount < 1; f++) {
          const near = t.nearestNear(k.x, k.y, ((k.dist % t.N) + t.N) % t.N, t.win);
          const obj = t.samples[(near.i + 22) % t.N];
          const diff = sim.wrapAngle(Math.atan2(obj.y - k.y, obj.x - k.x) - k.angle);
          val += Math.max(-0.06, Math.min(0.06, diff * 3.2 - val));
          s.setInput(k, { s: Math.max(-1, Math.min(1, val)), g: 1, b: 0, d: 0 });
          s.update(DT);
          if (k.driftT > mejorT) mejorT = k.driftT;
          if (k.driftLevel > nivel) nivel = k.driftLevel;
        }
        medidas.push({ nombre, nivel, mejorT });
      }
      const resumen = medidas.map((m) => `${m.nombre} ${m.mejorT.toFixed(2)} s (nivel ${m.nivel})`).join(', ');
      if (!medidas.some((m) => m.nivel >= 3)) return `nadie pasa del nivel 2: ${resumen}`;
      return null;
    },
  },
  {
    // el volante del móvil manda un decimal: girar a medias tiene que girar a medias
    nombre: 'la dirección es analógica: medio volante gira la mitad',
    run(sim) {
      const gira = (valor) => {
        const s = carrera(sim, { bots: 1, seed: 31 });
        const k = humano(s);
        for (let i = 0; i < 90; i++) { s.setInput(k, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }  // coge velocidad recta
        const a0 = k.angle;
        for (let i = 0; i < 30; i++) { s.setInput(k, { s: valor, g: 1, b: 0, d: 0 }); s.update(DT); }
        return Math.abs(sim.wrapAngle(k.angle - a0));
      };
      const todo = gira(1), medio = gira(0.5), nada = gira(0);
      if (nada > 0.01) return `sin tocar el volante ha girado ${nada.toFixed(3)} rad`;
      if (!(todo > 0.2)) return `a tope apenas gira (${todo.toFixed(3)} rad)`;
      const razon = medio / todo;
      if (razon < 0.4 || razon > 0.62) return `medio volante gira el ${(razon * 100).toFixed(0)} % en vez de la mitad`;
      // y un decimal descabellado no puede colarse
      const s2 = carrera(sim, { bots: 1, seed: 32 });
      const k2 = humano(s2);
      s2.setInput(k2, { s: 99, g: 1, b: 0, d: 0 });
      if (k2.input.s !== 1) return `un s = 99 se ha quedado en ${k2.input.s} (tendría que recortarse a 1)`;
      s2.setInput(k2, { s: NaN, g: 1, b: 0, d: 0 });
      return k2.input.s === 0 ? null : `un s = NaN se ha quedado en ${k2.input.s}`;
    },
  },
  {
    // con el volante no vale rozar el giro: hay que girar con ganas para cargar derrape
    nombre: 'un volantazo flojo no carga derrape y uno firme sí',
    run(sim) {
      const carga = (valor) => {
        const s = carrera(sim, { bots: 1, seed: 33 });
        const k = humano(s);
        let max = 0;
        for (let i = 0; i < 60 * 4; i++) {
          s.setInput(k, { s: valor, g: 1, b: 0, d: 0 });
          s.update(DT);
          max = Math.max(max, k.driftLevel);
        }
        return max;
      };
      const flojo = carga(sim.STEER_FIRME - 0.15), firme = carga(1);
      if (flojo > 0) return `girando flojo (${(sim.STEER_FIRME - 0.15).toFixed(2)}) ha cargado nivel ${flojo}`;
      return firme >= 1 ? null : 'girando a tope no ha llegado ni al nivel 1';
    },
  },
  {
    // Regresión de fase: en una carrera normal tienen que dispararse TODOS los sistemas a la vez
    // (saltos, paneles, cajas, objetos, golpes, derrape con turbo y rescate), no solo cada uno por
    // su lado en su escenario. Si algún número se queda a cero, es que algo se ha desconectado.
    nombre: 'en una carrera normal se disparan todos los sistemas a la vez',
    run(sim) {
      const s = sim.createSim({ geom, trackDefs, random: mulberry32(4242) });
      const entries = [{ playerId: 1, name: 'Persona', char: 0 }];
      for (let i = 1; i < 8; i++) entries.push({ playerId: null, bot: true, name: 'Bot ' + i, char: i });
      s.startRace({ entries, trackIndex: pista('Volcán Disco'), laps: 3 });
      const persona = s.state.karts.find((k) => !k.isBot);
      let sacadoEn = null;
      while (s.state.simTime < 210 && s.state.phase !== 'results') {
        // mientras está tirada en el césped no toca nada, como quien se queda mirando el móvil
        const quieta = sacadoEn !== null && s.state.simTime - sacadoEn < 3.5;
        if (!persona.finished) s.setInput(persona, quieta ? { s: 0, g: 0, b: 0, d: 0 } : s.aiInput(persona));
        // a los 12 s la sacamos al césped a propósito: tiene que venir el rescate
        if (sacadoEn === null && s.state.simTime > 12) {
          const t = s.state.track, m = t.samples[t.nearest(persona.x, persona.y).i];
          persona.x = m.x + m.nx * (t.halfW + 260); persona.y = m.y + m.ny * (t.halfW + 260);
          persona.speed = 0; sacadoEn = s.state.simTime;
        }
        s.update(DT);
      }
      const st = s.stats;
      const fallos = [];
      if (s.state.phase !== 'results') fallos.push('la carrera no llega a los resultados');
      if (!persona.finished) fallos.push('la persona no termina');
      if (st.jumps < 1) fallos.push('nadie salta');
      if (st.pads < 1) fallos.push('nadie pisa un panel');
      if (st.pickups < 5) fallos.push(`solo ${st.pickups} cajas cogidas`);
      if (st.itemsUsed < 5) fallos.push(`solo ${st.itemsUsed} objetos usados`);
      if (st.hits < 1) fallos.push('ningún golpe');
      if (st.rescues < 1) fallos.push('el rescate no ha recogido a nadie');
      if (st.driftBoosts.reduce((a, b) => a + b, 0) < 1) fallos.push('ningún turbo de derrape');
      if (!Object.keys(st.itemsByPos).length) fallos.push('no se apuntan los objetos por posición');
      return fallos.length ? fallos.join('; ') : null;
    },
  },
  {
    /*
     * Regla de oro pedida por el dueño: **una habilidad y nada más**. Nadie guarda dos ni encadena.
     * Se comprueba lo que de verdad importa: con algo en la mano, pasar por una caja no da nada
     * (y la caja se queda ahí para el siguiente); y mientras da vueltas la ruleta, tampoco.
     */
    nombre: 'solo se puede llevar una habilidad: con una en la mano, las cajas no dan nada',
    run(sim) {
      const s = carrera(sim, { bots: 1, seed: 41 });
      const k = humano(s);
      const encima = (caja) => { k.x = caja.x; k.y = caja.y; k.z = caja.h; k.ground = caja.h; k.air = false; };
      const cajas = s.state.track.boxes;

      // 1) con un objeto en la mano, la caja no se toca siquiera
      k.item = 'banana'; k.rolling = null;
      const caja = cajas[0];
      caja.respawnAt = 0;
      encima(caja);
      s.update(DT);
      if (k.rolling) return 'con un objeto en la mano ha cogido otro';
      if (k.item !== 'banana') return `le han cambiado el objeto por ${k.item}`;
      if (caja.respawnAt > s.state.simTime) return 'la caja ha desaparecido aunque no se la ha llevado nadie';

      // 2) con la ruleta girando, tampoco
      k.item = null; k.rolling = null;
      const caja2 = cajas[1]; caja2.respawnAt = 0;
      encima(caja2);
      s.update(DT);
      if (!k.rolling) return 'sin nada en la mano no ha cogido la caja';
      const salia = k.rolling.result;
      const caja3 = cajas[2]; caja3.respawnAt = 0;
      encima(caja3);
      s.update(DT);
      if (k.rolling.result !== salia) return 'la ruleta ha cambiado de objeto al pasar por otra caja';
      if (caja3.respawnAt > s.state.simTime) return 'se ha llevado una segunda caja con la ruleta girando';

      // 3) y al usar lo que lleva, se queda con las manos vacías y ya puede coger otra
      for (let i = 0; i < 120 && k.rolling; i++) s.update(DT);
      if (!k.item) return 'la ruleta no ha acabado dando un objeto';
      s.useItem(k);
      if (s.state.eligiendo) s.elegirVictima(null);     // por si le tocó el caracol
      if (k.item) return `después de usarlo sigue llevando ${k.item}`;
      const caja4 = cajas[3]; caja4.respawnAt = 0;
      encima(caja4);
      s.update(DT);
      return k.rolling ? null : 'con las manos vacías ya no coge cajas';
    },
  },
  {
    nombre: 'el caracol para la carrera hasta que se elige víctima',
    run(sim) {
      let avisado = null;
      const s = carrera(sim, { bots: 3, hooks: { onChoosing: (k, c) => { avisado = { k, c }; } } });
      const k = humano(s);
      k.item = 'snail';
      s.useItem(k);
      if (!s.state.eligiendo) return 'no ha parado la carrera para elegir';
      if (!avisado || avisado.k !== k) return 'no ha avisado de quién elige';
      if (avisado.c.length !== 3 || avisado.c.includes(k)) return `las opciones no son los tres rivales (${avisado.c.length})`;
      // con la carrera parada no corre ni el reloj ni nadie se mueve
      const t0 = s.state.raceTime, sim0 = s.state.simTime;
      const pos = s.state.karts.map((q) => [q.x, q.y]);
      for (let i = 0; i < 60; i++) { for (const q of s.state.karts) s.setInput(q, { s: 0, g: 1, b: 0, d: 0 }); s.update(DT); }
      if (Math.abs(s.state.raceTime - t0) > 1e-9) return 'el tiempo de carrera ha seguido corriendo';
      if (Math.abs(s.state.simTime - sim0) > 1e-9) return 'el reloj de la simulación ha seguido corriendo';
      if (s.state.karts.some((q, i) => Math.abs(q.x - pos[i][0]) > 1e-9 || Math.abs(q.y - pos[i][1]) > 1e-9)) return 'alguien se ha movido con el juego parado';
      return null;
    },
  },
  {
    // Se mide el **camino recorrido**, no la velocidad de un instante: con otros karts alrededor,
    // al frenado le dan empujones por detrás y la velocidad da saltos. Lo que importa es que en
    // esos segundos avance mucho menos, y que luego vuelva a ser el de antes.
    nombre: 'a quien le cae el caracol avanza mucho menos durante 3 s, y luego se recupera',
    run(sim) {
      let elegido = null;
      const s = carrera(sim, { bots: 1, hooks: { onChosen: (q, v) => { elegido = v; } } });
      const k = humano(s);
      const victima = s.state.karts.find((q) => q !== k);
      const recorrido = (kart, segundos) => {
        let d = 0;
        for (let i = 0; i < Math.round(segundos * 60); i++) {
          const x = kart.x, y = kart.y;
          s.setInput(k, { s: 0, g: 1, b: 0, d: 0 });
          s.update(DT);
          d += Math.hypot(kart.x - x, kart.y - y);
        }
        return d;
      };
      recorrido(victima, 2);                          // que coja velocidad de crucero
      const antes = recorrido(victima, 3);
      k.item = 'snail';
      s.useItem(k);
      if (!s.elegirVictima(victima.id)) return 'no ha aceptado la elección';
      if (s.state.eligiendo) return 'la carrera sigue parada después de elegir';
      if (elegido !== victima) return 'el hook no dice a quién le ha caído';
      // apartamos a quien lo lanzó, para que no lo empuje y falsee la medida
      k.x = 40; k.y = 40; k.speed = 0;
      const frenado = recorrido(victima, sim.SNAIL_TIME);
      const despues = recorrido(victima, 3);
      if (frenado > antes * 0.55) return `apenas ha frenado: ${frenado.toFixed(0)} px en vez de mucho menos de ${antes.toFixed(0)}`;
      if (despues < antes * 0.7) return `no se recupera al acabar (${despues.toFixed(0)} px frente a ${antes.toFixed(0)})`;
      return null;
    },
  },
  {
    nombre: 'si nadie elige, el caracol se lo lleva solo el de delante y la carrera sigue',
    run(sim) {
      const s = carrera(sim, { bots: 3 });
      const k = humano(s);
      // lo ponemos tercero para que haya alguien delante de quien fiarse
      s.updateRanking();
      k.item = 'snail';
      s.useItem(k);
      if (!s.state.eligiendo) return 'no ha parado a elegir';
      const delante = s.state.karts.filter((q) => q !== k && q.rank < k.rank).sort((a, b) => b.rank - a.rank)[0];
      for (let i = 0; i < 60 * (sim.SNAIL_CHOICE_TIME + 1); i++) s.update(DT);
      if (s.state.eligiendo) return 'la carrera se ha quedado parada para siempre';
      const frenado = s.state.karts.filter((q) => q.slowUntil > 0);
      if (frenado.length !== 1) return `tendría que haber frenado a uno y ha frenado a ${frenado.length}`;
      if (delante && frenado[0] !== delante) return `ha frenado a ${frenado[0].name} en vez de al de delante (${delante.name})`;
      return null;
    },
  },
  {
    nombre: 'el caparazón verde ya no existe y el caracol es raro',
    run(sim) {
      if (sim.ITEMS.green) return 'el caparazón verde sigue en la lista';
      if (!sim.ITEMS.snail) return 'falta el caracol';
      /*
       * El que va primero no puede sacar caracol, y al resto le sale poco. Se mide sobre el propio
       * reparto (`rollItem`) y no pasando por cajas: al pasar por una caja el ranking lo recalcula
       * la simulación en ese mismo instante, así que no se puede forzar «ahora vas primero» y fiarse
       * del resultado — antes esta prueba se sostenía de milagro.
       */
      const s = carrera(sim, { bots: 2 });
      for (let i = 0; i < 4000; i++) if (s.rollItem(1, 7) === 'snail') return 'al que va primero le ha salido el caracol';
      let caracoles = 0, total = 0;
      for (let rank = 2; rank <= 7; rank++) {
        for (let i = 0; i < 3000; i++) { total++; if (s.rollItem(rank, 7) === 'snail') caracoles++; }
      }
      const parte = caracoles / total;
      return parte > 0.02 && parte < 0.14 ? null : `sale el ${(parte * 100).toFixed(1)} % de las veces (se busca entre el 2 y el 14 %)`;
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
