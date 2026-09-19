'use strict';
/*
 * Comprobación completa (`npm test`):
 *  1. sintaxis de todos los archivos JS (screen.js es un módulo ES)
 *  2. validador de circuitos
 *  3. arranque real del servidor y petición de cada página/recurso
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
checkSyntax('public/screen.js', true);

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
    try {
      const r = await fetch(base + '/../server.js');
      if (r.status === 200 && (await r.text()).includes('WebSocketServer')) bad('sirve archivos fuera de public/'); else ok('no sirve archivos fuera de public/');
    } catch (_) { ok('no sirve archivos fuera de public/'); }
  }
  child.kill();
  await new Promise((res) => setTimeout(res, 200));
  console.log(failed ? '\nHAY FALLOS' : '\nTodo correcto');
  process.exit(failed ? 1 : 0);
})();
