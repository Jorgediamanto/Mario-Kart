#!/usr/bin/env node
'use strict';
/*
 * Trazados de los cuatro circuitos pequeños (todos menos Arcoíris, que tiene el suyo).
 *
 *   node tools/traza-circuitos.js                     # las medidas de los cuatro
 *   node tools/traza-circuitos.js Chicle              # solo uno, con su mapa de tramos
 *   node tools/traza-circuitos.js Chicle --escribir   # + los puntos listos para pegar en tracks.js
 *
 * El motor está en `tools/traza.js`. Aquí solo viven los circuitos: cada uno es una tabla de
 * vértices en polar alrededor de un centro (f = ángulo, r = lo lejos que queda, R = redondeo de la
 * esquina) más su ancho de carretera y lo grande que sale (`esc`).
 *
 * La idea, la misma que en Arcoíris: **se juega viendo desde detrás del kart**, así que la
 * carretera tiene que ser ancha, las curvas tienen que verse venir y una vuelta tiene que durar
 * entre 25 y 60 s (antes duraban 9-12 s y el circuito se acababa antes de aprendértelo).
 */

const path = require('path');
const T = require(path.join(__dirname, 'traza.js'));

const CIRCUITOS = {
  /*
   * Chicle — el circuito fácil, el de aprender: mucha recta, curvas abiertas y una sola chicane.
   * No tiene ninguna curva cerrada de verdad: se puede dar la vuelta entera sin levantar el pie.
   */
  'Chicle': {
    ancho: 200, esc: 1.25, ey: 0.60,
    spec: [
      { f:  42, r: 2050, R: 1000, nombre: 'salida de meta' },
      { f:  96, r: 2100, R: 1500, nombre: 'curvón del caramelo' },
      { f: 140, r: 1980, R:  900, nombre: 'barrido largo' },
      { f: 172, r: 1560, R:  470, nombre: 'chicane (entrada)' },
      { f: 198, r: 2050, R:  430, nombre: 'chicane (salida)' },
      { f: 228, r: 1620, R:  560, nombre: 'media del chupachups' },
      { f: 262, r: 2080, R:  760, nombre: 'rápida de enlace' },
      { f: 296, r: 1430, R:  480, nombre: 'la lenta de la piruleta' },
      { f: 328, r: 2020, R:  900, nombre: 'salida hacia la recta' },
      { f:   6, r: 2100, R: 1300, nombre: 'barrido de vuelta a meta' },
    ],
  },
  /*
   * Playa Neón — el paseo marítimo: una recta larguísima frente al mar y curvas de todo tipo al
   * volver, con una horquilla junto a las palmeras.
   */
  'Playa Neón': {
    ancho: 200, esc: 1.25, ey: 0.56,
    spec: [
      { f:  38, r: 2150, R: 1200, nombre: 'salida del paseo' },
      { f: 104, r: 2200, R: 1800, nombre: 'el curvón del mar' },
      { f: 146, r: 2050, R:  820, nombre: 'barrido de las palmeras' },
      { f: 178, r: 1500, R:  400, nombre: 'la horquilla de la sombrilla' },
      { f: 206, r: 2150, R:  520, nombre: 'media de vuelta al agua' },
      { f: 238, r: 1700, R:  600, nombre: 'ese de la arena' },
      { f: 266, r: 2150, R:  620, nombre: 'apoyo del chiringuito' },
      { f: 300, r: 1380, R:  420, nombre: 'la cerrada del flamenco' },
      { f: 334, r: 2100, R: 1000, nombre: 'salida a la recta' },
      { f:   4, r: 2150, R: 1400, nombre: 'rápida de meta' },
    ],
  },
  /*
   * Volcán Disco — el técnico: curvas medias y cerradas encadenadas, poca recta para descansar.
   * Es el circuito donde el derrape de nivel 3 se gana curva a curva.
   */
  'Volcán Disco': {
    ancho: 180, esc: 1.3, ey: 0.58,
    spec: [
      { f:  40, r: 2000, R:  850, nombre: 'salida de meta' },
      { f:  92, r: 2050, R: 1000, nombre: 'rápida del cráter' },
      { f: 128, r: 1480, R:  300, nombre: 'media de la lava' },
      { f: 156, r: 2050, R:  250, nombre: 'la cerrada del humo' },
      { f: 184, r: 1600, R:  290, nombre: 'zigzag (izquierda)' },
      { f: 210, r: 2050, R:  250, nombre: 'zigzag (derecha)' },
      { f: 238, r: 1480, R:  210, nombre: 'la horquilla del volcán' },
      { f: 266, r: 2000, R:  310, nombre: 'apoyo de la bola de espejos' },
      { f: 296, r: 1420, R:  270, nombre: 'media del baile' },
      { f: 326, r: 2000, R:  520, nombre: 'salida hacia la recta' },
      { f:   4, r: 2050, R: 1100, nombre: 'barrido de meta' },
    ],
  },
  /*
   * Luna Loca — el de la gravedad baja: rectas larguísimas y curvones para volar lejos en cada
   * salto. Las curvas son abiertas a propósito, porque ahí arriba se cae despacio.
   */
  'Luna Loca': {
    ancho: 220, esc: 1.25, ey: 0.58,
    spec: [
      { f:  44, r: 2150, R: 1300, nombre: 'salida del cráter grande' },
      { f: 100, r: 2200, R: 1900, nombre: 'curvón de la Tierra' },
      { f: 148, r: 2050, R: 1000, nombre: 'barrido de los cristales' },
      { f: 186, r: 1650, R:  520, nombre: 'media del cohete' },
      { f: 216, r: 2150, R:  560, nombre: 'rápida del mar de la tranquilidad' },
      { f: 252, r: 1480, R:  440, nombre: 'la cerrada de la bandera' },
      { f: 288, r: 2150, R:  700, nombre: 'enlace de las rocas' },
      { f: 322, r: 1530, R:  620, nombre: 'media del salto largo' },
      { f: 356, r: 2200, R: 1500, nombre: 'recta de vuelta a casa' },
    ],
  },
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const escribir = process.argv.includes('--escribir');
const nombres = args.length ? args : Object.keys(CIRCUITOS);

for (const nombre of nombres) {
  const c = CIRCUITOS[nombre];
  if (!c) { console.log(`no conozco «${nombre}» (hay: ${Object.keys(CIRCUITOS).join(', ')})`); process.exitCode = 1; continue; }
  console.log(`\n=== ${nombre} (ancho ${c.ancho}) ===`);
  const res = T.generar({ spec: c.spec, ancho: c.ancho, esc: c.esc, ey: c.ey, margen: c.margen || 220, espaciado: c.espaciado || 120 });
  T.informe(res, c.spec);
  if (escribir) {
    const fs = require('fs');
    const destino = path.join(__dirname, `puntos-${nombre.replace(/[^a-zA-Z]/g, '')}.txt`);
    fs.writeFileSync(destino, T.comoTexto(res.points));
    console.log('puntos escritos en ' + destino);
  }
}
