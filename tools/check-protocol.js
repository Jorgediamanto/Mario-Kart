'use strict';
/*
 * Fase 5 de `npm test`: «Móviles de mentira».
 *
 * Arranca el servidor de verdad en un puerto libre y conecta por WebSocket una pantalla falsa y
 * ocho móviles falsos. Recorre todo el protocolo de la fiesta (entrar, sala llena, personaje
 * repetido, ajustes, empezar, botones, objetos, relevo de anfitrión, reconexión y salir) y
 * comprueba que el servidor hace lo que tiene que hacer y no se cae por el camino.
 *
 * En la fiesta lo que falla son los móviles y la red: esto es lo más parecido a ocho personas
 * pulsando botones a la vez que se puede correr en un segundo.
 */
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');
let failed = false;
const ok = (msg) => console.log('  ✓ ' + msg);
const bad = (msg) => { failed = true; console.log('  ✗ ' + msg); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- cliente de mentira
function cliente(puerto, nombre) {
  const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
  ws.recibidos = [];
  ws.apodo = nombre;
  ws.on('message', (raw) => {
    try { ws.recibidos.push(JSON.parse(raw.toString())); } catch (_) { /* ignore */ }
  });
  ws.abierto = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.manda = (o) => ws.send(JSON.stringify(o));
  // espera un mensaje que cumpla `pred` (mira también los ya recibidos)
  ws.espera = (pred, ms = 2000) => new Promise((res) => {
    const fn = typeof pred === 'string' ? (m) => m.t === pred : pred;
    const ya = ws.recibidos.find(fn);
    if (ya) return res(ya);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const m = ws.recibidos.find(fn);
      if (m) { clearInterval(iv); res(m); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); res(null); }
    }, 10);
  });
  ws.olvida = () => { ws.recibidos.length = 0; };
  return ws;
}

async function main() {
  const PORT = 3000 + 900 + Math.floor(Math.random() * 90);
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let salida = '';
  let excepciones = '';
  server.stdout.on('data', (d) => { salida += d; });
  server.stderr.on('data', (d) => { salida += d; excepciones += d; });

  const fin = (codigo) => { server.kill(); process.exit(codigo); };
  // esperamos a que el servidor conteste
  const limite = Date.now() + 8000;
  let arriba = false;
  while (Date.now() < limite && !arriba) {
    try { arriba = (await fetch(`http://127.0.0.1:${PORT}/info`)).ok; } catch (_) { await espera(150); }
  }
  if (!arriba) { bad('el servidor no arranca\n' + salida); fin(1); return; }

  try {
    await recorrido(PORT);
  } catch (e) {
    bad('excepción en la prueba: ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e));
  }

  await espera(150);
  check(!excepciones.trim(), `el servidor no suelta ningún error${excepciones ? '\n' + excepciones : ''}`);
  console.log(failed ? '\nHAY FALLOS' : '\nProtocolo correcto');
  fin(failed ? 1 : 0);
}

// ---------------------------------------------------------------- el recorrido de la fiesta
async function recorrido(PORT) {
  // ---- la pantalla se presenta ----
  const tele = cliente(PORT, 'tele');
  await tele.abierto;
  const roster = await tele.espera('roster');
  check(roster && Array.isArray(roster.taken), 'al conectar, el servidor manda `roster` con los personajes cogidos');
  tele.manda({ t: 'screen', tracks: ['Chicle', 'Playa Neón', 'Volcán Disco', 'Luna Loca'] });
  const init = await tele.espera('init');
  check(init && Array.isArray(init.players) && init.settings, 'la pantalla recibe `init` con la sala y los ajustes');

  // ---- entran ocho móviles ----
  const moviles = [];
  for (let i = 0; i < 8; i++) {
    const m = cliente(PORT, 'movil' + i);
    await m.abierto;
    m.manda({ t: 'hello', name: 'Jugador ' + i, char: i });
    const w = await m.espera('welcome');
    if (!w) { bad(`el móvil ${i} no recibe \`welcome\``); return; }
    m.id = w.id; m.token = w.token;
    moviles.push(m);
  }
  check(moviles.every((m) => Number.isInteger(m.id) && typeof m.token === 'string' && m.token.length > 0),
    'los 8 móviles reciben `welcome` con su id y su token');
  const lobby = await moviles[7].espera('lobby');
  check(lobby && lobby.players.length === 8 && lobby.screen === true,
    'la sala (`lobby`) llega a los móviles con los 8 jugadores y la pantalla puesta');
  const joins = tele.recibidos.filter((m) => m.t === 'join');
  check(joins.length === 8, `la pantalla recibe un \`join\` por jugador (${joins.length} de 8)`);
  check(moviles[0].id === lobby.hostId, 'el primero en entrar es el anfitrión');

  // ---- la sala está llena: el noveno se queda fuera ----
  {
    const nueve = cliente(PORT, 'noveno');
    await nueve.abierto;
    nueve.manda({ t: 'hello', name: 'Tarde', char: 3 });
    const err = await nueve.espera('err');
    check(err && /llena/i.test(err.msg), 'el 9.º móvil recibe `err` porque la sala está llena');
    nueve.close();
  }

  // ---- personaje repetido ----
  {
    const repe = cliente(PORT, 'repe');
    await repe.abierto;
    // hacemos sitio: sale uno y entra otro pidiendo un personaje que sí está cogido
    moviles[7].manda({ t: 'leave' });
    await espera(120);
    repe.manda({ t: 'hello', name: 'Copión', char: 0 });
    const err = await repe.espera('err');
    check(err && /cogido/i.test(err.msg), 'pedir un personaje ya cogido devuelve `err`');
    // y con uno libre, entra sin problema
    repe.olvida();
    repe.manda({ t: 'hello', name: 'Copión', char: 7 });
    const w = await repe.espera('welcome');
    check(w && w.char === 7, 'con un personaje libre, entra sin problema');
    moviles[7] = repe; repe.id = w && w.id; repe.token = w && w.token;
  }

  // ---- los ajustes solo los toca el anfitrión ----
  {
    tele.olvida();
    moviles[3].manda({ t: 'set', settings: { track: 2, laps: 5, bots: 0 } });
    await espera(150);
    const cambio = tele.recibidos.find((m) => m.t === 'set');
    check(!cambio, 'un jugador que no es anfitrión no puede cambiar los ajustes');
    moviles[0].manda({ t: 'set', settings: { track: 2, laps: 5, bots: 0 } });
    const set = await tele.espera('set');
    check(set && set.settings.track === 2 && set.settings.laps === 5 && set.settings.bots === 0,
      'el anfitrión sí cambia circuito, vueltas y bots');
  }

  // ---- un móvil no puede hacerse pasar por pantalla ----
  {
    tele.olvida();
    moviles[2].manda({ t: 'screen', tracks: ['Pirata'] });
    moviles[2].manda({ t: 'phase', phase: 'race' });
    moviles[2].manda({ t: 'to', id: moviles[0].id, m: { t: 'fx', kind: 'hit' } });
    await espera(200);
    const robada = tele.recibidos.find((m) => m.t === 'replaced');
    const colada = moviles[0].recibidos.find((m) => m.t === 'fx');
    check(!robada && !colada, 'un móvil no puede hacerse pasar por la pantalla ni mandar mensajes de pantalla');
  }

  // ---- empezar la carrera ----
  {
    tele.olvida();
    moviles[3].manda({ t: 'start' });
    await espera(150);
    check(!tele.recibidos.find((m) => m.t === 'start'), 'solo el anfitrión puede empezar la carrera');
    moviles[0].manda({ t: 'start' });
    const start = await tele.espera('start');
    check(!!start, 'el anfitrión manda `start` y llega a la pantalla');
    tele.manda({ t: 'phase', phase: 'race' });
    const fase = await moviles[4].espera((m) => m.t === 'phase' && m.phase === 'race');
    check(!!fase, 'la pantalla cambia la fase y todos los móviles se enteran');
  }

  // ---- botones: 10 pulsaciones por segundo durante 3 s ----
  {
    tele.olvida();
    const quien = moviles[5];
    const total = 30;
    for (let n = 0; n < total; n++) {
      quien.manda({ t: 'i', s: n % 2 ? 1 : -1, g: 1, b: 0, d: 0 });
      await espera(100);
    }
    await espera(150);
    const entradas = tele.recibidos.filter((m) => m.t === 'i');
    const suyas = entradas.filter((m) => m.id === quien.id);
    const bienFormadas = suyas.every((m) => (m.s === 1 || m.s === -1) && m.g === 1 && m.b === 0 && m.d === 0);
    check(suyas.length === total && suyas.length === entradas.length && bienFormadas,
      `los ${total} botones llegan a la pantalla con el id correcto (${suyas.length} de ${total})`);
    // y el objeto
    tele.olvida();
    quien.manda({ t: 'use' });
    const uso = await tele.espera('use');
    check(uso && uso.id === quien.id, '`use` llega a la pantalla con el id de quien lo pulsa');
  }

  // ---- la pantalla habla con un móvil concreto ----
  {
    moviles[6].olvida();
    tele.manda({ t: 'to', id: moviles[6].id, m: { t: 'st', pos: 3, n: 8, lap: 1, laps: 3 } });
    const st = await moviles[6].espera('st');
    check(st && st.pos === 3, 'la pantalla manda el estado (`st`) a un móvil concreto');
    moviles[6].olvida();
    tele.manda({ t: 'to', id: moviles[6].id, m: { t: 'fx', kind: 'hit' } });
    const fx = await moviles[6].espera('fx');
    check(fx && fx.kind === 'hit', 'los avisos (`fx`) llegan al móvil');
  }

  // ---- se va el anfitrión: releva el siguiente ----
  {
    tele.olvida();
    const antiguo = moviles[0].id;
    moviles[0].close();
    const relevo = await tele.espera((m) => m.t === 'host' && m.hostId !== antiguo, 3000);
    check(!!relevo, 'si se desconecta el anfitrión, el relevo pasa a otro jugador');
    const desconectado = tele.recibidos.find((m) => m.t === 'conn' && m.id === antiguo && m.connected === false);
    check(!!desconectado, 'la pantalla se entera de que ese móvil se ha quedado sin conexión');
  }

  // ---- reconexión con el token: conserva su id y su kart ----
  {
    const vuelve = cliente(PORT, 'vuelve');
    await vuelve.abierto;
    vuelve.manda({ t: 'hello', name: 'Jugador 0', char: 0, token: moviles[0].token });
    const w = await vuelve.espera('welcome');
    check(w && w.id === moviles[0].id, 'al volver con su token, el móvil conserva su id (y su kart)');
    vuelve.close();
  }

  // ---- salir del todo ----
  {
    tele.olvida();
    const quien = moviles[4];
    quien.manda({ t: 'leave' });
    const leave = await tele.espera((m) => m.t === 'leave' && m.id === quien.id);
    check(!!leave, '`leave` saca al jugador y la pantalla se entera');
  }

  // ---- abrir la pantalla dos veces: la vieja queda inactiva ----
  {
    const tele2 = cliente(PORT, 'tele2');
    await tele2.abierto;
    tele2.manda({ t: 'screen', tracks: ['Chicle'] });
    const reemplazada = await tele.espera('replaced');
    check(!!reemplazada, 'si se abre la pantalla dos veces, la primera recibe `replaced`');
    tele2.close();
  }

  for (const m of moviles) { try { m.close(); } catch (_) { /* ignore */ } }
  try { tele.close(); } catch (_) { /* ignore */ }
}

main().catch((e) => { console.error(e); process.exit(1); });
