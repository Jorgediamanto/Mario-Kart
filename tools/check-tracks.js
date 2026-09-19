'use strict';
/*
 * Validación de circuitos:
 *  - la carretera se mantiene dentro de la pantalla (fuera del marcador superior)
 *  - ningún tramo pasa demasiado cerca de otro tramo (se solaparían)
 *  - ninguna curva es tan cerrada que la carretera se pliegue sobre sí misma
 */
const TRACKS = require('../public/tracks.js');
const GEOM = require('../public/geom.js');

const W = 1920, H = 1080, HUD_H = 90, SPACING = 8;
let ok = true;

for (const def of TRACKS) {
  const samples = GEOM.buildSamples(def.points, SPACING);
  const N = samples.length;
  const halfW = def.width / 2;
  const problems = [];

  // límites
  for (const s of samples) {
    if (s.x < halfW + 10 || s.x > W - halfW - 10 || s.y < HUD_H + halfW + 10 || s.y > H - halfW - 10) {
      problems.push(`se sale de la pantalla en (${s.x.toFixed(0)}, ${s.y.toFixed(0)})`);
      break;
    }
  }

  // tramos demasiado cercanos
  const minSep = Math.floor(N / 12);
  const needed = def.width + 30;
  let worst = Infinity, worstPair = null;
  for (let i = 0; i < N; i++) {
    for (let j = i + minSep; j < N; j++) {
      const sep = Math.min(j - i, N - (j - i));
      if (sep < minSep) continue;
      const d = Math.hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y);
      if (d < worst) { worst = d; worstPair = [i, j]; }
    }
  }
  if (worst < needed) {
    const [i, j] = worstPair;
    problems.push(`dos tramos se acercan a ${worst.toFixed(0)}px (mínimo ${needed}) en (${samples[i].x.toFixed(0)}, ${samples[i].y.toFixed(0)}) y (${samples[j].x.toFixed(0)}, ${samples[j].y.toFixed(0)})`);
  }

  // curvas demasiado cerradas
  let minRadius = Infinity, minAt = null;
  for (let i = 0; i < N; i++) {
    const a = samples[i].ang, b = samples[(i + 1) % N].ang;
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const r = Math.abs(d) < 1e-6 ? Infinity : SPACING / Math.abs(d);
    if (r < minRadius) { minRadius = r; minAt = samples[i]; }
  }
  if (minRadius < halfW + 10) {
    problems.push(`curva demasiado cerrada (radio ${minRadius.toFixed(0)}px, mínimo ${halfW + 10}) en (${minAt.x.toFixed(0)}, ${minAt.y.toFixed(0)})`);
  }

  // fracciones válidas y sin solapes con la parrilla (últimos ~7% del recorrido)
  const frac = (v, what) => { if (!(v >= 0 && v < 1)) problems.push(`${what} fuera de rango: ${v}`); };
  for (const f of def.boxes) frac(f, 'caja');
  for (const f of def.pads || []) frac(f, 'panel turbo');
  for (const f of def.features || []) {
    frac(f.at, f.type);
    const end = f.at + f.length / (N * SPACING);
    if (end > 0.93) problems.push(`${f.type} en ${f.at} invade la parrilla de salida`);
    for (const b of def.boxes) if (b > f.at - 0.01 && b < end + (f.type === 'ramp' ? 0.1 : 0.01)) problems.push(`caja en ${b} cae sobre ${f.type} (${f.at})`);
    for (const p of def.pads || []) if (p > f.at - 0.01 && p < end + (f.type === 'ramp' ? 0.1 : 0.01)) problems.push(`panel turbo en ${p} cae sobre ${f.type} (${f.at})`);
  }
  for (const b of def.barriers || []) { frac(b.from, 'barrera'); frac(b.to, 'barrera'); if (!['both', 'outer'].includes(b.side)) problems.push(`barrera con lado desconocido: ${b.side}`); }

  const len = N * SPACING;
  const status = problems.length ? 'PROBLEMAS' : 'OK';
  console.log(`${def.name}: ${status} — longitud ${len}px, ${N} muestras, separación mínima entre tramos ${worst.toFixed(0)}px, radio mínimo ${minRadius.toFixed(0)}px`);
  for (const p of problems) console.log(`   - ${p}`);
  if (problems.length) ok = false;
}

process.exit(ok ? 0 : 1);
