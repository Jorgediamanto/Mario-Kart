#!/usr/bin/env node
'use strict';
/*
 * Trazados de los dos circuitos monstruo nuevos, los hermanos de «Last Dance»:
 *
 *   node tools/traza-mundos.js                          # las medidas de los dos
 *   node tools/traza-mundos.js "Bajo la Cama"           # solo uno, con su mapa de tramos
 *   node tools/traza-mundos.js "Mundo Pixel" --escribir # + los puntos listos para pegar
 *
 * Misma receta que Last Dance (`tools/traza-lastdance.js`): un **anillo enorme** partido en cinco
 * sectores, uno por bioma, cada uno con su carácter. La forma no es un círculo: cada sector tira
 * de la carretera hacia dentro o hacia fuera y redondea sus esquinas con un radio distinto, así que
 * uno serpentea, otro es rapidísimo y otro va a base de apoyos cortos.
 *
 * Por qué un anillo y no algo más retorcido: la longitud que cabe en un espacio manda sobre la
 * forma. Con lóbulos que vuelven al centro salen horquillas de radio 50 que el validador tira (y
 * con razón: no se pueden tomar). El anillo da los 60.000 px con curvas que se pueden pasar de
 * verdad y deja cada bioma en su propia zona del mapa.
 *
 * Ojo con el ancho: estos dos miden **500** de carretera (en los tramos de dos caminos la franja
 * de en medio se lleva 200 y quedan dos calzadas de 150). Eso le pide al validador radios de 260 y
 * 530 px de separación entre tramos, así que ningún redondeo baja de 460.
 */

const path = require('path');
const T = require(path.join(__dirname, 'traza.js'));

const MUNDOS = {
  /*
   * Bajo la Cama — la casa a tamaño de juguete. Del salón a la cocina, de la nevera al baño y del
   * baño al desván. El salón y la nevera son las partes rápidas; la cocina va de apoyo en apoyo y
   * el baño tiene lo más cerrado del circuito.
   */
  'Bajo la Cama': {
    ancho: 500, espaciado: 140, margen: 430, ey: 0.78,
    sectores: [
      { nombre: 'salón', vertices: [
        [0.00, 12800, 2600], [0.20, 11900, 1500], [0.42, 12900, 2200], [0.66, 11700, 1200], [0.86, 12600, 2400],
      ] },
      { nombre: 'cocina', vertices: [
        [0.00, 12400, 900], [0.12, 10900, 560], [0.24, 12200, 500], [0.36, 10800, 540],
        [0.50, 12100, 520], [0.63, 10900, 500], [0.76, 12000, 560], [0.90, 12500, 1000],
      ] },
      { nombre: 'nevera', vertices: [
        [0.00, 13100, 3000], [0.26, 12300, 2400], [0.54, 13200, 2800], [0.80, 12400, 2200],
      ] },
      { nombre: 'baño', vertices: [
        [0.00, 12300, 1100], [0.15, 10600, 500], [0.28, 11800, 460], [0.41, 10500, 470],
        [0.55, 11900, 520], [0.70, 11000, 480], [0.84, 11900, 620], [0.94, 12600, 1400],
      ] },
      { nombre: 'desván', vertices: [
        [0.00, 12900, 2600], [0.24, 12000, 1600], [0.50, 13000, 2600], [0.76, 12200, 1800],
      ] },
    ],
  },
  /*
   * Mundo Pixel — por dentro de un videojuego: los 8 bits, el tetris, el glitch, la placa base y
   * el menú. El sector del glitch mezcla a propósito radios que no pegan ni con cola (un curvón
   * larguísimo seguido de un apoyo cortísimo): es el tramo que no se aprende nunca.
   */
  'Mundo Pixel': {
    ancho: 500, espaciado: 140, margen: 430, ey: 0.76,
    sectores: [
      { nombre: '8 bits', vertices: [
        [0.00, 13000, 900], [0.25, 12600, 700], [0.50, 13100, 700], [0.75, 12500, 800],
      ] },
      { nombre: 'tetris', vertices: [
        [0.00, 12600, 600], [0.14, 11200, 520], [0.27, 12500, 500], [0.40, 11100, 500],
        [0.53, 12400, 500], [0.66, 11100, 500], [0.79, 12400, 520], [0.92, 12700, 800],
      ] },
      { nombre: 'glitch', vertices: [
        [0.00, 13200, 2200], [0.18, 10900, 520], [0.34, 12800, 1800], [0.52, 11100, 560],
        [0.70, 13100, 1400], [0.88, 12000, 900],
      ] },
      { nombre: 'placa base', vertices: [
        [0.00, 12500, 700], [0.17, 11300, 540], [0.34, 12400, 520], [0.50, 11200, 520],
        [0.66, 12400, 540], [0.83, 11400, 620], [0.94, 12600, 900],
      ] },
      { nombre: 'menú', vertices: [
        [0.00, 13300, 3200], [0.30, 12500, 2600], [0.62, 13300, 3000], [0.84, 12600, 2400],
      ] },
    ],
  },
};

function spec(sectores) {
  const v = [];
  const paso = 360 / sectores.length;
  sectores.forEach((sec, i) => {
    const base = i * paso;
    for (const [t, r, R] of sec.vertices) {
      v.push({ f: base + paso * t, r, R, nombre: `${sec.nombre} ${(t * 100).toFixed(0)}%` });
    }
  });
  return v;
}

function hacer(nombre, escribir) {
  const c = MUNDOS[nombre];
  const s = spec(c.sectores);
  const res = T.generar({ spec: s, ancho: c.ancho, esc: 1, ey: c.ey, margen: c.margen, espaciado: c.espaciado });
  res.points = T.rotarAMeta(res.points, { ancho: c.ancho, W: res.W, H: res.H });
  const v = T.validar(res.points, { width: c.ancho, W: res.W, H: res.H });
  console.log(`\n=== ${nombre} ===`);
  T.informe({ ...res, v }, s);
  /*
   * En qué fracción de vuelta empieza cada sector. La lista de puntos se gira para que la meta
   * caiga en mitad de la recta más larga, así que los sectores **no** empiezan en 0,2 - 0,4 - 0,6:
   * esto dice dónde caen de verdad, que es lo que hay que escribir en `biomas` de tracks.js.
   */
  const N = res.points.length;
  const frac = (vv) => {
    const px = vv.x + res.dx, py = vv.y + res.dy;
    let mejor = 0, d0 = Infinity;
    res.points.forEach((q, i) => { const d = Math.hypot(q.x - px, q.y - py); if (d < d0) { d0 = d; mejor = i; } });
    return mejor / N;
  };
  console.log('sectores (fracción de vuelta en la que empieza cada uno):');
  let k = 0;
  for (const sec of c.sectores) {
    console.log(`  ${sec.nombre.padEnd(12)} ${frac(res.V[k]).toFixed(3)}`);
    k += sec.vertices.length;
  }
  if (escribir) {
    const fs = require('fs');
    const destino = path.join(__dirname, 'puntos-' + nombre.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '') + '.txt');
    fs.writeFileSync(destino, T.comoTexto(res.points));
    console.log('puntos escritos en ' + destino);
  }
}

const args = process.argv.slice(2).filter((a) => a !== '--escribir');
const escribir = process.argv.includes('--escribir');
const lista = args.length ? args : Object.keys(MUNDOS);
for (const n of lista) {
  if (!MUNDOS[n]) { console.log(`No existe «${n}». Hay: ${Object.keys(MUNDOS).join(', ')}`); process.exit(1); }
  hacer(n, escribir);
}
