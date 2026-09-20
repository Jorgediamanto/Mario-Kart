/*
 * Kart Party — simulación sin pantalla.
 *
 * Aquí vive toda la física del juego: circuitos, karts, saltos, objetos, bots, vueltas y
 * clasificación. Este archivo no dibuja nada y no sabe nada del navegador: cada cosa que se ve,
 * se oye o se envía a los móviles sale por un «hook» (ver DEFAULT_HOOKS). Así la misma simulación
 * corre en la tele (`screen.js` le pone las mallas de three.js) y en las pruebas de `npm test`,
 * que la hacen correr carreras de bots a toda velocidad sin abrir un navegador.
 *
 * Es `.mjs` (y no `.js`) a propósito: `package.json` no tiene `"type": "module"`, así que Node
 * trataría un `.js` como CommonJS al importarlo desde las herramientas.
 *
 * Coordenadas: el plano del circuito es (x, y) en 1920x1080; la altura del kart es `z`.
 * Cada objeto de la simulación tiene una ranura `view` que la simulación nunca lee: ahí guarda
 * `screen.js` su malla.
 */

// ===================== Constantes =====================
export const MAP_W = 1920, MAP_H = 1080;
export const DT = 1 / 60;
export const KART_R = 15;
export const BASE_MAX_SPEED = 445;   // unidades/s (sube o baja este número para karts más rápidos o más lentos)
export const ACCEL = 460, BRAKE = 750, COAST = 240;
export const GRAVITY = 950;          // unidades/s²
export const SPIN_TIME = 1.0;
// Tras un golpe, este rato sin que te puedan volver a dar (se suma al trompo). Con 2,5 s, lo más
// que te pueden pegar son 3 golpes en 10 s: nadie se queda sin jugar a base de caparazones.
export const HIT_IMMUNITY = 2.5;
export const ROULETTE_TIME = 1.6;
export const BOX_RESPAWN = 5;
// Lo cerca que hay que pasar de una caja para llevársela. Era 26 (el ancho justo de la caja) y
// obligaba a apuntar; con 42 basta con pasar por encima «más o menos», que es lo que uno espera.
export const BOX_ALCANCE = 42;
// Rescate automático (el «Lakitu»): si un kart se queda clavado o muy lejos de la carretera,
// se le recoloca en la pista mirando bien, y pierde un momento: esa es toda la penalización.
export const RESCUE_AFTER = 2.2;  // segundos perdido o atascado antes de que lo recojan
export const RESCUE_TIME = 1.2;   // lo que tarda la maniobra (el kart no se mueve)
export const RESCUE_FAR = 140;    // a esta distancia del borde de la carretera ya está «perdido»
export const RESCUE_SLOW = 40;    // por debajo de esta velocidad se considera parado
// Bots: si el morro apunta a más de este ángulo (radianes) del camino, el bot va de espaldas;
// suelta el gas y frena hasta encararse, y solo da marcha atrás cuando ya casi está parado.
export const AI_WRONG_ANGLE = 2.0;
export const AI_REVERSE_MAX = 150;   // a más marcha atrás que esto, el bot pisa gas para pararla
// Derrape automático (sin botón): mantener el giro en la misma dirección a buena velocidad entra
// solo en derrape, y cuanto más se aguante, más turbo al soltar. Los tiempos se cuentan desde que
// se empieza a girar, así que DRIFT_START es «cuándo empieza a deslizar» y DRIFT_L1..3 «qué nivel
// lleva». Subir estos números hace el derrape más difícil de cargar; bajarlos, más regalado.
export const DRIFT_START = 0.30;     // s girando igual antes de que el kart empiece a deslizar
export const DRIFT_MIN_SPEED = 0.55; // fracción de la velocidad máxima por debajo de la cual no se derrapa
export const DRIFT_L1 = 0.5;         // s para el nivel 1 (chispas azules)
export const DRIFT_L2 = 0.9;         // s para el nivel 2 (naranjas)
export const DRIFT_L3 = 1.4;         // s para el nivel 3 (rosas)
export const DRIFT_BOOST = [0.6, 1.0, 1.6];  // s de turbo al soltar, por nivel
export const DRIFT_TURN = 1.4;       // cuánto gira de más mientras derrapa
// La dirección es analógica (el volante del móvil manda un decimal de -1 a 1). Por debajo de esto
// se considera que estás corrigiendo, no girando: no carga derrape ni dispara el truco del aire.
export const STEER_FIRME = 0.55;
// Al rebotar en un quitamiedos no basta con devolver la velocidad: si el morro sigue apuntando al
// muro, el gas te vuelve a meter y te quedas picoteando el quitamiedos sin avanzar. Al rebotar se
// le endereza también el morro hacia la carretera, esta fracción del ángulo que le falta. Con 0,6
// dos rebotes bastan para salir; con menos vuelve el atasco, con 1 el kart se endereza solo del
// todo y el golpe deja de notarse.
export const BUMPER_ENDEREZA = 0.6;
// Hasta dónde llega el quitamiedos: más allá del borde + esto, el kart está fuera de verdad y le
// toca el rescate, no un empujón mágico de vuelta a la pista.
export const BUMPER_ALCANCE = 140;
// Igual que el rebote, pero al terminar el trompo de un golpe: el kart sale mirando hacia donde le
// pilló el caparazón y hay que buscarse la carretera con el trompo aún en el cuerpo. Al acabar se
// le endereza el morro hacia el sentido de la marcha, esta fracción de lo que le falta. Con 0,75
// sales casi encarado pero el golpe se sigue notando; con 1 sería como si no hubiera pasado nada.
export const GOLPE_ENDEREZA = 0.75;
// Turbo de salto: al despegar del filo de una rampa se regala este rato de turbo. Es lo que hace
// que un salto se sienta grande — sin él caes casi donde despegaste, porque en el aire no se
// acelera. Va con la altura de la rampa: las rampitas dan un empujón corto y el salto gordo, uno
// largo (`length` de la rampa no cuenta: lo que manda es lo alto que te tira).
export const RAMPA_TURBO = 0.02;     // segundos de turbo por unidad de altura de la rampa
export const RAMPA_TURBO_MAX = 2.0;  // tope, por si alguien pone una rampa gigantesca
export const RAMPA_ESPERA = 2.5;     // segundos antes de volver a cobrar turbo en la misma rampa
export const REBOTE_MAX = 150;       // lo más que puede rebotar un kart al aterrizar de golpe
// Progreso: cuando un kart aparece de golpe muy por delante (ha volado por encima de un atajo), su
// avance no se cuenta… pero solo durante este rato. Pasado eso se acepta, para no dejarle la
// clasificación congelada media vuelta.
export const PROGRESS_JUMP_WAIT = 1.0;   // segundos
// Rayo: a quien le cae no le puede volver a caer en este rato. Sin esto, dos rayos seguidos dejaban
// al líder encogido media carrera y sin nada que hacer, que es justo lo que no queremos en la fiesta.
export const LIGHTNING_IMMUNITY = 30;   // segundos
// Aviso de «vas al revés»: tanto tiempo seguido avanzando contra el sentido del circuito antes de
// avisar. Corto marea (basta un coletazo en una curva); largo llega tarde.
export const WRONG_WAY_TIME = 1.5;      // segundos
export const WRONG_WAY_SPEED = 60;      // por debajo de esta velocidad no se considera que avanza
// Si ni con el aviso se da la vuelta, a los tantos segundos se le recoge y se le pone mirando bien
export const WRONG_WAY_RESCUE = 4.5;    // segundos yendo al revés antes de que lo recojan
export const OFFROAD_RESCUE = 3.5;      // segundos seguidos fuera de la pista antes de que lo recojan
/*
 * Modo fácil, uno por jugador: se enciende con un interruptor en la sala del móvil y se recuerda
 * allí. El kart **acelera solo** (el botón de gas pasa a ser un empujón suave opcional) y el
 * volante lleva una **ayuda hacia el centro de la carretera**. Está pensado para quien coge un
 * mando por primera vez en una fiesta y se pasa la carrera mirando el quitamiedos; con la ayuda da
 * la vuelta entera aunque no toque nada, despacito y sin salirse. La ayuda se paga con un pelín de
 * velocidad, así que nadie lo va a encender para ir más rápido.
 */
export const EASY_AYUDA = 0.7;    // cuánto manda la ayuda cuando no tocas el volante (0 = nada, 1 = todo)
export const EASY_MAX = 0.94;     // velocidad máxima si no pisas el gas (pisándolo, la de siempre)
export const EASY_MIRA = 22;      // a cuántas muestras por delante mira la ayuda
/*
 * Caracol 🐌: el objeto raro. Al usarlo **se para la carrera entera**, quien lo usa elige a quién
 * se lo planta y esa persona va a paso de caracol un rato. Parar el juego es fuerte, así que:
 * el que elige tiene un tiempo límite y, si se lo piensa demasiado, se lo lleva el que va justo
 * delante (nunca se queda la fiesta colgada esperando a alguien que ha soltado el móvil).
 */
export const SNAIL_SLOW = 0.25;         // a cuánto se queda su velocidad máxima (25 % = un 75 % más lento)
export const SNAIL_TIME = 3;            // segundos que dura
export const SNAIL_CHOICE_TIME = 6;     // segundos para elegir antes de que elija solo
/*
 * Caparazón rojo 🎯 y caparazón azul 🔵.
 *
 * El azul es el objeto de los desesperados: sale disparado **por el centro de la carretera** a toda
 * velocidad buscando al primero, y se lleva por delante a cualquiera que pille en el camino. Pero
 * ese camino es **muy fino** (`BLUE_PASILLO`): va pegado a la línea central, así que al primero le
 * da solo si está por el medio. Si se va por fuera o corta por la cuerda, se salva.
 */
export const RED_SPEED = 800;           // el rojo, más rápido que antes (660): ahora sí alcanza
export const BLUE_SPEED = 1150;         // el azul va como un misil
export const BLUE_LIFE = 14;            // segundos antes de disolverse (si no encuentra a nadie)
export const BLUE_PASILLO = 42;         // lo fino que es su camino: más allá de esto, no te roza
/*
 * Cohete 🚀: el premio de los últimos. Te agarra, te pone en el centro de la carretera y te dispara
 * a más del doble de velocidad durante unos segundos, atropellando a quien te encuentres. Mientras
 * dura no se conduce (ni falta que hace) y no te pueden dar.
 */
export const ROCKET_TIME = 4.5;         // segundos de vuelo
export const ROCKET_SPEED = 2.1;        // veces la velocidad máxima normal
/*
 * Tinta 🦑: a los demás se les mancha la pantalla y no ven bien un rato. Y **al que va primero** le
 * puede estallar en la cara: de vez en cuando su caja no trae un objeto, sino un calamarazo para él
 * solito, que es la forma más divertida de que el líder también sufra.
 */
export const INK_TIME = 4.5;            // segundos con la pantalla manchada
export const INK_SELF_TIME = 3.0;       // los que dura cuando le estalla al primero
/*
 * Las tres habilidades de «Last Dance», el circuito de la jungla. Solo salen ahí (`itemsExtra`) y
 * son de las que cambian una carrera:
 *  - **Liana** 🌿: te engancha al kart de delante y te arrastra hasta él en un instante. Un
 *    adelantamiento de los de levantarse del sofá.
 *  - **Terremoto** 🌋: tiembla todo el circuito y los que van por el suelo salen volando. Al que lo
 *    usa no le pasa nada, claro.
 *  - **Portal** 🌀: te abres un agujero y sales más adelante, en el mismo trazado. No atraviesas
 *    paredes ni te saltas vueltas: es un empujón brutal, pero por la pista.
 */
export const LIANA_ALCANCE = 1400;      // px de pista por delante hasta los que engancha
export const LIANA_TIME = 0.7;          // lo que tarda el viaje
export const TERREMOTO_FUERZA = 420;    // con cuánta fuerza salen despedidos los demás
export const PORTAL_SALTO = 900;        // px de pista que te adelanta el portal
export const MAX_KARTS = 7;   // siete personajes, siete sitios: nadie repite kart
export const SAMPLE_SPACING = 8;

/*
 * Los siete de la fiesta. Cada uno tiene su color (la carrocería) y su acento (llantas, alerón,
 * bordes) — son los que se ven en la tele para saber de un vistazo quién es quién, así que
 * conviene que no se parezcan entre sí. `emoji` es el respaldo: se usa en los textos (marcador,
 * avisos, resultados) y también como cara si el modelo de cabezas no cargara.
 * `escala` encoge o agranda el kart entero (Carlota es la pequeñaja), y `bandera` pinta una
 * banderita en el alerón.
 */
export const CHARS = [
  { name: 'El Loco', emoji: '🤪', color: '#39ff88', accent: '#1a1a24' },
  { name: 'Chuma', emoji: '🧿', color: '#e8a33d', accent: '#ffffff' },
  { name: 'Toro', emoji: '🐂', color: '#6b3f2a', accent: '#ff2d2d' },
  { name: 'Diamanto', emoji: '💎', color: '#7fe9ff', accent: '#ffffff' },
  { name: 'Leini', emoji: '🤠', color: '#2a4fd6', accent: '#ff2d2d', bandera: 'texas' },
  { name: 'Carlota', emoji: '👧', color: '#ff8ad8', accent: '#ffe600', escala: 0.85 },
  { name: 'Scarlet', emoji: '🌹', color: '#d62c2c', accent: '#ffe600', bandera: 'cataluna' },
];

export const ITEMS = {
  mushroom: { icon: '🍄', name: 'Champiñón' },
  banana: { icon: '🍌', name: 'Plátano' },
  red: { icon: '🎯', name: 'Caparazón rojo' },
  blue: { icon: '🔵', name: 'Caparazón azul' },
  rocket: { icon: '🚀', name: 'Cohete' },
  ink: { icon: '🦑', name: 'Tinta' },
  star: { icon: '⭐', name: 'Estrella' },
  lightning: { icon: '⚡', name: 'Rayo' },
  snail: { icon: '🐌', name: 'Caracol' },
  // Exclusivos de circuitos que los pidan en `itemsExtra` (hoy, «Last Dance»). Son gordos a
  // propósito: cambian la carrera, no la adornan.
  liana: { icon: '🌿', name: 'Liana' },
  terremoto: { icon: '🌋', name: 'Terremoto' },
  portal: { icon: '🌀', name: 'Portal' },
};
export const ITEM_IDS = Object.keys(ITEMS);

// ===================== Utilidades =====================
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function ordinal(n) { return `${n}º`; }

/*
 * Malla de alturas del terreno que rodea la carretera. Cada circuito tiene la suya, porque cada
 * circuito puede tener su propio tamaño de mundo (`def.world`): Arcoíris es mucho más grande que
 * los cuatro primeros. El tamaño de casilla se estira con el mundo para que la malla tenga
 * siempre más o menos las mismas casillas y no se dispare ni el tiempo de montarla ni los
 * triángulos que dibuja la tele. Con el mundo de siempre salen exactamente las casillas de antes.
 */
const TER_CASILLAS = 13500;   // casillas objetivo, sea cual sea el tamaño del mundo
const TER_MARGEN_X = 1400, TER_MARGEN_Y = 1200;   // cuánto terreno sobra alrededor del circuito
export function terrenoDe(W, H) {
  const ancho = W + TER_MARGEN_X, alto = H + TER_MARGEN_Y;
  const cell = Math.max(24, Math.round(Math.sqrt((ancho * alto) / TER_CASILLAS)));
  return { x0: -TER_MARGEN_X / 2, y0: -TER_MARGEN_Y / 2, cell, cols: Math.ceil(ancho / cell) + 1, rows: Math.ceil(alto / cell) + 1 };
}
// El de siempre (1920x1080), para quien no pida otro.
export const TER = terrenoDe(MAP_W, MAP_H);

// ===================== Circuitos =====================
// `geom` es el módulo compartido public/geom.js (spline + remuestreo).
export function buildTrack(def, index, geom) {
  const samples = geom.buildSamples(def.points, SAMPLE_SPACING);
  const N = samples.length;
  const halfW = def.width / 2;
  // tamaño del mundo de este circuito (por defecto, el de toda la vida)
  const W = (def.world && def.world.w) || MAP_W, H = (def.world && def.world.h) || MAP_H;
  const ter = terrenoDe(W, H);
  const elev = new Float32Array(N);
  /*
   * `relieve`: el sube y baja del circuito entero, como una lista de alturas repartidas por el
   * recorrido (`[{ at: 0.25, h: 160 }, …]`, `at` en fracción de vuelta y `h` en píxeles). Entre dos
   * puntos la altura pasa suavemente (nada de rampas de esquí: una transición dura despegaría los
   * karts), y del último se vuelve al primero, que por eso tienen que valer lo mismo… o casi: la
   * meta se cierra sola. Las rampas y los lomos (`features`) se suman **encima** de esta cuesta.
   */
  if (def.relieve && def.relieve.length > 1) {
    const pts = def.relieve.slice().sort((a, b) => a.at - b.at);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      let a = pts[pts.length - 1], b = pts[0], ini = a.at - 1, fin = b.at;
      for (let k = 0; k < pts.length - 1; k++) {
        if (u >= pts[k].at && u < pts[k + 1].at) { a = pts[k]; b = pts[k + 1]; ini = a.at; fin = b.at; break; }
      }
      if (u >= pts[pts.length - 1].at) { a = pts[pts.length - 1]; b = pts[0]; ini = a.at; fin = b.at + 1; }
      const w = fin > ini ? smoothstep(0, 1, (u - ini) / (fin - ini)) : 0;
      elev[i] += lerp(a.h, b.h, w);
    }
  }
  for (const f of def.features || []) {
    const start = Math.floor(f.at * N);
    const len = Math.max(2, Math.round(f.length / SAMPLE_SPACING));
    for (let j = 0; j < len; j++) {
      const i = (start + j) % N, u = j / len;
      if (f.type === 'hill') elev[i] += f.height * 0.5 * (1 - Math.cos(u * Math.PI * 2));
      else if (f.type === 'ramp') elev[i] += f.height * u;
    }
  }
  samples.forEach((s, i) => { s.nx = -Math.sin(s.ang); s.ny = Math.cos(s.ang); s.h = elev[i]; });

  const t = {
    def, index, name: def.name, samples, N, halfW, width: def.width, gravity: def.gravity || 1,
    W, H, ter,
    win: Math.floor(N / 8), boxes: [], grid: [], pads: [], barriers: [], paredes: [], ramps: [], world: null,
    /*
     * La muestra de carretera más cercana a un punto. Se mira en una **rejilla**: el circuito se
     * reparte en celdas y solo se comparan las muestras de la celda y las ocho de alrededor. A lo
     * bruto era recorrer las N muestras en cada llamada, y con un circuito largo («Last Dance»
     * tiene 10.000) eso se comía el frame: siete karts la llaman varias veces por vuelta de bucle.
     * Si en las celdas de alrededor no hubiera nada (un punto perdidísimo), se busca a lo bruto.
     */
    nearest(x, y) {
      const R = this.rejilla;
      let bi = -1, bd = Infinity;
      if (R) {
        const cx = Math.floor((x - R.x0) / R.cell), cy = Math.floor((y - R.y0) / R.cell);
        const maxAro = Math.max(R.cols, R.rows);
        // se mira en anillos de celdas cada vez más grandes y se para en cuanto lo encontrado ya no
        // puede mejorar: lo que haya más allá del anillo está, por fuerza, más lejos
        // el anillo 0 es la celda del propio punto; luego se va abriendo
        for (let aro = 0; aro <= maxAro; aro++) {
          for (let gy = cy - aro; gy <= cy + aro; gy++) {
            if (gy < 0 || gy >= R.rows) continue;
            const borde = Math.abs(gy - cy) === aro;
            for (let gx = cx - aro; gx <= cx + aro; gx++) {
              if (gx < 0 || gx >= R.cols) continue;
              if (!borde && Math.abs(gx - cx) !== aro) continue;    // solo el borde del anillo
              for (const i of R.celdas[gy * R.cols + gx]) {
                const dx = samples[i].x - x, dy = samples[i].y - y;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; bi = i; }
              }
            }
          }
          const garantia = aro * R.cell;
          if (bi >= 0 && bd <= garantia * garantia) break;
        }
      }
      if (bi < 0) {
        bd = Infinity;
        for (let i = 0; i < N; i++) {
          const dx = samples[i].x - x, dy = samples[i].y - y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; bi = i; }
        }
      }
      const s = samples[bi];
      return { i: bi, d: Math.sqrt(bd), lat: (x - s.x) * s.nx + (y - s.y) * s.ny };
    },
    // Muestra más cercana mirando solo alrededor del índice `i0` (±win). Sirve para no confundir
    // dos tramos de carretera que pasan cerca (una horquilla): a cada kart se le busca su tramo.
    nearestNear(x, y, i0, win) {
      let bi = ((i0 % N) + N) % N, bd = Infinity;
      for (let j = -win; j <= win; j++) {
        const i = (((i0 + j) % N) + N) % N;
        const dx = samples[i].x - x, dy = samples[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      const s = samples[bi];
      return { i: bi, d: Math.sqrt(bd), lat: (x - s.x) * s.nx + (y - s.y) * s.ny };
    },
    groundAt(x, y) {
      const near = this.nearest(x, y);
      if (near.d <= halfW + 14) return samples[near.i].h;
      return this.terrainAt(x, y);
    },
    terrainAt(x, y) {
      const T = this.ter;
      const gx = clamp((x - T.x0) / T.cell, 0, T.cols - 1.001), gy = clamp((y - T.y0) / T.cell, 0, T.rows - 1.001);
      const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const h = this.terrain;
      const a = h[iy * T.cols + ix], b = h[iy * T.cols + ix + 1], c = h[(iy + 1) * T.cols + ix], d = h[(iy + 1) * T.cols + ix + 1];
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    },
    inRange(i, from, to) { return from <= to ? (i >= from && i <= to) : (i >= from || i <= to); },
  };
  for (const f of def.boxes) {
    const i = Math.floor(f * N) % N, s = samples[i];
    for (const off of [-halfW * 0.6, 0, halfW * 0.6]) t.boxes.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, respawnAt: 0, view: null });
  }
  for (const f of def.pads || []) t.pads.push(Math.floor(f * N) % N);
  /*
   * Muros centrales (`paredes`): tramos en los que la carretera va **partida en dos caminos** por
   * una pared por el medio. Cada uno lleva por un sitio distinto (y en «Last Dance», a un bioma
   * distinto), y donde la pared se corta se puede cambiar de camino. Para la simulación es una
   * franja prohibida alrededor de la línea central: si entras, te empuja al lado que tengas más
   * cerca. Así no hacen falta ramas de verdad en el trazado, que es un lío para el progreso, las
   * vueltas y los bots.
   */
  for (const w of def.paredes || []) {
    t.paredes.push({ from: Math.floor(w.from * N) % N, to: Math.floor(w.to * N) % N, ancho: w.ancho || 90 });
  }
  for (const b of def.barriers || []) {
    const from = Math.floor(b.from * N) % N, to = Math.floor(b.to * N) % N;
    let side = 0;
    if (b.side === 'outer') {
      let sum = 0;
      for (let i = from; i !== to; i = (i + 1) % N) sum += wrapAngle(samples[(i + 1) % N].ang - samples[i].ang);
      side = sum > 0 ? -1 : 1; // el exterior de la curva es el lado contrario al giro
    }
    t.barriers.push({ from, to, side });
  }
  for (const f of (def.features || []).filter((q) => q.type === 'ramp')) {
    const start = Math.floor(f.at * N);
    t.ramps.push({ start, end: (start + Math.round(f.length / SAMPLE_SPACING)) % N, height: f.height });
  }
  for (let k = 0; k < MAX_KARTS; k++) {
    const row = Math.floor(k / 2), col = k % 2;
    const idx = N - 8 - row * 7 - col * 3;
    const s = samples[idx];
    const off = (col === 0 ? -1 : 1) * halfW * 0.45;
    t.grid.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, ang: s.ang, dist: idx - N });
  }
  /*
   * Rejilla para `nearest`: celdas de unos 400 px con los índices de las muestras que caen dentro.
   * Cada muestra se apunta también en las celdas vecinas que toque su radio de influencia, para que
   * buscar en 3x3 celdas baste siempre.
   */
  {
    const cell = 400;
    const x0 = -TER_MARGEN_X, y0 = -TER_MARGEN_Y;
    const cols = Math.ceil((W + TER_MARGEN_X * 2) / cell), rows = Math.ceil((H + TER_MARGEN_Y * 2) / cell);
    const celdas = new Array(cols * rows);
    for (let i = 0; i < celdas.length; i++) celdas[i] = [];
    for (let i = 0; i < N; i++) {
      const gx = clamp(Math.floor((samples[i].x - x0) / cell), 0, cols - 1);
      const gy = clamp(Math.floor((samples[i].y - y0) / cell), 0, rows - 1);
      celdas[gy * cols + gx].push(i);
    }
    t.rejilla = { cell, x0, y0, cols, rows, celdas };
  }

  // relieve del terreno alrededor de la carretera
  const rnd = mulberry32(77 + index * 31);
  t.terrain = new Float32Array(ter.cols * ter.rows);
  for (let iy = 0; iy < ter.rows; iy++) {
    for (let ix = 0; ix < ter.cols; ix++) {
      const x = ter.x0 + ix * ter.cell, y = ter.y0 + iy * ter.cell;
      const near = t.nearest(x, y);
      const w = 1 - smoothstep(halfW + 40, halfW + 220, near.d);
      const hills = 12 * (Math.sin(x * 0.0065 + 0.4) * Math.cos(y * 0.0079) + 0.6 * Math.sin(x * 0.013 + 1.7) * Math.sin(y * 0.011 + 0.9));
      t.terrain[iy * ter.cols + ix] = lerp(hills, samples[near.i].h, w);
    }
  }
  t.rnd = rnd;
  return t;
}

// ===================== Hooks =====================
/*
 * Todo lo que la simulación «hace hacia fuera» pasa por aquí. Todos son opcionales y no hacen nada
 * por defecto: quien no los pasa (las pruebas) simplemente no ve ni oye nada.
 */
export const DEFAULT_HOOKS = {
  onPhase() {},                 // (fase) cambio de fase: 'lobby' | 'countdown' | 'race' | 'results'
  onCountdown() {},             // (n) 3, 2, 1
  onGo() {},                    // ¡YA!
  onTrackChanged() {},          // (circuito)
  onKartAdded() {},             // (kart) aquí screen.js le cuelga el modelo en k.view
  onKartRemoved() {},           // (kart)
  onSfx() {},                   // (nombre, kart)
  onParticles() {},             // (x, altura, y, opciones)
  onToast() {},                 // (texto, segundos)
  onStatus() {},                // (kart) hay que reenviar su estado al móvil
  onFx() {},                    // (kart, tipo) aviso al móvil: vibración, color…
  onHit() {},                   // (kart, causa) le han dado; causa = { id, tipo } de quien se lo ha hecho
  onShake() {},                 // (intensidad, kart)
  onFlash() {},                 // fogonazo de pantalla (rayo)
  onSquash() {},                // (kart, impulso) aplasta el kart
  onStretch() {},               // (kart, impulso) estira el kart
  onProjectileAdded() {},       // (proyectil)
  onProjectileRemoved() {},     // (proyectil)
  onBananaAdded() {},           // (plátano)
  onBananaRemoved() {},         // (plátano)
  onDrift() {},                 // (kart, nivel) 1, 2, 3 al subir de nivel; -1 cuando suelta el derrape
  onWrongWay() {},              // (kart, siVaAlReves) empieza o deja de ir en sentido contrario
  onRescue() {},                // (kart) lo han recogido y devuelto a la pista
  onChoosing() {},              // (kart, candidatos) se para todo: este kart elige víctima del caracol
  onChosen() {},                // (kart, victima) ya ha elegido (o se ha acabado el tiempo)
  onResults() {},               // (clasificación final)
};

// ===================== La simulación =====================
/*
 * `random` es la única fuente de azar de la simulación (parrilla, maña de los bots, ruleta de
 * objetos…): pasándole una semilla, dos carreras iguales salen idénticas. El valor por defecto es
 * la referencia a la función del sistema; la simulación nunca la llama directamente.
 */
export function createSim({ geom, trackDefs, hooks: userHooks = {}, random = Math.random } = {}) {
  const hooks = { ...DEFAULT_HOOKS, ...(userHooks || {}) };
  const tracks = trackDefs.map((def, i) => buildTrack(def, i, geom));

  const state = {
    phase: 'lobby',
    track: tracks[0],
    laps: 3,
    karts: [], projectiles: [], bananas: [],
    countdownT: 0, cdStep: -1, raceTime: 0, goFlash: 0,
    firstFinish: 0, finishedCount: 0, endAt: 0, results: null,
    simTime: 0,
    // mientras esto no es null, la carrera está **parada**: alguien está eligiendo a quién
    // plantarle el caracol. { kartId, opciones: [id], queda: segundos }
    eligiendo: null,
  };
  // `itemsByPos[posición][objeto]` = cuántas veces ha salido ese objeto a quien iba en esa posición:
  // es la forma de comprobar que el reparto por posición hace lo que dice `rollItem`.
  const stats = { jumps: 0, tricks: 0, rampBoosts: 0, rockets: 0, inks: 0, inkSelf: 0, lianas: 0, terremotos: 0, portales: 0, boings: 0, bumps: 0, pads: 0, maxAir: 0, pickups: 0, itemsUsed: 0, hits: 0, rescues: 0, itemsByPos: {}, driftBoosts: [0, 0, 0] };
  let simTime = 0;
  let statusTimer = 0;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ===================== Karts =====================
  function displayLap(k) { return clamp(k.lapCount + 1, 1, state.laps); }

  function makeKart(e, g) {
    const ch = CHARS[e.char];
    return {
      id: e.playerId != null ? 'p' + e.playerId : e.kb ? 'kb' : 'bot' + e.char,
      playerId: e.playerId != null ? e.playerId : null,
      isKb: !!e.kb, isBot: !!e.bot, isHuman: !e.bot, easy: !!e.easy,
      name: e.name, char: e.char, emoji: ch.emoji, color: ch.color,
      skill: 0.86 + random() * 0.1,
      lane: (random() * 2 - 1) * state.track.halfW * 0.5,
      x: g.x, y: g.y, z: g.h, vz: 0, air: false, ground: g.h, angle: g.ang, moveAngle: g.ang, speed: 0,
      dist: g.dist, gridDist: g.dist, lapCount: -1, rank: 1, offroad: false,
      item: null, rolling: null, itemUseAt: 0,
      boostUntil: 0, starUntil: 0, spinUntil: 0, invUntil: 0, shrinkUntil: 0, slowUntil: 0, lapAt: 0,
      lastRamp: -1, lastRampAt: -99, offT: 0,
      rocketUntil: 0, inkUntil: 0, liana: null,
      enderezaTrasGolpe: false,
      wrongT: 0, wrongWay: false, zapUntil: 0, hitsTaken: 0, aheadT: 0, driftT: 0, driftDir: 0, driftLevel: 0, steerT: 0, steerDir: 0, trick: false, trickAngle: 0, sPrev: 0, stuckT: 0, rescueUntil: 0, airT: 0, lastPad: -1, lastPadAt: 0, lastBoing: 0, dustT: 0,
      finished: false, finishTime: 0, finishRank: 0,
      input: { s: 0, g: 0, b: 0, d: 0 },
      view: null,
    };
  }

  function setInput(k, input) {
    if (!k || !input) return;
    // `s` es analógico (-1 a 1): el volante del móvil manda decimales, el teclado y los bots ±1
    const s = Number(input.s);
    k.input.s = Number.isFinite(s) ? clamp(s, -1, 1) : 0;
    k.input.g = input.g ? 1 : 0; k.input.b = input.b ? 1 : 0; k.input.d = input.d ? 1 : 0;
  }

  // Circuito que se ve en la sala (solo antes de empezar)
  function setTrack(index) {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return;
    const i = ((index % tracks.length) + tracks.length) % tracks.length;
    if (state.track === tracks[i]) return;
    state.track = tracks[i];
    hooks.onTrackChanged(state.track);
    // si alguien estaba calentando, el circuito de debajo ha cambiado: de vuelta a la parrilla nueva
    if (state.phase === 'warmup') {
      state.karts.forEach((k, n) => {
        const g = state.track.grid[n % state.track.grid.length];
        k.x = g.x; k.y = g.y; k.z = g.h; k.ground = g.h; k.vz = 0; k.air = false;
        k.angle = g.ang; k.moveAngle = g.ang; k.speed = 0;
        k.dist = g.dist; k.gridDist = g.dist; k.lapCount = -1;
        k.driftT = 0; k.driftLevel = 0; k.steerT = 0; k.steerDir = 0; k.stuckT = 0; k.offT = 0; k.wrongT = 0;
      });
    }
  }

  function startRace({ entries, trackIndex, laps } = {}) {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return false;
    const list = (entries || []).slice(0, MAX_KARTS);
    if (!list.length) return false;
    for (const k of state.karts) hooks.onKartRemoved(k);
    if (Number.isInteger(trackIndex)) state.track = tracks[((trackIndex % tracks.length) + tracks.length) % tracks.length];
    hooks.onTrackChanged(state.track);
    if (Number.isInteger(laps)) state.laps = clamp(laps, 1, 9);
    /*
     * Un circuito puede fijar sus propias vueltas (`vueltas` en tracks.js). Lo usa «Last Dance»:
     * con tres minutos por vuelta, tres vueltas serían una maratón de diez minutos y nadie quiere
     * eso en una fiesta. Lo que elija la sala se respeta en los demás.
     */
    const suyas = state.track && state.track.def.vueltas;
    if (Number.isInteger(suyas)) state.laps = clamp(suyas, 1, 9);
    for (const b of state.track.boxes) b.respawnAt = 0;
    shuffle(list);
    state.karts = list.map((e, i) => makeKart(e, state.track.grid[i]));
    state.projectiles = []; state.bananas = [];
    state.countdownT = 0; state.cdStep = -1; state.raceTime = 0; state.goFlash = 0;
    state.firstFinish = 0; state.finishedCount = 0; state.endAt = 0; state.results = null;
    state.phase = 'countdown';
    updateRanking();
    for (const k of state.karts) hooks.onKartAdded(k);
    hooks.onPhase('countdown');
    for (const k of state.karts) hooks.onStatus(k);
    return true;
  }

  function showResults() {
    state.phase = 'results';
    updateRanking();
    const sorted = state.karts.slice().sort((a, b) => a.rank - b.rank);
    state.results = sorted.map((k) => ({ pos: k.rank, name: k.name, emoji: k.emoji, color: k.color, finished: k.finished, time: k.finishTime, lap: displayLap(k) }));
    hooks.onResults(state.results);
    hooks.onPhase('results');
    for (const k of state.karts) hooks.onStatus(k);
    hooks.onSfx('finish');
  }

  /*
   * Calentamiento: mientras el anfitrión no pulsa EMPEZAR, quien ya está en la sala puede conducir
   * su kart en la parrilla, justo antes de la meta, para aprender los botones sin que nadie le
   * mire ni le adelante. Se conduce y se choca, y nada más: **ni vueltas, ni cajas, ni objetos, ni
   * clasificación**. Al empezar la carrera, `startRace` los vuelve a poner en la parrilla.
   *
   * Se llama cada vez que cambia quién está en la sala. A quien ya estaba **no se le toca**: si
   * entra alguien mientras tú das una vuelta de prueba, tú sigues donde ibas.
   */
  function warmup({ entries, trackIndex } = {}) {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return false;
    if (Number.isInteger(trackIndex)) setTrack(trackIndex);
    const lista = (entries || []).slice(0, MAX_KARTS);
    const idDe = (e) => (e.playerId != null ? 'p' + e.playerId : e.kb ? 'kb' : 'bot' + e.char);
    const quedan = new Set(lista.map(idDe));
    for (const k of state.karts.slice()) if (!quedan.has(k.id)) removeKart(k);
    const libres = state.track.grid.slice();
    for (const k of state.karts) { const i = libres.findIndex((g) => g && g.dist === k.gridDist); if (i >= 0) libres[i] = null; }
    for (const e of lista) {
      if (state.karts.some((k) => k.id === idDe(e))) continue;
      const hueco = libres.findIndex((g) => g);
      if (hueco < 0) break;
      const k = makeKart(e, libres[hueco]);
      k.gridDist = libres[hueco].dist;
      libres[hueco] = null;
      state.karts.push(k);
      hooks.onKartAdded(k);
      hooks.onStatus(k);
    }
    if (state.phase !== 'warmup') { state.phase = 'warmup'; hooks.onPhase('warmup'); }
    return true;
  }

  function backToLobby() {
    state.phase = 'lobby';
    for (const k of state.karts) hooks.onKartRemoved(k);
    for (const p of state.projectiles) hooks.onProjectileRemoved(p);
    for (const b of state.bananas) hooks.onBananaRemoved(b);
    state.karts = []; state.projectiles = []; state.bananas = []; state.results = null;
    hooks.onPhase('lobby');
  }

  // Saca a un kart de la carrera (su móvil se ha ido)
  function removeKart(k) {
    const idx = state.karts.indexOf(k);
    if (idx < 0) return;
    // si se va justo quien estaba eligiendo víctima, se resuelve solo: nadie se queda esperando
    if (state.eligiendo && state.eligiendo.kartId === k.id) elegirVictima(null);
    hooks.onKartRemoved(k);
    state.karts.splice(idx, 1);
  }

  function allFinished() { return state.karts.length > 0 && state.karts.every((k) => k.finished); }

  // ===================== Física =====================
  function boost(k, dur) {
    k.boostUntil = Math.max(k.boostUntil, simTime + dur);
    hooks.onStretch(k, 6);
    hooks.onSfx('boost', k);
  }

  // `causa` ({ id, tipo }) dice quién se lo ha hecho: sirve para las estadísticas de `npm run race`
  function hitKart(k, causa) {
    const now = simTime;
    if (k.starUntil > now || k.invUntil > now || k.spinUntil > now) return false;
    k.spinUntil = now + SPIN_TIME;
    k.enderezaTrasGolpe = true;      // al acabar el trompo se le pone el morro hacia la carretera
    k.invUntil = now + SPIN_TIME + HIT_IMMUNITY;
    k.speed *= 0.25;
    k.driftT = 0; k.driftLevel = 0; k.steerT = 0; k.boostUntil = 0; k.trick = false;
    k.vz = Math.max(k.vz, 230); k.air = true;
    hooks.onParticles(k.x, k.z + 14, k.y, { n: 14, color: ['#ffe600', '#ffffff', '#ff2d95'], spread: 220, vy: 120, life: 0.7, size: 6 });
    hooks.onShake(6, k);
    hooks.onSfx('hit', k);
    hooks.onFx(k, 'hit');
    hooks.onHit(k, causa || null);
    stats.hits++;
    k.hitsTaken++;
    return true;
  }

  // El tramo de carretera «propio» del kart: la muestra más cercana buscando solo alrededor de su
  // progreso. Con la búsqueda global, un kart que sale despedido en una horquilla se encontraba
  // más cerca del tramo de enfrente, se subía a él (los bots) o lo dejaban allí (el rescate), el
  // antiatajos no le daba crédito y perdía la vuelta entera.
  function tramoDe(k) {
    const t = state.track;
    return t.nearestNear(k.x, k.y, ((k.dist % t.N) + t.N) % t.N, t.win);
  }

  function aiInput(k) {
    const t = state.track, N = t.N;
    const near = tramoDe(k);
    let target;
    if (near.d > t.halfW * 1.6) target = t.samples[near.i];
    else {
      const s = t.samples[(near.i + 24) % N];
      target = { x: s.x + s.nx * k.lane, y: s.y + s.ny * k.lane };
    }
    const desired = Math.atan2(target.y - k.y, target.x - k.x);
    const diff = wrapAngle(desired - k.angle);
    const steer = Math.abs(diff) < 0.05 ? 0 : diff > 0 ? 1 : -1;
    const ahead = t.samples[(near.i + 40) % N];
    const curve = Math.abs(wrapAngle(ahead.ang - t.samples[near.i].ang));
    const brake = curve > 1.5 && k.speed > 340 ? 1 : 0;

    /*
     * De espaldas al camino, lo primero es encararse: con carrerilla se frena, y ya casi parado se
     * da marcha atrás girando al revés. Pero la marcha atrás tiene tope: pasado `AI_REVERSE_MAX`
     * se pisa el gas para pararla. Sin ese tope, un bot que se liaba salía marcha atrás y seguía
     * acelerando hacia atrás sin fin, porque el freno, con la velocidad ya negativa, es justo lo
     * que la hace más negativa.
     */
    const alReves = Math.abs(diff) > AI_WRONG_ANGLE;
    if (k.speed < -AI_REVERSE_MAX) return { s: steer, g: 1, b: 0, d: 0 };
    const reverse = alReves && k.speed < 60;
    const frena = brake || alReves;
    return { s: reverse ? -steer : steer, g: frena ? 0 : 1, b: frena ? 1 : 0, d: 0 };
  }

  // Lo recogen y lo dejan en el punto más cercano de la carretera, mirando en el sentido correcto
  function rescatar(k, near) {
    const s = state.track.samples[near.i];
    k.x = s.x; k.y = s.y; k.z = s.h; k.ground = s.h; k.vz = 0; k.air = false; k.airT = 0;
    k.angle = s.ang; k.moveAngle = s.ang; k.speed = 0;
    k.driftT = 0; k.driftLevel = 0; k.steerT = 0; k.steerDir = 0;
    k.wrongT = 0;
    if (k.wrongWay) { k.wrongWay = false; hooks.onWrongWay(k, false); hooks.onFx(k, 'wrong0'); }
    k.boostUntil = 0; k.trick = false; k.trickAngle = 0; k.offroad = false;
    k.stuckT = 0; k.offT = 0;
    k.rescueUntil = simTime + RESCUE_TIME;
    k.invUntil = Math.max(k.invUntil, simTime + RESCUE_TIME + 0.5);
    stats.rescues++;
    hooks.onRescue(k);
    hooks.onSfx('rescue', k);
    hooks.onFx(k, 'rescue');
    hooks.onToast(`${k.emoji} ${k.name}: ¡de vuelta a la pista!`, 2);
  }

  /*
   * El cohete 🚀 conduce por ti: te pega a la línea central, te lanza a más del doble de velocidad y
   * atropella a quien te encuentres. Por eso no se dirige y no te pueden dar: es un regalo para el
   * que va último, no una ventaja que haya que pilotar.
   */
  // El viaje de la liana: en `LIANA_TIME` segundos te planta detrás del kart al que enganchaste
  function tirarDeLaLiana(k, dt) {
    const t = state.track, now = simTime;
    const l = k.liana;
    const queda = Math.max(0, (l.hasta - now) / LIANA_TIME);
    const avance = 1 - queda;
    k.x = lerp(l.desde.x, l.x, avance);
    k.y = lerp(l.desde.y, l.y, avance);
    k.z = t.groundAt(k.x, k.y); k.ground = k.z; k.vz = 0; k.air = false;
    k.angle = l.ang; k.moveAngle = l.ang;
    k.speed = BASE_MAX_SPEED * 0.9;
    k.offroad = false; k.offT = 0; k.stuckT = 0; k.wrongT = 0;
    hooks.onParticles(k.x, k.z + 12, k.y, { n: 2, color: ['#39ff88', '#8dffc0'], spread: 60, vy: 40, life: 0.4, size: 4 });
    if (now >= l.hasta) { k.liana = null; boost(k, 0.5); }
    const propio = tramoDe(k);
    comprobarSentido(k, propio, dt);
    updateProgress(k, propio, dt);
  }

  function volarConCohete(k, dt) {
    const t = state.track;
    const near = tramoDe(k);
    const delante = t.samples[(near.i + 10) % t.N];
    const objetivo = Math.atan2(delante.y - k.y, delante.x - k.x);
    // se le lleva al centro suavemente, para que no vaya rebotando por los quitamiedos
    const sm = t.samples[near.i];
    k.x = lerp(k.x, sm.x, 1 - Math.exp(-6 * dt));
    k.y = lerp(k.y, sm.y, 1 - Math.exp(-6 * dt));
    k.angle = objetivo; k.moveAngle = objetivo;
    k.speed = BASE_MAX_SPEED * ROCKET_SPEED;
    k.x += Math.cos(objetivo) * k.speed * dt;
    k.y += Math.sin(objetivo) * k.speed * dt;
    k.z = t.groundAt(k.x, k.y); k.ground = k.z; k.vz = 0; k.air = false;
    k.offroad = false; k.offT = 0; k.stuckT = 0; k.wrongT = 0;
    // a quien pille por el camino, se lo lleva por delante
    for (const o of state.karts) {
      if (o === k || o.finished) continue;
      const dx = o.x - k.x, dy = o.y - k.y;
      if (dx * dx + dy * dy < (KART_R * 2.4) * (KART_R * 2.4)) hitKart(o, { id: k.id, tipo: 'rocket' });
    }
    hooks.onParticles(k.x, k.z + 10, k.y, { n: 2, color: ['#ffe600', '#ff6a00', '#ffffff'], spread: 90, vy: 40, life: 0.35, size: 5 });
    const propio = tramoDe(k);
    comprobarSentido(k, propio, dt);
    updateProgress(k, propio, dt);
  }

  function stepKart(k, inp, dt) {
    const t = state.track, now = simTime;
    // mientras lo recogen se queda quieto: es la penalización por salirse
    if (k.rescueUntil > now) { k.speed = 0; k.vz = 0; k.air = false; k.driftT = 0; k.driftLevel = 0; return; }
    if (k.rocketUntil > now) { volarConCohete(k, dt); return; }
    if (k.liana) { tirarDeLaLiana(k, dt); return; }
    const spinning = k.spinUntil > now;
    // se acabó el trompo: el morro, hacia la carretera (ver GOLPE_ENDEREZA). Si no, después de
    // cada caparazón toca buscarse la pista de nuevo, que es lo que más despista jugando.
    if (k.enderezaTrasGolpe && !spinning) {
      k.enderezaTrasGolpe = false;
      const sm = t.samples[tramoDe(k).i];
      k.angle = wrapAngle(k.angle + wrapAngle(sm.ang - k.angle) * GOLPE_ENDEREZA);
      k.moveAngle = k.angle;
    }
    const active = (state.phase === 'race' || state.phase === 'warmup') && !spinning;
    // `inp.d` (el viejo botón de derrape) ya no se usa: el derrape sale solo. Se sigue aceptando en
    // el protocolo para no romper los móviles que lleven la página cargada de antes.
    let s = active ? inp.s : 0, g = active ? inp.g : 0, b = active ? inp.b : 0;
    /*
     * Modo fácil (ver EASY_AYUDA): el gas se pisa solo mientras no frenes, y al volante se le suma
     * una ayuda que apunta a la carretera unas muestras más adelante. Cuanto menos toques tú, más
     * manda la ayuda: con el volante quieto el kart se conduce solo; girando a tope, mandas tú.
     */
    const gasPulsado = !!g;
    if (k.easy && active) {
      if (!b) g = 1;
      const suyo = tramoDe(k);
      const sm = t.samples[(suyo.i + EASY_MIRA) % t.N];
      const rumbo = wrapAngle(Math.atan2(sm.y - k.y, sm.x - k.x) - k.angle);
      s = clamp(s + clamp(rumbo * 2.4, -1, 1) * EASY_AYUDA, -1, 1);
    }

    const near = t.nearest(k.x, k.y);
    const onRoad = near.d <= t.halfW + 3;
    k.offroad = !onRoad && !k.air;
    const boosting = k.boostUntil > now, star = k.starUntil > now, small = k.shrinkUntil > now;
    let maxS = BASE_MAX_SPEED * (k.isBot ? k.skill : 1);
    if (boosting) maxS *= 1.5;
    if (star) maxS *= 1.25;
    if (small) maxS *= 0.7;
    if (k.slowUntil > now) maxS *= SNAIL_SLOW;   // caracol: a paso de tortuga
    if (k.easy && !gasPulsado) maxS *= EASY_MAX;  // modo fácil: sin pisar el gas se va un pelín más despacio
    if (k.offroad && !boosting && !star) maxS *= 0.45;

    if (!k.air) {
      if (g) k.speed += ACCEL * dt;
      else if (b) k.speed -= (k.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
      else { const c = COAST * dt; if (Math.abs(k.speed) <= c) k.speed = 0; else k.speed -= Math.sign(k.speed) * c; }
      // el turbo empuja hasta el 85 % del máximo… salvo si estás frenando: si pisas el freno, frenas.
      // Sin esta salvedad no había manera de parar con un turbo puesto, y un kart que se liaba
      // (bots incluidos) se quedaba dando vueltas a toda pastilla sin poder encararse.
      if (boosting && !b && k.speed < maxS * 0.85) k.speed = maxS * 0.85;
      if (k.speed > maxS) k.speed = Math.max(maxS, k.speed - (k.offroad ? 1100 : 700) * dt);
      const minS = -maxS * 0.35;
      if (k.speed < minS) k.speed = minS;
      if (spinning) k.speed *= Math.pow(0.02, dt);
    } else if (k.speed > maxS * 1.1) k.speed = Math.max(maxS * 1.1, k.speed - 300 * dt);

    const spd = Math.abs(k.speed);
    let turn = 2.7 * clamp(spd / 140, 0, 1);
    if (spd > 320) turn *= 1 - 0.3 * clamp((spd - 320) / 250, 0, 1);
    if (k.air) turn *= 0.35;
    // ---- derrape automático: lo dispara mantener el giro, no un botón ----
    // Para el derrape y el truco solo cuenta *hacia qué lado* giras y si lo haces con ganas
    // (STEER_FIRME): con el volante del móvil `s` es un decimal que no para de moverse.
    const dir = Math.abs(s) >= STEER_FIRME ? (s < 0 ? -1 : 1) : 0;
    if (dir !== 0 && dir === k.steerDir) k.steerT += dt;
    else { k.steerDir = dir; k.steerT = dir !== 0 ? dt : 0; }
    const puedeDerrapar = spd > maxS * DRIFT_MIN_SPEED && !k.offroad && !k.air;
    const seguia = k.driftT > 0;
    const drifting = seguia ? (puedeDerrapar && dir === k.driftDir) : (puedeDerrapar && dir !== 0 && k.steerT >= DRIFT_START);
    if (drifting) {
      turn *= DRIFT_TURN;
      // el reloj del derrape es el del giro: quien lleva 0,8 s girando va por el nivel 1
      k.driftT = seguia ? k.driftT + dt : k.steerT;
      k.driftDir = dir;
      const nivel = k.driftT >= DRIFT_L3 ? 3 : k.driftT >= DRIFT_L2 ? 2 : k.driftT >= DRIFT_L1 ? 1 : 0;
      if (nivel !== k.driftLevel) {
        k.driftLevel = nivel;
        if (nivel > 0) { hooks.onDrift(k, nivel); hooks.onFx(k, 'drift' + nivel); }
      }
    } else if (seguia && !k.air) {
      // en el aire el derrape se queda en pausa (un salto no te quita la carga)
      if (k.driftLevel > 0) { boost(k, DRIFT_BOOST[k.driftLevel - 1]); stats.driftBoosts[k.driftLevel - 1]++; }
      k.driftT = 0; k.driftLevel = 0;
      hooks.onDrift(k, -1);
      hooks.onFx(k, 'drift0');
    }
    // truco en el aire: en un salto de verdad (no en un botecito), un volantazo (o tocar ◀ ▶)
    const tocaTruco = dir !== 0 && k.sPrev === 0;
    if (k.air && tocaTruco && !k.trick && k.z - k.ground > 16 && k.airT > 0.12) { k.trick = true; k.trickAngle = 0; hooks.onSfx('trick', k); }
    k.sPrev = dir;

    k.angle += s * turn * dt * (k.speed >= 0 ? 1 : -1);
    const lag = drifting ? 3.2 : k.air ? 2 : 11;
    k.moveAngle = k.angle + wrapAngle(k.moveAngle - k.angle) * Math.exp(-lag * dt);
    k.x += Math.cos(k.moveAngle) * k.speed * dt;
    k.y += Math.sin(k.moveAngle) * k.speed * dt;

    if (k.x < KART_R) { k.x = KART_R; k.speed *= 0.5; }
    if (k.x > t.W - KART_R) { k.x = t.W - KART_R; k.speed *= 0.5; }
    if (k.y < KART_R) { k.y = KART_R; k.speed *= 0.5; }
    if (k.y > t.H - KART_R) { k.y = t.H - KART_R; k.speed *= 0.5; }

    // bumpers elásticos
    const near2 = t.nearest(k.x, k.y);
    for (const br of t.barriers) {
      if (!t.inRange(near2.i, br.from, br.to)) continue;
      const sideSign = Math.sign(near2.lat) || 1;
      if (br.side !== 0 && sideSign !== br.side) continue;
      const limit = t.halfW + 4;
      /*
       * El quitamiedos es un muro, no un imán: solo empuja a quien lo está tocando. Sin el tope de
       * `BUMPER_ALCANCE`, un kart que acabara lejos de la pista (un caparazón en un salto, por
       * ejemplo) se veía arrastrado de golpe al borde desde cientos de píxeles… y así nunca le
       * tocaba el rescate. Se notó al poner quitamiedos en **todo** el recorrido de los cinco
       * circuitos: antes solo había en algunos tramos y el fallo pasaba desapercibido.
       */
      const fuera = Math.abs(near2.lat) - limit;
      if (fuera > 0 && fuera < BUMPER_ALCANCE && !(k.z - k.ground > 30)) {
        const sm = t.samples[near2.i];
        k.x = sm.x + sm.nx * limit * sideSign; k.y = sm.y + sm.ny * limit * sideSign;
        const vx = Math.cos(k.moveAngle) * k.speed, vy = Math.sin(k.moveAngle) * k.speed;
        const vn = vx * sm.nx + vy * sm.ny;
        if (vn * sideSign > 0) {
          // el morro, hacia la carretera (ver BUMPER_ENDEREZA): sin esto el kart rebota, vuelve a
          // apuntar al muro y se queda dando botes contra el quitamiedos toda la carrera
          const recto = Math.cos(wrapAngle(k.angle - sm.ang)) >= 0 ? sm.ang : sm.ang + Math.PI;
          k.angle = wrapAngle(k.angle + wrapAngle(recto - k.angle) * BUMPER_ENDEREZA);
          setVel(k, vx - vn * sm.nx * 1.7, vy - vn * sm.ny * 1.7);
          k.vz = Math.max(k.vz, 90); k.air = true;
          hooks.onSquash(k, 5);
          hooks.onParticles(k.x, k.z + 8, k.y, { n: 8, color: t.def.theme.bumper, spread: 160, vy: 80, life: 0.5, size: 4 });
          stats.boings++;
          if (now - k.lastBoing > 0.25) { hooks.onSfx('boing', k); k.lastBoing = now; }
          hooks.onShake(3, k);
        }
      }
    }
    // muro central: si te metes en la franja de en medio, te saca al camino que tengas más cerca
    for (const w of t.paredes) {
      if (!t.inRange(near2.i, w.from, w.to)) continue;
      const mitad = w.ancho / 2;
      if (Math.abs(near2.lat) < mitad && !(k.z - k.ground > 40)) {
        const sm = t.samples[near2.i];
        const lado = near2.lat >= 0 ? 1 : -1;
        k.x = sm.x + sm.nx * mitad * lado; k.y = sm.y + sm.ny * mitad * lado;
        const vx = Math.cos(k.moveAngle) * k.speed, vy = Math.sin(k.moveAngle) * k.speed;
        const vn = vx * sm.nx + vy * sm.ny;
        if (vn * lado < 0) {      // iba hacia dentro del muro: rebota hacia su camino
          setVel(k, vx - vn * sm.nx * 1.5, vy - vn * sm.ny * 1.5);
          hooks.onSquash(k, 4);
          hooks.onParticles(k.x, k.z + 8, k.y, { n: 6, color: t.def.theme.bumper, spread: 130, vy: 70, life: 0.4, size: 4 });
          if (now - k.lastBoing > 0.25) { hooks.onSfx('boing', k); k.lastBoing = now; }
        }
      }
    }
    // paneles turbo
    if (!k.air) {
      for (const pi of t.pads) {
        let di = near2.i - pi; if (di > t.N / 2) di -= t.N; if (di < -t.N / 2) di += t.N;
        if (Math.abs(di) <= 3 && Math.abs(near2.lat) < t.halfW * 0.8 && (k.lastPad !== pi || now - k.lastPadAt > 2)) {
          k.lastPad = pi; k.lastPadAt = now;
          boost(k, 1.0);
          stats.pads++;
          hooks.onSfx('pad', k);
          hooks.onParticles(k.x, k.z + 6, k.y, { n: 10, color: t.def.theme.pad, spread: 120, vy: 100, life: 0.5, size: 4 });
        }
      }
    }

    // vertical: gravedad, suelo, saltos y aterrizajes
    const gOld = k.ground;
    const gNew = t.groundAt(k.x, k.y);
    k.ground = gNew;
    const grav = GRAVITY * t.gravity;
    k.vz -= grav * dt;
    k.z += k.vz * dt;
    if (k.z <= gNew) {
      if (k.air) land(k, -k.vz);
      k.z = gNew;
      k.vz = Math.max(k.vz, (gNew - gOld) / dt);
      if (k.vz > 40 && (gNew - gOld) / dt < 40) k.vz = 0;
      k.air = false;
    } else {
      if (!k.air && k.z - gNew > 2) {
        k.air = true;
        if (k.vz > 60) hooks.onSfx('jump', k);
        /*
         * ¿Ha despegado del filo de una rampa? Entonces, turbo de salto (ver RAMPA_TURBO). Con tres
         * condiciones, que sin ellas el premio se descontrola: hay que ir **hacia delante**, hay que
         * **entrar derecho** a la rampa (si llegas de lado, atravesado, no cuenta) y no se puede
         * cobrar dos veces la misma rampa en poco rato — un kart dando tumbos entraba y salía del
         * aire encima de la rampa y se pasaba la carrera con turbo.
         */
        const rampa = t.ramps.find((r) => t.inRange(near2.i, r.start, (r.end + 4) % t.N));
        const derecho = Math.abs(wrapAngle(k.moveAngle - t.samples[near2.i].ang)) < 0.6;
        if (rampa && k.speed > 120 && derecho && (k.lastRamp !== rampa.start || now - k.lastRampAt > RAMPA_ESPERA)) {
          k.lastRamp = rampa.start; k.lastRampAt = now;
          boost(k, Math.min(RAMPA_TURBO_MAX, rampa.height * RAMPA_TURBO));
          stats.rampBoosts++;
          hooks.onFx(k, 'salto');
        }
      }
    }
    k.airT = k.air ? k.airT + dt : 0;
    if (k.air && k.trick) k.trickAngle = Math.min(Math.PI * 2, k.trickAngle + dt * 9);
    if (k.air) stats.maxAir = Math.max(stats.maxAir, k.z - k.ground);
    if (k.offroad && spd > 60) { k.dustT += dt; if (k.dustT > 0.06) { k.dustT = 0; hooks.onParticles(k.x, k.z + 3, k.y, { n: 2, color: [t.def.theme.groundAlt, t.def.theme.ground], spread: 40, vy: 50, life: 0.6, size: 6, g: 60 }); } }

    // ¿perdido o clavado? a los RESCUE_AFTER segundos, de vuelta a la carretera
    if ((state.phase === 'race' || state.phase === 'warmup') && !k.finished && !spinning) {
      const propio = tramoDe(k);                   // su tramo, no el que le pille más cerca
      const lento = Math.abs(k.speed) < RESCUE_SLOW && !k.air;
      const perdido = propio.d > t.halfW + RESCUE_FAR;
      const atascado = lento && (g || b);          // pisa el gas y no se mueve: contra un muro
      const abandonado = lento && k.offroad;       // parado fuera de la pista
      // y el que lleva un buen rato corriendo al revés: con el aviso no ha bastado, se le recoge
      if (k.wrongT >= WRONG_WAY_RESCUE) { rescatar(k, propio); return; }
      /*
       * Y el que lleva mucho rato **fuera de la pista aunque se mueva**: penando por el campo a un
       * tercio de velocidad, dando botes y sin encontrar la vuelta. Antes solo se recogía a quien
       * estaba casi parado, así que se podían perder diez segundos ahí. A quien va rápido por fuera
       * (un atajo, una salida de curva) no le pasa nada: el reloj se le va reiniciando.
       */
      // ojo: se mira la distancia a **su** tramo, no la bandera `offroad`, que se apaga en el aire:
      // un kart dando botes por el campo la encendía y apagaba y el reloj no llegaba a nada
      k.offT = propio.d > t.halfW + 3 ? k.offT + dt : 0;
      if (k.offT >= OFFROAD_RESCUE) { rescatar(k, propio); return; }
      if (perdido || atascado || abandonado) k.stuckT += dt; else k.stuckT = 0;
      if (k.stuckT >= RESCUE_AFTER) { rescatar(k, propio); return; }
    }

    comprobarSentido(k, near2, dt);
    updateProgress(k, near2, dt);
  }

  function land(k, impact) {
    stats.jumps++;
    hooks.onSquash(k, clamp(impact / 60, 1, 8));
    if (impact > 120) hooks.onParticles(k.x, k.z + 2, k.y, { n: 8, color: ['#ffffff', state.track.def.theme.groundAlt], spread: 120, vy: 60, life: 0.5, size: 4, g: 200 });
    // Un aterrizaje fuerte da un botecito, pero con tope: sin él, al caer de un salto grande se
    // rebotaba, se volvía a rebotar y el kart se quedaba trotando en el sitio sin poder acelerar
    // (en el aire no se acelera). Con el tope, el segundo golpe ya no llega al mínimo y se acabó.
    if (impact > 420) { k.vz = Math.min(impact * 0.22, REBOTE_MAX); k.air = true; }
    if (k.trick) {
      k.trick = false; k.trickAngle = 0;
      if (k.airT >= 0.4) { stats.tricks++; boost(k, 0.9); if (k.isHuman) hooks.onToast(`${k.emoji} ${k.name}: ¡truco! 🤸`, 1.5); }
    }
    if (impact > 80) hooks.onSfx('land', k);
  }

  // ¿va en sentido contrario? Se mira si su movimiento apunta contra el trazado de su tramo. No
  // cuenta mientras da un trompo, mientras lo recogen ni casi parado (ahí cualquiera se lía).
  function comprobarSentido(k, near, dt) {
    const s = state.track.samples[near.i];
    const alReves = state.phase === 'race' && !k.finished && k.spinUntil <= simTime && k.rescueUntil <= simTime
      && Math.abs(k.speed) > WRONG_WAY_SPEED
      && Math.cos(k.moveAngle - s.ang) * Math.sign(k.speed) < -0.3;
    // el reloj no se pone a cero de golpe: baja rápido pero baja. Un kart que da bandazos yendo al
    // revés lo reiniciaba con cada coletazo y así no llegaba nunca ni al aviso ni al rescate.
    k.wrongT = alReves ? k.wrongT + dt : Math.max(0, k.wrongT - dt * 2);
    const aviso = k.wrongT >= WRONG_WAY_TIME;
    if (aviso !== k.wrongWay) {
      k.wrongWay = aviso;
      hooks.onWrongWay(k, aviso);
      hooks.onFx(k, aviso ? 'wrong' : 'wrong0');
      if (aviso) hooks.onSfx('wrong', k);
    }
  }

  function updateProgress(k, near, dt) {
    const t = state.track, N = t.N;
    if (near.d > t.halfW * 2.5) return;
    const cur = ((k.dist % N) + N) % N;
    let delta = near.i - cur;
    if (delta > N / 2) delta -= N; else if (delta < -N / 2) delta += N;
    // Un salto adelante grande suele ser un vuelo por encima de un trozo de pista, y no cuenta: si
    // no, cortar el circuito saldría gratis. Pero si el kart sigue ahí un rato, es que de verdad
    // está ahí, y congelarle el progreso una vuelta entera (y mentir en la clasificación) es mucho
    // peor que el atajo: a los PROGRESS_JUMP_WAIT segundos se le acepta el salto.
    if (Math.abs(delta) > t.win) {
      k.aheadT += dt;
      if (k.aheadT < PROGRESS_JUMP_WAIT) return;
    }
    k.aheadT = 0;
    k.dist += delta;
    if (state.phase !== 'race') return;    // en calentamiento se conduce, pero no se cuentan vueltas
    const lap = Math.floor(k.dist / N);
    if (lap > k.lapCount) {
      k.lapCount = lap;
      k.lapAt = simTime;              // cuándo empezó esta vuelta (la tele lo usa para sus avisos)
      if (!k.finished && state.phase === 'race') {
        if (lap >= state.laps) finishKart(k);
        else if (lap > 0) {
          hooks.onSfx('lap', k);
          if (k.isHuman && lap === state.laps - 1) hooks.onToast(`${k.emoji} ${k.name}: ¡última vuelta!`, 2.5);
        }
      }
    }
  }

  function finishKart(k) {
    k.finished = true;
    k.finishTime = state.raceTime;
    k.finishRank = ++state.finishedCount;
    k.item = null; k.rolling = null;
    if (!state.firstFinish) state.firstFinish = state.raceTime;
    hooks.onToast(`🏁 ${k.emoji} ${k.name} termina ${ordinal(k.finishRank)}`, 3.5);
    hooks.onParticles(k.x, k.z + 60, k.y, { n: 40, color: 'rainbow', spread: 260, vy: 160, life: 1.6, size: 5, g: 300, flat: true });
    hooks.onSfx('finishKart', k);
    hooks.onStatus(k);
  }

  function setVel(k, vx, vy) {
    const sp = Math.hypot(vx, vy);
    if (sp < 1) { k.speed = 0; return; }
    const ang = Math.atan2(vy, vx);
    const forward = Math.cos(wrapAngle(ang - k.angle)) >= 0;
    k.speed = forward ? sp : -sp;
    k.moveAngle = forward ? ang : ang + Math.PI;
  }

  function collideKarts() {
    const ks = state.karts, now = simTime;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (Math.abs(a.z - b.z) > 24) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy, minD = KART_R * 2;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = minD - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const avx = Math.cos(a.moveAngle) * a.speed, avy = Math.sin(a.moveAngle) * a.speed;
        const bvx = Math.cos(b.moveAngle) * b.speed, bvy = Math.sin(b.moveAngle) * b.speed;
        const rel = (avx - bvx) * nx + (avy - bvy) * ny;
        if (rel > 0) {
          const imp = rel * 0.9;
          setVel(a, avx - imp * nx, avy - imp * ny);
          setVel(b, bvx + imp * nx, bvy + imp * ny);
          if (rel > 120) {
            const hop = clamp(rel * 0.45, 40, 160);
            a.vz = Math.max(a.vz, hop * 0.6); b.vz = Math.max(b.vz, hop); a.air = b.air = true;
            hooks.onSquash(a, 3); hooks.onSquash(b, 3);
            hooks.onParticles((a.x + b.x) / 2, (a.z + b.z) / 2 + 10, (a.y + b.y) / 2, { n: 8, color: ['#ffffff', '#ffe600'], spread: 160, vy: 80, life: 0.4, size: 4 });
            stats.bumps++;
            if (now - a.lastBoing > 0.25) { hooks.onSfx('bump', a); a.lastBoing = now; }
          }
        }
        const aStar = a.starUntil > now, bStar = b.starUntil > now;
        if (aStar && !bStar) hitKart(b, { id: a.id, tipo: 'star' });
        if (bStar && !aStar) hitKart(a, { id: b.id, tipo: 'star' });
      }
    }
  }

  // ===================== Objetos =====================
  function rollItem(rank, n) {
    const r = n > 1 ? (rank - 1) / (n - 1) : 0.5;
    /*
     * Objetos propios del circuito (`itemsExtra` en tracks.js). Se suman al reparto normal con el
     * peso que diga cada uno: así «Last Dance» puede tener sus tres fumadas sin tocarle el reparto
     * a los demás circuitos.
     */
    const propios = (state.track && state.track.def.itemsExtra) || [];
    const ultimos = r > 0.55;          // de la mitad de atrás para abajo
    const w = [
      // al quitar el caparazón verde, el que va primero se quedaba con dos objetos y casi siempre
      // plátano: se le sube el champiñón para que al menos sea mitad y mitad
      ['mushroom', 3 + 2 * r], ['banana', 3 - 1.5 * r],
      ['red', rank === 1 ? 0 : 1 + 3 * r], ['star', 4 * r * r], ['lightning', n >= 3 ? 3 * r * r * r : 0],
      // el caracol es raro y solo aparece si hay a quién elegir; el que va primero no lo saca
      ['snail', n >= 2 && rank > 1 ? 2 * r * r : 0],
      // Lo gordo, solo para la parte de atrás de la parrilla: el cohete y el caparazón azul son
      // para remontar, no para que el que va segundo remate al primero. Cuanto más atrás, más
      // probables; al primero nunca le salen.
      ['rocket', n >= 3 && ultimos ? 5 * r * r * r : 0],
      ['blue', n >= 3 && rank > 2 ? 3.2 * r * r : 0],
      // la tinta la puede llevar cualquiera menos el líder: a él le estalla (ver `inkSelf`)
      ['ink', n >= 3 && rank > 1 ? 2 + 1.5 * r : 0],
      // y la broma para el que va primero: una de cada catorce cajas le revienta un calamarazo
      ['inkSelf', rank === 1 && n >= 3 ? 0.55 : 0],
    ];
    for (const extra of propios) {
      // cada objeto propio dice su peso base y, si quiere, desde qué puesto sale
      const desde = extra.desde || 1;
      const peso = rank >= desde ? extra.peso * (extra.conLaPosicion === false ? 1 : 0.4 + 1.2 * r) : 0;
      w.push([extra.id, peso]);
    }
    const total = w.reduce((acc, [, x]) => acc + x, 0);
    let x = random() * total;
    for (const [id, wt] of w) { x -= wt; if (x <= 0) return id; }
    return 'mushroom';
  }

  function checkBoxes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.item || k.rolling || k.finished) continue;
      for (const box of state.track.boxes) {
        if (box.respawnAt > now) continue;
        const dx = box.x - k.x, dy = box.y - k.y;
        if (dx * dx + dy * dy < BOX_ALCANCE * BOX_ALCANCE && Math.abs(k.z - box.h) < 60) {
          box.respawnAt = now + BOX_RESPAWN;
          k.rolling = { until: now + ROULETTE_TIME, result: rollItem(k.rank, state.karts.length) };
          stats.pickups++;
          const fila = stats.itemsByPos[k.rank] || (stats.itemsByPos[k.rank] = {});
          fila[k.rolling.result] = (fila[k.rolling.result] || 0) + 1;
          hooks.onParticles(box.x, box.h + 18, box.y, { n: 16, color: 'rainbow', spread: 200, vy: 120, life: 0.7, size: 5 });
          hooks.onSfx('pickup', k);
          hooks.onStatus(k);
          break;
        }
      }
    }
  }

  function finishRoulettes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.rolling && now >= k.rolling.until) {
        /*
         * `inkSelf` no es un objeto: es la broma que le puede tocar al que va primero. En vez de
         * llevarse algo, se lleva un calamarazo en la cara y sigue corriendo a ciegas un rato. Así
         * el líder también tiene algo que temer al pasar por una caja.
         */
        if (k.rolling.result === 'inkSelf') {
          k.rolling = null;
          k.inkUntil = Math.max(k.inkUntil, now + INK_SELF_TIME);
          stats.inkSelf++;
          hooks.onFx(k, 'ink');
          hooks.onSfx('ink', k);
          hooks.onToast(`${k.emoji} ${k.name}: ¡calamarazo por ir primero! 🦑`, 2.2);
          hooks.onStatus(k);
          continue;
        }
        k.item = k.rolling.result; k.rolling = null;
        k.itemUseAt = now + 0.8 + random() * 2.5;
        hooks.onStatus(k);
      }
      if (k.isBot && k.item && now >= k.itemUseAt) {
        if (k.item === 'banana' && now < k.itemUseAt + 6) {
          const behind = state.karts.some((o) => o !== k && o.dist < k.dist && k.dist - o.dist < 60);
          if (!behind) continue;
        }
        useItem(k);
      }
    }
  }

  function useItem(k) {
    const now = simTime;
    if (!k.item || k.spinUntil > now || k.finished || state.phase !== 'race') return;
    const it = k.item;
    k.item = null;
    stats.itemsUsed++;
    const cos = Math.cos(k.angle), sin = Math.sin(k.angle);
    switch (it) {
      case 'mushroom': boost(k, 1.2); break;
      case 'banana': {
        const bn = { x: k.x - cos * 34, y: k.y - sin * 34, z: null, owner: k.id, bornAt: now, view: null };
        state.bananas.push(bn);
        hooks.onBananaAdded(bn);
        if (state.bananas.length > 30) hooks.onBananaRemoved(state.bananas.shift());
        hooks.onSfx('drop', k);
        break;
      }
      case 'red': {
        const ahead = state.karts.find((o) => o.rank === k.rank - 1) || null;
        const p = { type: 'red', x: k.x + cos * 28, y: k.y + sin * 28, z: 0, angle: k.angle, speed: RED_SPEED, owner: k.id, bornAt: now, life: 9, targetId: ahead ? ahead.id : null, dead: false, view: null };
        state.projectiles.push(p);
        hooks.onProjectileAdded(p);
        hooks.onSfx('shell', k);
        break;
      }
      case 'blue': {
        // sale al centro de la carretera y se va, disparado, a buscar al primero
        const near = tramoDe(k);
        const sm = state.track.samples[near.i];
        const lider = state.karts.find((o) => o.rank === 1 && !o.finished) || null;
        const p = {
          type: 'blue', x: sm.x, y: sm.y, z: 0, angle: sm.ang, speed: BLUE_SPEED,
          owner: k.id, bornAt: now, life: BLUE_LIFE, targetId: lider ? lider.id : null,
          dist: near.i, dead: false, view: null,
        };
        state.projectiles.push(p);
        hooks.onProjectileAdded(p);
        hooks.onSfx('shell', k);
        hooks.onFx(k, 'blue');
        break;
      }
      case 'rocket': {
        // te agarra, te pone en el centro y te dispara: mientras dura, ni se conduce ni te dan
        const near = tramoDe(k);
        const sm = state.track.samples[near.i];
        k.x = sm.x; k.y = sm.y; k.z = sm.h; k.ground = sm.h; k.vz = 0; k.air = false;
        k.angle = sm.ang; k.moveAngle = sm.ang;
        k.rocketUntil = now + ROCKET_TIME;
        k.invUntil = Math.max(k.invUntil, k.rocketUntil + 0.3);
        k.spinUntil = 0; k.driftT = 0; k.driftLevel = 0;
        stats.rockets++;
        hooks.onFx(k, 'rocket');
        hooks.onSfx('rocket', k);
        hooks.onToast(`${k.emoji} ${k.name}: ¡cohete! 🚀`, 2);
        break;
      }
      case 'liana': {
        // engancha al primero que tenga por delante dentro del alcance y se lanza hacia él
        const t2 = state.track;
        const objetivo = state.karts
          .filter((o) => o !== k && !o.finished && o.dist > k.dist && (o.dist - k.dist) * SAMPLE_SPACING < LIANA_ALCANCE)
          .sort((a, b) => a.dist - b.dist)[0];
        if (!objetivo) { boost(k, 1.0); hooks.onToast(`${k.emoji} ${k.name}: la liana no engancha a nadie… turbo de consolación 🌿`, 2); break; }
        const sm = t2.samples[((Math.round(objetivo.dist) % t2.N) + t2.N) % t2.N];
        k.liana = { hasta: now + LIANA_TIME, x: sm.x - Math.cos(sm.ang) * 40, y: sm.y - Math.sin(sm.ang) * 40, ang: sm.ang, desde: { x: k.x, y: k.y } };
        k.invUntil = Math.max(k.invUntil, now + LIANA_TIME + 0.2);
        stats.lianas++;
        hooks.onFx(k, 'liana');
        hooks.onSfx('liana', k);
        hooks.onToast(`${k.emoji} ${k.name} se engancha con la liana a ${objetivo.emoji} ${objetivo.name} 🌿`, 2);
        break;
      }
      case 'terremoto': {
        let sacudidos = 0;
        for (const o of state.karts) {
          if (o === k || o.finished || o.starUntil > now) continue;
          o.vz = Math.max(o.vz, TERREMOTO_FUERZA * (0.7 + random() * 0.6));
          o.air = true;
          o.speed *= 0.55;
          o.driftT = 0; o.driftLevel = 0;
          o.angle += (random() - 0.5) * 1.2;
          hooks.onFx(o, 'terremoto');
          hooks.onParticles(o.x, o.z + 6, o.y, { n: 12, color: ['#8a5a2b', '#c98a4b', '#ffd000'], spread: 180, vy: 140, life: 0.8, size: 5 });
          sacudidos++;
        }
        stats.terremotos++;
        hooks.onShake(14, k);
        hooks.onFlash();
        hooks.onSfx('terremoto', k);
        hooks.onToast(`${k.emoji} ${k.name} sacude la jungla: ${sacudidos} por los aires 🌋`, 2.4);
        break;
      }
      case 'portal': {
        const t2 = state.track;
        const saltos = Math.round(PORTAL_SALTO / SAMPLE_SPACING);
        const destino = ((Math.round(k.dist) + saltos) % t2.N + t2.N) % t2.N;
        const sm = t2.samples[destino];
        hooks.onParticles(k.x, k.z + 20, k.y, { n: 22, color: ['#b14bff', '#00e5ff', '#ffffff'], spread: 220, vy: 120, life: 0.7, size: 5 });
        k.x = sm.x; k.y = sm.y; k.z = sm.h; k.ground = sm.h; k.vz = 0; k.air = false;
        k.angle = sm.ang; k.moveAngle = sm.ang;
        k.dist += saltos;
        k.speed = Math.max(k.speed, BASE_MAX_SPEED * 0.8);
        k.aheadT = 0;     // el salto es legal: no es un atajo volando, es el portal
        stats.portales++;
        hooks.onParticles(k.x, k.z + 20, k.y, { n: 22, color: ['#b14bff', '#00e5ff', '#ffffff'], spread: 220, vy: 120, life: 0.7, size: 5 });
        hooks.onFx(k, 'portal');
        hooks.onSfx('portal', k);
        hooks.onToast(`${k.emoji} ${k.name} se abre un portal 🌀`, 2);
        break;
      }
      case 'ink': {
        let manchados = 0;
        for (const o of state.karts) {
          if (o === k || o.finished || o.starUntil > now) continue;
          o.inkUntil = Math.max(o.inkUntil, now + INK_TIME);
          hooks.onFx(o, 'ink');
          manchados++;
        }
        stats.inks++;
        hooks.onSfx('ink', k);
        hooks.onToast(`${k.emoji} ${k.name} llena de tinta a ${manchados === 1 ? 'su rival' : 'los demás'} 🦑`, 2.2);
        break;
      }
      case 'snail': {
        // se para todo y este kart elige. Las opciones son los demás que siguen en carrera.
        const opciones = state.karts.filter((o) => o !== k && !o.finished).map((o) => o.id);
        if (!opciones.length) { boost(k, 0.6); break; }   // si no queda nadie, al menos un empujoncito
        state.eligiendo = { kartId: k.id, opciones, queda: SNAIL_CHOICE_TIME };
        hooks.onChoosing(k, opciones.map((id) => state.karts.find((o) => o.id === id)));
        hooks.onSfx('snail', k);
        break;
      }
      case 'star':
        k.starUntil = now + 7; k.spinUntil = 0;
        hooks.onFx(k, 'star');
        hooks.onParticles(k.x, k.z + 20, k.y, { n: 24, color: 'rainbow', spread: 240, vy: 150, life: 0.9, size: 5 });
        hooks.onSfx('star', k);
        break;
      case 'lightning':
        for (const o of state.karts) {
          if (o === k || o.starUntil > now || o.zapUntil > now) continue;
          o.zapUntil = now + LIGHTNING_IMMUNITY;
          o.shrinkUntil = now + 5;
          if (o.spinUntil <= now && o.invUntil <= now) { o.spinUntil = now + 0.6; o.speed *= 0.4; o.vz = Math.max(o.vz, 120); o.air = true; hooks.onHit(o, { id: k.id, tipo: 'lightning' }); }
          hooks.onParticles(o.x, o.z + 30, o.y, { n: 10, color: ['#ffe600', '#00e5ff'], spread: 100, vy: -200, life: 0.5, size: 4, g: 0 });
          hooks.onFx(o, 'zap');
        }
        hooks.onFlash();
        hooks.onShake(10, k);
        hooks.onSfx('lightning', k);
        break;
      default: break;
    }
    hooks.onStatus(k);
  }

  /*
   * Plantarle el caracol a alguien y seguir la carrera. `victimaId` puede venir del móvil de quien
   * eligió o, si se acabó el tiempo, lo decidimos aquí: el que va justo delante, que es lo que
   * habría elegido casi todo el mundo.
   */
  function elegirVictima(victimaId) {
    const e = state.eligiendo;
    if (!e) return false;
    const quien = state.karts.find((o) => o.id === e.kartId) || null;
    let victima = e.opciones.includes(victimaId) ? state.karts.find((o) => o.id === victimaId) : null;
    if (!victima) {
      // por defecto, el de justo delante; si quien eligió ya no está, el que vaya primero
      const rangoBase = quien ? quien.rank : state.karts.length + 1;
      const candidatos = state.karts.filter((o) => e.opciones.includes(o.id));
      victima = candidatos.filter((o) => o.rank < rangoBase).sort((a, b) => b.rank - a.rank)[0]
        || candidatos.sort((a, b) => a.rank - b.rank)[0] || null;
    }
    state.eligiendo = null;
    if (victima) {
      victima.slowUntil = simTime + SNAIL_TIME;
      victima.speed *= SNAIL_SLOW;
      hooks.onFx(victima, 'snail');
      hooks.onSfx('snailHit', victima);
      hooks.onParticles(victima.x, victima.z + 18, victima.y, { n: 16, color: ['#7dff3f', '#39ff88', '#ffffff'], spread: 120, vy: 60, life: 0.9, size: 5 });
      hooks.onToast(`🐌 ${quien ? quien.emoji + ' ' + quien.name : 'Alguien'} frena a ${victima.emoji} ${victima.name}`, 2.5);
      if (quien) hooks.onStatus(quien);
      hooks.onStatus(victima);
    }
    hooks.onChosen(quien, victima);
    return true;
  }

  function stepProjectiles(dt) {
    const t = state.track, now = simTime;
    for (const p of state.projectiles) {
      if (p.dead) continue;
      let homing = false;
      if (p.type === 'blue') {
        /*
         * El azul no persigue: **corre por la carretera**. Cada paso se engancha a la línea central
         * un poco más adelante, así que su camino es una raya fina por el centro (BLUE_PASILLO) y
         * solo se lleva por delante a quien esté justo ahí. Al primero le da si va por el medio;
         * si se abre o corta por la cuerda, se libra.
         */
        homing = true;
        const near = t.nearestNear(p.x, p.y, ((p.dist % t.N) + t.N) % t.N, t.win);
        p.dist = near.i;
        const sm = t.samples[(near.i + 6) % t.N];
        const desired = Math.atan2(sm.y - p.y, sm.x - p.x);
        p.angle += clamp(wrapAngle(desired - p.angle), -9 * dt, 9 * dt);
        // si ya ha pasado al primero y sigue vivo, se apaga en cuanto se le acabe la vida
        const objetivo = p.targetId ? state.karts.find((k) => k.id === p.targetId) : null;
        if (objetivo && !objetivo.finished) {
          const dx = objetivo.x - p.x, dy = objetivo.y - p.y;
          if (dx * dx + dy * dy < 40000) {   // ya lo tiene a tiro: se endereza hacia él lo justo
            const haciaEl = Math.atan2(dy, dx);
            p.angle += clamp(wrapAngle(haciaEl - p.angle), -3 * dt, 3 * dt);
          }
        }
      }
      if (p.type === 'red' && p.targetId) {
        const tgt = state.karts.find((k) => k.id === p.targetId);
        if (tgt) {
          homing = true;
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          let desired;
          if (Math.hypot(dx, dy) < 260) desired = Math.atan2(dy, dx);
          else { const near = t.nearest(p.x, p.y); const s = t.samples[(near.i + 16) % t.N]; desired = Math.atan2(s.y - p.y, s.x - p.x); }
          const diff = wrapAngle(desired - p.angle), maxTurn = 7 * dt;
          p.angle += clamp(diff, -maxTurn, maxTurn);
        }
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.z = t.groundAt(p.x, p.y) + 8;
      const age = now - p.bornAt;
      if (age > p.life || p.x < 0 || p.x > t.W || p.y < 0 || p.y > t.H) { p.dead = true; continue; }
      if (!homing && t.nearest(p.x, p.y).d > t.halfW + 30) { p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); continue; }
      for (const k of state.karts) {
        if (k.id === p.owner && (p.type === 'red' || p.type === 'blue' || age < 0.5)) continue;
        if (k.z - p.z > 22) continue; // saltando por encima
        const dx = k.x - p.x, dy = k.y - p.y;
        const alcance = p.type === 'blue' ? KART_R + BLUE_PASILLO / 2 : KART_R + 10;
        if (dx * dx + dy * dy < alcance * alcance) {
          if (k.starUntil > now) { p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); }
          else if (hitKart(k, { id: p.owner, tipo: p.type })) p.dead = true;
          break;
        }
      }
      if (p.dead) continue;
      for (let i = state.bananas.length - 1; i >= 0; i--) {
        const bn = state.bananas[i];
        const dx = bn.x - p.x, dy = bn.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) { hooks.onBananaRemoved(bn); state.bananas.splice(i, 1); p.dead = true; hooks.onParticles(p.x, p.z, p.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
      }
    }
    for (const p of state.projectiles) if (p.dead) hooks.onProjectileRemoved(p);
    state.projectiles = state.projectiles.filter((p) => !p.dead);
  }

  function checkBananas() {
    const now = simTime;
    for (let i = state.bananas.length - 1; i >= 0; i--) {
      const bn = state.bananas[i];
      for (const k of state.karts) {
        if (bn.owner === k.id && now < bn.bornAt + 0.7) continue;
        if (k.z - k.ground > 22) continue;
        const dx = bn.x - k.x, dy = bn.y - k.y;
        if (dx * dx + dy * dy < (KART_R + 10) * (KART_R + 10)) {
          if (k.starUntil > now || hitKart(k, { id: bn.owner, tipo: 'banana' })) { hooks.onBananaRemoved(bn); state.bananas.splice(i, 1); hooks.onParticles(bn.x, k.z + 6, bn.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
        }
      }
    }
  }

  // ===================== Bucle de simulación =====================
  function updateRanking() {
    const arr = state.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
    arr.forEach((k, i) => { k.rank = i + 1; });
  }

  function update(dt) {
    // durante la pausa del caracol el reloj de la simulación no corre: si corriera, los turbos,
    // las estrellas y los trompos de todo el mundo se irían consumiendo con el juego parado
    if (!state.eligiendo) { simTime += dt; state.simTime = simTime; }
    if (state.phase === 'countdown') {
      state.countdownT += dt;
      const step = Math.floor(state.countdownT);
      if (step !== state.cdStep) {
        state.cdStep = step;
        if (step < 3) { hooks.onSfx('beep'); hooks.onCountdown(3 - step); }
      }
      if (state.countdownT >= 3) {
        state.phase = 'race'; state.raceTime = 0; state.goFlash = 1.2;
        hooks.onGo();
        hooks.onSfx('go');
        hooks.onPhase('race');
      }
      return;
    }
    /*
     * Calentamiento: se conduce, pero no se juega. Los karts se mueven y se chocan entre ellos (que
     * ya es medio divertido), les recogen si se quedan clavados, y nada más: ni vueltas, ni cajas,
     * ni objetos, ni clasificación.
     */
    if (state.phase === 'warmup') {
      for (const k of state.karts) stepKart(k, k.isBot ? aiInput(k) : k.input, dt);
      collideKarts();
      statusTimer += dt;
      if (statusTimer >= 0.3) { statusTimer = 0; for (const k of state.karts) hooks.onStatus(k); }
      return;
    }
    if (state.phase !== 'race') return;

    // Caracol: la carrera está parada mientras alguien elige. No avanza ni el tiempo de vuelta ni
    // ningún efecto; lo único que corre es la cuenta atrás para elegir.
    if (state.eligiendo) {
      state.eligiendo.queda -= dt;
      if (state.eligiendo.queda <= 0) elegirVictima(null);
      return;
    }

    state.raceTime += dt;
    for (const k of state.karts) {
      // los bots y quien ya ha terminado van solos; a los demás les mueve lo último que mandó su móvil
      const inp = (k.isBot || k.finished) ? aiInput(k) : k.input;
      stepKart(k, inp, dt);
    }
    collideKarts();
    stepProjectiles(dt);
    checkBananas();
    checkBoxes();
    finishRoulettes();
    updateRanking();

    statusTimer += dt;
    if (statusTimer >= 0.3) { statusTimer = 0; for (const k of state.karts) hooks.onStatus(k); }

    const humans = state.karts.filter((k) => k.isHuman);
    if (!state.endAt) {
      if (humans.length && humans.every((k) => k.finished)) state.endAt = simTime + 2.5;
      else if (state.firstFinish && state.raceTime - state.firstFinish > 60) state.endAt = simTime;
      else if (state.raceTime > 60 * 8) state.endAt = simTime;
    }
    if (state.endAt && simTime >= state.endAt) showResults();
  }

  return {
    tracks, state, stats,
    startRace, warmup, update, setInput, useItem, aiInput, hitKart, boost, backToLobby, removeKart, elegirVictima, rollItem,
    setTrack, displayLap, updateRanking, allFinished,
    now: () => simTime,
  };
}
