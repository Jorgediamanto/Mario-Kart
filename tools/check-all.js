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
const https = require('https');
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
checkSyntax('public/volante.js', false);
checkSyntax('tools/check-tracks.js', false);
checkSyntax('tools/check-sim.js', false);
checkSyntax('tools/check-protocol.js', false);
checkSyntax('tools/sim-race.js', false);
checkSyntax('public/screen.js', true);
checkSyntax('public/sim.mjs', false);   // ya es un módulo: node --check lo entiende tal cual
checkSyntax('public/layout.mjs', false);

// La pantalla no tiene pruebas de navegador, así que al menos se comprueba que no usa nombres de
// three.js que no existan en la versión instalada (un `THREE.LoQueSea` mal escrito revienta la tele
// en la fiesta y aquí no se notaría), y que la pantalla dividida sigue en su sitio.
console.log('Pantalla');
{
  const screenSrc = fs.readFileSync(path.join(ROOT, 'public/screen.js'), 'utf8');
  const threeSrc = fs.readFileSync(path.join(ROOT, 'node_modules/three/build/three.module.js'), 'utf8');
  const exportados = new Set();
  for (const m of threeSrc.matchAll(/^export \{([^}]+)\}/gm)) {
    for (const nombre of m[1].split(',')) exportados.add(nombre.trim().split(/\s+as\s+/).pop());
  }
  const usados = new Set([...screenSrc.matchAll(/\bTHREE\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  const faltan = [...usados].filter((n) => !exportados.has(n));
  if (!exportados.size) bad('no se ha podido leer la lista de exportaciones de three.js');
  else if (faltan.length) bad(`screen.js usa nombres de three.js que no existen: ${faltan.join(', ')}`);
  else ok(`los ${usados.size} nombres de three.js que usa screen.js existen en la versión instalada`);
  const partido = ['setScissorTest', 'setScissor', 'setViewport'].filter((n) => !screenSrc.includes(n));
  if (partido.length) bad(`la pantalla dividida ha perdido ${partido.join(', ')}`);
  else ok('la pantalla dividida usa setScissorTest, setScissor y setViewport');
  /*
   * Audio: no se puede escuchar desde aquí, pero sí comprobar lo que pide la hoja de ruta. Que
   * todo el sonido pase por el bus con compresor (y no suelto a `destination`, que es como estaba
   * antes y por lo que no había manera de callar el juego), que la tecla `M` siga existiendo y que
   * los motores se apaguen al quitar un kart, que es la fuga fácil: un oscilador no para solo.
   */
  const suelto = /\.connect\(\s*ac\.destination\s*\)/g;
  const conexiones = [...screenSrc.matchAll(suelto)].length;
  if (conexiones > 1) bad(`hay ${conexiones} sonidos conectados directos a la salida: tienen que pasar por el bus con compresor`);
  else ok('todo el sonido pasa por el bus con compresor');
  const audio = [
    ["la tecla `M` calla el sonido", /key === 'm' \|\| key === 'M'/],
    ["hay un compresor en la salida", /createDynamicsCompressor/],
    ["cada kart tiene su motor", /function actualizarMotores/],
    ["al quitar un kart se le para el motor", /pararMotor\(k\)/],
    ["hay música y se programa por delante del reloj", /function actualizarMusica/],
    ["la música no viene de ningún archivo", /const TEMAS = \{/],
  ];
  for (const [que, re] of audio) (re.test(screenSrc) ? ok : bad)(que);
}

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
      ['/volante.js', 'text/javascript', 'KART_VOLANTE'],
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
    // el mando: dos botones grandes (OBJETO y GAS) y los ◀ ▶ solo como respaldo del volante
    try {
      const html = await (await fetch(base + '/play')).text();
      const js = await (await fetch(base + '/play.js')).text();
      const mandaDerrape = /\bd:\s*1\b/.test(js) || /held\.d\b/.test(js);
      // el bloque de respaldo va marcado con data-respaldo: fuera de él no puede haber ◀ ▶
      const respaldo = html.match(/<div class="left" id="turn-zone" data-respaldo="1">[\s\S]*?<\/div>/);
      const fuera = respaldo ? html.replace(respaldo[0], '') : html;
      const dosBotones = html.includes('id="btn-item"') && /data-k="g"/.test(fuera);
      const girarSoloEnRespaldo = !!respaldo && !/data-k="(left|right)"/.test(fuera)
        && /data-k="left"/.test(respaldo[0]) && /data-k="right"/.test(respaldo[0]);
      if (dosBotones && girarSoloEnRespaldo && !/data-k="[bd]"/.test(html) && !mandaDerrape) {
        ok('el mando tiene 2 botones (objeto y gas) y los ◀ ▶ solo de respaldo');
      } else {
        bad(`el mando no cuadra: ${dosBotones ? '' : 'faltan objeto/gas; '}${girarSoloEnRespaldo ? '' : 'los ◀ ▶ no están solo en el respaldo; '}${mandaDerrape ? 'play.js manda derrape' : ''}`);
      }
      // el volante: analógico y con permiso de iPhone
      const volanteBien = /deviceorientation/.test(js) && /requestPermission/.test(js)
        && /Math\.round\(volante\.s \* 100\)/.test(js) && /isSecureContext/.test(js);
      if (volanteBien) ok('play.js lee el giroscopio, pide permiso en iPhone y manda dirección decimal');
      else bad('play.js no tiene el volante completo (giroscopio, permiso, dirección decimal)');
    } catch (e) { bad('no se puede comprobar el mando: ' + e.message); }

    // HTTPS: sin él los móviles no pueden usar el giroscopio
    try {
      const info = await (await fetch(base + '/info')).json();
      // el QR nunca puede llevar a la dirección cifrada: el aviso del navegador dejaría a alguien
      // fuera de la fiesta. Se entra por la normal y el mando ofrece saltar (ver play.js).
      if (info.url && info.url.startsWith('http://')) ok('el QR lleva a la dirección normal, sin avisos del navegador');
      else bad(`el QR lleva a ${info.url}: el aviso del certificado dejaría a gente fuera`);
      if (!info.seguro) {
        ok('sin HTTPS (no hay openssl): el juego sigue y el mando usará los botones ◀ ▶');
      } else {
        const texto = await new Promise((res, rej) => {
          const r = https.request({ host: '127.0.0.1', port: info.httpsPort, path: '/play', rejectUnauthorized: false },
            (resp) => { let d = ''; resp.on('data', (c) => { d += c; }); resp.on('end', () => res(resp.statusCode === 200 ? d : '')); });
          r.on('error', rej); r.end();
        });
        if (texto.includes('Kart Party')) ok(`HTTPS sirve el mando en el puerto ${info.httpsPort} (hace falta para el volante)`);
        else bad('HTTPS dice estar en marcha pero no sirve el mando');
        // El certificado tiene que cumplir las reglas de Apple o el iPhone no deja ni continuar:
        // como mucho 825 días y tiene que decir que es de un servidor web.
        const crt = await (await fetch(base + '/certificado.crt')).text();
        const pem = path.join(os.tmpdir(), 'kart-cert-' + process.pid + '.pem');
        fs.writeFileSync(pem, crt);
        const texto2 = spawnSync(process.env.OPENSSL || 'openssl', ['x509', '-in', pem, '-noout', '-text'], { encoding: 'utf8' });
        const salida = texto2.status === 0 ? texto2.stdout : spawnSync('/usr/bin/openssl', ['x509', '-in', pem, '-noout', '-text'], { encoding: 'utf8' }).stdout || '';
        const fechas = spawnSync('/usr/bin/openssl', ['x509', '-in', pem, '-noout', '-dates'], { encoding: 'utf8' }).stdout || '';
        fs.unlinkSync(pem);
        const desde = /notBefore=(.*)/.exec(fechas), hasta = /notAfter=(.*)/.exec(fechas);
        const dias = desde && hasta ? (Date.parse(hasta[1]) - Date.parse(desde[1])) / 86400000 : 9999;
        const serverAuth = /TLS Web Server Authentication/.test(salida);
        const tieneSAN = /Subject Alternative Name/.test(salida);
        if (dias <= 825 && serverAuth && tieneSAN) ok(`el certificado lo acepta un iPhone (${Math.round(dias)} días, serverAuth, con SAN)`);
        else bad(`el certificado no vale para iPhone: ${Math.round(dias)} días${serverAuth ? '' : ', sin serverAuth'}${tieneSAN ? '' : ', sin SAN'}`);
      }
    } catch (e) { bad('no se puede comprobar el HTTPS: ' + e.message); }

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
      const esperadas = require(path.join(ROOT, 'public/tracks.js')).length * 3;
      // la parrilla la llena `--bots`, que por defecto son todos los sitios que haya (hoy, siete)
      const sitios = datos.carreras[0] && datos.carreras[0].karts.length;
      const bien = j.status === 0 && datos.carreras.length === esperadas && sitios >= 2
        && datos.carreras.every((c) => c.karts.length === sitios && c.karts.every((k) => campos.every((f) => k[f] !== undefined)));
      if (bien) ok(`npm run race --json (${esperadas} carreras de ${sitios} karts, con todos los campos)`);
      else bad(`npm run race --json: esperaba ${esperadas} carreras y llegan ${datos.carreras ? datos.carreras.length : '?'}, o faltan campos`);
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
