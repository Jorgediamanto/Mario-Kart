#!/usr/bin/env node
'use strict';
/*
 * Trazado de Arcoíris — el circuito grande de la fiesta.
 *
 *   node tools/traza-arcoiris.js            # enseña las medidas y el mapa de tramos
 *   node tools/traza-arcoiris.js --escribir # además deja los puntos listos para pegar en tracks.js
 *
 * El motor (polígono con las esquinas redondeadas, remuestreo y validación) está en
 * `tools/traza.js`, compartido con los otros circuitos. Aquí solo vive **este** circuito.
 */

const path = require('path');
const T = require(path.join(__dirname, 'traza.js'));

const ANCHO = 260, MARGEN = 220, ESPACIADO = 120;

// (f = ángulo alrededor del centro, r = lo lejos que queda ese vértice, R = redondeo de la esquina)
const SPEC = [
  // sector rápido: la recta de meta y el curvón
  { f:  45, r: 2400, R: 1150, nombre: 'salida de meta' },
  { f: 100, r: 2450, R: 1900, nombre: 'curvón rapidísimo' },
  { f: 140, r: 2350, R: 1250, nombre: 'barrido largo' },
  // sector medio: curvas de verdad, para frenar y derrapar
  { f: 172, r: 1900, R:  520, nombre: 'media (izquierda)' },
  { f: 200, r: 2400, R:  430, nombre: 'media cerrada (derecha)' },
  { f: 228, r: 1850, R:  520, nombre: 'media rápida' },
  // sector técnico: el zigzag y la cerrada
  { f: 252, r: 2400, R:  420, nombre: 'apoyo' },
  { f: 276, r: 1450, R:  260, nombre: 'la cerrada de verdad' },
  { f: 300, r: 2350, R:  400, nombre: 'salida de la cerrada' },
  { f: 322, r: 1700, R:  380, nombre: 'enlace' },
  // sector rápido de vuelta a meta
  { f: 350, r: 2450, R: 1500, nombre: 'barrido rapidísimo' },
  { f:  20, r: 2400, R: 1250, nombre: 'rápida' },
];

const ESC = Number(process.env.ESC || 1.4);   // lo grande que sale el circuito
const res = T.generar({ spec: SPEC, ancho: ANCHO, esc: ESC, margen: MARGEN, espaciado: ESPACIADO });
T.informe(res, SPEC);

if (process.env.ESCRIBIR || process.argv.includes('--escribir')) {
  const fs = require('fs');
  const destino = process.env.ESCRIBIR || path.join(__dirname, 'arcoiris-puntos.txt');
  fs.writeFileSync(destino, T.comoTexto(res.points));
  console.log('puntos escritos en ' + destino);
}
