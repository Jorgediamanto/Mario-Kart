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
