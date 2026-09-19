'use strict';
/*
 * Kart Party — servidor
 *  - Sirve los archivos estáticos (pantalla de la tele y mando del móvil)
 *  - Relé WebSocket: los móviles envían sus botones, la pantalla recibe todo
 *  - Genera el código QR con la URL para unirse
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three', 'build'); // motor 3D, servido en /vendor/
const MAX_PLAYERS = 8;
const NUM_CHARS = 8;
const DISCONNECT_GRACE_MS = 90 * 1000; // tiempo que guardamos el sitio de un móvil desconectado

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
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
  const host = process.env.HOST_IP || (localIPs()[0] || {}).address || 'localhost';
  return `http://${host}:${PORT}/play`;
}

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ url: joinUrl(), port: PORT, ips: localIPs() }));
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
});

// ---------- Estado de la sala ----------
/** @type {Map<number, {id:number, token:string, name:string, char:number, ws:WebSocket|null, timer:any}>} */
const players = new Map();
let screenWs = null;
let hostId = null;
let phase = 'lobby';
let trackNames = [];
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
  return { id: p.id, name: p.name, char: p.char, host: p.id === hostId, connected: !!(p.ws && p.ws.readyState === WebSocket.OPEN) };
}
function lobbyMessage() {
  return {
    t: 'lobby',
    players: [...players.values()].map(publicPlayer),
    settings, hostId, phase, tracks: trackNames,
    screen: !!(screenWs && screenWs.readyState === WebSocket.OPEN),
  };
}
function rosterMessage() {
  return { t: 'roster', taken: [...players.values()].map((p) => p.char) };
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
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });

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
      if (screenWs && screenWs !== ws && screenWs.readyState === WebSocket.OPEN) {
        send(screenWs, { t: 'replaced' });
        try { screenWs.close(); } catch (_) { /* ignore */ }
      }
      screenWs = ws;
      ws.role = 'screen';
      if (Array.isArray(m.tracks)) trackNames = m.tracks.map((s) => String(s).slice(0, 40)).slice(0, 20);
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
      return;
    }

    // ----- Móvil -----
    if (m.t === 'hello') {
      const name = sanitizeName(m.name) || 'Jugador';
      const char = Number.isInteger(m.char) && m.char >= 0 && m.char < NUM_CHARS ? m.char : -1;
      let p = null;
      if (typeof m.token === 'string' && m.token.length <= 64) {
        for (const q of players.values()) if (q.token === m.token) { p = q; break; }
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
        p.ws = ws;
        ws.role = 'player'; ws.playerId = p.id;
        log(`Reconectado: ${p.name}`);
        toScreen({ t: 'join', player: publicPlayer(p) });
      } else {
        if (char < 0) { send(ws, { t: 'err', msg: 'Elige un personaje.' }); return; }
        if (players.size >= MAX_PLAYERS) { send(ws, { t: 'err', msg: 'La sala está llena (máximo 8 jugadores).' }); return; }
        if (charTaken(char, -1)) { send(ws, { t: 'err', msg: 'Ese personaje ya está cogido, elige otro.' }); return; }
        p = { id: nextId++, token: crypto.randomBytes(16).toString('hex'), name, char, ws, timer: null };
        players.set(p.id, p);
        ws.role = 'player'; ws.playerId = p.id;
        log(`Nuevo jugador: ${p.name} (personaje ${p.char})`);
        toScreen({ t: 'join', player: publicPlayer(p) });
      }
      ensureHost();
      send(ws, { t: 'welcome', id: p.id, token: p.token, name: p.name, char: p.char, phase });
      broadcastLobby();
      return;
    }

    if (ws.role !== 'player' || ws.playerId === null) return;
    const id = ws.playerId;
    switch (m.t) {
      case 'i': {
        const s = m.s === -1 || m.s === 1 ? m.s : 0;
        toScreen({ t: 'i', id, s, g: m.g ? 1 : 0, b: m.b ? 1 : 0, d: m.d ? 1 : 0 });
        break;
      }
      case 'use': toScreen({ t: 'use', id }); break;
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

server.listen(PORT, '0.0.0.0', () => {
  const ips = localIPs();
  console.log('');
  console.log('KART PARTY en marcha');
  console.log('');
  console.log(`   Pantalla (abrir en el ordenador conectado a la tele):  http://localhost:${PORT}`);
  console.log(`   Mandos (los móviles, misma WiFi):                        ${joinUrl()}`);
  if (ips.length > 1) {
    console.log('');
    console.log('   Otras IPs de este equipo (si el QR no funciona, prueba con HOST_IP=...):');
    for (const ip of ips.slice(1)) console.log(`     - ${ip.address} (${ip.name})`);
  }
  console.log('');
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} está ocupado. Prueba con: PORT=3001 npm start`);
  } else {
    console.error('Error del servidor:', e.message);
  }
  process.exit(1);
});
