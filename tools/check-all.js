'use strict';
/*
 * Comprobación completa (`npm test`):
 *  1. sintaxis de todos los archivos JS (screen.js es un módulo ES)
 *  2. validador de circuitos
 *  3. arranque real del servidor y petición de cada página/recurso
 *  4. carrera de bots sin navegador dentro de public/sim.mjs
 *  5. el protocolo de la fiesta con una pantalla y ocho móviles de mentira
 */
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failed = false;
const ok = (msg) => console.log('  ✓ ' + msg);
const bad = (msg) => { failed = true; console.log('  ✗ ' + msg); };

function checkSyntax(file, isModule) {
  let target = path.join(ROOT, file);
  if (isModule) {
    // node --check trata .js como CommonJS; copiamos el módulo a .mjs para validarlo
    target = path.join(os.tmpdir(), 'kart-party-check-' + path.basename(file, '.js') + '.mjs');
    fs.copyFileSync(path.join(ROOT, file), target);
  }
  const r = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  if (r.status === 0) ok(`sintaxis: ${file}`);
  else bad(`sintaxis: ${file}\n${r.stderr}`);
}

console.log('Sintaxis');
checkSyntax('server.js', false);
checkSyntax('public/play.js', false);
checkSyntax('public/tracks.js', false);
checkSyntax('public/geom.js', false);
checkSyntax('tools/check-tracks.js', false);
checkSyntax('tools/check-sim.js', false);
checkSyntax('tools/check-protocol.js', false);
checkSyntax('tools/sim-race.js', false);
checkSyntax('public/screen.js', true);
checkSyntax('public/sim.mjs', false);   // ya es un módulo: node --check lo entiende tal cual
checkSyntax('public/layout.mjs', false);

console.log('Circuitos');
{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-tracks.js')], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').map((l) => (l ? '    ' + l : l)).join('\n'));
  if (r.status === 0) ok('validador de circuitos'); else bad('validador de circuitos');
}

console.log('Servidor');
(async () => {
  const PORT = 3000 + 700 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const base = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 8000;
  let up = false;
  while (Date.now() < deadline && !up) {
    try { const r = await fetch(base + '/info'); up = r.ok; } catch (_) { await new Promise((res) => setTimeout(res, 200)); }
  }
  if (!up) bad('el servidor no ha arrancado en 8 s\n' + out);
  else {
    ok(`arranca (puerto ${PORT})`);
    const checks = [
      ['/', 'text/html', 'KART PARTY'],
      ['/play', 'text/html', 'Kart Party'],
      ['/info', 'application/json', '"url"'],
      ['/qr.svg', 'image/svg+xml', '<svg'],
      ['/screen.js', 'text/javascript', "from 'three'"],
      ['/sim.mjs', 'text/javascript', 'createSim'],
      ['/layout.mjs', 'text/javascript', 'panelLayout'],
      ['/play.js', 'text/javascript', 'WebSocket'],
      ['/tracks.js', 'text/javascript', 'KART_TRACKS'],
      ['/geom.js', 'text/javascript', 'KART_GEOM'],
      ['/vendor/three.module.js', 'text/javascript', 'three.core.js'],
      ['/vendor/three.core.js', 'text/javascript', 'Vector3'],
    ];
    for (const [p, type, needle] of checks) {
      try {
        const r = await fetch(base + p);
        const text = await r.text();
        const ct = r.headers.get('content-type') || '';
        if (r.ok && ct.includes(type) && text.includes(needle)) ok(`GET ${p}`);
        else bad(`GET ${p} → ${r.status} ${ct}${text.includes(needle) ? '' : ' (contenido inesperado)'}`);
      } catch (e) { bad(`GET ${p} → ${e.message}`); }
    }
    // el mando: exactamente cuatro botones grandes y ni rastro de freno ni de derrape
    try {
      const html = await (await fetch(base + '/play')).text();
      const ctl = html.match(/class="ctl[^"]*"/g) || [];
      const teclas = (html.match(/data-k="([a-z]+)"/g) || []).map((m) => m.slice(8, -1)).sort();
      const js = await (await fetch(base + '/play.js')).text();
      const mandaDerrape = /\bd:\s*1\b/.test(js) || /held\.d\b/.test(js);
      const bien = ctl.length === 4
        && JSON.stringify(teclas) === JSON.stringify(['g', 'left', 'right'])
        && html.includes('id="btn-item"')
        && !/data-k="[bd]"/.test(html)
        && !mandaDerrape;
      if (bien) ok('el mando tiene 4 botones (◀ ▶, objeto, gas) y no manda derrape');
      else bad(`el mando no cuadra: ${ctl.length} botones .ctl, teclas ${teclas.join(',')}${mandaDerrape ? ', play.js manda derrape' : ''}`);
    } catch (e) { bad('no se puede comprobar el mando: ' + e.message); }

    try {
      const r = await fetch(base + '/../server.js');
      if (r.status === 200 && (await r.text()).includes('WebSocketServer')) bad('sirve archivos fuera de public/'); else ok('no sirve archivos fuera de public/');
    } catch (_) { ok('no sirve archivos fuera de public/'); }
  }
  child.kill();
  await new Promise((res) => setTimeout(res, 200));

  console.log('Carrera sin pantalla');
  {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-sim.js')], { encoding: 'utf8' });
    process.stdout.write(r.stdout.split('\n').map((l) => (l ? '    ' + l : l)).join('\n'));
    if (r.stderr) process.stdout.write(r.stderr);
    if (r.status === 0) ok('simulación de carreras'); else bad('simulación de carreras');
  }
  {
    // `npm run race`: una pasada en silencio y otra en JSON, para que no se pudra la herramienta
    const q = spawnSync(process.execPath, [path.join(ROOT, 'tools/sim-race.js'), '--track', 'all', '--laps', '2', '--quiet'], { encoding: 'utf8' });
    if (q.status === 0) ok('npm run race (silencioso)'); else bad('npm run race (silencioso)\n' + (q.stderr || ''));
    const j = spawnSync(process.execPath, [path.join(ROOT, 'tools/sim-race.js'), '--track', 'all', '--runs', '3', '--laps', '2', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    try {
      const datos = JSON.parse(j.stdout);
      const campos = ['pos', 'nombre', 'tiempo', 'mejorVuelta', 'objetosUsados', 'golpesDados', 'golpesRecibidos', 'fueraDePista', 'enElAire'];
      const bien = j.status === 0 && datos.carreras.length === 12
        && datos.carreras.every((c) => c.karts.length === 8 && c.karts.every((k) => campos.every((f) => k[f] !== undefined)));
      if (bien) ok('npm run race --json (12 carreras con todos los campos)'); else bad('npm run race --json: faltan campos o carreras');
    } catch (e) { bad('npm run race --json no produce JSON válido: ' + e.message); }
  }

  console.log('Móviles de mentira');
  {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-protocol.js')], { encoding: 'utf8' });
    process.stdout.write(r.stdout.split('\n').map((l) => (l ? '    ' + l : l)).join('\n'));
    if (r.stderr) process.stdout.write(r.stderr);
    if (r.status === 0) ok('protocolo móvil ↔ servidor ↔ pantalla'); else bad('protocolo móvil ↔ servidor ↔ pantalla');
  }

  console.log(failed ? '\nHAY FALLOS' : '\nTodo correcto');
  process.exit(failed ? 1 : 0);
})();
