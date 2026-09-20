'use strict';
/*
 * Kart Party — servidor
 *  - Sirve los archivos estáticos (pantalla de la tele y mando del móvil)
 *  - Relé WebSocket: los móviles envían sus botones, la pantalla recibe todo
 *  - Genera el código QR con la URL para unirse
 *  - Sirve lo mismo por HTTPS con un certificado propio, porque el volante del mando necesita
 *    el giroscopio y los navegadores solo lo dan en «contexto seguro» (ver `certificado()`)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');

const PORT = parseInt(process.env.PORT, 10) || 3000;
// Puerto de HTTPS (el de siempre + 443). `KART_HTTPS=0` lo apaga del todo.
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || PORT + 443;
const HTTPS_ON = process.env.KART_HTTPS !== '0';
const CERT_DIR = path.join(__dirname, '.cert');
const PUBLIC_DIR = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three', 'build'); // motor 3D, servido en /vendor/
// Complementos de three.js (el cargador de modelos .glb), servidos en /vendor/jsm/…
const THREE_JSM_DIR = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');
const MAX_PLAYERS = 7;   // siete personajes, siete sitios (ver CHARS en public/sim.mjs)
const NUM_CHARS = 7;
const DISCONNECT_GRACE_MS = 90 * 1000; // tiempo que guardamos el sitio de un móvil desconectado

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
};

// ---------- IPs locales ----------
function localIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      out.push({ name, address: a.address });
    }
  }
  const score = (e) => {
    let s = 0;
    if (/^en\d/.test(e.name)) s += 10; // Wi-Fi / Ethernet en macOS
    if (/^(wl|eth|eno|enp)/.test(e.name)) s += 8; // Linux
    if (/^(192\.168\.|10\.)/.test(e.address)) s += 5;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(e.address)) s += 4;
    if (/^(utun|tun|tap|bridge|vmnet|docker|veth|awdl|llw|anpi|ap\d)/.test(e.name)) s -= 20; // VPNs, virtuales
    if (/^169\.254\./.test(e.address)) s -= 30; // link-local
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(e.address)) s -= 15; // CGNAT / Tailscale
    return s;
  };
  out.sort((a, b) => score(b) - score(a));
  return out;
}

function joinUrl() {
  return `http://${hostIP()}:${PORT}/play`;
}
function hostIP() {
  return process.env.HOST_IP || (localIPs()[0] || {}).address || 'localhost';
}
/*
 * La dirección del volante, cifrada. **El QR no apunta aquí a propósito**: el certificado es
 * nuestro, así que el navegador enseña un aviso feo («podrían estar robándote los datos») y hay
 * gente a la que no le deja pasar. Poner eso en la puerta de entrada deja a alguien fuera de la
 * fiesta. Se entra por la dirección normal y, ya dentro, el mando ofrece saltar aquí para tener
 * volante, explicando antes lo que va a salir.
 */
function joinUrlVolante() { return seguroListo ? `https://${hostIP()}:${HTTPS_PORT}/play` : ''; }

/*
 * Certificado propio (autofirmado) para poder servir por HTTPS.
 *
 * Por qué hace falta: el mando gira inclinando el móvil, y los navegadores solo dejan leer el
 * giroscopio en «contexto seguro». `http://192.168.x.x` no lo es, así que sin esto no hay volante
 * en ningún móvil. Con el certificado, el móvil entra por `https://` y, tras aceptar **una vez**
 * el aviso del navegador («no es privada» → continuar), ya puede usar los sensores.
 *
 * Se genera con `openssl` (viene de serie en macOS y Linux; no añadimos dependencias) y se guarda
 * en `.cert/`, que no va al repositorio. Se rehace solo si cambian las IPs del equipo (otra WiFi).
 * Si algo falla —no hay openssl, no se puede escribir— devuelve null y no pasa nada: el juego
 * sigue funcionando por HTTP y el mando enseña los botones de girar de siempre.
 */
function certificado() {
  const keyFile = path.join(CERT_DIR, 'clave.pem');
  const certFile = path.join(CERT_DIR, 'certificado.pem');
  const ipsFile = path.join(CERT_DIR, 'ips.json');
  const ips = [...new Set([hostIP(), ...localIPs().map((i) => i.address), '127.0.0.1'])];
  // La versión va en la firma: si cambian las reglas del certificado, los viejos se rehacen solos.
  const firma = JSON.stringify({ v: 2, ips });
  try {
    if (fs.readFileSync(ipsFile, 'utf8') === firma) {
      return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    }
  } catch (_) { /* no existe o ha cambiado la WiFi: lo rehacemos */ }
  try {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    const san = 'subjectAltName=' + [...ips.map((ip) => (/^[\d.]+$/.test(ip) ? 'IP:' + ip : 'DNS:' + ip)), 'DNS:localhost'].join(',');
    /*
     * Ojo con estos números y extensiones: no son decorativos. Apple **rechaza de plano** los
     * certificados de servidor que duren más de 825 días o que no digan que son para un servidor
     * web (`serverAuth`), y entonces el iPhone no ofrece ni la opción de continuar: se queda en
     * «podrían estar intentando robarte los datos» y no hay manera de entrar. Por eso 397 días
     * (lo que aceptan todos los navegadores) y las extensiones completas.
     */
    const args = ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '397',
      '-keyout', keyFile, '-out', certFile, '-subj', '/CN=Kart Party',
      '-addext', san,
      '-addext', 'extendedKeyUsage=serverAuth',
      '-addext', 'basicConstraints=critical,CA:true',
      '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign'];
    // `/usr/bin/openssl` como repuesto: al abrir el juego con doble clic desde el Finder, la
    // Terminal a veces no trae el PATH completo, y ese siempre está en macOS.
    let r = spawnSync('openssl', args, { encoding: 'utf8', timeout: 25000 });
    if (r.status !== 0) r = spawnSync('/usr/bin/openssl', args, { encoding: 'utf8', timeout: 25000 });
    if (r.status !== 0) return null;
    fs.writeFileSync(ipsFile, firma);
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  } catch (_) { return null; }
}
let seguroListo = false;

// ---------- HTTP ----------
function serveStatic(req, res, urlPath) {
  let p = urlPath;
  if (p === '/') p = '/index.html';
  else if (p === '/play' || p === '/play/') p = '/play.html';
  let decoded;
  try { decoded = decodeURIComponent(p); } catch (_) { res.writeHead(400); res.end('400'); return; }
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, safe);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('403'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - no encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

async function atiende(req, res) {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ url: joinUrl(), urlVolante: joinUrlVolante(), seguro: seguroListo, port: PORT, httpsPort: HTTPS_PORT, ips: localIPs() }));
      return;
    }
    /*
     * El certificado, para descargarlo e instalarlo en un móvil. Quien lo haga deja de ver el
     * aviso para siempre en ese móvil (en iPhone hay que ir además a Ajustes → General →
     * Información → Certificados de confianza y activarlo). Para invitados de una noche es mucho
     * lío y no hace falta; para el móvil de casa, se hace una vez y ya.
     */
    if (url.pathname === '/certificado.crt') {
      if (!seguroListo) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No hay certificado (el juego va sin HTTPS)'); return; }
      fs.readFile(path.join(CERT_DIR, 'certificado.pem'), (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encuentro el certificado'); return; }
        res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="Kart Party.crt"', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    if (url.pathname === '/qr.svg') {
      const svg = await QRCode.toString(joinUrl(), {
        type: 'svg', width: 512, margin: 1, errorCorrectionLevel: 'M',
        color: { dark: '#111111', light: '#ffffff' },
      });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' });
      res.end(svg);
      return;
    }
    if (url.pathname.startsWith('/vendor/jsm/')) {
      // complementos de three.js (GLTFLoader y lo que arrastra) desde node_modules: los modelos
      // de los karts son .glb y hacen falta para cargarlos, también sin internet
      const rel = url.pathname.slice('/vendor/jsm/'.length);
      const dest = path.normalize(path.join(THREE_JSM_DIR, rel));
      if (!/^[\w./-]+\.js$/.test(rel) || rel.includes('..') || !dest.startsWith(THREE_JSM_DIR)) { res.writeHead(404); res.end('404'); return; }
      fs.readFile(dest, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Falta three.js: ejecuta npm install'); return; }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
        res.end(data);
      });
      return;
    }
    if (url.pathname.startsWith('/vendor/')) {
      // three.js desde node_modules (sin depender de internet en la fiesta)
      const name = path.basename(url.pathname);
      if (!/^three(\.[a-z]+)*\.js$/.test(name)) { res.writeHead(404); res.end('404'); return; }
      fs.readFile(path.join(THREE_DIR, name), (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Falta three.js: ejecuta npm install'); return; }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
        res.end(data);
      });
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error: ' + e.message);
  }
}
const server = http.createServer(atiende);
// El mismo juego servido por HTTPS: es la única forma de que el móvil pueda usar el giroscopio.
const creds = HTTPS_ON ? certificado() : null;
const serverSeguro = creds ? https.createServer(creds, atiende) : null;

// ---------- Estado de la sala ----------
/** @type {Map<number, {id:number, token:string, name:string, char:number, ws:WebSocket|null, timer:any}>} */
const players = new Map();
let screenWs = null;
let hostId = null;
let phase = 'lobby';
let trackNames = [];
/*
 * Los personajes los define la simulación (`CHARS` en public/sim.mjs) y llegan aquí en el `screen`
 * de la pantalla, igual que los nombres de los circuitos: así el móvil enseña **los personajes que
 * hay de verdad** para elegir, sin una segunda copia de la lista que se quede vieja.
 */
let charList = [];
const settings = { track: 0, laps: 3, bots: 2 };
let nextId = 1;

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function toScreen(obj) { send(screenWs, obj); }
function toPlayer(id, obj) {
  const p = players.get(id);
  if (p) send(p.ws, obj);
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, char: p.char, easy: !!p.easy, host: p.id === hostId, connected: !!(p.ws && p.ws.readyState === WebSocket.OPEN) };
}
function lobbyMessage() {
  return {
    t: 'lobby',
    players: [...players.values()].map(publicPlayer),
    settings, hostId, phase, tracks: trackNames, chars: charList,
    screen: !!(screenWs && screenWs.readyState === WebSocket.OPEN),
  };
}
function rosterMessage() {
  return { t: 'roster', taken: [...players.values()].map((p) => p.char), chars: charList, max: MAX_PLAYERS };
}
function broadcastLobby() {
  const m = lobbyMessage();
  for (const p of players.values()) send(p.ws, m);
  // los móviles que aún no han entrado solo necesitan saber qué personajes quedan libres
  const r = rosterMessage();
  for (const c of wss.clients) if (c.role === null) send(c, r);
}
function isConnected(p) { return !!(p && p.ws && p.ws.readyState === WebSocket.OPEN); }
function ensureHost() {
  const current = hostId !== null ? players.get(hostId) : null;
  if (current && isConnected(current)) return;
  // el anfitrión pasa a ser el primer jugador conectado (o, si no hay ninguno, el actual/primero)
  let candidate = null;
  for (const p of players.values()) {
    if (isConnected(p)) { candidate = p; break; }
  }
  if (!candidate) candidate = current || players.values().next().value || null;
  const newId = candidate ? candidate.id : null;
  if (newId === hostId) return;
  hostId = newId;
  toScreen({ t: 'host', hostId });
}
// Echa a todos y deja la sala vacía. Es el último recurso de la fiesta: cuando un móvil que ya
// nadie tiene delante se ha quedado de anfitrión, desde la tele se vacía y todos vuelven a entrar.
function vaciarSala() {
  const ids = [...players.keys()];
  for (const id of ids) {
    const p = players.get(id);
    // `kicked` y no `err`: el móvil tiene que dejar de reconectarse solo, o volvería a entrar
    // al instante y no habríamos vaciado nada.
    if (p && p.ws) { try { send(p.ws, { t: 'kicked', msg: 'Se ha vaciado la sala desde la tele. Vuelve a entrar cuando quieras.' }); p.ws.playerId = null; p.ws.close(); } catch (_) { /* ignore */ } }
    clearTimeout(p && p.timer);
    players.delete(id);
    toScreen({ t: 'leave', id });
  }
  hostId = null;
  log(`Sala vaciada desde la tele (${ids.length} jugadores)`);
  ensureHost();
  broadcastLobby();
}

function removePlayer(id, reason) {
  const p = players.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  players.delete(id);
  if (p.ws) { try { p.ws.close(); } catch (_) { /* ignore */ } }
  toScreen({ t: 'leave', id });
  log(`Jugador sale: ${p.name} (${reason})`);
  ensureHost();
  broadcastLobby();
}
function sanitizeName(n) {
  if (typeof n !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return n.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 12);
}
function charTaken(char, exceptId) {
  for (const p of players.values()) if (p.char === char && p.id !== exceptId) return true;
  return false;
}
function log(...a) { console.log(new Date().toLocaleTimeString(), ...a); }

// ---------- WebSocket ----------
// Un solo relé para los dos servidores (los móviles entran por wss:// y la tele por ws://)
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
const alUpgrade = (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
server.on('upgrade', alUpgrade);
if (serverSeguro) serverSeguro.on('upgrade', alUpgrade);

wss.on('connection', (ws) => {
  ws.role = null; // 'screen' | 'player'
  ws.playerId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, rosterMessage());

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;

    // ----- Pantalla (tele) -----
    if (m.t === 'screen') {
      // un móvil que ya está jugando no puede hacerse pasar por la tele y echarla de la fiesta
      if (ws.role === 'player') return;
      if (screenWs && screenWs !== ws && screenWs.readyState === WebSocket.OPEN) {
        send(screenWs, { t: 'replaced' });
        try { screenWs.close(); } catch (_) { /* ignore */ }
      }
      screenWs = ws;
      ws.role = 'screen';
      if (Array.isArray(m.tracks)) trackNames = m.tracks.map((s) => String(s).slice(0, 40)).slice(0, 20);
      if (Array.isArray(m.chars)) {
        charList = m.chars.slice(0, NUM_CHARS).map((c) => ({
          name: String((c && c.name) || '').slice(0, 20),
          emoji: String((c && c.emoji) || '🏎️').slice(0, 8),
          color: /^#[0-9a-f]{6}$/i.test((c && c.color) || '') ? c.color : '#ffffff',
        }));
      }
      if (settings.track >= Math.max(1, trackNames.length)) settings.track = 0;
      log('Pantalla conectada');
      send(ws, { t: 'init', players: [...players.values()].map(publicPlayer), settings, hostId });
      broadcastLobby();
      return;
    }
    if (ws.role === 'screen') {
      if (m.t === 'to' && m.m) { toPlayer(m.id, m.m); return; }
      if (m.t === 'all' && m.m) { for (const p of players.values()) send(p.ws, m.m); return; }
      if (m.t === 'phase' && typeof m.phase === 'string') {
        phase = m.phase.slice(0, 16);
        for (const p of players.values()) send(p.ws, { t: 'phase', phase });
        return;
      }
      if (m.t === 'set' && m.settings) { applySettings(m.settings); return; }
      if (m.t === 'vaciar') { vaciarSala(); return; }
      return;
    }

    // ----- Móvil -----
    if (m.t === 'hello') {
      const name = sanitizeName(m.name) || 'Jugador';
      const char = Number.isInteger(m.char) && m.char >= 0 && m.char < NUM_CHARS ? m.char : -1;
      // modo fácil, uno por jugador (lo enciende cada cual en la sala de su móvil). Un mando con la
      // página cargada de antes no manda el campo y se queda en normal, que es lo de siempre.
      const easy = m.easy === true;
      let p = null;
      if (typeof m.token === 'string' && m.token.length <= 64) {
        for (const q of players.values()) if (q.token === m.token) { p = q; break; }
      }
      /*
       * Sin token válido, pero pidiendo un personaje que tiene un jugador **desconectado**: es la
       * misma persona volviendo (ha saltado al volante, que es otra dirección y por tanto otro
       * almacén del navegador; o ha recargado tras borrar datos). Recupera su sitio en vez de
       * chocar con un «ese personaje ya está cogido» contra su propio fantasma, que además se
       * quedaría 90 segundos ocupando plaza y, si era el anfitrión, con la corona.
       */
      if (!p && char >= 0) {
        for (const q of players.values()) if (q.char === char && !isConnected(q)) { p = q; break; }
        if (p) log(`Vuelve por otra dirección: ${p.name} recupera su sitio`);
      }
      if (p) {
        // Reconexión (o cambio de nombre/personaje)
        clearTimeout(p.timer);
        if (p.ws && p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
          p.ws.playerId = null; try { p.ws.close(); } catch (_) { /* ignore */ }
        }
        if (char >= 0 && char !== p.char) {
          if (charTaken(char, p.id)) { send(ws, { t: 'err', msg: 'Ese personaje ya está cogido, elige otro.' }); return; }
          p.char = char;
        }
        p.name = name;
        p.easy = easy;
        p.ws = ws;
        ws.role = 'player'; ws.playerId = p.id;
        log(`Reconectado: ${p.name}`);
        toScreen({ t: 'join', player: publicPlayer(p) });
      } else {
        if (char < 0) { send(ws, { t: 'err', msg: 'Elige un personaje.' }); return; }
        if (players.size >= MAX_PLAYERS) { send(ws, { t: 'err', msg: `La sala está llena (máximo ${MAX_PLAYERS} jugadores).` }); return; }
        if (charTaken(char, -1)) { send(ws, { t: 'err', msg: 'Ese personaje ya está cogido, elige otro.' }); return; }
        p = { id: nextId++, token: crypto.randomBytes(16).toString('hex'), name, char, easy, ws, timer: null };
        players.set(p.id, p);
        ws.role = 'player'; ws.playerId = p.id;
        log(`Nuevo jugador: ${p.name} (personaje ${p.char})`);
        toScreen({ t: 'join', player: publicPlayer(p) });
      }
      ensureHost();
      send(ws, { t: 'welcome', id: p.id, token: p.token, name: p.name, char: p.char, easy: !!p.easy, phase });
      broadcastLobby();
      return;
    }

    if (ws.role !== 'player' || ws.playerId === null) return;
    const id = ws.playerId;
    switch (m.t) {
      case 'i': {
        // `s` es la dirección, analógica desde que el mando gira con el giroscopio: un decimal
        // de -1 a 1. Los mandos viejos mandan -1, 0 o 1 y encajan igual.
        const n = Number(m.s);
        const s = Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
        toScreen({ t: 'i', id, s, g: m.g ? 1 : 0, b: m.b ? 1 : 0, d: m.d ? 1 : 0 });
        break;
      }
      case 'use': toScreen({ t: 'use', id }); break;
      // caracol: a quién le planta el freno quien lo está usando (`kart` es el id del kart)
      case 'picked': toScreen({ t: 'picked', id, kart: typeof m.kart === 'string' ? m.kart.slice(0, 24) : '' }); break;
      case 'start': if (id === hostId) toScreen({ t: 'start' }); break;
      case 'again': if (id === hostId) toScreen({ t: 'again' }); break;
      case 'set': if (id === hostId && m.settings) applySettings(m.settings); break;
      case 'leave': removePlayer(id, 'ha salido'); break;
      default: break;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'screen') {
      if (screenWs === ws) { screenWs = null; log('Pantalla desconectada'); broadcastLobby(); }
      return;
    }
    if (ws.role === 'player' && ws.playerId !== null) {
      const p = players.get(ws.playerId);
      if (!p || p.ws !== ws) return;
      p.ws = null;
      log(`Desconectado: ${p.name} (guardamos su sitio ${DISCONNECT_GRACE_MS / 1000}s)`);
      toScreen({ t: 'conn', id: p.id, connected: false });
      clearTimeout(p.timer);
      p.timer = setTimeout(() => removePlayer(p.id, 'no ha vuelto'), DISCONNECT_GRACE_MS);
      ensureHost(); // si era el anfitrión, otro jugador conectado toma el relevo
      broadcastLobby();
    }
  });
  ws.on('error', () => { /* el close se encarga */ });
});

function applySettings(s) {
  const nTracks = Math.max(1, trackNames.length);
  if (Number.isInteger(s.track)) settings.track = ((s.track % nTracks) + nTracks) % nTracks;
  if (Number.isInteger(s.laps)) settings.laps = Math.min(9, Math.max(1, s.laps));
  if (Number.isInteger(s.bots)) settings.bots = Math.min(7, Math.max(0, s.bots));
  toScreen({ t: 'set', settings });
  broadcastLobby();
}

// Latido: cerramos conexiones muertas (móviles bloqueados, WiFi caída...)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) { /* ignore */ }
  }
}, 10000);

function arranca() {
  const ips = localIPs();
  console.log('');
  console.log('KART PARTY en marcha');
  console.log('');
  console.log(`   Pantalla (abrir en el ordenador conectado a la tele):  http://localhost:${PORT}`);
  console.log(`   Mandos (los móviles, misma WiFi):                        ${joinUrl()}`);
  if (seguroListo) {
    console.log('');
    console.log(`   Volante (opcional):                                      ${joinUrlVolante()}`);
    console.log('   Se entra siempre por la dirección de arriba, que no da ningún aviso. El volante');
    console.log('   (girar inclinando el móvil) necesita conexión cifrada, así que el propio mando');
    console.log('   ofrece saltar a esta otra desde la sala. Al hacerlo, el navegador avisa de que');
    console.log('   «la conexión no es privada»: hay que continuar igualmente (es este ordenador).');
    console.log('   Quien no quiera o no pueda, juega con los botones ◀ ▶ y no se pierde nada.');
  } else {
    console.log('');
    console.log('   Sin HTTPS: los móviles jugarán con los botones ◀ ▶ (el volante necesita HTTPS).');
    if (HTTPS_ON) console.log('   Para tener volante hace falta `openssl` en el PATH.');
  }
  if (ips.length > 1) {
    console.log('');
    console.log('   Otras IPs de este equipo (si el QR no funciona, prueba con HOST_IP=...):');
    for (const ip of ips.slice(1)) console.log(`     - ${ip.address} (${ip.name})`);
  }
  console.log('');
}

if (serverSeguro) {
  // Si el puerto seguro falla, seguimos por HTTP sin más: nadie se queda sin jugar
  serverSeguro.on('error', (e) => { console.error(`   (HTTPS en el puerto ${HTTPS_PORT} no ha podido arrancar: ${e.message})`); });
  serverSeguro.listen(HTTPS_PORT, '0.0.0.0', () => { seguroListo = true; });
}
// damos un instante al servidor seguro para que diga si ha arrancado, y luego el HTTP
setTimeout(() => server.listen(PORT, '0.0.0.0', arranca), serverSeguro ? 150 : 0);
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} está ocupado. Prueba con: PORT=3001 npm start`);
  } else {
    console.error('Error del servidor:', e.message);
  }
  process.exit(1);
});
