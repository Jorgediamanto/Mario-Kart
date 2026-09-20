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
       * y sigues) y el trazado mide 15.936 px en un mundo propio (), mucho más grande.
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
      world: { w: 6650, h: 4100 },
      // al ser el más largo necesita más cajas y paneles que los otros
      boxes: [0.21, 0.28, 0.33, 0.39, 0.46, 0.51, 0.67, 0.76],
      pads: [0.25, 0.36, 0.44, 0.68, 0.77],
      features: [
        // Los saltos son de verdad: lo que manda no es lo alto que sube la rampa, sino lo **empinada**
        // que es (altura entre longitud) y el turbo de salto que da al despegar (RAMPA_TURBO).
        { type: 'ramp', at: 0.03, height: 80, length: 150 },     // salto de la recta de meta
        { type: 'hill', at: 0.165, height: 26, length: 300 },    // lomo antes del curvón
        { type: 'ramp', at: 0.53, height: 110, length: 170 },    // el salto grande, por dentro del aro
        { type: 'hill', at: 0.71, height: 22, length: 320 },     // lomo de la rápida del final
        { type: 'ramp', at: 0.808, height: 85, length: 160 },    // último salto antes de la recta de meta
      ],
      /*
       * El sube y baja del circuito: alturas repartidas por la vuelta, que la simulación une con
       * transiciones suaves. Las cuestas rondan el 5 % (la de 0,26 a 0,37 llega al 10 %, que es la
       * subida gorda), y el salto grande cae justo en plena bajada, para volar más.
       */
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.12, h: 110 }, { at: 0.26, h: 40 }, { at: 0.37, h: 210 },
        { at: 0.48, h: 150 }, { at: 0.56, h: 20 }, { at: 0.68, h: -80 }, { at: 0.80, h: 0 },
        { at: 0.90, h: 80 },
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
          { kind: 'castillo', at: 0.32 },   // se pasa por debajo, a mitad de circuito
          { kind: 'aro', at: 0.555 },       // el aro por el que se vuela en el salto grande
        ],
        palette: ['#ff2d95', '#00e5ff', '#ffe600', '#39ff88', '#b14bff', '#ff6a00'],
        clouds: null,
        sun: null,
        stars: true,
      },
      points: [
        { x: 3249, y: 3795 }, { x: 3132, y: 3818 }, { x: 3014, y: 3839 }, { x: 2895, y: 3853 }, { x: 2775, y: 3859 }, { x: 2655, y: 3858 },
        { x: 2536, y: 3849 }, { x: 2417, y: 3833 }, { x: 2300, y: 3810 }, { x: 2184, y: 3779 }, { x: 2070, y: 3740 }, { x: 1958, y: 3698 },
        { x: 1846, y: 3655 }, { x: 1735, y: 3612 }, { x: 1623, y: 3570 }, { x: 1511, y: 3527 }, { x: 1399, y: 3485 }, { x: 1287, y: 3440 },
        { x: 1180, y: 3386 }, { x: 1079, y: 3322 }, { x: 985, y: 3249 }, { x: 897, y: 3166 }, { x: 819, y: 3076 }, { x: 749, y: 2979 },
        { x: 688, y: 2875 }, { x: 638, y: 2767 }, { x: 599, y: 2654 }, { x: 570, y: 2537 }, { x: 553, y: 2419 }, { x: 540, y: 2300 },
        { x: 514, y: 2183 }, { x: 462, y: 2075 }, { x: 401, y: 1972 }, { x: 340, y: 1869 }, { x: 278, y: 1766 }, { x: 233, y: 1655 },
        { x: 220, y: 1537 }, { x: 240, y: 1419 }, { x: 292, y: 1311 }, { x: 371, y: 1222 }, { x: 472, y: 1158 }, { x: 586, y: 1119 },
        { x: 700, y: 1083 }, { x: 814, y: 1047 }, { x: 928, y: 1011 }, { x: 1043, y: 975 }, { x: 1157, y: 939 }, { x: 1271, y: 903 },
        { x: 1383, y: 859 }, { x: 1482, y: 792 }, { x: 1566, y: 707 }, { x: 1648, y: 620 }, { x: 1730, y: 532 }, { x: 1812, y: 445 },
        { x: 1894, y: 358 }, { x: 1986, y: 282 }, { x: 2096, y: 235 }, { x: 2215, y: 220 }, { x: 2333, y: 240 }, { x: 2441, y: 290 },
        { x: 2546, y: 347 }, { x: 2651, y: 405 }, { x: 2757, y: 462 }, { x: 2862, y: 520 }, { x: 2967, y: 577 }, { x: 3072, y: 634 },
        { x: 3177, y: 692 }, { x: 3283, y: 749 }, { x: 3398, y: 776 }, { x: 3515, y: 751 }, { x: 3628, y: 713 }, { x: 3742, y: 675 },
        { x: 3855, y: 636 }, { x: 3969, y: 598 }, { x: 4083, y: 560 }, { x: 4196, y: 522 }, { x: 4310, y: 484 }, { x: 4423, y: 446 },
        { x: 4542, y: 429 }, { x: 4660, y: 449 }, { x: 4766, y: 502 }, { x: 4853, y: 584 }, { x: 4911, y: 688 }, { x: 4945, y: 803 },
        { x: 4978, y: 918 }, { x: 5026, y: 1028 }, { x: 5106, y: 1117 }, { x: 5209, y: 1177 }, { x: 5322, y: 1216 }, { x: 5436, y: 1254 },
        { x: 5549, y: 1292 }, { x: 5663, y: 1330 }, { x: 5777, y: 1368 }, { x: 5889, y: 1410 }, { x: 5994, y: 1467 }, { x: 6091, y: 1537 },
        { x: 6177, y: 1621 }, { x: 6250, y: 1715 }, { x: 6310, y: 1819 }, { x: 6354, y: 1931 }, { x: 6382, y: 2047 }, { x: 6394, y: 2166 },
        { x: 6390, y: 2286 }, { x: 6369, y: 2403 }, { x: 6335, y: 2518 }, { x: 6283, y: 2626 }, { x: 6213, y: 2723 }, { x: 6129, y: 2808 },
        { x: 6040, y: 2889 }, { x: 5952, y: 2970 }, { x: 5863, y: 3050 }, { x: 5774, y: 3131 }, { x: 5682, y: 3207 }, { x: 5582, y: 3273 },
        { x: 5475, y: 3328 }, { x: 5364, y: 3372 }, { x: 5248, y: 3403 }, { x: 5131, y: 3427 }, { x: 5013, y: 3450 }, { x: 4896, y: 3473 },
        { x: 4778, y: 3496 }, { x: 4661, y: 3519 }, { x: 4543, y: 3542 }, { x: 4425, y: 3565 }, { x: 4308, y: 3588 }, { x: 4190, y: 3611 },
        { x: 4073, y: 3634 }, { x: 3955, y: 3657 }, { x: 3837, y: 3680 }, { x: 3720, y: 3703 }, { x: 3602, y: 3726 }, { x: 3485, y: 3749 },
        { x: 3367, y: 3772 },
      ],
    },
    {
      /*
       * Last Dance — el circuito monstruo, el del final de la fiesta.
       *
       * Una vuelta de 72.900 px (casi cinco veces Arcoíris, unos tres minutos), un anillo enorme
       * dividido en **cinco biomas**, uno por sector: jungla, hielo, mina, centro de la tierra y
       * cielo. Cada bioma tiene su color de asfalto, su terreno, su niebla y sus bichos, y se
       * enlazan con rectas largas que hacen de puerta.
       *
       * Lo que lo hace distinto de los demás:
       *  - **dos caminos**: en cinco tramos la carretera va partida por una pared por el medio
       *    (`paredes`), y hay que elegir lado; donde la pared se corta, se puede cambiar;
       *  - **saltos por todas partes** y un relieve que baja hasta −900 en el centro de la tierra y
       *    sube a +1.150 en el cielo;
       *  - **tres habilidades propias** que solo salen aquí (`itemsExtra`): la liana 🌿, el
       *    terremoto 🌋 y el portal 🌀. Son gordas a propósito.
       *
       * El trazado se genera con `node tools/traza-lastdance.js`.
       */
      name: 'Last Dance',
      /*
       * 400 de ancho, el más ancho del juego a propósito: en los tramos partidos la pared se lleva
       * 90 y quedan **dos carriles de 155** (antes eran de 85: no se podía ni adelantar ni elegir
       * nada, la pared te llevaba en volandas). El validador aguanta: la curva más cerrada del
       * circuito tiene 287 px de radio y hacen falta 210.
       */
      width: 400,
      gravity: 0.92,
      world: { w: 25250, h: 20350 },
      // una sola vuelta: con tres minutos por vuelta, tres serían una maratón
      vueltas: 1,
      // los objetos de la casa, que solo salen en este circuito
      itemsExtra: [
        { id: 'liana', peso: 2.6, desde: 2 },
        { id: 'terremoto', peso: 2.0, desde: 3 },
        { id: 'portal', peso: 2.2, desde: 2 },
      ],
      boxes: [
        0.020, 0.075, 0.115, 0.170, 0.205, 0.245, 0.300, 0.325, 0.375, 0.415,
        0.455, 0.495, 0.545, 0.585, 0.640, 0.680, 0.730, 0.755, 0.810, 0.855, 0.885, 0.930,
      ],
      pads: [0.065, 0.13, 0.22, 0.31, 0.39, 0.46, 0.56, 0.645, 0.735, 0.82, 0.92, 0.96],
      features: [
        // jungla
        { type: 'ramp', at: 0.045, height: 90, length: 170 },
        { type: 'hill', at: 0.09, height: 26, length: 320 },
        { type: 'ramp', at: 0.145, height: 105, length: 180 },
        // hielo
        { type: 'hill', at: 0.235, height: 22, length: 340 },
        { type: 'ramp', at: 0.275, height: 95, length: 170 },
        { type: 'ramp', at: 0.345, height: 115, length: 185 },
        // mina
        { type: 'hill', at: 0.435, height: 28, length: 300 },
        { type: 'ramp', at: 0.475, height: 85, length: 160 },
        { type: 'ramp', at: 0.525, height: 100, length: 175 },
        // centro de la tierra
        { type: 'ramp', at: 0.615, height: 120, length: 190 },
        { type: 'hill', at: 0.665, height: 30, length: 320 },
        { type: 'ramp', at: 0.705, height: 95, length: 170 },
        // cielo
        { type: 'ramp', at: 0.785, height: 130, length: 195 },
        { type: 'hill', at: 0.845, height: 24, length: 340 },
        { type: 'ramp', at: 0.905, height: 110, length: 180 },
      ],
      /*
       * El sube y baja: se entra por la jungla a nivel del mar, el hielo está en lo alto de la
       * montaña, la mina empieza a bajar, el centro de la tierra está a −900 y del pozo se sale
       * disparado hasta el cielo, a +1.150, antes de volver a la jungla.
       */
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.08, h: 120 }, { at: 0.16, h: 60 },
        { at: 0.24, h: 420 }, { at: 0.32, h: 520 }, { at: 0.38, h: 300 },
        { at: 0.46, h: -180 }, { at: 0.52, h: -420 }, { at: 0.58, h: -700 },
        { at: 0.64, h: -900 }, { at: 0.70, h: -640 }, { at: 0.74, h: -200 },
        { at: 0.80, h: 620 }, { at: 0.86, h: 1150 }, { at: 0.92, h: 700 }, { at: 0.96, h: 260 },
      ],
      // quitamiedos en todo el recorrido: en un circuito así, salirse sería el final
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      /*
       * Los dos caminos: en estos tramos hay una pared por el medio y hay que elegir lado. La
       * pared se corta entre tramo y tramo, que es donde se puede cambiar de camino.
       */
      paredes: [
        // jungla
        { from: 0.050, to: 0.090, ancho: 90 },
        { from: 0.100, to: 0.140, ancho: 90 },
        // hielo
        { from: 0.250, to: 0.290, ancho: 90 },
        { from: 0.300, to: 0.345, ancho: 90 },
        // mina
        { from: 0.440, to: 0.485, ancho: 90 },
        { from: 0.495, to: 0.540, ancho: 90 },
        // centro de la tierra
        { from: 0.620, to: 0.665, ancho: 90 },
        { from: 0.675, to: 0.720, ancho: 90 },
        // cielo
        { from: 0.790, to: 0.835, ancho: 90 },
        { from: 0.845, to: 0.895, ancho: 90 },
      ],
      /*
       * Los cruces: rampas que saltan **por encima** del muro y te dejan en el otro carril. Hay una
       * en cada tramo de muro, siempre pegada a la línea de en medio, así que cruzar es una
       * decisión (por fuera se pasa de largo). Con los huecos entre muro y muro, los dos caminos se
       * entrelazan: se puede ir cambiando toda la vuelta.
       */
      cruces: [
        0.068, 0.120,   // jungla
        0.268, 0.325,   // hielo
        0.458, 0.518,   // mina
        0.640, 0.700,   // centro de la tierra
        0.808, 0.868,   // cielo
      ],
      theme: {
        sky: ['#07220f', '#2fb36a'], fog: '#123a1e',
        ground: '#1f7a3a', groundAlt: '#2fa34f',
        road: '#3b2a1a', curb: ['#ffe600', '#1a1a1a'], bumper: ['#39ff88', '#ffe600'], pad: '#00ffd0',
        /*
         * Los cinco biomas, por tramos del recorrido. Cada uno pinta su asfalto, su terreno, su
         * niebla y su cielo, y trae sus propios bichos. La tele cambia la niebla y el cielo **por
         * panel**, según dónde esté cada jugador: dos personas pueden estar en biomas distintos.
         */
        biomas: [
          { hasta: 0.20, nombre: 'Jungla', road: '#3b2a1a', ground: '#1f7a3a', groundAlt: '#2fa34f',
            fog: '#123a1e', sky: ['#07220f', '#2fb36a'], decor: [{ kind: 'palm', n: 60 }, { kind: 'candyTree', n: 30 }, { kind: 'rock', n: 20 }] },
          { hasta: 0.40, nombre: 'Hielo', road: '#cfeaff', ground: '#dff1ff', groundAlt: '#b6dcf5',
            fog: '#cfe6ff', sky: ['#9fd6ff', '#f2fbff'], decor: [{ kind: 'crystal', n: 55 }, { kind: 'moonRock', n: 25 }, { kind: 'pineTree', n: 30 }] },
          { hasta: 0.58, nombre: 'Mina', road: '#2b2622', ground: '#4a3b2c', groundAlt: '#38302a',
            fog: '#1b1510', sky: ['#0a0806', '#4a3b2c'], decor: [{ kind: 'rock', n: 60 }, { kind: 'crystal', n: 30 }, { kind: 'moonRock', n: 25 }] },
          { hasta: 0.76, nombre: 'Centro de la Tierra', road: '#3a1410', ground: '#6b1f12', groundAlt: '#a3320f',
            fog: '#5a1206', sky: ['#1a0402', '#ff5e00'], decor: [{ kind: 'volcano', n: 10 }, { kind: 'crystal', n: 35 }, { kind: 'rock', n: 35 }] },
          { hasta: 1.01, nombre: 'Cielo', road: '#e8e2ff', ground: '#9fd6ff', groundAlt: '#cfe6ff',
            fog: '#d8ecff', sky: ['#5ab0ff', '#ffffff'], decor: [{ kind: 'balloon', n: 55 }, { kind: 'planet', n: 18 }, { kind: 'rocket', n: 8 }] },
        ],
        decor: [
          { kind: 'palm', n: 40 }, { kind: 'candyTree', n: 20 }, { kind: 'rock', n: 30 },
          { kind: 'crystal', n: 30 }, { kind: 'balloon', n: 20 },
        ],
        /*
         * La cordillera: noventa montañas de `modelos/montanas.glb` repartidas por todo el hueco
         * entre tramos, cada una del color de su bioma. Son lo que hace que un mundo de 25.000 x
         * 20.000 parezca un sitio y no una mesa: desde la carretera siempre hay algo detrás.
         */
        montanas: { n: 90, lejos: 820, banda: 3400, min: 0.9, max: 2.2 },
        props: [
          { kind: 'aro', at: 0.16 },
          { kind: 'arcoRoca', at: 0.50 },
          { kind: 'aroFuego', at: 0.64 },
          { kind: 'anillo', at: 0.87 },
          { kind: 'castillo', at: 0.30 },
        ],
        palette: ['#39ff88', '#ffe600', '#00e5ff', '#ff2d95', '#ff6a00', '#b14bff'],
        clouds: { color: '#ffffff', n: 14 },
        sun: { color: '#fff176', pos: [9000, 3000, -4000], r: 220 },
        stars: false,
      },
      points: [
        { x: 21598, y: 3371 }, { x: 21721, y: 3438 }, { x: 21843, y: 3506 }, { x: 21965, y: 3574 }, { x: 22088, y: 3641 }, { x: 22210, y: 3709 },
        { x: 22333, y: 3777 }, { x: 22452, y: 3849 }, { x: 22568, y: 3928 }, { x: 22680, y: 4012 }, { x: 22788, y: 4101 }, { x: 22891, y: 4196 },
        { x: 22989, y: 4296 }, { x: 23082, y: 4400 }, { x: 23169, y: 4509 }, { x: 23251, y: 4623 }, { x: 23328, y: 4740 }, { x: 23398, y: 4861 },
        { x: 23462, y: 4985 }, { x: 23520, y: 5112 }, { x: 23573, y: 5242 }, { x: 23624, y: 5372 }, { x: 23675, y: 5502 }, { x: 23727, y: 5633 },
        { x: 23778, y: 5763 }, { x: 23829, y: 5893 }, { x: 23881, y: 6023 }, { x: 23932, y: 6153 }, { x: 23983, y: 6283 }, { x: 24035, y: 6414 },
        { x: 24086, y: 6544 }, { x: 24137, y: 6674 }, { x: 24189, y: 6804 }, { x: 24240, y: 6934 }, { x: 24292, y: 7064 }, { x: 24343, y: 7194 },
        { x: 24390, y: 7326 }, { x: 24430, y: 7460 }, { x: 24463, y: 7596 }, { x: 24492, y: 7733 }, { x: 24522, y: 7870 }, { x: 24551, y: 8007 },
        { x: 24581, y: 8143 }, { x: 24610, y: 8280 }, { x: 24640, y: 8417 }, { x: 24669, y: 8554 }, { x: 24699, y: 8690 }, { x: 24728, y: 8827 },
        { x: 24754, y: 8965 }, { x: 24773, y: 9103 }, { x: 24784, y: 9243 }, { x: 24787, y: 9383 }, { x: 24783, y: 9523 }, { x: 24771, y: 9662 },
        { x: 24752, y: 9801 }, { x: 24726, y: 9938 }, { x: 24692, y: 10074 }, { x: 24650, y: 10207 }, { x: 24602, y: 10339 }, { x: 24547, y: 10467 },
        { x: 24485, y: 10593 }, { x: 24416, y: 10714 }, { x: 24341, y: 10832 }, { x: 24259, y: 10946 }, { x: 24172, y: 11056 }, { x: 24085, y: 11165 },
        { x: 23997, y: 11274 }, { x: 23909, y: 11383 }, { x: 23828, y: 11497 }, { x: 23766, y: 11622 }, { x: 23724, y: 11755 }, { x: 23703, y: 11893 },
        { x: 23704, y: 12033 }, { x: 23726, y: 12171 }, { x: 23769, y: 12304 }, { x: 23824, y: 12433 }, { x: 23879, y: 12561 }, { x: 23934, y: 12690 },
        { x: 23989, y: 12819 }, { x: 24044, y: 12947 }, { x: 24096, y: 13077 }, { x: 24127, y: 13213 }, { x: 24136, y: 13353 }, { x: 24120, y: 13492 },
        { x: 24081, y: 13626 }, { x: 24019, y: 13752 }, { x: 23937, y: 13865 }, { x: 23838, y: 13963 }, { x: 23723, y: 14042 }, { x: 23597, y: 14103 },
        { x: 23470, y: 14161 }, { x: 23342, y: 14219 }, { x: 23215, y: 14277 }, { x: 23088, y: 14335 }, { x: 22960, y: 14393 }, { x: 22833, y: 14451 },
        { x: 22706, y: 14510 }, { x: 22578, y: 14568 }, { x: 22456, y: 14635 }, { x: 22347, y: 14723 }, { x: 22257, y: 14829 }, { x: 22188, y: 14951 },
        { x: 22142, y: 15082 }, { x: 22119, y: 15220 }, { x: 22102, y: 15359 }, { x: 22085, y: 15498 }, { x: 22068, y: 15637 }, { x: 22051, y: 15776 },
        { x: 22034, y: 15915 }, { x: 22016, y: 16054 }, { x: 21993, y: 16191 }, { x: 21948, y: 16324 }, { x: 21884, y: 16448 }, { x: 21801, y: 16561 },
        { x: 21702, y: 16659 }, { x: 21588, y: 16741 }, { x: 21464, y: 16804 }, { x: 21331, y: 16848 }, { x: 21195, y: 16883 }, { x: 21060, y: 16918 },
        { x: 20925, y: 16953 }, { x: 20789, y: 16989 }, { x: 20654, y: 17024 }, { x: 20518, y: 17059 }, { x: 20383, y: 17094 }, { x: 20248, y: 17129 },
        { x: 20112, y: 17165 }, { x: 19977, y: 17200 }, { x: 19846, y: 17248 }, { x: 19721, y: 17312 }, { x: 19606, y: 17392 }, { x: 19502, y: 17485 },
        { x: 19408, y: 17589 }, { x: 19316, y: 17694 }, { x: 19224, y: 17800 }, { x: 19132, y: 17905 }, { x: 19040, y: 18011 }, { x: 18948, y: 18116 },
        { x: 18856, y: 18221 }, { x: 18764, y: 18327 }, { x: 18672, y: 18432 }, { x: 18578, y: 18536 }, { x: 18478, y: 18633 }, { x: 18372, y: 18725 },
        { x: 18260, y: 18809 }, { x: 18143, y: 18886 }, { x: 18022, y: 18955 }, { x: 17897, y: 19019 }, { x: 17772, y: 19082 }, { x: 17648, y: 19145 },
        { x: 17523, y: 19208 }, { x: 17398, y: 19272 }, { x: 17273, y: 19335 }, { x: 17148, y: 19398 }, { x: 17022, y: 19459 }, { x: 16894, y: 19514 },
        { x: 16763, y: 19564 }, { x: 16630, y: 19607 }, { x: 16495, y: 19645 }, { x: 16359, y: 19677 }, { x: 16222, y: 19703 }, { x: 16083, y: 19723 },
        { x: 15944, y: 19737 }, { x: 15804, y: 19745 }, { x: 15664, y: 19746 }, { x: 15524, y: 19744 }, { x: 15385, y: 19742 }, { x: 15245, y: 19740 },
        { x: 15105, y: 19738 }, { x: 14965, y: 19736 }, { x: 14825, y: 19734 }, { x: 14685, y: 19732 }, { x: 14545, y: 19730 }, { x: 14405, y: 19728 },
        { x: 14265, y: 19726 }, { x: 14125, y: 19724 }, { x: 13986, y: 19722 }, { x: 13846, y: 19720 }, { x: 13706, y: 19718 }, { x: 13566, y: 19716 },
        { x: 13426, y: 19713 }, { x: 13286, y: 19711 }, { x: 13146, y: 19709 }, { x: 13006, y: 19707 }, { x: 12866, y: 19707 }, { x: 12727, y: 19714 },
        { x: 12587, y: 19724 }, { x: 12447, y: 19734 }, { x: 12308, y: 19744 }, { x: 12168, y: 19753 }, { x: 12029, y: 19763 }, { x: 11889, y: 19773 },
        { x: 11750, y: 19783 }, { x: 11610, y: 19793 }, { x: 11470, y: 19802 }, { x: 11331, y: 19812 }, { x: 11191, y: 19822 }, { x: 11052, y: 19832 },
        { x: 10912, y: 19842 }, { x: 10772, y: 19851 }, { x: 10633, y: 19861 }, { x: 10493, y: 19871 }, { x: 10354, y: 19881 }, { x: 10214, y: 19891 },
        { x: 10075, y: 19900 }, { x: 9935, y: 19910 }, { x: 9795, y: 19918 }, { x: 9655, y: 19919 }, { x: 9516, y: 19914 }, { x: 9376, y: 19902 },
        { x: 9238, y: 19884 }, { x: 9100, y: 19859 }, { x: 8963, y: 19828 }, { x: 8829, y: 19790 }, { x: 8696, y: 19747 }, { x: 8565, y: 19697 },
        { x: 8437, y: 19641 }, { x: 8311, y: 19579 }, { x: 8189, y: 19512 }, { x: 8069, y: 19439 }, { x: 7950, y: 19366 }, { x: 7831, y: 19292 },
        { x: 7712, y: 19219 }, { x: 7593, y: 19145 }, { x: 7473, y: 19072 }, { x: 7354, y: 18999 }, { x: 7235, y: 18925 }, { x: 7116, y: 18852 },
        { x: 6997, y: 18779 }, { x: 6878, y: 18705 }, { x: 6759, y: 18632 }, { x: 6639, y: 18559 }, { x: 6520, y: 18485 }, { x: 6401, y: 18412 },
        { x: 6282, y: 18339 }, { x: 6163, y: 18265 }, { x: 6044, y: 18192 }, { x: 5922, y: 18123 }, { x: 5796, y: 18061 }, { x: 5667, y: 18007 },
        { x: 5536, y: 17959 }, { x: 5405, y: 17911 }, { x: 5273, y: 17863 }, { x: 5142, y: 17815 }, { x: 5010, y: 17767 }, { x: 4879, y: 17719 },
        { x: 4747, y: 17671 }, { x: 4616, y: 17623 }, { x: 4485, y: 17575 }, { x: 4353, y: 17527 }, { x: 4222, y: 17479 }, { x: 4090, y: 17431 },
        { x: 3959, y: 17382 }, { x: 3831, y: 17326 }, { x: 3705, y: 17265 }, { x: 3583, y: 17197 }, { x: 3464, y: 17123 }, { x: 3349, y: 17043 },
        { x: 3238, y: 16958 }, { x: 3132, y: 16867 }, { x: 3030, y: 16771 }, { x: 2933, y: 16670 }, { x: 2842, y: 16564 }, { x: 2755, y: 16454 },
        { x: 2674, y: 16340 }, { x: 2594, y: 16225 }, { x: 2515, y: 16110 }, { x: 2444, y: 15989 }, { x: 2386, y: 15862 }, { x: 2341, y: 15730 },
        { x: 2309, y: 15593 }, { x: 2291, y: 15455 }, { x: 2287, y: 15315 }, { x: 2290, y: 15175 }, { x: 2293, y: 15035 }, { x: 2296, y: 14895 },
        { x: 2298, y: 14755 }, { x: 2301, y: 14616 }, { x: 2304, y: 14476 }, { x: 2307, y: 14336 }, { x: 2309, y: 14196 }, { x: 2290, y: 14058 },
        { x: 2240, y: 13927 }, { x: 2163, y: 13811 }, { x: 2061, y: 13715 }, { x: 1942, y: 13642 }, { x: 1821, y: 13571 }, { x: 1700, y: 13501 },
        { x: 1579, y: 13431 }, { x: 1458, y: 13361 }, { x: 1337, y: 13291 }, { x: 1216, y: 13221 }, { x: 1095, y: 13150 }, { x: 983, y: 13067 },
        { x: 898, y: 12956 }, { x: 845, y: 12827 }, { x: 829, y: 12689 }, { x: 849, y: 12551 }, { x: 906, y: 12423 }, { x: 974, y: 12301 },
        { x: 1042, y: 12179 }, { x: 1110, y: 12056 }, { x: 1178, y: 11934 }, { x: 1246, y: 11812 }, { x: 1314, y: 11690 }, { x: 1371, y: 11562 },
        { x: 1395, y: 11425 }, { x: 1384, y: 11285 }, { x: 1339, y: 11153 }, { x: 1262, y: 11036 }, { x: 1171, y: 10931 }, { x: 1079, y: 10825 },
        { x: 988, y: 10719 }, { x: 896, y: 10613 }, { x: 805, y: 10507 }, { x: 713, y: 10401 }, { x: 622, y: 10295 }, { x: 532, y: 10188 },
        { x: 465, y: 10066 }, { x: 427, y: 9931 }, { x: 422, y: 9792 }, { x: 449, y: 9655 }, { x: 507, y: 9528 }, { x: 592, y: 9418 },
        { x: 693, y: 9321 }, { x: 794, y: 9224 }, { x: 895, y: 9126 }, { x: 996, y: 9029 }, { x: 1096, y: 8932 }, { x: 1197, y: 8835 },
        { x: 1298, y: 8738 }, { x: 1399, y: 8641 }, { x: 1499, y: 8544 }, { x: 1583, y: 8432 }, { x: 1633, y: 8302 }, { x: 1647, y: 8163 },
        { x: 1623, y: 8026 }, { x: 1587, y: 7891 }, { x: 1550, y: 7756 }, { x: 1513, y: 7621 }, { x: 1476, y: 7486 }, { x: 1439, y: 7351 },
        { x: 1402, y: 7216 }, { x: 1366, y: 7081 }, { x: 1329, y: 6946 }, { x: 1292, y: 6811 }, { x: 1259, y: 6675 }, { x: 1251, y: 6535 },
        { x: 1269, y: 6397 }, { x: 1294, y: 6259 }, { x: 1318, y: 6121 }, { x: 1343, y: 5984 }, { x: 1368, y: 5846 }, { x: 1393, y: 5708 },
        { x: 1418, y: 5571 }, { x: 1445, y: 5433 }, { x: 1487, y: 5300 }, { x: 1544, y: 5172 }, { x: 1615, y: 5052 }, { x: 1699, y: 4941 },
        { x: 1797, y: 4840 }, { x: 1902, y: 4748 }, { x: 2008, y: 4657 }, { x: 2114, y: 4566 }, { x: 2227, y: 4483 }, { x: 2348, y: 4413 },
        { x: 2476, y: 4356 }, { x: 2609, y: 4314 }, { x: 2746, y: 4285 }, { x: 2884, y: 4261 }, { x: 3022, y: 4236 }, { x: 3160, y: 4211 },
        { x: 3297, y: 4186 }, { x: 3435, y: 4162 }, { x: 3573, y: 4137 }, { x: 3710, y: 4112 }, { x: 3848, y: 4088 }, { x: 3986, y: 4063 },
        { x: 4124, y: 4038 }, { x: 4261, y: 4014 }, { x: 4399, y: 3989 }, { x: 4537, y: 3964 }, { x: 4674, y: 3939 }, { x: 4812, y: 3915 },
        { x: 4950, y: 3890 }, { x: 5088, y: 3865 }, { x: 5223, y: 3833 }, { x: 5347, y: 3768 }, { x: 5448, y: 3672 }, { x: 5521, y: 3553 },
        { x: 5570, y: 3422 }, { x: 5618, y: 3290 }, { x: 5666, y: 3159 }, { x: 5713, y: 3027 }, { x: 5761, y: 2896 }, { x: 5809, y: 2765 },
        { x: 5857, y: 2633 }, { x: 5906, y: 2502 }, { x: 5983, y: 2386 }, { x: 6093, y: 2301 }, { x: 6225, y: 2257 }, { x: 6365, y: 2259 },
        { x: 6503, y: 2281 }, { x: 6641, y: 2303 }, { x: 6779, y: 2325 }, { x: 6917, y: 2347 }, { x: 7056, y: 2369 }, { x: 7194, y: 2391 },
        { x: 7332, y: 2413 }, { x: 7470, y: 2434 }, { x: 7608, y: 2456 }, { x: 7747, y: 2478 }, { x: 7885, y: 2500 }, { x: 8024, y: 2512 },
        { x: 8160, y: 2484 }, { x: 8282, y: 2416 }, { x: 8383, y: 2320 }, { x: 8482, y: 2221 }, { x: 8581, y: 2122 }, { x: 8680, y: 2023 },
        { x: 8779, y: 1924 }, { x: 8878, y: 1825 }, { x: 8977, y: 1726 }, { x: 9076, y: 1627 }, { x: 9174, y: 1528 }, { x: 9273, y: 1429 },
        { x: 9372, y: 1330 }, { x: 9471, y: 1231 }, { x: 9570, y: 1132 }, { x: 9669, y: 1033 }, { x: 9768, y: 934 }, { x: 9874, y: 843 },
        { x: 9993, y: 769 }, { x: 10121, y: 715 }, { x: 10257, y: 682 }, { x: 10396, y: 669 }, { x: 10536, y: 679 }, { x: 10674, y: 698 },
        { x: 10813, y: 717 }, { x: 10951, y: 737 }, { x: 11090, y: 756 }, { x: 11229, y: 775 }, { x: 11367, y: 795 }, { x: 11506, y: 814 },
        { x: 11644, y: 833 }, { x: 11783, y: 853 }, { x: 11922, y: 872 }, { x: 12060, y: 891 }, { x: 12199, y: 911 }, { x: 12337, y: 930 },
        { x: 12476, y: 949 }, { x: 12615, y: 967 }, { x: 12754, y: 972 }, { x: 12894, y: 965 }, { x: 13032, y: 944 }, { x: 13169, y: 912 },
        { x: 13304, y: 878 }, { x: 13440, y: 844 }, { x: 13576, y: 810 }, { x: 13711, y: 776 }, { x: 13847, y: 741 }, { x: 13983, y: 707 },
        { x: 14118, y: 673 }, { x: 14254, y: 639 }, { x: 14390, y: 605 }, { x: 14525, y: 570 }, { x: 14661, y: 536 }, { x: 14797, y: 502 },
        { x: 14933, y: 470 }, { x: 15071, y: 446 }, { x: 15210, y: 432 }, { x: 15350, y: 427 }, { x: 15490, y: 423 }, { x: 15629, y: 420 },
        { x: 15769, y: 423 }, { x: 15909, y: 433 }, { x: 16048, y: 449 }, { x: 16186, y: 471 }, { x: 16323, y: 500 }, { x: 16458, y: 535 },
        { x: 16592, y: 577 }, { x: 16723, y: 625 }, { x: 16852, y: 679 }, { x: 16979, y: 738 }, { x: 17103, y: 804 }, { x: 17224, y: 874 },
        { x: 17344, y: 945 }, { x: 17465, y: 1016 }, { x: 17586, y: 1086 }, { x: 17706, y: 1157 }, { x: 17827, y: 1228 }, { x: 17948, y: 1299 },
        { x: 18069, y: 1369 }, { x: 18189, y: 1440 }, { x: 18310, y: 1511 }, { x: 18431, y: 1582 }, { x: 18552, y: 1652 }, { x: 18672, y: 1723 },
        { x: 18793, y: 1794 }, { x: 18914, y: 1864 }, { x: 19034, y: 1935 }, { x: 19155, y: 2006 }, { x: 19276, y: 2077 }, { x: 19397, y: 2147 },
        { x: 19517, y: 2218 }, { x: 19638, y: 2288 }, { x: 19761, y: 2356 }, { x: 19883, y: 2424 }, { x: 20006, y: 2491 }, { x: 20128, y: 2559 },
        { x: 20251, y: 2627 }, { x: 20373, y: 2694 }, { x: 20496, y: 2762 }, { x: 20618, y: 2830 }, { x: 20741, y: 2897 }, { x: 20863, y: 2965 },
        { x: 20986, y: 3032 }, { x: 21108, y: 3100 }, { x: 21231, y: 3168 }, { x: 21353, y: 3235 }, { x: 21476, y: 3303 },
      ],
    },
    {
      /*
       * Chicle — el circuito de aprender, y el primero que se rehízo con el molde de Arcoíris.
       *
       * Antes medía 3.984 px y una vuelta duraba 8 s: te la sabías antes de acabar la primera y la
       * carretera de 110 px era un pasillo para la cámara de detrás. Ahora mide 11.936 px en un
       * mundo propio de 5100x3400, la carretera es casi el doble de ancha (200) y sube y baja.
       *
       * Es el fácil de los cinco **a propósito**: curvas abiertas, una sola chicane y ninguna
       * cerrada de verdad (el radio más pequeño es 264, y con 200 de ancho eso se pasa sin
       * levantar el pie). Se genera con `node tools/traza-circuitos.js Chicle --escribir`.
       */
      name: 'Chicle',
      width: 240,
      gravity: 1,
      world: { w: 5400, h: 3600 },
      boxes: [0.05, 0.10, 0.28, 0.35, 0.47, 0.52, 0.90],
      pads: [0.08, 0.31, 0.50, 0.92],
      features: [
        // los saltos, al estilo de Arcoíris: uno grande de verdad (y su aro) y otros dos de propina
        { type: 'ramp', at: 0.135, height: 95, length: 170 },   // el salto del donut
        { type: 'hill', at: 0.39, height: 26, length: 280 },
        { type: 'ramp', at: 0.575, height: 70, length: 150 },
        { type: 'ramp', at: 0.715, height: 60, length: 150 },
        { type: 'hill', at: 0.865, height: 20, length: 240 },
      ],
      // el sube y baja: cuestas suaves (ninguna llega al 6 %), que este es el circuito fácil
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.14, h: 70 }, { at: 0.30, h: 120 }, { at: 0.46, h: 60 },
        { at: 0.60, h: -40 }, { at: 0.74, h: 20 }, { at: 0.88, h: 80 },
      ],
      // quitamiedos en los dos lados de todo el circuito, como en Arcoíris: aquí no se sale nadie
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      theme: {
        sky: ['#ff7ad9', '#8df6ff'], fog: '#ffb6ec',
        ground: '#86ff3d', groundAlt: '#4fe04a',
        road: '#3a1d7a', curb: ['#ff2d95', '#ffffff'], bumper: ['#ffe600', '#ff2d95'], pad: '#00ffd0',
        pools: { kind: 'water', color: '#37e5ff', count: 6, minR: 40, maxR: 80 },
        // más decoración que antes, pero no el triple: el circuito es tres veces más largo y cada
        // malla se dibuja una vez por panel (con 8 jugadores, ocho veces). Medir con la tecla P.
        decor: [
          { kind: 'candyTree', n: 48 }, { kind: 'mushroom', n: 17 }, { kind: 'balloon', n: 20 },
          { kind: 'lollipop', n: 14 }, { kind: 'rock', n: 11 },
        ],
        props: [
          { kind: 'donut', at: 0.165 },     // se vuela por dentro del donut
          { kind: 'tarta', at: 0.66 },      // y se pasa por debajo de la tarta
        ],
        palette: ['#ff2d95', '#00e5ff', '#ffe600', '#b14bff', '#ff6a00', '#39ff88'],
        clouds: { color: '#ffffff', n: 11 },
        sun: { color: '#fff176', pos: [4600, 900, -1400], r: 110 },
        stars: false,
      },
      points: [
        { x: 3393, y: 3163 }, { x: 3276, y: 3192 }, { x: 3160, y: 3221 }, { x: 3044, y: 3249 }, { x: 2927, y: 3278 }, { x: 2811, y: 3307 },
        { x: 2694, y: 3335 }, { x: 2576, y: 3357 }, { x: 2457, y: 3369 }, { x: 2337, y: 3372 }, { x: 2217, y: 3365 }, { x: 2099, y: 3348 },
        { x: 1982, y: 3322 }, { x: 1867, y: 3287 }, { x: 1755, y: 3245 }, { x: 1643, y: 3203 }, { x: 1530, y: 3160 }, { x: 1418, y: 3118 },
        { x: 1306, y: 3076 }, { x: 1194, y: 3033 }, { x: 1082, y: 2991 }, { x: 973, y: 2940 }, { x: 872, y: 2876 }, { x: 780, y: 2799 },
        { x: 700, y: 2710 }, { x: 632, y: 2611 }, { x: 578, y: 2504 }, { x: 538, y: 2391 }, { x: 514, y: 2274 }, { x: 505, y: 2154 },
        { x: 497, y: 2035 }, { x: 463, y: 1920 }, { x: 402, y: 1817 }, { x: 327, y: 1723 }, { x: 262, y: 1623 }, { x: 226, y: 1509 },
        { x: 223, y: 1390 }, { x: 253, y: 1274 }, { x: 313, y: 1171 }, { x: 400, y: 1089 }, { x: 505, y: 1033 }, { x: 617, y: 989 },
        { x: 729, y: 945 }, { x: 840, y: 901 }, { x: 952, y: 857 }, { x: 1063, y: 812 }, { x: 1169, y: 757 }, { x: 1270, y: 692 },
        { x: 1370, y: 626 }, { x: 1471, y: 561 }, { x: 1572, y: 496 }, { x: 1672, y: 431 }, { x: 1773, y: 366 }, { x: 1876, y: 304 },
        { x: 1986, y: 258 }, { x: 2103, y: 230 }, { x: 2222, y: 220 }, { x: 2341, y: 229 }, { x: 2458, y: 257 }, { x: 2569, y: 303 },
        { x: 2676, y: 357 }, { x: 2783, y: 411 }, { x: 2889, y: 466 }, { x: 2996, y: 520 }, { x: 3103, y: 574 }, { x: 3210, y: 628 },
        { x: 3317, y: 683 }, { x: 3429, y: 726 }, { x: 3547, y: 744 }, { x: 3666, y: 758 }, { x: 3785, y: 772 }, { x: 3904, y: 787 },
        { x: 4023, y: 801 }, { x: 4143, y: 815 }, { x: 4262, y: 829 }, { x: 4381, y: 843 }, { x: 4500, y: 859 }, { x: 4615, y: 890 },
        { x: 4724, y: 939 }, { x: 4825, y: 1005 }, { x: 4913, y: 1086 }, { x: 4988, y: 1179 }, { x: 5047, y: 1283 }, { x: 5096, y: 1393 },
        { x: 5133, y: 1507 }, { x: 5158, y: 1624 }, { x: 5169, y: 1743 }, { x: 5167, y: 1863 }, { x: 5152, y: 1982 }, { x: 5124, y: 2099 },
        { x: 5084, y: 2211 }, { x: 5031, y: 2319 }, { x: 4967, y: 2420 }, { x: 4892, y: 2514 }, { x: 4817, y: 2607 }, { x: 4735, y: 2695 },
        { x: 4644, y: 2773 }, { x: 4544, y: 2839 }, { x: 4437, y: 2892 }, { x: 4324, y: 2933 }, { x: 4208, y: 2962 }, { x: 4091, y: 2991 },
        { x: 3975, y: 3020 }, { x: 3858, y: 3048 }, { x: 3742, y: 3077 }, { x: 3626, y: 3106 }, { x: 3509, y: 3134 },
      ],
    },
    {
      /*
       * Playa Neón — el paseo marítimo: la recta más larga de los cinco circuitos pequeños
       * (1.500 px seguidos frente al mar) y, al volver, curvas de todos los tipos, con la
       * horquilla de la sombrilla como la parte lenta de verdad.
       *
       * Rehecho con el molde de Arcoíris: antes medía 4.088 px (vuelta de 9 s) en el mundo de
       * 1920x1080; ahora mide 12.816 px en uno propio de 5400x3450, con la carretera a 200.
       * Se genera con `node tools/traza-circuitos.js "Playa Neón" --escribir`.
       */
      name: 'Playa Neón',
      width: 230,
      gravity: 1,
      world: { w: 5700, h: 3650 },
      boxes: [0.02, 0.22, 0.28, 0.42, 0.47, 0.70, 0.75],
      pads: [0.03, 0.25, 0.45, 0.68, 0.95],
      features: [
        { type: 'ramp', at: 0.06, height: 100, length: 180 },   // el salto del flotador
        { type: 'hill', at: 0.34, height: 24, length: 280 },
        { type: 'ramp', at: 0.52, height: 75, length: 160 },
        { type: 'ramp', at: 0.79, height: 65, length: 150 },
        { type: 'hill', at: 0.90, height: 18, length: 240 },
      ],
      // dunas: sube hacia el interior a mitad de vuelta y baja otra vez hasta la orilla
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.12, h: -30 }, { at: 0.26, h: 60 }, { at: 0.40, h: 140 },
        { at: 0.54, h: 90 }, { at: 0.66, h: 10 }, { at: 0.80, h: -50 }, { at: 0.92, h: 20 },
      ],
      // quitamiedos en los dos lados de todo el circuito, como en Arcoíris: aquí no se sale nadie
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      theme: {
        sky: ['#5b00ff', '#ff7a00'], fog: '#ff9ac0',
        ground: '#ffd93d', groundAlt: '#ffb800',
        road: '#0f3d5c', curb: ['#ff6a00', '#ffffff'], bumper: ['#00e5ff', '#ff2d95'], pad: '#39ff88',
        pools: { kind: 'water', color: '#00e5ff', count: 10, minR: 45, maxR: 95 },
        decor: [
          { kind: 'palm', n: 44 }, { kind: 'beachBall', n: 17 }, { kind: 'umbrella', n: 14 },
          { kind: 'rock', n: 12 }, { kind: 'flamingo', n: 11 },
        ],
        props: [
          { kind: 'flotador', at: 0.095 },    // el flotador gigante por el que se vuela
          { kind: 'chiringuito', at: 0.61 },  // y el chiringuito, por debajo
        ],
        palette: ['#ff2d95', '#00e5ff', '#39ff88', '#ffe600', '#ff6a00', '#b14bff'],
        clouds: { color: '#ffc6e8', n: 11 },
        sun: { color: '#ffb300', pos: [600, 620, -1600], r: 140 },
        stars: false,
      },
      points: [
        { x: 2718, y: 3298 }, { x: 2600, y: 3322 }, { x: 2482, y: 3346 }, { x: 2364, y: 3369 }, { x: 2245, y: 3386 }, { x: 2125, y: 3395 },
        { x: 2005, y: 3395 }, { x: 1884, y: 3388 }, { x: 1765, y: 3372 }, { x: 1647, y: 3349 }, { x: 1531, y: 3318 }, { x: 1417, y: 3279 },
        { x: 1306, y: 3233 }, { x: 1197, y: 3181 }, { x: 1089, y: 3130 }, { x: 980, y: 3078 }, { x: 871, y: 3027 }, { x: 763, y: 2974 },
        { x: 662, y: 2909 }, { x: 572, y: 2829 }, { x: 496, y: 2736 }, { x: 436, y: 2632 }, { x: 393, y: 2520 }, { x: 369, y: 2402 },
        { x: 363, y: 2282 }, { x: 376, y: 2163 }, { x: 408, y: 2047 }, { x: 433, y: 1930 }, { x: 417, y: 1811 }, { x: 362, y: 1704 },
        { x: 291, y: 1607 }, { x: 242, y: 1498 }, { x: 221, y: 1380 }, { x: 228, y: 1260 }, { x: 265, y: 1145 }, { x: 327, y: 1043 },
        { x: 413, y: 959 }, { x: 516, y: 897 }, { x: 630, y: 860 }, { x: 746, y: 829 }, { x: 862, y: 798 }, { x: 978, y: 766 },
        { x: 1094, y: 735 }, { x: 1211, y: 703 }, { x: 1325, y: 666 }, { x: 1432, y: 612 }, { x: 1539, y: 556 }, { x: 1645, y: 501 },
        { x: 1752, y: 445 }, { x: 1859, y: 389 }, { x: 1965, y: 333 }, { x: 2072, y: 278 }, { x: 2185, y: 238 }, { x: 2304, y: 221 },
        { x: 2424, y: 227 }, { x: 2541, y: 256 }, { x: 2649, y: 307 }, { x: 2751, y: 371 }, { x: 2853, y: 435 }, { x: 2955, y: 500 },
        { x: 3056, y: 564 }, { x: 3158, y: 628 }, { x: 3259, y: 693 }, { x: 3361, y: 757 }, { x: 3463, y: 821 }, { x: 3573, y: 869 },
        { x: 3691, y: 889 }, { x: 3811, y: 904 }, { x: 3930, y: 919 }, { x: 4049, y: 935 }, { x: 4169, y: 950 }, { x: 4288, y: 965 },
        { x: 4407, y: 981 }, { x: 4527, y: 996 }, { x: 4646, y: 1011 }, { x: 4765, y: 1027 }, { x: 4884, y: 1043 }, { x: 5000, y: 1076 },
        { x: 5107, y: 1130 }, { x: 5203, y: 1203 }, { x: 5284, y: 1292 }, { x: 5347, y: 1394 }, { x: 5395, y: 1504 }, { x: 5437, y: 1617 },
        { x: 5462, y: 1734 }, { x: 5469, y: 1854 }, { x: 5457, y: 1974 }, { x: 5426, y: 2090 }, { x: 5379, y: 2201 }, { x: 5315, y: 2303 },
        { x: 5247, y: 2402 }, { x: 5179, y: 2501 }, { x: 5106, y: 2596 }, { x: 5021, y: 2682 }, { x: 4928, y: 2757 }, { x: 4826, y: 2821 },
        { x: 4717, y: 2873 }, { x: 4603, y: 2911 }, { x: 4486, y: 2937 }, { x: 4368, y: 2961 }, { x: 4250, y: 2985 }, { x: 4132, y: 3010 },
        { x: 4014, y: 3034 }, { x: 3896, y: 3058 }, { x: 3779, y: 3082 }, { x: 3661, y: 3106 }, { x: 3543, y: 3130 }, { x: 3425, y: 3154 },
        { x: 3307, y: 3178 }, { x: 3189, y: 3202 }, { x: 3071, y: 3226 }, { x: 2953, y: 3250 }, { x: 2836, y: 3274 },
      ],
    },
    {
      /*
       * Volcán Disco — el técnico de los cinco: el zigzag, la horquilla del volcán y dos curvas
       * cerradas de verdad (radio 173, el más pequeño de todos los circuitos). Aquí el derrape de
       * nivel 3 se gana curva a curva, y por eso la carretera es la más estrecha de los rehechos
       * (180): tiene que dar respeto, pero sin ser el pasillo de 110 de antes.
       *
       * Rehecho con el molde de Arcoíris: de 4.544 px (vuelta de 12 s) a 13.512 px en un mundo
       * propio de 5600x3600. `node tools/traza-circuitos.js "Volcán Disco" --escribir`.
       */
      name: 'Volcán Disco',
      width: 220,
      gravity: 1,
      world: { w: 5600, h: 3600 },
      boxes: [0.03, 0.07, 0.26, 0.36, 0.42, 0.65, 0.70, 0.75],
      pads: [0.05, 0.25, 0.40, 0.68, 0.95],
      features: [
        { type: 'ramp', at: 0.13, height: 105, length: 170 },   // el salto del aro de fuego
        { type: 'hill', at: 0.30, height: 22, length: 260 },
        { type: 'ramp', at: 0.50, height: 70, length: 150 },
        { type: 'ramp', at: 0.79, height: 70, length: 150 },
        { type: 'hill', at: 0.90, height: 20, length: 240 },
      ],
      // se sube al cráter en la primera mitad y se baja de vuelta a meta: 250 px de desnivel
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.12, h: 40 }, { at: 0.26, h: 150 }, { at: 0.40, h: 220 },
        { at: 0.52, h: 160 }, { at: 0.66, h: 60 }, { at: 0.78, h: -30 }, { at: 0.90, h: 40 },
      ],
      // quitamiedos en los dos lados de todo el circuito, como en Arcoíris: aquí no se sale nadie
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      theme: {
        sky: ['#2b0040', '#ff3d00'], fog: '#7a1c7a',
        ground: '#7a1fb8', groundAlt: '#4b0a80',
        road: '#1c1c2e', curb: ['#ffea00', '#1a1a1a'], bumper: ['#ff2d95', '#00e5ff'], pad: '#ffea00',
        pools: { kind: 'lava', color: '#ff5e00', color2: '#ffd000', count: 12, minR: 40, maxR: 85 },
        decor: [
          { kind: 'crystal', n: 38 }, { kind: 'rock', n: 26 }, { kind: 'pineTree', n: 20 },
          { kind: 'cactus', n: 12 }, { kind: 'volcano', n: 3 },
        ],
        props: [
          { kind: 'aroFuego', at: 0.16 },   // se vuela por dentro del aro de fuego
          { kind: 'arcoRoca', at: 0.56 },   // y se pasa por debajo del arco de lava
        ],
        palette: ['#00e5ff', '#ff2d95', '#ffea00', '#39ff88', '#ff6a00', '#b14bff'],
        clouds: { color: '#ff8a65', n: 9 },
        sun: { color: '#ff3d00', pos: [4400, 700, -1700], r: 110 },
        stars: true,
      },
      points: [
        { x: 3851, y: 3112 }, { x: 3736, y: 3144 }, { x: 3621, y: 3176 }, { x: 3505, y: 3207 }, { x: 3390, y: 3239 }, { x: 3275, y: 3271 },
        { x: 3159, y: 3303 }, { x: 3044, y: 3335 }, { x: 2927, y: 3360 }, { x: 2808, y: 3372 }, { x: 2689, y: 3369 }, { x: 2570, y: 3352 },
        { x: 2455, y: 3321 }, { x: 2344, y: 3277 }, { x: 2239, y: 3219 }, { x: 2137, y: 3157 }, { x: 2035, y: 3095 }, { x: 1933, y: 3032 },
        { x: 1831, y: 2970 }, { x: 1728, y: 2908 }, { x: 1626, y: 2846 }, { x: 1524, y: 2783 }, { x: 1417, y: 2731 }, { x: 1300, y: 2706 },
        { x: 1183, y: 2683 }, { x: 1066, y: 2659 }, { x: 948, y: 2635 }, { x: 831, y: 2612 }, { x: 714, y: 2588 }, { x: 596, y: 2565 },
        { x: 479, y: 2541 }, { x: 364, y: 2511 }, { x: 272, y: 2437 }, { x: 224, y: 2328 }, { x: 231, y: 2210 }, { x: 282, y: 2102 },
        { x: 336, y: 1995 }, { x: 390, y: 1888 }, { x: 443, y: 1781 }, { x: 462, y: 1664 }, { x: 436, y: 1548 }, { x: 397, y: 1434 },
        { x: 359, y: 1321 }, { x: 323, y: 1207 }, { x: 331, y: 1089 }, { x: 392, y: 987 }, { x: 493, y: 925 }, { x: 610, y: 905 },
        { x: 729, y: 889 }, { x: 847, y: 873 }, { x: 966, y: 857 }, { x: 1085, y: 841 }, { x: 1203, y: 825 }, { x: 1322, y: 809 },
        { x: 1440, y: 794 }, { x: 1559, y: 778 }, { x: 1670, y: 737 }, { x: 1770, y: 671 }, { x: 1869, y: 605 }, { x: 1969, y: 539 },
        { x: 2068, y: 472 }, { x: 2168, y: 406 }, { x: 2267, y: 340 }, { x: 2367, y: 273 }, { x: 2476, y: 227 }, { x: 2595, y: 225 },
        { x: 2706, y: 267 }, { x: 2811, y: 325 }, { x: 2916, y: 382 }, { x: 3021, y: 439 }, { x: 3126, y: 497 }, { x: 3231, y: 554 },
        { x: 3336, y: 612 }, { x: 3441, y: 669 }, { x: 3546, y: 726 }, { x: 3660, y: 758 }, { x: 3780, y: 768 }, { x: 3899, y: 779 },
        { x: 4018, y: 789 }, { x: 4137, y: 800 }, { x: 4256, y: 810 }, { x: 4375, y: 821 }, { x: 4495, y: 832 }, { x: 4614, y: 842 },
        { x: 4733, y: 853 }, { x: 4851, y: 871 }, { x: 4962, y: 915 }, { x: 5060, y: 984 }, { x: 5139, y: 1073 }, { x: 5199, y: 1176 },
        { x: 5255, y: 1282 }, { x: 5304, y: 1391 }, { x: 5342, y: 1504 }, { x: 5367, y: 1621 }, { x: 5379, y: 1740 }, { x: 5378, y: 1860 },
        { x: 5364, y: 1979 }, { x: 5337, y: 2095 }, { x: 5298, y: 2208 }, { x: 5247, y: 2316 }, { x: 5184, y: 2418 }, { x: 5112, y: 2514 },
        { x: 5039, y: 2608 }, { x: 4959, y: 2697 }, { x: 4868, y: 2774 }, { x: 4767, y: 2838 }, { x: 4658, y: 2887 }, { x: 4543, y: 2921 },
        { x: 4428, y: 2953 }, { x: 4312, y: 2985 }, { x: 4197, y: 3017 }, { x: 4082, y: 3048 }, { x: 3966, y: 3080 },
      ],
    },
    {
      /*
       * Luna Loca — el de la gravedad baja (0,55): aquí se cae despacio, así que los saltos son
       * larguísimos y las curvas son abiertas a propósito (el radio más pequeño es 325, el más
       * generoso de los cinco). Es el circuito de volar, no el de trazar.
       *
       * Rehecho con el molde de Arcoíris: de 4.080 px (vuelta de 10 s) a 13.152 px en un mundo
       * propio de 5450x3650, con la carretera a 220, la más ancha después de Arcoíris.
       * `node tools/traza-circuitos.js "Luna Loca" --escribir`.
       */
      name: 'Luna Loca',
      width: 230,
      gravity: 0.55,
      world: { w: 5450, h: 3650 },
      boxes: [0.02, 0.21, 0.26, 0.31, 0.43, 0.62, 0.66, 0.76],
      pads: [0.04, 0.23, 0.44, 0.65, 0.78],
      features: [
        // con esta gravedad (0,55) las rampas mandan a la estratosfera: es el circuito saltarín
        { type: 'ramp', at: 0.06, height: 110, length: 160 },   // el salto del anillo
        { type: 'ramp', at: 0.47, height: 80, length: 150 },
        { type: 'hill', at: 0.37, height: 24, length: 300 },
        { type: 'hill', at: 0.70, height: 20, length: 260 },
        { type: 'ramp', at: 0.80, height: 75, length: 150 },
      ],
      // los mares de la luna: subidas y bajadas largas, que con gravedad 0,55 se notan el doble
      relieve: [
        { at: 0.00, h: 0 }, { at: 0.13, h: 90 }, { at: 0.27, h: 180 }, { at: 0.42, h: 60 },
        { at: 0.55, h: -60 }, { at: 0.68, h: 40 }, { at: 0.80, h: 160 }, { at: 0.91, h: 60 },
      ],
      // quitamiedos en los dos lados de todo el circuito, como en Arcoíris: aquí no se sale nadie
      barriers: [{ from: 0, to: 0.999, side: 'both' }],
      theme: {
        sky: ['#03001c', '#1b1464'], fog: '#2a1a6e',
        ground: '#5a7dff', groundAlt: '#3a55d6',
        road: '#eaf6ff', curb: ['#00ffff', '#ff00ff'], bumper: ['#39ff88', '#ffe600'], pad: '#ff2d95',
        pools: { kind: 'crater', color: '#2c3fa8', count: 14, minR: 35, maxR: 90 },
        decor: [
          { kind: 'moonRock', n: 36 }, { kind: 'crystal', n: 30 }, { kind: 'planet', n: 9 },
          { kind: 'flag', n: 9 }, { kind: 'rocket', n: 5 },
        ],
        props: [
          { kind: 'anillo', at: 0.10 },   // el anillo del planeta, y se vuela por dentro
          { kind: 'base', at: 0.61 },     // la base lunar, por debajo
        ],
        palette: ['#00ffff', '#ff00ff', '#ffe600', '#39ff88', '#ff6a00', '#ffffff'],
        clouds: null,
        sun: { color: '#8ee3ff', pos: [4200, 900, -1800], r: 160, ring: true },
        stars: true,
      },
      points: [
        { x: 2522, y: 3371 }, { x: 2403, y: 3385 }, { x: 2284, y: 3392 }, { x: 2164, y: 3391 }, { x: 2045, y: 3383 }, { x: 1926, y: 3367 },
        { x: 1809, y: 3344 }, { x: 1693, y: 3313 }, { x: 1580, y: 3275 }, { x: 1469, y: 3230 }, { x: 1361, y: 3180 }, { x: 1252, y: 3130 },
        { x: 1143, y: 3080 }, { x: 1035, y: 3030 }, { x: 926, y: 2980 }, { x: 818, y: 2929 }, { x: 712, y: 2875 }, { x: 613, y: 2807 },
        { x: 523, y: 2729 }, { x: 442, y: 2640 }, { x: 373, y: 2543 }, { x: 316, y: 2438 }, { x: 272, y: 2327 }, { x: 242, y: 2211 },
        { x: 226, y: 2093 }, { x: 223, y: 1973 }, { x: 235, y: 1854 }, { x: 251, y: 1736 }, { x: 263, y: 1617 }, { x: 252, y: 1498 },
        { x: 233, y: 1380 }, { x: 220, y: 1261 }, { x: 231, y: 1142 }, { x: 266, y: 1028 }, { x: 325, y: 925 }, { x: 405, y: 836 },
        { x: 502, y: 766 }, { x: 611, y: 718 }, { x: 728, y: 694 }, { x: 847, y: 686 }, { x: 966, y: 678 }, { x: 1086, y: 671 },
        { x: 1205, y: 663 }, { x: 1324, y: 655 }, { x: 1444, y: 647 }, { x: 1563, y: 639 }, { x: 1682, y: 632 }, { x: 1802, y: 624 },
        { x: 1920, y: 610 }, { x: 2034, y: 574 }, { x: 2148, y: 536 }, { x: 2261, y: 499 }, { x: 2375, y: 462 }, { x: 2489, y: 424 },
        { x: 2602, y: 387 }, { x: 2716, y: 349 }, { x: 2829, y: 312 }, { x: 2943, y: 274 }, { x: 3057, y: 239 }, { x: 3175, y: 221 },
        { x: 3295, y: 224 }, { x: 3412, y: 247 }, { x: 3523, y: 289 }, { x: 3626, y: 350 }, { x: 3717, y: 427 }, { x: 3796, y: 517 },
        { x: 3873, y: 608 }, { x: 3951, y: 699 }, { x: 4028, y: 791 }, { x: 4105, y: 882 }, { x: 4188, y: 968 }, { x: 4288, y: 1032 },
        { x: 4397, y: 1083 }, { x: 4505, y: 1133 }, { x: 4614, y: 1183 }, { x: 4722, y: 1233 }, { x: 4827, y: 1291 }, { x: 4922, y: 1363 },
        { x: 5004, y: 1450 }, { x: 5073, y: 1548 }, { x: 5125, y: 1655 }, { x: 5161, y: 1769 }, { x: 5178, y: 1887 }, { x: 5178, y: 2007 },
        { x: 5159, y: 2125 }, { x: 5123, y: 2238 }, { x: 5069, y: 2345 }, { x: 5003, y: 2445 }, { x: 4936, y: 2544 }, { x: 4869, y: 2643 },
        { x: 4795, y: 2737 }, { x: 4709, y: 2820 }, { x: 4613, y: 2891 }, { x: 4508, y: 2948 }, { x: 4396, y: 2990 }, { x: 4280, y: 3018 },
        { x: 4163, y: 3042 }, { x: 4046, y: 3065 }, { x: 3928, y: 3089 }, { x: 3811, y: 3113 }, { x: 3694, y: 3136 }, { x: 3577, y: 3160 },
        { x: 3460, y: 3184 }, { x: 3342, y: 3208 }, { x: 3225, y: 3231 }, { x: 3108, y: 3255 }, { x: 2991, y: 3279 }, { x: 2874, y: 3303 },
        { x: 2756, y: 3326 }, { x: 2639, y: 3350 },
      ],
    },
  ];
});
