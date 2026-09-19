'use strict';
/*
 * `npm run race` — carreras por consola, los ojos del agente (y del dueño) sobre el juego.
 *
 * Corre la simulación de public/sim.mjs sin navegador y cuenta lo que ha pasado: quién ha ganado,
 * mejor vuelta, objetos usados, golpes dados y recibidos, tiempo fuera de la pista y por el aire.
 * Sirve para equilibrar objetos, derrape y circuitos con datos en vez de imaginarse la carrera.
 *
 *   npm run race                                  una carrera en el primer circuito
 *   npm run race -- --track all --runs 3          los cuatro circuitos, tres carreras cada uno
 *   npm run race -- --track 2 --laps 5 --verbose  registro de todo lo que pasa, con tiempos
 *   npm run race -- --stats items                 reparto de objetos (también drift y speed)
 *   npm run race -- --track all --runs 3 --json   lo mismo en JSON, para comparar entre cambios
 */
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const geom = require(path.join(ROOT, 'public/geom.js'));
const trackDefs = require(path.join(ROOT, 'public/tracks.js'));
const DT = 1 / 60;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cuántos karts caben: lo dice `MAX_KARTS` en public/sim.mjs. Aquí se lee del archivo porque esto
// es CommonJS y sim.mjs es un módulo ES, que solo se puede importar (más abajo) desde una función
// async — y el tope hace falta ya, para los argumentos y para el texto de ayuda.
const MAX_BOTS = (() => {
  const fuente = require('fs').readFileSync(path.join(ROOT, 'public/sim.mjs'), 'utf8');
  const m = fuente.match(/export const MAX_KARTS = (\d+)/);
  return m ? parseInt(m[1], 10) : 8;
})();

// ---------------------------------------------------------------- argumentos
function parseArgs(argv) {
  const o = { track: '0', laps: 3, bots: MAX_BOTS, seed: 1000, runs: 1, verbose: false, stats: null, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--track') o.track = val();
    else if (a === '--laps') o.laps = parseInt(val(), 10);
    else if (a === '--bots') o.bots = parseInt(val(), 10);
    else if (a === '--seed') o.seed = parseInt(val(), 10);
    else if (a === '--runs') o.runs = parseInt(val(), 10);
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--stats') o.stats = val();
    else if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else { console.error('No entiendo la opción ' + a); process.exit(2); }
  }
  if (!Number.isInteger(o.laps) || o.laps < 1 || o.laps > 9) { console.error('--laps tiene que ir de 1 a 9'); process.exit(2); }
  if (!Number.isInteger(o.bots) || o.bots < 2 || o.bots > MAX_BOTS) { console.error(`--bots tiene que ir de 2 a ${MAX_BOTS}`); process.exit(2); }
  if (!Number.isInteger(o.runs) || o.runs < 1) { console.error('--runs tiene que ser 1 o más'); process.exit(2); }
  if (o.stats && !['items', 'drift', 'speed'].includes(o.stats)) { console.error('--stats: items, drift o speed'); process.exit(2); }
  return o;
}

const AYUDA = `Carreras de prueba de Kart Party (sin navegador).

  --track n|all   circuito (0..${trackDefs.length - 1}) o todos                (por defecto 0)
  --laps n        vueltas (1..9)                                  (por defecto 3)
  --bots n        karts en la parrilla (2..${MAX_BOTS})                    (por defecto ${MAX_BOTS})
  --seed n        semilla: la misma da siempre la misma carrera   (por defecto 1000)
  --runs k        cuántas carreras por circuito                   (por defecto 1)
  --verbose       registro de todo lo que pasa, con tiempo y posición
  --stats X       histograma: items | drift | speed
  --json          salida en JSON (para comparar entre cambios)
  --quiet         sin salida (solo el código de salida; lo usa npm test)`;

// ---------------------------------------------------------------- una carrera
function correr(sim, { trackIndex, laps, bots, seed, verbose }) {
  const eventos = [];
  const datos = new Map();   // kart -> estadísticas
  let s = null;

  const registra = (k, texto) => {
    if (!verbose || !k) return;
    eventos.push({ t: s ? s.state.raceTime : 0, pos: k.rank, kart: k.name, texto });
  };

  const hooks = {
    onSfx: (nombre, k) => {
      if (!k) return;
      if (nombre === 'jump') { datos.get(k).jumps++; registra(k, 'salta'); }
      else if (nombre === 'trick') { datos.get(k).tricks++; registra(k, 'hace un truco'); }
      else if (nombre === 'pad') { datos.get(k).pads++; registra(k, 'pisa un panel turbo'); }
      else if (nombre === 'pickup') registra(k, 'coge una caja');
      else if (nombre === 'boing') registra(k, 'rebota en un bumper');
    },
    onHit: (k, causa) => {
      const d = datos.get(k);
      d.hitsTaken++;
      const autor = causa && s.state.karts.find((q) => q.id === causa.id);
      if (autor && autor !== k) datos.get(autor).hitsGiven++;
      registra(k, `recibe un golpe${causa ? ' (' + causa.tipo + (autor ? ' de ' + autor.name : '') + ')' : ''}`);
    },
  };

  s = sim.createSim({ geom, trackDefs, random: mulberry32(seed), hooks });
  const entries = [];
  for (let i = 0; i < bots; i++) entries.push({ playerId: null, bot: true, name: sim.CHARS[i].name, char: i });
  s.startRace({ entries, trackIndex, laps });
  for (const k of s.state.karts) {
    datos.set(k, {
      kart: k, jumps: 0, tricks: 0, pads: 0, hitsTaken: 0, hitsGiven: 0, itemsUsed: 0,
      offroad: 0, air: 0, items: {}, drifts: [], velocidades: [], vueltas: [], ultimaVuelta: 0,
    });
  }

  const tope = 60 * laps + 60;
  let previo = s.state.karts.map((k) => ({ item: k.item, lap: k.lapCount, drift: k.driftT, fin: k.finished }));
  while (s.state.simTime < tope && !s.allFinished() && s.state.phase !== 'results') {
    s.update(DT);
    s.state.karts.forEach((k, i) => {
      const d = datos.get(k);
      if (k.offroad) d.offroad += DT;
      if (k.air) d.air += DT;
      d.velocidades.push(Math.abs(k.speed));
      // objeto: aparece al salir la ruleta y desaparece al usarlo
      if (k.item && k.item !== previo[i].item) d.items[k.item] = (d.items[k.item] || 0) + 1;
      if (!k.item && previo[i].item && !k.finished) { d.itemsUsed++; registra(k, `usa ${sim.ITEMS[previo[i].item].name.toLowerCase()}`); }
      // derrape: se cuenta cuando se suelta
      if (previo[i].drift > 0 && k.driftT === 0) d.drifts.push(previo[i].drift);
      // (quien ya ha terminado sigue rodando por la pista: esas vueltas de propina no cuentan)
      if (k.lapCount > previo[i].lap && k.lapCount > 0 && !previo[i].fin) {
        const t = k.finished ? k.finishTime : s.state.raceTime;
        const vuelta = t - d.ultimaVuelta;
        d.vueltas.push(vuelta);
        d.ultimaVuelta = t;
        registra(k, k.finished ? `¡meta! ${t.toFixed(2)} s (última vuelta ${vuelta.toFixed(2)} s)` : `cierra la vuelta ${k.lapCount} en ${vuelta.toFixed(2)} s`);
      }
      previo[i] = { item: k.item, lap: k.lapCount, drift: k.driftT, fin: k.finished };
    });
  }

  const karts = s.state.karts.slice().sort((a, b) => a.rank - b.rank).map((k) => {
    const d = datos.get(k);
    const mejor = d.vueltas.length ? Math.min(...d.vueltas) : 0;
    return {
      pos: k.rank, nombre: k.name, terminado: k.finished, tiempo: +k.finishTime.toFixed(2),
      mejorVuelta: +mejor.toFixed(2), vueltas: d.vueltas.map((v) => +v.toFixed(2)),
      objetosUsados: d.itemsUsed, objetos: d.items,
      golpesDados: d.hitsGiven, golpesRecibidos: d.hitsTaken,
      saltos: d.jumps, trucos: d.tricks, paneles: d.pads,
      fueraDePista: +d.offroad.toFixed(1), enElAire: +d.air.toFixed(1),
      derrapes: d.drifts.map((v) => +v.toFixed(2)),
      velocidadMedia: +(d.velocidades.reduce((a, b) => a + b, 0) / Math.max(1, d.velocidades.length)).toFixed(0),
      velocidades: d.velocidades,
    };
  });

  return {
    circuito: trackDefs[trackIndex].name, trackIndex, vueltas: laps, semilla: seed, bots,
    duracion: +s.state.raceTime.toFixed(2), karts, eventos,
  };
}

// ---------------------------------------------------------------- salida por consola
function tabla(r) {
  const filas = [['Pos', 'Kart', 'Tiempo', 'Mejor', 'Obj', 'G+', 'G-', 'Saltos', 'Trucos', 'Paneles', 'Fuera', 'Aire', 'Vel']];
  for (const k of r.karts) {
    filas.push([
      k.pos + 'º', k.nombre, k.terminado ? k.tiempo.toFixed(2) + 's' : '—', k.mejorVuelta ? k.mejorVuelta.toFixed(2) + 's' : '—',
      String(k.objetosUsados), String(k.golpesDados), String(k.golpesRecibidos), String(k.saltos), String(k.trucos),
      String(k.paneles), k.fueraDePista.toFixed(1) + 's', k.enElAire.toFixed(1) + 's', String(k.velocidadMedia),
    ]);
  }
  const anchos = filas[0].map((_, i) => Math.max(...filas.map((f) => f[i].length)));
  console.log(`\n${r.circuito} · ${r.vueltas} vueltas · ${r.bots} karts · semilla ${r.semilla} · ${r.duracion.toFixed(1)} s`);
  filas.forEach((f, i) => {
    console.log('  ' + f.map((c, j) => (j === 1 ? c.padEnd(anchos[j]) : c.padStart(anchos[j]))).join('  '));
    if (i === 0) console.log('  ' + anchos.map((a) => '─'.repeat(a)).join('  '));
  });
}

function histograma(titulo, pares) {
  const max = Math.max(1, ...pares.map(([, v]) => v));
  console.log('\n' + titulo);
  for (const [nombre, v] of pares) {
    console.log('  ' + String(nombre).padEnd(34) + String(v).padStart(6) + '  ' + '█'.repeat(Math.round((v / max) * 40)));
  }
}

function pintaStats(tipo, runs, sim) {
  const todos = runs.flatMap((r) => r.karts);
  if (tipo === 'items') {
    const cuenta = {};
    for (const id of Object.keys(sim.ITEMS)) cuenta[id] = 0;
    for (const k of todos) for (const [id, n] of Object.entries(k.objetos)) cuenta[id] += n;
    histograma('Objetos que han tocado (todas las carreras)', Object.entries(cuenta).map(([id, n]) => [sim.ITEMS[id].name, n]));
    const porPos = {};
    for (const r of runs) for (const k of r.karts) porPos[k.pos] = (porPos[k.pos] || 0) + k.objetosUsados;
    histograma('Objetos usados según la posición final', Object.entries(porPos).map(([p, n]) => [p + 'º', n]));
  } else if (tipo === 'drift') {
    // los cortes son los niveles del derrape automático, para ver de un vistazo cuánto turbo se carga
    const L1 = sim.DRIFT_L1, L2 = sim.DRIFT_L2, L3 = sim.DRIFT_L3;
    const n = (v) => v.toFixed(2).replace('.', ',');
    const cubos = [0, 0, 0, 0];
    let total = 0;
    for (const k of todos) for (const d of k.derrapes) {
      total++;
      cubos[d < L1 ? 0 : d < L2 ? 1 : d < L3 ? 2 : 3]++;
    }
    histograma(`Derrapes por duración (${total} en total)`, [
      [`sin nivel (< ${n(L1)} s)`, cubos[0]],
      [`nivel 1 (${n(L1)}-${n(L2)} s, turbo ${n(sim.DRIFT_BOOST[0])} s)`, cubos[1]],
      [`nivel 2 (${n(L2)}-${n(L3)} s, turbo ${n(sim.DRIFT_BOOST[1])} s)`, cubos[2]],
      [`nivel 3 (> ${n(L3)} s, turbo ${n(sim.DRIFT_BOOST[2])} s)`, cubos[3]],
    ]);
  } else if (tipo === 'speed') {
    const cubos = new Array(8).fill(0);
    for (const k of todos) for (const v of k.velocidades) cubos[Math.min(7, Math.floor(v / 100))]++;
    histograma('Reparto de velocidades (muestras por tick)', cubos.map((n, i) => [`${i * 100}-${i * 100 + 99}`, n]));
  }
}

// ---------------------------------------------------------------- principal
async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { console.log(AYUDA); return; }
  const sim = await import(pathToFileURL(path.join(ROOT, 'public/sim.mjs')).href);

  const indices = o.track === 'all'
    ? trackDefs.map((_, i) => i)
    : [parseInt(o.track, 10)];
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= trackDefs.length)) {
    console.error(`--track tiene que ser un número de 0 a ${trackDefs.length - 1}, o "all"`);
    process.exit(2);
  }

  const runs = [];
  for (const trackIndex of indices) {
    for (let r = 0; r < o.runs; r++) {
      runs.push(correr(sim, { trackIndex, laps: o.laps, bots: o.bots, seed: o.seed + r, verbose: o.verbose }));
    }
  }

  if (o.quiet) return;
  if (o.json) {
    // las velocidades tick a tick son demasiado para el JSON: solo la media
    const limpio = runs.map((r) => ({ ...r, karts: r.karts.map(({ velocidades, ...k }) => k) }));
    console.log(JSON.stringify({ generado: new Date().toISOString(), carreras: limpio }, null, 2));
    return;
  }

  for (const r of runs) {
    if (o.verbose) {
      console.log(`\n▸ ${r.circuito} · semilla ${r.semilla}`);
      for (const e of r.eventos) console.log(`   ${e.t.toFixed(2).padStart(7)}s  ${(e.pos + 'º').padStart(3)}  ${e.kart.padEnd(10)} ${e.texto}`);
    }
    tabla(r);
  }
  if (o.stats) pintaStats(o.stats, runs, sim);

  if (runs.length > 1) {
    console.log('\nResumen');
    const porCircuito = new Map();
    for (const r of runs) {
      const lista = porCircuito.get(r.circuito) || [];
      lista.push(r);
      porCircuito.set(r.circuito, lista);
    }
    for (const [nombre, lista] of porCircuito) {
      const mejores = lista.flatMap((r) => r.karts.filter((k) => k.mejorVuelta).map((k) => k.mejorVuelta));
      const media = mejores.reduce((a, b) => a + b, 0) / Math.max(1, mejores.length);
      const ganadores = lista.map((r) => r.karts[0].nombre).join(', ');
      console.log(`  ${nombre.padEnd(14)} vuelta media ${media.toFixed(2)} s · mejor ${Math.min(...mejores).toFixed(2)} s · ganan: ${ganadores}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
