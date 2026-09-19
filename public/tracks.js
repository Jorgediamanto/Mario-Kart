/*
 * Circuitos de Kart Party (versión 3D).
 * Cada circuito es una lista de puntos de control (línea central, en orden de carrera)
 * que se suaviza con una spline Catmull-Rom cerrada. El punto 0 es la línea de meta.
 * Coordenadas del plano en 1920x1080 (la parrilla de salida queda justo antes del punto 0).
 *
 *  - features: relieve a lo largo del recorrido. `at` es la fracción del circuito donde empieza,
 *    `length` en píxeles. 'hill' = lomo suave (los karts saltan un poco si van rápido),
 *    'ramp' = rampa que sube y termina en un corte: salto grande.
 *  - pads: fracciones con panel turbo. boxes: fracciones con cajas de objetos.
 *  - barriers: tramos con bumpers elásticos en los bordes ('both' o 'outer' = solo el lado de fuera de la curva).
 *  - gravity: multiplicador (menos = saltos más largos y flotantes).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KART_TRACKS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    {
      /*
       * Arcoíris — el circuito de la fiesta: el primero de la lista y el más largo.
       *
       * Está hecho contra las quejas del dueño: la carretera era estrecha, te salías todo el rato,
       * el circuito se acababa enseguida y el trazado (tres rectas unidas por horquillas de 180º)
       * no parecía un circuito. Aquí la carretera mide 260 (el doble que en los otros), hay
       * **quitamiedos en los dos lados de todo el recorrido** (no te puedes salir rodando: rebotas
       * y sigues) y el trazado mide 15.728 px en un mundo propio (), mucho más grande.
       *
       * Forma: un circuito de carreras de verdad, con curvas de todos los tipos enlazadas —
       * recta de meta larguísima con la meta en mitad, curvón rapidísimo, barrido, dos curvas
       * medias, una cerrada de verdad (radio ~190) y un sector rápido de vuelta a meta. Se generó
       * con un script (polígono alrededor de un centro con las esquinas redondeadas: radio grande
       * = curva rápida, pequeño = cerrada) y se validó antes de pegarlo aquí.
       *
       * Los puntos están repartidos cada 120 px **a propósito**: la spline es Catmull-Rom uniforme
       * y con espaciados dispares se pasa de frenada en las transiciones y salen radios de 37 px
       * donde tocan 200. Si tocas el trazado, mantén ese reparto y pasa 
> kart-party@1.0.0 check
> node tools/check-tracks.js

Chicle: OK — mundo 1920x1080, longitud 3984px, 498 muestras, ancho 110px, separación mínima entre tramos 265px, radio mínimo 67px
Playa Neón: OK — mundo 1920x1080, longitud 4088px, 511 muestras, ancho 110px, separación mínima entre tramos 293px, radio mínimo 91px
Volcán Disco: OK — mundo 1920x1080, longitud 4544px, 568 muestras, ancho 110px, separación mínima entre tramos 255px, radio mínimo 88px
Luna Loca: OK — mundo 1920x1080, longitud 4080px, 510 muestras, ancho 110px, separación mínima entre tramos 312px, radio mínimo 167px
Arcoíris: OK — mundo 3400x1950, longitud 12632px, 1579 muestras, ancho 260px, separación mínima entre tramos 300px, radio mínimo 157px.
       */
      name: 'Arcoíris',
      width: 260,
      gravity: 0.9,            // flota un poco: los saltos son más largos y se caen más suaves
      world: { w: 6550, h: 4050 },
      // al ser el más largo necesita más cajas y paneles que los otros
      boxes: [0.21, 0.28, 0.33, 0.39, 0.45, 0.50, 0.66, 0.75],
      pads: [0.24, 0.36, 0.47, 0.675, 0.77],
      features: [
        { type: 'ramp', at: 0.03, height: 42, length: 210 },     // salto de la recta de meta
        { type: 'hill', at: 0.175, height: 22, length: 280 },    // lomo antes del curvón
        { type: 'ramp', at: 0.525, height: 50, length: 230 },    // el salto grande, por dentro del aro
        { type: 'hill', at: 0.70, height: 18, length: 300 },     // lomo de la rápida del final
        { type: 'ramp', at: 0.805, height: 38, length: 210 },    // último salto antes de la recta de meta
      ],
      // quitamiedos en los dos lados de todo el circuito: aquí no se sale nadie
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      theme: {
        arcoiris: true,                 // la carretera se pinta con todos los colores
        cielo: true,                    // la carretera flota en el vacío: ni terreno ni suelo debajo
        sky: ['#1a0533', '#4a0a6e'], fog: '#2a0a4a',
        ground: '#160a2e', groundAlt: '#241046',
        road: '#2a1150', curb: ['#ffffff', '#ff2d95'], bumper: ['#00e5ff', '#ff2d95'], pad: '#ffe600',
        decor: [
          { kind: 'planet', n: 14 }, { kind: 'rocket', n: 4 },
        ],
        // cosas plantadas sobre la carretera, en su sitio exacto (no al azar como la decoración)
        props: [
          { kind: 'castillo', at: 0.31 },   // se pasa por debajo, a mitad de circuito
          { kind: 'aro', at: 0.548 },       // el aro por el que se vuela en el salto grande
        ],
        palette: ['#ff2d95', '#00e5ff', '#ffe600', '#39ff88', '#b14bff', '#ff6a00'],
        clouds: null,
        sun: null,
        stars: true,
      },
      points: [
        { x: 3149, y: 3761 }, { x: 3031, y: 3784 }, { x: 2913, y: 3805 }, { x: 2793, y: 3819 }, { x: 2673, y: 3825 }, { x: 2553, y: 3823 },
        { x: 2434, y: 3814 }, { x: 2315, y: 3797 }, { x: 2197, y: 3773 }, { x: 2081, y: 3742 }, { x: 1968, y: 3703 }, { x: 1856, y: 3660 },
        { x: 1743, y: 3618 }, { x: 1631, y: 3575 }, { x: 1519, y: 3532 }, { x: 1407, y: 3489 }, { x: 1295, y: 3447 }, { x: 1183, y: 3402 },
        { x: 1077, y: 3347 }, { x: 976, y: 3282 }, { x: 881, y: 3207 }, { x: 795, y: 3124 }, { x: 716, y: 3034 }, { x: 647, y: 2935 },
        { x: 588, y: 2831 }, { x: 539, y: 2722 }, { x: 500, y: 2608 }, { x: 473, y: 2491 }, { x: 456, y: 2372 }, { x: 441, y: 2253 },
        { x: 410, y: 2138 }, { x: 359, y: 2029 }, { x: 298, y: 1925 }, { x: 250, y: 1816 }, { x: 224, y: 1699 }, { x: 222, y: 1579 },
        { x: 242, y: 1461 }, { x: 285, y: 1348 }, { x: 348, y: 1247 }, { x: 430, y: 1159 }, { x: 527, y: 1089 }, { x: 636, y: 1039 },
        { x: 750, y: 1002 }, { x: 865, y: 966 }, { x: 979, y: 930 }, { x: 1094, y: 894 }, { x: 1208, y: 856 }, { x: 1315, y: 802 },
        { x: 1411, y: 731 }, { x: 1495, y: 645 }, { x: 1578, y: 558 }, { x: 1660, y: 471 }, { x: 1742, y: 383 }, { x: 1836, y: 308 },
        { x: 1943, y: 255 }, { x: 2059, y: 226 }, { x: 2179, y: 222 }, { x: 2297, y: 243 }, { x: 2408, y: 289 }, { x: 2513, y: 347 },
        { x: 2618, y: 404 }, { x: 2724, y: 462 }, { x: 2829, y: 519 }, { x: 2934, y: 577 }, { x: 3040, y: 634 }, { x: 3145, y: 692 },
        { x: 3257, y: 734 }, { x: 3376, y: 729 }, { x: 3490, y: 692 }, { x: 3604, y: 654 }, { x: 3718, y: 616 }, { x: 3832, y: 578 },
        { x: 3946, y: 539 }, { x: 4059, y: 501 }, { x: 4173, y: 463 }, { x: 4288, y: 428 }, { x: 4407, y: 418 }, { x: 4525, y: 437 },
        { x: 4635, y: 486 }, { x: 4729, y: 560 }, { x: 4802, y: 655 }, { x: 4849, y: 765 }, { x: 4884, y: 880 }, { x: 4941, y: 985 },
        { x: 5022, y: 1074 }, { x: 5122, y: 1140 }, { x: 5233, y: 1183 }, { x: 5347, y: 1222 }, { x: 5461, y: 1260 }, { x: 5575, y: 1298 },
        { x: 5689, y: 1336 }, { x: 5802, y: 1376 }, { x: 5909, y: 1430 }, { x: 6007, y: 1500 }, { x: 6094, y: 1582 }, { x: 6168, y: 1677 },
        { x: 6227, y: 1781 }, { x: 6270, y: 1893 }, { x: 6296, y: 2010 }, { x: 6306, y: 2130 }, { x: 6297, y: 2249 }, { x: 6274, y: 2367 },
        { x: 6240, y: 2482 }, { x: 6188, y: 2590 }, { x: 6118, y: 2688 }, { x: 6034, y: 2773 }, { x: 5945, y: 2854 }, { x: 5856, y: 2935 },
        { x: 5768, y: 3015 }, { x: 5679, y: 3096 }, { x: 5586, y: 3172 }, { x: 5486, y: 3238 }, { x: 5379, y: 3293 }, { x: 5267, y: 3337 },
        { x: 5152, y: 3369 }, { x: 5034, y: 3392 }, { x: 4916, y: 3415 }, { x: 4798, y: 3439 }, { x: 4680, y: 3462 }, { x: 4563, y: 3485 },
        { x: 4445, y: 3508 }, { x: 4327, y: 3531 }, { x: 4209, y: 3554 }, { x: 4091, y: 3577 }, { x: 3973, y: 3600 }, { x: 3856, y: 3623 },
        { x: 3738, y: 3646 }, { x: 3620, y: 3669 }, { x: 3502, y: 3692 }, { x: 3384, y: 3715 }, { x: 3266, y: 3738 },
      ],
    },
    {
      name: 'Chicle',
      width: 110,
      gravity: 1,
      boxes: [0.2, 0.64, 0.82],
      pads: [0.08, 0.7],
      features: [
        { type: 'hill', at: 0.28, height: 20, length: 260 },
        { type: 'ramp', at: 0.46, height: 34, length: 160 },
        { type: 'hill', at: 0.86, height: 14, length: 200 },
      ],
      barriers: [{ from: 0.22, to: 0.3, side: 'both' }, { from: 0.62, to: 0.68, side: 'outer' }],
      theme: {
        sky: ['#ff7ad9', '#8df6ff'], fog: '#ffb6ec',
        ground: '#86ff3d', groundAlt: '#4fe04a',
        road: '#3a1d7a', curb: ['#ff2d95', '#ffffff'], bumper: ['#ffe600', '#ff2d95'], pad: '#00ffd0',
        pools: { kind: 'water', color: '#37e5ff', count: 4, minR: 40, maxR: 80 },
        decor: [
          { kind: 'candyTree', n: 34 }, { kind: 'mushroom', n: 12 }, { kind: 'balloon', n: 14 },
          { kind: 'lollipop', n: 10 }, { kind: 'rock', n: 8 },
        ],
        palette: ['#ff2d95', '#00e5ff', '#ffe600', '#b14bff', '#ff6a00', '#39ff88'],
        clouds: { color: '#ffffff', n: 9 },
        sun: { color: '#fff176', pos: [1750, 760, -700], r: 70 },
        stars: false,
      },
      points: [
        { x: 500, y: 245 }, { x: 900, y: 230 }, { x: 1300, y: 240 }, { x: 1600, y: 300 },
        { x: 1740, y: 520 }, { x: 1650, y: 760 }, { x: 1400, y: 900 }, { x: 1150, y: 850 },
        { x: 950, y: 700 }, { x: 750, y: 830 }, { x: 500, y: 920 }, { x: 250, y: 800 },
        { x: 190, y: 560 }, { x: 280, y: 330 },
      ],
    },
    {
      name: 'Playa Neón',
      width: 110,
      gravity: 1,
      boxes: [0.18, 0.46, 0.8],
      pads: [0.34, 0.7],
      features: [
        { type: 'hill', at: 0.24, height: 18, length: 240 },
        { type: 'ramp', at: 0.54, height: 36, length: 170 },
        { type: 'hill', at: 0.88, height: 12, length: 180 },
      ],
      barriers: [{ from: 0.12, to: 0.2, side: 'both' }, { from: 0.7, to: 0.78, side: 'outer' }],
      theme: {
        sky: ['#5b00ff', '#ff7a00'], fog: '#ff9ac0',
        ground: '#ffd93d', groundAlt: '#ffb800',
        road: '#0f3d5c', curb: ['#ff6a00', '#ffffff'], bumper: ['#00e5ff', '#ff2d95'], pad: '#39ff88',
        pools: { kind: 'water', color: '#00e5ff', count: 7, minR: 45, maxR: 95 },
        decor: [
          { kind: 'palm', n: 30 }, { kind: 'beachBall', n: 12 }, { kind: 'umbrella', n: 10 },
          { kind: 'rock', n: 8 }, { kind: 'flamingo', n: 8 },
        ],
        palette: ['#ff2d95', '#00e5ff', '#39ff88', '#ffe600', '#ff6a00', '#b14bff'],
        clouds: { color: '#ffc6e8', n: 8 },
        sun: { color: '#ffb300', pos: [300, 520, -1100], r: 120 },
        stars: false,
      },
      points: [
        { x: 500, y: 930 }, { x: 900, y: 950 }, { x: 1300, y: 930 }, { x: 1650, y: 860 },
        { x: 1760, y: 640 }, { x: 1660, y: 420 }, { x: 1420, y: 300 }, { x: 1180, y: 380 },
        { x: 960, y: 520 }, { x: 760, y: 420 }, { x: 560, y: 260 }, { x: 320, y: 250 },
        { x: 180, y: 420 }, { x: 190, y: 640 }, { x: 300, y: 830 },
      ],
    },
    {
      name: 'Volcán Disco',
      width: 110,
      gravity: 1,
      boxes: [0.15, 0.5, 0.75],
      pads: [0.08, 0.6],
      features: [
        { type: 'ramp', at: 0.26, height: 40, length: 170 },
        { type: 'hill', at: 0.44, height: 16, length: 200 },
        { type: 'hill', at: 0.84, height: 22, length: 260 },
      ],
      barriers: [{ from: 0.3, to: 0.46, side: 'both' }, { from: 0.78, to: 0.84, side: 'outer' }],
      theme: {
        sky: ['#2b0040', '#ff3d00'], fog: '#7a1c7a',
        ground: '#7a1fb8', groundAlt: '#4b0a80',
        road: '#1c1c2e', curb: ['#ffea00', '#1a1a1a'], bumper: ['#ff2d95', '#00e5ff'], pad: '#ffea00',
        pools: { kind: 'lava', color: '#ff5e00', color2: '#ffd000', count: 8, minR: 40, maxR: 85 },
        decor: [
          { kind: 'crystal', n: 26 }, { kind: 'rock', n: 18 }, { kind: 'pineTree', n: 14 },
          { kind: 'cactus', n: 8 }, { kind: 'volcano', n: 2 },
        ],
        palette: ['#00e5ff', '#ff2d95', '#ffea00', '#39ff88', '#ff6a00', '#b14bff'],
        clouds: { color: '#ff8a65', n: 6 },
        sun: { color: '#ff3d00', pos: [1600, 600, -1100], r: 90 },
        stars: true,
      },
      points: [
        { x: 450, y: 250 }, { x: 900, y: 230 }, { x: 1350, y: 250 }, { x: 1680, y: 350 },
        { x: 1760, y: 600 }, { x: 1720, y: 790 }, { x: 1630, y: 915 }, { x: 1520, y: 935 },
        { x: 1430, y: 860 }, { x: 1410, y: 760 }, { x: 1405, y: 690 }, { x: 1388, y: 625 },
        { x: 1340, y: 577 }, { x: 1275, y: 560 }, { x: 1210, y: 577 }, { x: 1162, y: 625 },
        { x: 1145, y: 690 }, { x: 1140, y: 760 }, { x: 1115, y: 860 }, { x: 1020, y: 935 },
        { x: 750, y: 950 }, { x: 400, y: 900 }, { x: 190, y: 720 }, { x: 170, y: 470 },
        { x: 260, y: 300 },
      ],
    },
    {
      name: 'Luna Loca',
      width: 110,
      gravity: 0.55,
      boxes: [0.16, 0.5, 0.8],
      pads: [0.06, 0.42, 0.72],
      features: [
        { type: 'ramp', at: 0.2, height: 26, length: 180 },
        { type: 'hill', at: 0.34, height: 18, length: 220 },
        { type: 'ramp', at: 0.56, height: 28, length: 190 },
        { type: 'hill', at: 0.86, height: 14, length: 200 },
      ],
      barriers: [{ from: 0.26, to: 0.34, side: 'both' }, { from: 0.62, to: 0.7, side: 'both' }],
      theme: {
        sky: ['#03001c', '#1b1464'], fog: '#2a1a6e',
        ground: '#5a7dff', groundAlt: '#3a55d6',
        road: '#eaf6ff', curb: ['#00ffff', '#ff00ff'], bumper: ['#39ff88', '#ffe600'], pad: '#ff2d95',
        pools: { kind: 'crater', color: '#2c3fa8', count: 9, minR: 35, maxR: 90 },
        decor: [
          { kind: 'moonRock', n: 24 }, { kind: 'crystal', n: 20 }, { kind: 'planet', n: 6 },
          { kind: 'flag', n: 6 }, { kind: 'rocket', n: 3 },
        ],
        palette: ['#00ffff', '#ff00ff', '#ffe600', '#39ff88', '#ff6a00', '#ffffff'],
        clouds: null,
        sun: { color: '#8ee3ff', pos: [1500, 820, -1200], r: 150, ring: true },
        stars: true,
      },
      points: [
        { x: 400, y: 230 }, { x: 800, y: 215 }, { x: 1200, y: 215 }, { x: 1600, y: 260 },
        { x: 1780, y: 470 }, { x: 1720, y: 700 }, { x: 1500, y: 860 }, { x: 1200, y: 930 },
        { x: 900, y: 880 }, { x: 650, y: 940 }, { x: 350, y: 900 }, { x: 170, y: 720 },
        { x: 150, y: 460 }, { x: 240, y: 300 },
      ],
    },
  ];
});
