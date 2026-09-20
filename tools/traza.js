'use strict';
/*
 * Motor de trazados de Kart Party (lo usan `traza-arcoiris.js` y `traza-circuitos.js`).
 *
 * Aquí está todo lo que era `traza-arcoiris.js` antes de que hiciera falta para los cinco
 * circuitos: el código es el mismo, solo que ahora se le pasa el circuito en vez de llevarlo
 * escrito dentro. Así un trazado nuevo es una tabla de vértices y nada más.
 *
 * Cómo está pensado un circuito: es un **polígono alrededor de un centro** (los vértices van en
 * ángulo creciente, así el trazado nunca se cruza consigo mismo) con **las esquinas redondeadas**.
 * El redondeo de cada esquina es lo que decide qué curva sale: grande = curva rápida y larga,
 * pequeño = cerrada. Si un redondeo no cabe en su lado, se recorta solo.
 *
 * Después, la línea se remuestrea a puntos **repartidos a distancia constante** (la spline del
 * juego es Catmull-Rom uniforme: con espaciados dispares salen radios de 37 px donde tocan 200) y
 * se valida con las mismas reglas que `npm run check`: dos tramos nunca a menos de ancho+30 y
 * ningún radio por debajo de mitad del ancho+10.
 *
 * La spline suaviza los arcos, así que el radio que sale es más o menos **dos tercios** del
 * redondeo que se pide aquí: para una curva de radio 170 hay que pedir unos 260.
 */

const path = require('path');
const GEOM = require(path.join(__dirname, '..', 'public', 'geom.js'));
const rad = (d) => d * Math.PI / 180;

function vertices(spec, C, ey) {
  return spec.map((v) => ({
    x: C.x + Math.cos(rad(v.f)) * v.r,
    y: C.y + Math.sin(rad(v.f)) * v.r * ey,
    R: v.R, nombre: v.nombre,
  }));
}

// Recorta los redondeos que no caben en su lado (proporcionalmente, dejando un respiro)
function encajar(V, respiro = 40) {
  const n = V.length;
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    let tocado = false;
    const t = V.map((v, i) => {
      const p = V[(i - 1 + n) % n], q = V[(i + 1) % n];
      const inA = Math.atan2(v.y - p.y, v.x - p.x), outA = Math.atan2(q.y - v.y, q.x - v.x);
      let d = outA - inA; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      return { d, t: Math.abs(d) < 1e-6 ? 0 : v.R * Math.tan(Math.abs(d) / 2) };
    });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const L = Math.hypot(V[j].x - V[i].x, V[j].y - V[i].y) - respiro;
      const suma = t[i].t + t[j].t;
      if (suma > L) {
        const f = L / suma;
        V[i].R *= f; V[j].R *= f; tocado = true;
      }
    }
    if (!tocado) break;
  }
  return V;
}

function trazar(V, paso = 6) {
  const n = V.length, pts = [];
  const info = [];
  // tangentes de cada esquina
  const geomV = V.map((v, i) => {
    const p = V[(i - 1 + n) % n], q = V[(i + 1) % n];
    const inA = Math.atan2(v.y - p.y, v.x - p.x), outA = Math.atan2(q.y - v.y, q.x - v.x);
    let d = outA - inA; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const t = Math.abs(d) < 1e-6 ? 0 : v.R * Math.tan(Math.abs(d) / 2);
    return { inA, outA, giro: d, t };
  });
  // ¿caben los fillets en cada lado?
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const L = Math.hypot(V[j].x - V[i].x, V[j].y - V[i].y);
    if (geomV[i].t + geomV[j].t > L - 1) info.push(`lado ${i}->${j}: los redondeos piden ${(geomV[i].t + geomV[j].t).toFixed(0)}px y el lado mide ${L.toFixed(0)}px`);
  }
  for (let i = 0; i < n; i++) {
    const v = V[i], gv = geomV[i], j = (i + 1) % n;
    // arco de la esquina i
    const a0 = { x: v.x - Math.cos(gv.inA) * gv.t, y: v.y - Math.sin(gv.inA) * gv.t };
    const a1 = { x: v.x + Math.cos(gv.outA) * gv.t, y: v.y + Math.sin(gv.outA) * gv.t };
    if (gv.t > 0.5) {
      const s = Math.sign(gv.giro);
      const cx = a0.x + Math.cos(gv.inA + s * Math.PI / 2) * v.R, cy = a0.y + Math.sin(gv.inA + s * Math.PI / 2) * v.R;
      const fi = Math.atan2(a0.y - cy, a0.x - cx);
      const m = Math.max(2, Math.round(Math.abs(gv.giro) * v.R / paso));
      for (let k = 0; k <= m; k++) pts.push({ x: cx + Math.cos(fi + gv.giro * k / m) * v.R, y: cy + Math.sin(fi + gv.giro * k / m) * v.R });
    } else pts.push({ x: v.x, y: v.y });
    // recta hasta el arco siguiente
    const gw = geomV[j], w = V[j];
    const b0 = { x: w.x - Math.cos(gw.inA) * gw.t, y: w.y - Math.sin(gw.inA) * gw.t };
    const L = Math.hypot(b0.x - a1.x, b0.y - a1.y);
    const m = Math.max(1, Math.round(L / paso));
    for (let k = 1; k < m; k++) pts.push({ x: a1.x + (b0.x - a1.x) * k / m, y: a1.y + (b0.y - a1.y) * k / m });
  }
  return { pts, info, geomV };
}

function validar(points, { width, W, H, spacing = 8 }) {
  const samples = GEOM.buildSamples(points, spacing);
  const N = samples.length, halfW = width / 2, problemas = [];
  for (const s of samples) if (s.x < halfW + 10 || s.x > W - halfW - 10 || s.y < halfW + 10 || s.y > H - halfW - 10) { problemas.push(`se sale del mundo (${W}x${H}) en (${s.x.toFixed(0)},${s.y.toFixed(0)})`); break; }
  const minSep = Math.floor(N / 12), needed = width + 30;
  let worst = Infinity, wp = null;
  for (let i = 0; i < N; i++) for (let j = i + minSep; j < N; j++) {
    if (Math.min(j - i, N - (j - i)) < minSep) continue;
    const d = Math.hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y);
    if (d < worst) { worst = d; wp = [i, j]; }
  }
  if (worst < needed) problemas.push(`dos tramos a ${worst.toFixed(0)}px (mínimo ${needed}) en (${samples[wp[0]].x.toFixed(0)},${samples[wp[0]].y.toFixed(0)}) y (${samples[wp[1]].x.toFixed(0)},${samples[wp[1]].y.toFixed(0)})`);
  let minR = Infinity, minAt = null;
  const radios = [];
  for (let i = 0; i < N; i++) {
    let d = samples[(i + 1) % N].ang - samples[i].ang;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const r = Math.abs(d) < 1e-6 ? Infinity : spacing / Math.abs(d);
    radios.push(r);
    if (r < minR) { minR = r; minAt = { ...samples[i], i }; }
  }
  if (minR < halfW + 10) problemas.push(`curva demasiado cerrada (radio ${minR.toFixed(0)}, mínimo ${halfW + 10}) en (${minAt.x.toFixed(0)},${minAt.y.toFixed(0)})`);
  return { problemas, N, len: N * spacing, worst, minR, minAt, samples, radios };
}

/*
 * De la tabla de vértices a los puntos listos para `tracks.js`:
 * redondea las esquinas, mide el trazado, le da un mundo propio con su margen, reparte los puntos
 * a distancia constante y gira la lista para que la meta caiga en mitad de la recta más larga.
 */
function generar({ spec, ancho, esc = 1, ey = 0.58, margen = 220, espaciado = 120, centro = { x: 0, y: 0 }, respiro = 40 }) {
  const V = encajar(vertices(spec.map((v) => ({ ...v, r: v.r * esc })), centro, ey), respiro);
  const { pts, info, geomV } = trazar(V);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const W = Math.ceil((maxX - minX + margen * 2) / 50) * 50, H = Math.ceil((maxY - minY + margen * 2) / 50) * 50;
  const movida = pts.map((p) => ({ x: p.x - minX + margen, y: p.y - minY + margen }));
  let len = 0;
  for (let i = 0; i < movida.length; i++) { const a = movida[i], b = movida[(i + 1) % movida.length]; len += Math.hypot(b.x - a.x, b.y - a.y); }
  const paso = len / Math.round(len / espaciado);
  let points = GEOM.resampleClosed(movida, paso).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  points = rotarAMeta(points, { ancho, W, H });

  const v = validar(points, { width: ancho, W, H });
  return { points, W, H, V, geomV, info, v, paso, len, ancho };
}

// La meta va en mitad de la recta más larga: rotamos los puntos para que el punto 0 caiga ahí.
function rotarAMeta(points, { ancho, W, H }) {
  const pre = validar(points, { width: ancho, W, H });
  const N = pre.N;
  let mejor = null, ini = null;
  for (let k = 0; k < N; k++) {
    const recto = pre.radios[k] > 1200;
    if (recto && ini === null) ini = k;
    if (!recto && ini !== null) { const L = k - ini; if (!mejor || L > mejor.L) mejor = { ini, fin: k, L }; ini = null; }
  }
  if (ini !== null) { const L = N - ini; if (!mejor || L > mejor.L) mejor = { ini, fin: N, L }; }
  if (!mejor) return points;
  const centro = (mejor.ini + mejor.fin) / 2 / N;        // fracción del circuito
  const corte = Math.round(centro * points.length) % points.length;
  return points.slice(corte).concat(points.slice(0, corte));
}

// Los tramos del circuito por fracciones: dónde hay recta y dónde curva (para colocar rampas, cajas…)
function tramosDe(v, minPx = 150) {
  const N = v.N;
  const tipo = (r) => (r > 1200 ? 'recta' : r > 600 ? 'rápida' : r > 320 ? 'media' : 'cerrada');
  let ini = 0, t0 = tipo(v.radios[0]);
  const tramos = [];
  for (let i = 1; i <= N; i++) {
    const t = i < N ? tipo(v.radios[i]) : null;
    if (t !== t0) { tramos.push({ tipo: t0, de: ini / N, a: i / N, px: (i - ini) * 8 }); ini = i; t0 = t; }
  }
  return tramos.filter((t) => t.px > minPx);
}

// El informe de siempre por consola: esquinas, medidas, problemas, reparto y mapa de tramos.
function informe(res, spec) {
  const { V, geomV, info, v, points, W, H, len, paso, ancho } = res;
  for (const i of info) console.log('  ⚠ ' + i);
  V.forEach((vv, i) => console.log(`  ${String(i).padStart(2)} ${(vv.nombre || '').padEnd(24)} giro ${(geomV[i].giro * 180 / Math.PI).toFixed(0).padStart(4)}º  radio ${vv.R.toFixed(0).padStart(5)} (pedido ${spec[i].R})`));
  console.log(`mundo ${W}x${H} | trazado ${len.toFixed(0)}px | spline ${v.len}px (${v.N} muestras) | ${points.length} puntos cada ${paso.toFixed(1)}px`);
  console.log(`separación mínima ${v.worst.toFixed(0)} (min ${ancho + 30}) | radio mínimo ${v.minR.toFixed(0)} (min ${ancho / 2 + 10})`);
  for (const p of v.problemas) console.log('   - ' + p);
  console.log(v.problemas.length ? 'PROBLEMAS' : 'SIN PROBLEMAS');
  const cat = { recta: 0, rapida: 0, media: 0, lenta: 0 };
  for (const r of v.radios) { if (r > 1400) cat.recta++; else if (r > 600) cat.rapida++; else if (r > 300) cat.media++; else cat.lenta++; }
  const pc = (n) => (n / v.N * 100).toFixed(0) + '%';
  console.log(`reparto: rectas ${pc(cat.recta)} | curvas rápidas ${pc(cat.rapida)} | medias ${pc(cat.media)} | cerradas ${pc(cat.lenta)}`);
  console.log('tramos:');
  for (const t of tramosDe(v)) console.log(`  ${t.de.toFixed(3)} → ${t.a.toFixed(3)}  ${t.tipo.padEnd(8)} ${t.px.toFixed(0)}px`);
}

// Deja los puntos con el formato de `tracks.js`, listos para pegar.
function comoTexto(points) {
  const lineas = [];
  for (let i = 0; i < points.length; i += 6) {
    lineas.push('        ' + points.slice(i, i + 6).map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + ',');
  }
  return lineas.join('\n') + '\n';
}

module.exports = { vertices, encajar, trazar, validar, generar, rotarAMeta, tramosDe, informe, comoTexto };
