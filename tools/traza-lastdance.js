#!/usr/bin/env node
'use strict';
/*
 * Trazado de «Last Dance» — el circuito monstruo de la jungla, el que dura una vuelta entera de
 * carrera de verdad.
 *
 *   node tools/traza-lastdance.js            # las medidas y el mapa de tramos
 *   node tools/traza-lastdance.js --escribir # + los puntos listos para pegar en tracks.js
 *
 * Forma: una **flor de seis pétalos** alrededor de un centro hueco. Cada pétalo es un lóbulo largo
 * que se va hasta el borde del mundo y vuelve, y entre lóbulo y lóbulo el trazado pasa cerca del
 * centro. Así se consigue una vuelta larguísima sin que el circuito se convierta en una serpiente,
 * y cada pétalo puede ser de un bioma distinto (jungla, hielo, mina, centro de la tierra, cielo).
 *
 * El motor (polígono con esquinas redondeadas, remuestreo y validación) es el mismo de siempre:
 * `tools/traza.js`.
 */

const path = require('path');
const T = require(path.join(__dirname, 'traza.js'));

const ANCHO = 280, MARGEN = 420, ESPACIADO = 140;

/*
 * Forma: un **anillo enorme** alrededor de un mundo gigante, dividido en cinco sectores, uno por
 * bioma (jungla, hielo, mina, centro de la tierra y cielo). No es un círculo: cada sector tiene su
 * carácter — la jungla serpentea, el hielo es rapidísimo, la mina es revirada, el centro de la
 * tierra tiene la curva más cerrada del juego y el cielo es una sucesión de curvones —, y entre
 * sector y sector hay una recta larga que sirve de puerta de un bioma al siguiente.
 *
 * Por qué un anillo y no una flor con pétalos: la longitud que cabe en un espacio manda sobre la
 * forma. Metiendo lóbulos que vuelven al centro salen horquillas de 180º con radios de 50 px, que
 * el validador tira (y con razón: no se pueden tomar). Un anillo gigante da los 80.000 px con
 * curvas anchas y deja cada bioma en su propia zona del mapa, que es lo que se quería.
 */
const SECTORES = [
  // jungla: serpentea entre los árboles
  { nombre: 'jungla', vertices: [
    [0.00, 12600, 2600], [0.16, 11400, 900], [0.30, 12900, 820], [0.44, 11500, 760],
    [0.58, 12800, 900], [0.72, 11800, 1100], [0.86, 12700, 2200],
  ] },
  // hielo: la parte rápida, curvones larguísimos
  { nombre: 'hielo', vertices: [
    [0.00, 13100, 3200], [0.22, 12400, 2600], [0.46, 13200, 3000], [0.70, 12200, 2400], [0.88, 12900, 2800],
  ] },
  // mina: revirada y estrecha de espíritu, con apoyos cortos
  { nombre: 'mina', vertices: [
    [0.00, 12500, 1400], [0.14, 11200, 620], [0.26, 12300, 520], [0.38, 11000, 560],
    [0.52, 12200, 600], [0.66, 10900, 520], [0.80, 12000, 700], [0.92, 12600, 1200],
  ] },
  // centro de la tierra: lo más cerrado del juego, y una recta de escape
  { nombre: 'centro', vertices: [
    [0.00, 12400, 1300], [0.18, 10600, 520], [0.30, 11900, 420], [0.42, 10500, 460],
    [0.60, 12300, 900], [0.78, 11600, 1500], [0.92, 12600, 2000],
  ] },
  // cielo: curvones de subidón, todo abierto
  { nombre: 'cielo', vertices: [
    [0.00, 13000, 3000], [0.25, 12300, 2400], [0.52, 13100, 2800], [0.78, 12500, 2600],
  ] },
];

function spec() {
  const v = [];
  const paso = 360 / SECTORES.length;
  SECTORES.forEach((sec, i) => {
    const base = i * paso;
    for (const [t, r, R] of sec.vertices) {
      v.push({ f: base + paso * t, r, R, nombre: `${sec.nombre} ${(t * 100).toFixed(0)}%` });
    }
  });
  return v;
}

const ESC = Number(process.env.ESC || 1);
const res = T.generar({ spec: spec().map((x) => ({ ...x, r: x.r * ESC })), ancho: ANCHO, esc: 1, ey: 0.78, margen: MARGEN, espaciado: ESPACIADO });
res.points = T.rotarAMeta(res.points, { ancho: ANCHO, W: res.W, H: res.H });
const v = T.validar(res.points, { width: ANCHO, W: res.W, H: res.H });
T.informe({ ...res, v }, spec());
if (process.env.ESCRIBIR || process.argv.includes('--escribir')) {
  const fs = require('fs');
  const destino = process.env.ESCRIBIR || path.join(__dirname, 'puntos-LastDance.txt');
  fs.writeFileSync(destino, T.comoTexto(res.points));
  console.log('puntos escritos en ' + destino);
}
