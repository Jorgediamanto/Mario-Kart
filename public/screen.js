/* global KART_TRACKS, KART_GEOM */
/*
 * Kart Party — pantalla 3D (la tele)
 * La simulación vive en sim.mjs; aquí solo está lo que se ve y se oye: mundo 3D, modelos de los
 * karts, partículas, cámara, HUD, audio y la conexión con los móviles a través del servidor.
 * Coordenadas: el plano del circuito es (x, y) en 1920x1080; en 3D, X = x, Z = y, Y = altura.
 */
import * as THREE from 'three';
import {
  createSim, MAP_W, MAP_H, DT, MAX_KARTS, SPIN_TIME, RESCUE_TIME, BASE_MAX_SPEED, CHARS, ITEMS, ITEM_IDS,
  clamp, lerp, smoothstep, mulberry32, ordinal, CRUCE_ANCHO, anchoDePared,
} from './sim.mjs';
import { panelLayout, panelEnPixeles } from './layout.mjs';
import * as Torneo from './torneo.mjs';
import { GLTFLoader } from '/vendor/jsm/loaders/GLTFLoader.js';

(() => {
  'use strict';

  // ===================== Constantes de la tele =====================
  // Las de la simulación (tamaño del mapa, física, personajes, objetos) llegan de sim.mjs.
  const UI_W = 1920, UI_H = 1080;   // lienzo de la interfaz (no es el tamaño del mundo)
  const AVISO_ULTIMA_VUELTA = 4;    // segundos que se ve el «¡ÚLTIMA VUELTA!» en el marcador
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
  const UI_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  // Chispas y brillo del derrape por nivel: 0 = deslizando sin carga, 1 azul, 2 naranja, 3 rosa
  const DRIFT_COLORS = ['#dfe9ff', '#00e5ff', '#ff9f1c', '#ff2d95'];
  // Cámara de tercera persona (una por persona, en su panel). Distancias en unidades del mapa.
  const CHASE_DIST = 180;        // lo que se queda por detrás del kart (más cerca = tu kart se ve más grande)
  const CHASE_SPEED_DIST = 90;   // cuánto más se aleja a velocidad máxima (da sensación de rapidez)
  const CHASE_HEIGHT = 95;       // altura sobre el kart
  const CHASE_AHEAD = 230;       // a qué distancia por delante del kart mira
  const CHASE_LAG = 7;           // suavizado del seguimiento (más alto = más pegada, menos suave)
  // Campo de visión: se fija el HORIZONTAL y de ahí sale el vertical según la forma del panel. Si
  // se fijara el vertical, un panel ancho (dos jugadores) saldría con un ojo de pez tremendo y uno
  // estrecho (ocho jugadores) se quedaría sin ver los lados.
  /*
   * Carteles que flotan sobre los karts, en píxeles de pantalla de verdad. Con la pantalla
   * dividida la escena se dibuja una vez por panel, así que **cada cartel sale tantas veces como
   * paneles hay**: con ocho personas y ocho karts eran 64 nombres a la vez y no se veía la
   * carretera. De ahí que sean pequeños y que se escondan los que no aportan (ver `renderPaneles`).
   */
  /*
   * Carteles que flotan sobre los karts, **en píxeles de pantalla**: se ven siempre del mismo
   * tamaño, esté el kart cerca o lejos. Es lo que pidió el dueño («que no sean dinámicos, que
   * siempre tengan el mismo tamaño, pequeño»), y además así no hay nombres gigantes cuando otro
   * kart se te pega.
   *
   * Ojo con **dónde** se calcula ese tamaño: la escena se dibuja una vez por panel, y un sprite
   * tiene un solo tamaño. Si se calcula una vez por frame con la cámara del primer panel, un kart
   * lejos de esa cámara y pegado a otra sale enorme en el panel del vecino (pasó, y tapaba el
   * panel entero). Por eso con pantalla dividida se recalculan **panel a panel**, dentro de
   * `carteles()`, con la cámara y el alto de ese panel.
   */
  const ETIQ_ALTO = 11;          // alto del nombre flotante, en píxeles
  const ETIQ_ANCHO = 4;          // proporción del cartel (la textura es 320x80)
  const ETIQ_LEJOS = 1500;       // más lejos que esto, el nombre no se dibuja: es solo ruido
  const ICONO_OBJETO = 15;       // alto del icono del objeto que lleva cada kart, en píxeles
  const CABEZA = 18;             // alto del emoji del piloto, en píxeles
  const CHASE_HFOV = 66;         // grados, campo de visión horizontal de la cámara de persecución
  const CHASE_FOV_MIN = 35, CHASE_FOV_MAX = 75;   // límites del vertical, para no marearse
  const CHASE_FOV_BOOST = 7;     // grados que se abre la cámara en turbo (sensación de velocidad)
  /*
   * Carácter de la cámara (solo imagen: la simulación no se entera de nada de esto).
   *  - la sacudida es **de cada uno**: si te dan a ti, tiembla tu panel y no el de los demás;
   *  - el «hit-stop» es el frenazo de imagen de los juegos de peleas: 30 ms congelado en un golpe
   *    fuerte hacen que se sienta el golpe mucho más que cualquier partícula;
   *  - y a más velocidad la cámara mira más lejos, que es lo que hace uno al ir rápido.
   */
  const CAM_SACUDIDA_MAX = 16;      // tope de la sacudida, en unidades de mundo
  const CAM_SACUDIDA_CAIDA = 26;    // lo rápido que se calma (unidades por segundo)
  const CAM_SACUDIDA_CAIDA_FUERTE = 500;   // velocidad de caída a partir de la cual el aterrizaje sacude
  const CAM_HITSTOP = 0.03;         // segundos de imagen congelada en un golpe fuerte
  const CAM_HITSTOP_MIN = 6;        // a partir de qué sacudida se congela (6 = golpe, 3 = quitamiedos, no)
  const CHASE_AHEAD_SPEED = 170;    // cuánto más lejos mira la cámara a tope de velocidad
  /*
   * Estelas y marcas. Todo sale del mismo saco de partículas de siempre (900 como mucho, en un solo
   * dibujado), así que esto **no añade ni una llamada de dibujo**. Lo que sí hay que cuidar es no
   * comerse el saco: cuando se llena, lo nuevo pisa lo viejo, y lo viejo son justo las marcas, que
   * son las que más duran. La cuenta del peor caso, ocho karts derrapando y con turbo a la vez:
   * marcas 8·2/0,11·1,5 ≈ 218 · estelas 8/0,045·0,3 ≈ 53 · polvo de derrape (el de siempre) ≈ 270 ·
   * lo que emite la simulación, medido en `check-sim.js`, ≈ 160. Total ≈ 700 de 900.
   */
  const MARCA_CADA = 0.11;      // segundos entre marca y marca de neumático de un kart que derrapa
  const MARCA_VIDA = 1.5;       // lo que tarda en borrarse una marca
  const ESTELA_CADA = 0.045;    // segundos entre rayas de la estela de turbo
  const HUMO_CAIDA = 420;       // velocidad de caída a partir de la cual el aterrizaje echa humo
  /*
   * Motor de cada kart: un oscilador por kart, con el tono subiendo con la velocidad. Todo el audio
   * del juego pasa ahora por un **bus** con un compresor al final, que es lo que evita que ocho
   * motores más los golpes suenen a sartén. El volumen de cada motor es bajísimo a propósito y los
   * bots suenan a un tercio: el motor que importa es el tuyo. Con la tecla `M` se calla todo.
   */
  const MOTOR_VOL = 0.05;       // volumen de un motor (el de una persona; los bots, un tercio)
  const MOTOR_BOT = 0.34;       // cuánto del volumen le toca a un bot
  const MOTOR_HZ_MIN = 42;      // tono parado
  const MOTOR_HZ_MAX = 190;     // tono a tope de velocidad
  const MOTOR_TURBO = 1.28;     // cuánto sube el tono con turbo o estrella
  /*
   * Música, toda sintetizada (ni un archivo): un tema tranquilo en la sala y otro rápido en
   * carrera, que se acelera en la última vuelta. Va bajita a propósito —por encima tienen que
   * oírse los motores y los golpes— y se calla con la misma tecla `M` que todo lo demás.
   */
  const MUSICA_VOL = 0.055;     // volumen de la música (bajo: manda el juego, no la canción)
  const MUSICA_ULTIMA = 1.18;   // cuánto se acelera el tema en la última vuelta

  // ===================== Utilidades =====================
  // clamp, lerp, smoothstep, mulberry32 y ordinal vienen de sim.mjs.
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s - m * 60;
    return `${m}:${r.toFixed(2).padStart(5, '0')}`;
  }

  // Muelle amortiguado: para aplastar/estirar/inclinar los karts con rebote
  class Spring {
    constructor(k, c) { this.v = 0; this.vel = 0; this.k = k; this.c = c; }
    step(target, dt) {
      const a = (target - this.v) * this.k - this.vel * this.c;
      this.vel += a * dt;
      this.v += this.vel * dt;
      return this.v;
    }
  }

  // ===================== DOM =====================
  const canvas = document.getElementById('c');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const $ = (id) => document.getElementById(id);
  const elegirEl = $('elegir');
  const lobbyEl = $('lobby'), resultsEl = $('results'), noticeEl = $('notice'), hudEl = $('hud'), bigEl = $('big'), toastsEl = $('toasts'), flashEl = $('flash');
  const semaforoEl = $('semaforo');
  const timeChipEl = $('timechip'), fpsEl = $('fpsbox');

  // ===================== Three.js =====================
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    noticeEl.textContent = 'Este navegador no puede mostrar 3D (WebGL). Prueba con Chrome, Edge o Safari actualizados.';
    noticeEl.classList.remove('hidden');
    throw e;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 20, 9000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8060ff, 1.4);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-700, 1300, 900);
  scene.add(hemi, sun);

  const toonGradient = (() => {
    const tex = new THREE.DataTexture(new Uint8Array([70, 130, 200, 255]), 4, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    return tex;
  })();
  const matCache = new Map();
  function toon(color) {
    const key = 't' + color;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }));
    return matCache.get(key);
  }
  function flat(color, opts) {
    const key = 'f' + color + JSON.stringify(opts || {});
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, ...(opts || {}) }));
    return matCache.get(key);
  }
  function shade(hex, dl) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, dl); return '#' + c.getHexString(); }

  // En pantalla dividida, «la cámara» y «el alto de la pantalla» son los del panel: así las
  // etiquetas y los emojis siguen midiendo lo mismo en píxeles dentro de cada panel.
  let camActiva = null, altoActivo = 1;
  let viewW = 1, viewH = 1;
  function resize() {
    viewW = window.innerWidth; viewH = window.innerHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    altoActivo = viewH;
    // el HUD y la sala están dibujados sobre un lienzo de 1920x1080 y se escalan a la tele; no
    // tienen nada que ver con el tamaño del mundo del circuito, que ahora cambia según el mapa
    const s = Math.min(viewW / UI_W, viewH / UI_H);
    stage.style.width = Math.floor(UI_W * s) + 'px'; stage.style.height = Math.floor(UI_H * s) + 'px';
    ui.style.transform = `scale(${s})`;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- texturas de texto / emoji (sprites) ----
  const texCache = new Map();
  function textTexture(text, opts) {
    const key = text + '|' + JSON.stringify(opts);
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = opts.w; c.height = opts.h;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = opts.font;
    if (opts.bg) { g.fillStyle = opts.bg; g.beginPath(); g.roundRect(4, 4, c.width - 8, c.height - 8, 20); g.fill(); }
    if (opts.stroke) { g.lineWidth = opts.strokeW || 8; g.strokeStyle = opts.stroke; g.strokeText(text, c.width / 2, c.height / 2 + (opts.dy || 0)); }
    g.fillStyle = opts.color || '#fff';
    g.fillText(text, c.width / 2, c.height / 2 + (opts.dy || 0));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }
  function makeSprite(tex, order) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = order || 10;
    return s;
  }
  // escala para que un sprite mida `px` píxeles en pantalla esté donde esté
  const _v = new THREE.Vector3();
  function screenScale(sprite, px, aspect, camDada, altoDado) {
    const cam = camDada || camActiva || camera;
    const alto = altoDado || altoActivo;
    sprite.getWorldPosition(_v);
    const dist = _v.distanceTo(cam.position);
    const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / alto;
    sprite.scale.set(px * worldPerPx * aspect, px * worldPerPx, 1);
  }

  // Los circuitos los construye la simulación (ver más abajo, sección «Estado»).

  // ===================== Construcción del mundo 3D =====================
  const animated = []; // objetos con animación ambiental { obj, kind, phase, ... }

  /*
   * Contorno de dibujo animado: una copia de la malla «hinchada» hacia fuera y pintada por dentro
   * (`BackSide`), así solo se ve el borde que asoma. El hinchado va por la normal **promediada por
   * posición**: si se usan las normales de cada cara, las cajas se abren por las esquinas y el
   * borde sale roto. Cada geometría se hincha una sola vez y se guarda.
   */
  const CONTORNO_COLOR = '#160b28', CONTORNO_GROSOR = 0.9;
  const matContorno = new THREE.MeshBasicMaterial({ color: CONTORNO_COLOR, side: THREE.BackSide });
  const contornos = new WeakMap();
  function geoContorno(geo) {
    if (contornos.has(geo)) return contornos.get(geo);
    const g = geo.clone();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const suma = new Map();
    const clave = (i) => `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
    for (let i = 0; i < pos.count; i++) {
      const k = clave(i);
      const v = suma.get(k) || [0, 0, 0];
      v[0] += nor.getX(i); v[1] += nor.getY(i); v[2] += nor.getZ(i);
      suma.set(k, v);
    }
    for (let i = 0; i < pos.count; i++) {
      const v = suma.get(clave(i));
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      pos.setXYZ(i, pos.getX(i) + v[0] / l * CONTORNO_GROSOR, pos.getY(i) + v[1] / l * CONTORNO_GROSOR, pos.getZ(i) + v[2] / l * CONTORNO_GROSOR);
    }
    pos.needsUpdate = true;
    contornos.set(geo, g);
    return g;
  }
  // Un contorno para una malla instanciada (los bumpers): un solo dibujado más para todos
  function contornoInstanciado(mesh) {
    const c = new THREE.InstancedMesh(geoContorno(mesh.geometry), matContorno, mesh.count);
    c.instanceMatrix.copy(mesh.instanceMatrix);
    c.instanceMatrix.needsUpdate = true;
    return c;
  }
  // Le cuelga a cada malla su contorno, para que lo siga a todas partes (las ruedas giran)
  function ponerContorno(raiz, lista) {
    raiz.traverse((o) => { if (o.isMesh && !o.userData.esContorno) lista.push(o); });
    for (const o of lista.slice()) {
      const c = new THREE.Mesh(geoContorno(o.geometry), matContorno);
      c.userData.esContorno = true;
      o.add(c);
    }
  }

  /*
   * Biomas (`theme.biomas`): un circuito puede estar hecho de varios paisajes, uno por tramo del
   * recorrido. Lo usa «Last Dance»: jungla, hielo, mina, centro de la tierra y cielo. Cada bioma
   * pinta su asfalto, su terreno, su niebla, su cielo y sus bichos, y **la niebla y el cielo se
   * cambian por panel**, según dónde esté cada jugador: dos personas pueden ir por biomas distintos
   * y cada una ve el suyo.
   */
  function biomaEn(t, fraccion) {
    const lista = t.def.theme.biomas;
    if (!lista || !lista.length) return null;
    const f = ((fraccion % 1) + 1) % 1;
    for (const b of lista) if (f < b.hasta) return b;
    return lista[lista.length - 1];
  }
  function biomaDeMuestra(t, i) { return biomaEn(t, i / t.N); }
  // cada bioma tiene su cielo; se guarda hecho para no rehacer la textura en cada cambio
  const cielosDeBioma = new Map();
  function cieloDeBioma(b, th) {
    const clave = (b && b.nombre) || 'base';
    if (!cielosDeBioma.has(clave)) {
      const sky = (b && b.sky) || th.sky;
      cielosDeBioma.set(clave, skyTexture(sky[0], sky[1]));
    }
    return cielosDeBioma.get(clave);
  }

  function buildWorld(t) {
    const th = t.def.theme;
    const rnd = mulberry32(999 + t.index * 17);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    /*
     * Un sitio al azar **junto a la carretera**, a un lado o al otro: se elige un punto del
     * recorrido y se sale de lado. Antes la decoración se sorteaba por todo el mundo, y eso valía
     * cuando el mundo medía 1920x1080; con los circuitos grandes (Arcoíris mide 6650x4100, o sea
     * ocho veces más superficie) la mitad de los árboles caían donde no pasa nadie y las curvas se
     * quedaban sin referencias para la vista de detrás. Mismas mallas que antes —los fps mandan—,
     * pero todas donde se juega.
     */
    function juntoALaPista(t, margen, banda) {
      const s = t.samples[Math.floor(rnd() * t.N)];
      const lado = rnd() < 0.5 ? -1 : 1;
      const fuera = (t.halfW + margen + 20 + rnd() * banda) * lado;
      return { x: s.x + s.nx * fuera, y: s.y + s.ny * fuera };
    }
    const world = new THREE.Group();
    world.userData.animated = [];
    const anim = (o) => { world.userData.animated.push(o); };

    /*
     * Circuitos «de cielo» (`theme.cielo`): la carretera flota en el vacío, sin terreno ni suelo
     * debajo, y se pinta un poco transparente para que se vean las estrellas a través. Solo se
     * puede hacer donde hay quitamiedos en todo el recorrido (si no, uno se caería al vacío y no
     * habría dónde recogerlo). La simulación no cambia: el terreno sigue existiendo por debajo,
     * simplemente no se dibuja.
     */
    const cielo = !!th.cielo;

    // ---- terreno (low-poly con colores por vértice) ----
    if (!cielo) {
      const pos = [], col = [], idx = [];
      const c1 = new THREE.Color(th.ground), c2 = new THREE.Color(th.groundAlt);
      const TE = t.ter;
      const _t1 = new THREE.Color(), _t2 = new THREE.Color();
      for (let iy = 0; iy < TE.rows; iy++) for (let ix = 0; ix < TE.cols; ix++) {
        const x = TE.x0 + ix * TE.cell, y = TE.y0 + iy * TE.cell;
        pos.push(x, t.terrain[iy * TE.cols + ix], y);
        let a = c1, b = c2;
        if (th.biomas) {     // el terreno se pinta del bioma que le pilla más cerca
          const bio = biomaDeMuestra(t, t.nearest(x, y).i);
          if (bio) { _t1.set(bio.ground || th.ground); _t2.set(bio.groundAlt || th.groundAlt); a = _t1; b = _t2; }
        }
        const c = rnd() < 0.45 ? b : a;
        col.push(c.r, c.g, c.b);
      }
      for (let iy = 0; iy < TE.rows - 1; iy++) for (let ix = 0; ix < TE.cols - 1; ix++) {
        const a = iy * TE.cols + ix, b = a + 1, c = a + TE.cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      let geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo = geo.toNonIndexed();
      geo.computeVertexNormals();
      world.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
    }

    // suelo infinito bajo el terreno, para que el mundo no flote en el vacío
    if (!cielo) {
      const base = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), flat(shade(th.groundAlt, -0.12)));
      base.rotation.x = -Math.PI / 2; base.position.set(t.W / 2, -28, t.H / 2);
      world.add(base);
    }

    // ---- carretera, bordillos ----
    // Los bordes pueden ser un número o una función de la muestra: así la carretera se puede partir
    // en dos calzadas (los tramos de dos caminos «abiertos») sin cambiar nada más.
    const ribbon = (lat0, lat1, colorFn, dy, opacidad) => {
      const f0 = typeof lat0 === 'function' ? lat0 : () => lat0;
      const f1 = typeof lat1 === 'function' ? lat1 : () => lat1;
      const pos = [], col = [], idx = [];
      for (let i = 0; i < t.N; i++) {
        const s = t.samples[i];
        const a0 = f0(i), a1 = f1(i);
        pos.push(s.x + s.nx * a0, s.h + dy, s.y + s.ny * a0, s.x + s.nx * a1, s.h + dy, s.y + s.ny * a1);
        const c = colorFn(i);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        const a = i * 2, b = ((i + 1) % t.N) * 2;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      if (opacidad !== undefined && opacidad < 1) { mat.transparent = true; mat.opacity = opacidad; }
      return new THREE.Mesh(geo, mat);
    };
    const roadC = new THREE.Color(th.road), roadC2 = new THREE.Color(shade(th.road, 0.06));
    // Arcoíris: la carretera va cambiando de color a lo largo del circuito, en franjas anchas
    // para que desde la cámara de persecución se vea el color cambiar según avanzas.
    const _arco = new THREE.Color();
    // con biomas, el asfalto cambia de color al cambiar de paisaje (y sigue alternando franjas)
    const _bio = new THREE.Color(), _bio2 = new THREE.Color();
    const colorCarretera = th.arcoiris
      ? (i) => { _arco.setHSL(((Math.floor(i / 7) * 7) / t.N * 4) % 1, 0.95, Math.floor(i / 7) % 2 ? 0.58 : 0.5); return _arco; }
      : th.biomas
        ? (i) => {
          const b = biomaDeMuestra(t, i);
          _bio.set((b && b.road) || th.road);
          if (Math.floor(i / 6) % 2) return _bio;
          _bio2.copy(_bio).offsetHSL(0, 0, 0.06);
          return _bio2;
        }
        : (i) => (Math.floor(i / 6) % 2 ? roadC : roadC2);
    /*
     * Tramos de dos caminos **abiertos** (`tipo: 'abierto'` en tracks.js): la carretera no lleva una
     * pared por el medio, se **parte en dos calzadas de verdad** y por el hueco se ve el terreno.
     * `media(i)` es medio hueco en cada muestra, con la misma cuenta que usa la simulación para
     * echarte de en medio (`anchoDePared`): lo que se ve es exactamente lo que hay.
     */
    const abiertas = (t.paredes || []).filter((w) => w.abierto);
    const media = (i) => { let m = 0; for (const w of abiertas) m = Math.max(m, anchoDePared(w, i, t.N) / 2); return m; };
    const opacidadPista = cielo ? 0.72 : 1;
    if (abiertas.length) {
      world.add(ribbon(-t.halfW, (i) => -media(i), colorCarretera, 1.0, opacidadPista));
      world.add(ribbon((i) => media(i), t.halfW, colorCarretera, 1.0, opacidadPista));
    } else {
      world.add(ribbon(-t.halfW, t.halfW, colorCarretera, 1.0, opacidadPista));
    }
    const cA = new THREE.Color(th.curb[0]), cB = new THREE.Color(th.curb[1]);
    const rayas = (i) => (Math.floor(i / 3) % 2 ? cA : cB);
    world.add(ribbon(t.halfW, t.halfW + 12, rayas, 1.0));
    world.add(ribbon(-t.halfW - 12, -t.halfW, rayas, 1.0));
    if (abiertas.length) {
      // bordillo por dentro, en el filo de cada calzada: donde no hay hueco, la cinta se queda sin
      // ancho (los dos bordes en el mismo sitio) y no se dibuja nada
      const dentro = (lado, fuera) => (i) => { const m = media(i); return m > 4 ? (m + (fuera ? 11 : 0)) * lado : 0; };
      world.add(ribbon(dentro(1, true), dentro(1, false), rayas, 1.02));
      world.add(ribbon(dentro(-1, false), dentro(-1, true), rayas, 1.02));
    }

    // ---- decoración de la carretera: flechas, meta, paneles turbo, carteles ----
    const decal = (i, w, len, mat, dy) => {
      const s = t.samples[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
      m.position.set(s.x, s.h + dy, s.y);
      m.rotation.set(-Math.PI / 2, 0, -s.ang);
      return m;
    };
    const arrowTex = textTexture('➤', { w: 128, h: 128, font: `bold 96px ${UI_FONT}`, color: 'rgba(255,255,255,0.5)' });
    for (let k = 1; k <= 12; k++) world.add(decal(Math.floor(k * t.N / 12) % t.N, 40, 40, new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false }), 1.4));
    {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const g = c.getContext('2d');
      for (let r = 0; r < 8; r++) for (let q = 0; q < 2; q++) { g.fillStyle = (r + q) % 2 ? '#111' : '#fff'; g.fillRect(q * 32, r * 32, 32, 32); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      world.add(decal(0, t.width, 24, new THREE.MeshBasicMaterial({ map: tex }), 1.5));
      // arco de meta
      const s0 = t.samples[0];
      const arch = new THREE.Group();
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 70, 10), toon(side < 0 ? th.curb[0] : th.bumper[0]));
        pole.position.set(s0.nx * (t.halfW + 16) * side, 35, s0.ny * (t.halfW + 16) * side);
        arch.add(pole);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 14, t.width + 44), toon(th.bumper[1]));
      beam.position.y = 74;
      arch.add(beam);
      const sign = makeSprite(textTexture('META', { w: 256, h: 96, font: `900 64px ${UI_FONT}`, color: '#fff', stroke: '#4a0a5e', strokeW: 10 }), 5);
      sign.material.depthTest = true; sign.position.y = 98; sign.scale.set(90, 34, 1);
      arch.add(sign);
      arch.position.set(s0.x, s0.h + 1, s0.y);
      arch.rotation.y = -s0.ang;
      world.add(arch);
    }
    {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = th.pad; g.fillRect(0, 0, 128, 64);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(10 + k * 64, 8); g.lineTo(50 + k * 64, 32); g.lineTo(10 + k * 64, 56); g.lineTo(26 + k * 64, 32); g.closePath(); g.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
      for (const i of t.pads) {
        const m = decal(i, t.width * 0.8, 44, new THREE.MeshBasicMaterial({ map: tex }), 1.4);
        world.add(m);
        anim({ kind: 'pad', obj: m, tex });
      }
    }
    for (const r of t.ramps) {
      const s = t.samples[r.start];
      const sign = makeSprite(textTexture('↗ SALTO', { w: 256, h: 96, font: `900 52px ${UI_FONT}`, color: '#ffe600', stroke: '#4a0a5e', strokeW: 10 }), 5);
      sign.material.depthTest = true;
      sign.position.set(s.x - s.nx * (t.halfW + 46), s.h + 46, s.y - s.ny * (t.halfW + 46));
      sign.scale.set(80, 30, 1);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 44, 8), toon('#ffffff'));
      pole.position.set(s.x - s.nx * (t.halfW + 46), s.h + 22, s.y - s.ny * (t.halfW + 46));
      world.add(sign, pole);
    }
    /*
     * Cosas que van sobre la carretera en un sitio exacto (`theme.props`), no repartidas al azar
     * como la decoración. El grupo se gira con la carretera, así que dentro de él **+X es hacia
     * donde se corre y +Z es hacia el lado**: todo se coloca en esas coordenadas.
     */
    // La textura del bloque de interrogación de Mundo Pixel: la usan el prop gigante (se pasa por
    // debajo) y los bloques sueltos de la decoración, así que se hace una vez.
    let _texBloque = null;
    const texBloque = () => {
      if (_texBloque) return _texBloque;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#e8a24a'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#8a4a12';
      x.fillRect(0, 0, 64, 6); x.fillRect(0, 58, 64, 6); x.fillRect(0, 0, 6, 64); x.fillRect(58, 0, 6, 64);
      for (const [a, b] of [[8, 8], [50, 8], [8, 50], [50, 50]]) x.fillRect(a, b, 6, 6);
      x.font = '900 42px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('?', 32, 35);
      _texBloque = new THREE.CanvasTexture(c);
      _texBloque.colorSpace = THREE.SRGBColorSpace;
      _texBloque.magFilter = THREE.NearestFilter;
      return _texBloque;
    };
    const props = {
      // Castillo con dos torreones a los lados y un arco enorme por el que se pasa. Encima, el
      // árbol de cristal que pidió el dueño: es el punto de referencia del circuito.
      castillo: () => {
        const g = new THREE.Group();
        const sep = t.halfW + 175;          // los torreones, bien apartados de la carretera
        for (const lado of [-1, 1]) {
          const torre = new THREE.Mesh(new THREE.CylinderGeometry(62, 74, 300, 8), toon('#6a3bd6'));
          torre.position.set(0, 150, sep * lado);
          const tejado = new THREE.Mesh(new THREE.ConeGeometry(80, 120, 8), toon('#ff2d95'));
          tejado.position.set(0, 360, sep * lado);
          const aro = new THREE.Mesh(new THREE.TorusGeometry(70, 8, 6, 8), toon('#ffe600'));
          aro.rotation.x = Math.PI / 2; aro.position.set(0, 292, sep * lado);
          g.add(torre, tejado, aro);
          for (let k = 0; k < 4; k++) {   // ventanas
            const v = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 16), flat('#ffe600'));
            v.position.set(66, 110 + k * 55, sep * lado); g.add(v);
          }
        }
        // el arco: un dintel grueso y almenas encima
        const dintel = new THREE.Mesh(new THREE.BoxGeometry(90, 56, sep * 2), toon('#7a4be0'));
        dintel.position.y = 258; g.add(dintel);
        for (let k = -3; k <= 3; k++) {
          const almena = new THREE.Mesh(new THREE.BoxGeometry(90, 40, 46), toon('#9b6bff'));
          almena.position.set(0, 306, k * 72); g.add(almena);
        }
        // árbol de cristal en lo alto del castillo
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(14, 20, 130, 7), toon('#3a1d7a'));
        tronco.position.y = 390; g.add(tronco);
        for (let k = 0; k < 7; k++) {
          const hoja = new THREE.Mesh(new THREE.OctahedronGeometry(34 + (k % 3) * 12), flat(th.palette[k % th.palette.length]));
          hoja.position.set(Math.cos(k * 1.9) * 46, 450 + (k % 4) * 34, Math.sin(k * 1.9) * 46);
          hoja.scale.y = 1.5;
          g.add(hoja);
        }
        const luz = new THREE.PointLight('#ff6ae6', 0, 900, 1.6);
        luz.position.y = 470; luz.intensity = 500000; g.add(luz);
        anim({ kind: 'spinY', obj: g.children[g.children.length - 2], speed: 0.5 });
        return g;
      },
      /*
       * Un aro genérico: de pie, cruzado en la carretera, se vuela por dentro. Cada circuito tiene
       * el suyo con su forma (el donut de Chicle, el flotador de la playa, el aro de fuego del
       * volcán, el anillo del planeta en la luna): solo cambian los colores y los adornos que se le
       * cuelgan alrededor.
       */
      aroDe: ({ color, dentro, adorno, adornoColor, n = 14, gordo = 18, girar = 0 }) => {
        const g = new THREE.Group();
        const r = t.halfW + 60;
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(r, gordo, 10, 44), flat(color));
        anillo.rotation.y = Math.PI / 2;
        anillo.position.y = r + 30;
        g.add(anillo);
        if (dentro) {
          const d = new THREE.Mesh(new THREE.TorusGeometry(r - gordo - 4, 7, 8, 40), flat(dentro));
          d.rotation.y = Math.PI / 2; d.position.y = r + 30;
          g.add(d);
        }
        if (adorno) {
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const pieza = adorno === 'chispa'
              ? new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), flat(adornoColor[k % adornoColor.length]))
              : new THREE.Mesh(new THREE.ConeGeometry(13, 34, 7), flat(adornoColor[k % adornoColor.length]));
            pieza.position.set(0, r + 30 + Math.cos(a) * (r + gordo), Math.sin(a) * (r + gordo));
            pieza.rotation.x = -a + Math.PI;
            g.add(pieza);
          }
        }
        for (const lado of [-1, 1]) {
          const pata = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, r + 30, 8), toon(color));
          pata.position.set(0, (r + 30) / 2, lado * (r - 10)); g.add(pata);
        }
        if (girar) anim({ kind: 'spinY', obj: anillo, speed: girar });
        anim({ kind: 'pulse', obj: g, phase: 1.3 });
        return g;
      },
      /*
       * Un pórtico por el que se pasa por debajo: dos pilares y un techo. Con los colores y el
       * remate de cada circuito sale una tarta, un chiringuito, un arco de lava o una base lunar.
       */
      porticoDe: ({ pilar, techo, remate, alto = 250, forma = 'caja' }) => {
        const g = new THREE.Group();
        const sep = t.halfW + 120;
        for (const lado of [-1, 1]) {
          const p = forma === 'roca'
            ? new THREE.Mesh(new THREE.DodecahedronGeometry(72), toon(pilar))
            : new THREE.Mesh(new THREE.CylinderGeometry(46, 58, alto, forma === 'caja' ? 10 : 7), toon(pilar));
          p.position.set(0, alto / 2, sep * lado);
          if (forma === 'roca') { p.scale.set(0.9, alto / 110, 0.9); p.position.y = alto / 2; }
          g.add(p);
        }
        const dintel = new THREE.Mesh(new THREE.BoxGeometry(96, 46, sep * 2 + 90), toon(techo));
        dintel.position.y = alto + 20; g.add(dintel);
        if (remate === 'tarta') {
          for (let k = 0; k < 3; k++) {
            const piso = new THREE.Mesh(new THREE.CylinderGeometry(120 - k * 30, 130 - k * 30, 60, 16), toon(k % 2 ? '#fff2fb' : '#ff9ad5'));
            piso.position.y = alto + 70 + k * 62; g.add(piso);
            const nata = new THREE.Mesh(new THREE.TorusGeometry(120 - k * 30, 12, 8, 20), toon('#ffffff'));
            nata.rotation.x = Math.PI / 2; nata.position.y = alto + 98 + k * 62; g.add(nata);
          }
          const vela = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 60, 8), toon('#ffe600'));
          vela.position.y = alto + 280; g.add(vela);
          const llama = new THREE.Mesh(new THREE.ConeGeometry(14, 36, 8), flat('#ff6a00'));
          llama.position.y = alto + 330; g.add(llama);
          anim({ kind: 'bob', obj: llama, amp: 9, phase: 0.7 });
        } else if (remate === 'paja') {
          const techoPaja = new THREE.Mesh(new THREE.ConeGeometry(sep + 120, 120, 4), toon('#d8a34a'));
          techoPaja.position.y = alto + 90; techoPaja.rotation.y = Math.PI / 4; g.add(techoPaja);
          for (let k = -2; k <= 2; k++) {
            const tabla = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 60), toon(k % 2 ? '#ff6a00' : '#00e5ff'));
            tabla.position.set(0, alto + 44, k * 90); g.add(tabla);
          }
        } else if (remate === 'lava') {
          for (let k = -3; k <= 3; k++) {
            const gota = new THREE.Mesh(new THREE.ConeGeometry(16, 60 + (k % 3) * 26, 7), flat('#ff5e00'));
            gota.rotation.x = Math.PI; gota.position.set(0, alto - 20, k * 78); g.add(gota);
            anim({ kind: 'bob', obj: gota, amp: 4 + (k % 3) * 2, phase: k });
          }
          const luz = new THREE.PointLight('#ff5e00', 0, 800, 1.6);
          luz.position.y = alto; luz.intensity = 360000; g.add(luz);
        } else if (remate === 'sofa') {
          // el sofá del salón, a tamaño de casa: se pasa por debajo, entre las patas
          const c = '#b0303a';
          const asiento = new THREE.Mesh(new THREE.BoxGeometry(210, 70, sep * 2 + 60), toon(c));
          asiento.position.y = alto + 84; g.add(asiento);
          const respaldo = new THREE.Mesh(new THREE.BoxGeometry(70, 160, sep * 2 + 60), toon(shade(c, -0.08)));
          respaldo.position.set(-100, alto + 190, 0); g.add(respaldo);
          for (const lado of [-1, 1]) {
            const brazo = new THREE.Mesh(new THREE.BoxGeometry(210, 130, 64), toon(shade(c, 0.06)));
            brazo.position.set(0, alto + 150, (sep + 28) * lado); g.add(brazo);
            const cojin = new THREE.Mesh(new THREE.BoxGeometry(150, 46, sep * 0.78), toon(shade(c, 0.14)));
            cojin.position.set(24, alto + 140, lado * sep * 0.5); g.add(cojin);
          }
        } else if (remate === 'tostadora') {
          // la tostadora: se pasa por dentro, por debajo de las dos ranuras, con las tostadas fuera
          const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(230, 180, sep * 2 + 40), toon('#dde6ee'));
          cuerpo.position.y = alto + 108; g.add(cuerpo);
          const palanca = new THREE.Mesh(new THREE.BoxGeometry(26, 60, 18), toon('#ff3d3d'));
          palanca.position.set(126, alto + 150, sep * 0.8); g.add(palanca);
          for (const lado of [-1, 1]) {
            const ranura = new THREE.Mesh(new THREE.BoxGeometry(170, 22, 76), toon('#23262c'));
            ranura.position.set(0, alto + 196, lado * sep * 0.52); g.add(ranura);
            const tostada = new THREE.Mesh(new THREE.BoxGeometry(150, 110, 36), toon('#c98a4b'));
            tostada.position.set(0, alto + 250, lado * sep * 0.52); g.add(tostada);
            anim({ kind: 'bob', obj: tostada, amp: 16, phase: lado > 0 ? 0 : 1.4 });
          }
        } else if (remate === 'bloque') {
          // el bloque de interrogación, flotando y dando botes por encima de la carretera
          const cubo = new THREE.Mesh(new THREE.BoxGeometry(210, 210, 210), new THREE.MeshToonMaterial({ map: texBloque(), gradientMap: toonGradient }));
          cubo.position.y = alto + 200; g.add(cubo);
          anim({ kind: 'bob', obj: cubo, amp: 16, phase: 0.4 });
        } else if (remate === 'pantalla') {
          // la pantalla del GAME OVER: se pasa por dentro del marco
          const marco = new THREE.Mesh(new THREE.BoxGeometry(60, 280, sep * 2 + 140), toon('#2a2f65'));
          marco.position.y = alto + 160; g.add(marco);
          const c = document.createElement('canvas'); c.width = 512; c.height = 160;
          const x = c.getContext('2d');
          x.fillStyle = '#05050f'; x.fillRect(0, 0, 512, 160);
          x.fillStyle = '#ff2d95'; x.font = `900 62px ${UI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText('GAME OVER', 256, 86);
          const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(sep * 2, 150), new THREE.MeshBasicMaterial({ map: tex }));
          panel.position.set(-31, alto + 160, 0);
          panel.rotation.y = -Math.PI / 2;
          g.add(panel);
        } else if (remate === 'cupula') {
          const cupula = new THREE.Mesh(new THREE.SphereGeometry(140, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), flat('#8ee3ff'));
          cupula.position.y = alto + 40; g.add(cupula);
          const antena = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 110, 6), toon('#9aa0b5'));
          antena.position.y = alto + 220; g.add(antena);
          const plato = new THREE.Mesh(new THREE.SphereGeometry(40, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), toon('#eaf6ff'));
          plato.position.y = alto + 280; plato.rotation.z = 0.6; g.add(plato);
          anim({ kind: 'spinY', obj: plato, speed: 0.8 });
        }
        return g;
      },
      // El aro por el que se vuela en el salto grande. De pie, cruzado en la carretera.
      aro: () => {
        const g = new THREE.Group();
        const r = t.halfW + 60;
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(r, 18, 10, 44), flat('#ff2d95'));
        anillo.rotation.y = Math.PI / 2;    // de pie y cruzado: se vuela por dentro
        anillo.position.y = r + 30;
        const dentro = new THREE.Mesh(new THREE.TorusGeometry(r - 22, 7, 8, 40), flat('#00e5ff'));
        dentro.rotation.y = Math.PI / 2; dentro.position.y = r + 30;
        for (const lado of [-1, 1]) {
          const pata = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, r + 30, 8), toon('#9b3bff'));
          pata.position.set(0, (r + 30) / 2, lado * (r - 10)); g.add(pata);
        }
        g.add(anillo, dentro);
        anim({ kind: 'pulse', obj: g, phase: 1.3 });
        return g;
      },
      // Chicle: un donut glaseado con virutas, y una tarta de tres pisos con su vela
      donut: () => props.aroDe({ color: '#ff8ad8', dentro: '#ffe600', adorno: 'chispa', adornoColor: ['#ffffff', '#00e5ff', '#ffe600', '#39ff88'], n: 18, gordo: 26 }),
      tarta: () => props.porticoDe({ pilar: '#ffd7f0', techo: '#ff5ec8', remate: 'tarta', alto: 250 }),
      // Playa Neón: un flotador gigante y el chiringuito de la playa
      flotador: () => props.aroDe({ color: '#ff3d6e', dentro: '#ffffff', adorno: 'chispa', adornoColor: ['#ffffff', '#ff3d6e'], n: 16, gordo: 24, girar: 0.25 }),
      chiringuito: () => props.porticoDe({ pilar: '#c98a4b', techo: '#8a5a2b', remate: 'paja', alto: 240, forma: 'palo' }),
      // Volcán Disco: el aro de fuego y un arco de roca con lava colgando
      aroFuego: () => props.aroDe({ color: '#ff5e00', dentro: '#ffd000', adorno: 'llama', adornoColor: ['#ff5e00', '#ffd000', '#ff2d00'], n: 16, gordo: 20, girar: 0.5 }),
      arcoRoca: () => props.porticoDe({ pilar: '#4b2a3a', techo: '#2e1a26', remate: 'lava', alto: 260, forma: 'roca' }),
      // Luna Loca: el anillo de un planeta y la base lunar
      anillo: () => props.aroDe({ color: '#8ee3ff', dentro: '#ff00ff', adorno: 'chispa', adornoColor: ['#ffffff', '#8ee3ff'], n: 20, gordo: 16, girar: 0.4 }),
      base: () => props.porticoDe({ pilar: '#c9d4ff', techo: '#8fa4e8', remate: 'cupula', alto: 240, forma: 'palo' }),
      // Bajo la Cama: el sofá del salón y la tostadora de la cocina
      sofa: () => props.porticoDe({ pilar: '#7a2028', techo: '#8d2530', remate: 'sofa', alto: 250 }),
      tostadora: () => props.porticoDe({ pilar: '#b9c4cd', techo: '#9aa6b5', remate: 'tostadora', alto: 250, forma: 'palo' }),
      // Mundo Pixel: el bloque de interrogación y la pantalla de GAME OVER
      bloque: () => props.porticoDe({ pilar: '#8a4a12', techo: '#c87a3a', remate: 'bloque', alto: 250 }),
      pantalla: () => props.porticoDe({ pilar: '#2a2f65', techo: '#1a1a2e', remate: 'pantalla', alto: 260 }),
    };
    for (const pr of th.props || []) {
      const hacer = props[pr.kind];
      if (!hacer) continue;
      const s = t.samples[Math.floor(pr.at * t.N) % t.N];
      const obj = hacer();
      obj.position.set(s.x, s.h, s.y);
      obj.rotation.y = -s.ang;
      ponerContorno(obj, []);      // el castillo y el aro, también con su borde de dibujo animado
      world.add(obj);
    }

    // ---- bumpers ----
    {
      const geo = new THREE.CylinderGeometry(7, 8, 16, 12);
      const items = [];
      for (const b of t.barriers) {
        const sides = b.side === 0 ? [-1, 1] : [b.side];
        let n = 0;
        for (let i = b.from; i !== b.to; i = (i + 1) % t.N) {
          if (n++ % 3) continue;
          const s = t.samples[i];
          for (const side of sides) items.push({ x: s.x + s.nx * (t.halfW + 20) * side, y: s.y + s.ny * (t.halfW + 20) * side, h: s.h, c: n % 2 });
        }
      }
      if (items.length) {
        const dummy = new THREE.Object3D();
        for (const c of [0, 1]) {
          const list = items.filter((q) => q.c === c);
          if (!list.length) continue;
          const mesh = new THREE.InstancedMesh(geo, toon(th.bumper[c]), list.length);
          list.forEach((q, i) => { dummy.position.set(q.x, q.h + 8, q.y); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
          world.add(mesh, contornoInstanciado(mesh));   // el borde oscuro, en un solo dibujado más
        }
      }
    }
    /*
     * Las paredes que parten la carretera en dos caminos (`paredes` en tracks.js). Se dibujan como
     * un murete bajo con luces por encima, para que se vea desde lejos por qué lado hay que ir.
     */
    // ¿este punto está en el hueco que deja un cruce? (ahí el muro se corta para que se vea la rampa)
    const enUnCruce = (i, margen) => (t.cruces || []).some((c) => {
      let d = i - c; if (d > t.N / 2) d -= t.N; if (d < -t.N / 2) d += t.N;
      return Math.abs(d) <= margen;
    });
    if (t.paredes && t.paredes.length) {
      const geoMuro = new THREE.BoxGeometry(26, 36, 46);
      const geoLuz = new THREE.BoxGeometry(14, 8, 14);
      const trozos = [], luces = [];
      const dummy = new THREE.Object3D();
      for (const w of t.paredes) {
        if (w.abierto) continue;            // este no lleva pared: la carretera se parte de verdad
        let n = 0;
        for (let i = w.from; i !== w.to; i = (i + 1) % t.N) {
          if (n++ % 4) continue;
          if (enUnCruce(i, 9)) continue;      // el hueco por donde se salta al otro carril
          // en los picos (donde la franja se está abriendo o cerrando) no hay pared que valga
          if (anchoDePared(w, i, t.N) < w.ancho * 0.6) continue;
          const sm = t.samples[i];
          trozos.push({ x: sm.x, y: sm.y, h: sm.h, ang: sm.ang });
          if (n % 16 === 1) luces.push({ x: sm.x, y: sm.y, h: sm.h, ang: sm.ang });
        }
      }
      if (trozos.length) {
        const muro = new THREE.InstancedMesh(geoMuro, toon(th.curb ? th.curb[0] : '#ffffff'), trozos.length);
        trozos.forEach((q, i) => {
          dummy.position.set(q.x, q.h + 18, q.y);
          dummy.rotation.set(0, -q.ang, 0);
          dummy.updateMatrix(); muro.setMatrixAt(i, dummy.matrix);
        });
        world.add(muro, contornoInstanciado(muro));
        const faro = new THREE.InstancedMesh(geoLuz, flat(th.pad || '#ffe600'), luces.length);
        luces.forEach((q, i) => {
          dummy.position.set(q.x, q.h + 42, q.y);
          dummy.rotation.set(0, -q.ang, 0);
          dummy.updateMatrix(); faro.setMatrixAt(i, dummy.matrix);
        });
        world.add(faro);
      }
    }

    /*
     * Las bifurcaciones abiertas: por dentro, cada calzada lleva su quitamiedos (que es contra lo
     * que rebotas si te metes en el medio), y en la punta —donde se abre y donde se vuelve a
     * juntar— un cartel y una isleta a rayas, para que se vea venir la decisión desde lejos.
     */
    if (abiertas.length) {
      const bloques = [];
      for (const w of abiertas) {
        for (let i = w.from, n = 0; i !== w.to; i = (i + 1) % t.N, n++) {
          if (n % 5) continue;
          const m = anchoDePared(w, i, t.N) / 2;
          if (m < 18) continue;
          const sm = t.samples[i];
          for (const lado of [-1, 1]) {
            const lat = (m + 9) * lado;
            bloques.push({ x: sm.x + sm.nx * lat, y: sm.y + sm.ny * lat, h: sm.h, ang: sm.ang, c: (n / 5) % 2 | 0 });
          }
        }
        // la isleta de la punta (entrada) y la de la unión (salida), con su cartel
        for (const [muestra, texto, giro] of [[w.from, '↰ ELIGE ↱', 0], [w.to, 'SE JUNTAN', Math.PI]]) {
          const sm = t.samples[((muestra % t.N) + t.N) % t.N];
          const isleta = new THREE.Mesh(new THREE.ConeGeometry(w.ancho * 0.36, 16, 3), toon(th.curb ? th.curb[0] : '#ffe600'));
          isleta.position.set(sm.x, sm.h + 8, sm.y);
          isleta.rotation.set(0, -sm.ang + giro + Math.PI / 2, 0);
          ponerContorno(isleta, []);
          world.add(isleta);
          const cartel = makeSprite(textTexture(texto, { w: 320, h: 96, font: `900 52px ${UI_FONT}`, color: '#ffffff', stroke: '#2a0a3a', strokeW: 10 }), 5);
          cartel.material.depthTest = true;
          cartel.position.set(sm.x, sm.h + 76, sm.y);
          cartel.scale.set(104, 31, 1);
          const poste = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 62, 8), toon('#ffffff'));
          poste.position.set(sm.x, sm.h + 31, sm.y);
          world.add(cartel, poste);
        }
      }
      if (bloques.length) {
        const geoTope = new THREE.BoxGeometry(30, 22, 16);
        const dummy = new THREE.Object3D();
        for (const c of [0, 1]) {
          const lista = bloques.filter((q) => q.c === c);
          if (!lista.length) continue;
          const mesh = new THREE.InstancedMesh(geoTope, toon(th.bumper[c]), lista.length);
          lista.forEach((q, k) => {
            dummy.position.set(q.x, q.h + 11, q.y);
            dummy.rotation.set(0, -q.ang, 0);
            dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
          });
          world.add(mesh, contornoInstanciado(mesh));
        }
      }
    }

    /*
     * Los cruces de carril: una rampa peraltada a cada lado del muro, tan ancha como la banda que
     * salta de verdad (CRUCE_ANCHO). Lo que se ve es exactamente lo que cruza: por fuera de la
     * rampa se sigue por el mismo camino. El arco de aviso lo pone el bloque de abajo.
     */
    if (t.cruces && t.cruces.length) {
      const sitios = [];
      for (const ci of t.cruces) {
        const muro = t.paredes.find((q) => t.inRange(ci, q.from, q.to));
        const desde = muro ? muro.ancho / 2 : 0;
        const banda = (t.halfW - desde) * CRUCE_ANCHO;
        for (const lado of [-1, 1]) sitios.push({ i: ci, desde, banda, lado, centro: (desde + banda / 2) * lado });
      }
      const banda = sitios[0].banda, dummy = new THREE.Object3D();
      // la rampa: un cajón peraltado que levanta el borde de dentro, el que mira al muro
      const poner = (geo, mat, alto, off, roll) => {
        const m = new THREE.InstancedMesh(geo, mat, sitios.length);
        sitios.forEach((q, k) => {
          const sm = t.samples[q.i];
          const lat = q.centro + off * q.lado;
          dummy.position.set(sm.x + sm.nx * lat, sm.h + alto, sm.y + sm.ny * lat);
          dummy.rotation.set(roll * q.lado, -sm.ang, 0, 'YXZ');
          dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
        });
        world.add(m);
        return m;
      };
      const rampa = poner(new THREE.BoxGeometry(150, 12, banda), toon(th.curb ? th.curb[0] : '#ffe600'), 8, 0, 0.42);
      world.add(contornoInstanciado(rampa));
      // el labio de despegue, pegado al muro y del color de los paneles: es lo que se busca al pasar
      const labio = poner(new THREE.BoxGeometry(150, 26, 16), flat(th.pad || '#00ffd0'), 26, -banda / 2 - 2, 0);
      world.add(contornoInstanciado(labio));
      // dos galones en el suelo, delante de la rampa, que enseñan hacia dónde te va a tirar
      const geoGalon = new THREE.BoxGeometry(34, 3, banda * 0.8);
      const galones = new THREE.InstancedMesh(geoGalon, flat(th.pad || '#00ffd0'), sitios.length * 2);
      sitios.forEach((q, k) => {
        [0, 1].forEach((j) => {
          const sm = t.samples[((q.i - 14 + j * 7) % t.N + t.N) % t.N];
          dummy.position.set(sm.x + sm.nx * q.centro, sm.h + 2, sm.y + sm.ny * q.centro);
          dummy.rotation.set(0, -sm.ang, 0);
          dummy.updateMatrix(); galones.setMatrixAt(k * 2 + j, dummy.matrix);
        });
      });
      world.add(galones);
    }

    // ---- arcos de aviso y bordillos altos ----
    // Desde la cámara de detrás ya no se ve el circuito entero: lo que viene hay que anunciarlo con
    // antelación. Un arco de color cruza la carretera unas 200 unidades antes de cada rampa
    // (amarillo) y de cada panel de turbo (el color del panel), y las curvas llevan bordillos altos
    // en el exterior, que es la referencia para saber cuánto falta y por dónde entra la curva.
    // Todo va en mallas instanciadas (dos o tres dibujados en total) porque la escena se pinta una
    // vez por panel y cada dibujado de más se multiplica por el número de jugadores.
    {
      // Avisar con tiempo es de lo que más ayuda a quien no juega a menudo: con 42 muestras el
      // arco aparece unas 340 unidades antes (casi un segundo a tope), suficiente para reaccionar.
      const ARCO_ANTES = 42;    // muestras de aviso (unas 340 unidades: casi un segundo)
      const avisos = [];
      for (const r of t.ramps) avisos.push({ i: r.start, color: '#ffe600' });
      for (const i of t.pads) avisos.push({ i, color: th.pad });
      for (const i of t.cruces || []) avisos.push({ i, color: '#ff2d95' });   // cambio de carril a la vista
      for (const w of abiertas) avisos.push({ i: w.from, color: '#00e5ff' });   // la carretera se parte en dos
      const porColor = new Map();
      for (const a of avisos) { if (!porColor.has(a.color)) porColor.set(a.color, []); porColor.get(a.color).push(a); }
      const geoPoste = new THREE.CylinderGeometry(4, 5, 76, 8);
      const geoViga = new THREE.BoxGeometry((t.halfW + 26) * 2, 13, 11);
      const dummy = new THREE.Object3D();
      for (const [color, lista] of porColor) {
        const postes = new THREE.InstancedMesh(geoPoste, toon(color), lista.length * 2);
        const vigas = new THREE.InstancedMesh(geoViga, toon(color), lista.length);
        lista.forEach((a, k) => {
          const s = t.samples[((a.i - ARCO_ANTES) % t.N + t.N) % t.N];
          [-1, 1].forEach((lado, j) => {
            dummy.position.set(s.x + s.nx * (t.halfW + 24) * lado, s.h + 38, s.y + s.ny * (t.halfW + 24) * lado);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            postes.setMatrixAt(k * 2 + j, dummy.matrix);
          });
          dummy.position.set(s.x, s.h + 76, s.y);
          dummy.rotation.set(0, -(s.ang + Math.PI / 2), 0);
          dummy.updateMatrix();
          vigas.setMatrixAt(k, dummy.matrix);
        });
        world.add(postes, vigas, contornoInstanciado(postes), contornoInstanciado(vigas));
      }
      // bordillos altos por fuera de las curvas (el interior se deja libre para pisarlo derrapando)
      const geoBordillo = new THREE.BoxGeometry(22, 7, 15);   // bajito: si lo pisas no parece que lo atravieses
      const listas = [[], []];
      for (let i = 0; i < t.N; i += 2) {
        const giro = wrapPi(t.samples[(i + 6) % t.N].ang - t.samples[i].ang);
        if (Math.abs(giro) < 0.05) continue;       // recta: sin bordillo
        const lado = giro > 0 ? -1 : 1;            // el de fuera de la curva
        const s = t.samples[i];
        listas[(i / 2) % 2 ? 1 : 0].push({ s, lado });
      }
      for (let c = 0; c < 2; c++) {
        if (!listas[c].length) continue;
        const mesh = new THREE.InstancedMesh(geoBordillo, toon(th.curb[c]), listas[c].length);
        listas[c].forEach((q, k) => {
          dummy.position.set(q.s.x + q.s.nx * (t.halfW + 6) * q.lado, q.s.h + 3.5, q.s.y + q.s.ny * (t.halfW + 6) * q.lado);
          dummy.rotation.set(0, -q.s.ang, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(k, dummy.matrix);
        });
        world.add(mesh);
      }
    }

    // ---- cajas de objetos ----
    for (const box of t.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 22), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient, transparent: true, opacity: 0.9 }));
      m.position.set(box.x, box.h + 18, box.y);
      m.add(new THREE.Mesh(geoContorno(m.geometry), matContorno));
      const q = makeSprite(textTexture('?', { w: 64, h: 64, font: `900 52px ${UI_FONT}`, color: '#fff', stroke: '#000', strokeW: 6 }), 6);
      q.material.depthTest = true; q.scale.set(16, 16, 1);
      m.add(q);
      box.view = m;
      world.add(m);
    }
    // ---- charcos / lava / cráteres ----
    if (th.pools) {
      let placed = 0, tries = 0;
      while (placed < th.pools.count && tries < 4000) {
        tries++;
        const r = th.pools.minR + rnd() * (th.pools.maxR - th.pools.minR);
        const { x, y } = juntoALaPista(t, r + 50, 520);
        if (x < 60 + r || y < 60 + r || x > t.W - 60 - r || y > t.H - 60 - r) continue;
        if (t.nearest(x, y).d < t.halfW + r + 50) continue;
        const h = t.terrainAt(x, y);
        const grp = new THREE.Group();
        if (th.pools.kind === 'crater') {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.18, 8, 24), toon(shade(th.ground, -0.08)));
          ring.rotation.x = Math.PI / 2; ring.position.y = 2;
          const floor = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24), flat(th.pools.color));
          floor.rotation.x = -Math.PI / 2; floor.position.y = 1.2;
          grp.add(ring, floor);
        } else {
          const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), flat(th.pools.color, th.pools.kind === 'water' ? { transparent: true, opacity: 0.9 } : {}));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 1.6;
          disc.scale.x = 1.3;
          grp.add(disc);
          if (th.pools.color2) {
            const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 20), flat(th.pools.color2));
            inner.rotation.x = -Math.PI / 2; inner.position.set(-r * 0.25, 2.2, -r * 0.2); inner.scale.x = 1.3;
            grp.add(inner);
          }
          if (th.pools.kind === 'lava') {
            const glow = new THREE.PointLight(th.pools.color, 0, 260, 1.5);
            glow.position.y = 30; glow.intensity = 40000;
            if (placed < 3) grp.add(glow);
          }
          anim({ kind: 'pool', obj: grp, phase: rnd() * 6 });
        }
        grp.position.set(x, h, y);
        world.add(grp);
        placed++;
      }
    }
    // ---- decoración ----
    const decor = {
      candyTree: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 28, 8), toon(pick(['#ffffff', '#ffd6f2', '#ffe600'])));
        trunk.position.y = 14; g.add(trunk);
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const r = 14 + rnd() * 12;
          const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), toon(pick(th.palette)));
          ball.position.set((rnd() - 0.5) * 18, 30 + rnd() * 16, (rnd() - 0.5) * 18);
          g.add(ball);
        }
        return g;
      },
      pineTree: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 20, 8), toon('#4a2b7a'));
        trunk.position.y = 10; g.add(trunk);
        const c = pick(th.palette);
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(22 - i * 6, 26, 8), toon(i % 2 ? shade(c, 0.12) : c));
          cone.position.y = 26 + i * 16; g.add(cone);
        }
        return g;
      },
      palm: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 64, 8), toon('#c9702a'));
        trunk.position.y = 32; trunk.rotation.z = 0.18; g.add(trunk);
        for (let i = 0; i < 6; i++) {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(44, 2.5, 12), toon(pick(['#39ff88', '#7dff3f', '#00e5a8'])));
          leaf.position.set(-11 + Math.cos(i) * 20, 64, Math.sin(i) * 20);
          leaf.rotation.set(0, -i * 1.05, -0.5);
          g.add(leaf);
        }
        for (let i = 0; i < 2; i++) { const nut = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), toon('#7a3b10')); nut.position.set(-11 + i * 6, 58, 4 - i * 6); g.add(nut); }
        return g;
      },
      mushroom: () => {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 20, 10), toon('#fff4d6'));
        stem.position.y = 10; g.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(pick(['#ff2d55', '#ff2d95', '#9b3bff', '#00e5ff'])));
        cap.position.y = 18; g.add(cap);
        for (let i = 0; i < 4; i++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), toon('#ffffff')); dot.position.set(Math.cos(i * 1.6) * 10, 26 + (i % 2) * 3, Math.sin(i * 1.6) * 10); g.add(dot); }
        return g;
      },
      balloon: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), toon(pick(th.palette)));
        b.scale.y = 1.2; b.position.y = 70;
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 56, 4), flat('#ffffff'));
        str.position.y = 28;
        g.add(b, str);
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 8 });
        return g;
      },
      lollipop: () => {
        const g = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 46, 6), toon('#ffffff'));
        stick.position.y = 23; g.add(stick);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 5, 20), toon(pick(th.palette)));
        disc.rotation.x = Math.PI / 2; disc.position.y = 56; g.add(disc);
        const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 5.5, 16), toon(pick(th.palette)));
        disc2.rotation.x = Math.PI / 2; disc2.position.y = 56; g.add(disc2);
        anim({ kind: 'spinY', obj: g, speed: 0.6 + rnd() });
        return g;
      },
      rock: () => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 8, 0), toon(pick(['#5a2ca0', '#3b1e6b', '#7a1fb8', '#2c3fa8'])));
        m.position.y = 6; m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.set(1 + rnd() * 0.6, 0.7 + rnd() * 0.5, 1);
        return m;
      },
      moonRock: () => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rnd() * 9, 1), toon(pick(['#8fa8ff', '#b8c6ff', '#6a7fd6'])));
        m.position.y = 6; m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.set(1 + rnd() * 0.5, 0.6 + rnd() * 0.5, 1);
        return m;
      },
      crystal: () => {
        const g = new THREE.Group();
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const c = new THREE.Mesh(new THREE.OctahedronGeometry(6 + rnd() * 8), flat(pick(th.palette)));
          c.scale.y = 1.8 + rnd(); c.position.set((rnd() - 0.5) * 16, 10 + rnd() * 6, (rnd() - 0.5) * 16); c.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5);
          g.add(c);
        }
        anim({ kind: 'pulse', obj: g, phase: rnd() * 6 });
        return g;
      },
      cactus: () => {
        const g = new THREE.Group();
        const c = pick(['#39ff88', '#00e5a8', '#7dff3f']);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 40, 8), toon(c)); body.position.y = 20; g.add(body);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 8), toon(c)); arm.position.set(side * 10, 26, 0); arm.rotation.z = side * 1.2; g.add(arm);
          const up = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 8), toon(c)); up.position.set(side * 16, 34, 0); g.add(up);
        }
        return g;
      },
      volcano: () => {
        const g = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(120, 150, 9), toon('#3b1e6b'));
        cone.position.y = 75; g.add(cone);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(22, 30, 14, 9), flat('#ff5e00'));
        top.position.y = 146; g.add(top);
        anim({ kind: 'volcano', obj: g, t: rnd() * 3 });
        g.userData.big = true;
        return g;
      },
      beachBall: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), toon(pick(th.palette)));
        const band = new THREE.Mesh(new THREE.TorusGeometry(12.6, 2.2, 8, 24), toon(pick(th.palette)));
        band.rotation.x = Math.PI / 2 + 0.4;
        g.add(b, band); g.position.y = 13;
        return g;
      },
      umbrella: () => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 56, 6), toon('#ffffff')); pole.position.y = 28; g.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(30, 16, 10, 1, true), new THREE.MeshToonMaterial({ color: pick(th.palette), gradientMap: toonGradient, side: THREE.DoubleSide }));
        top.position.y = 56; g.add(top);
        g.rotation.z = 0.2;
        return g;
      },
      flamingo: () => {
        const g = new THREE.Group();
        for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 26, 5), toon('#ff8a00')); leg.position.set(0, 13, s * 4); g.add(leg); }
        const body = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 8), toon('#ff6ab8')); body.position.y = 32; body.scale.set(1.3, 0.9, 1); g.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 24, 6), toon('#ff6ab8')); neck.position.set(12, 46, 0); neck.rotation.z = -0.3; g.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6), toon('#ff6ab8')); head.position.set(16, 58, 0); g.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 6), toon('#222222')); beak.position.set(21, 56, 0); beak.rotation.z = -1.9; g.add(beak);
        g.rotation.y = rnd() * 6;
        return g;
      },
      planet: () => {
        const g = new THREE.Group();
        const p = new THREE.Mesh(new THREE.SphereGeometry(18 + rnd() * 10, 14, 10), toon(pick(th.palette)));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 6, 30), toon(pick(th.palette)));
        ring.rotation.x = Math.PI / 2 + 0.5;
        g.add(p, ring);
        g.position.y = 110 + rnd() * 80;
        anim({ kind: 'spinY', obj: g, speed: 0.3 + rnd() * 0.4 });
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 6 });
        return g;
      },
      flag: () => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 50, 6), toon('#ffffff')); pole.position.y = 25; g.add(pole);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), new THREE.MeshToonMaterial({ color: pick(th.palette), gradientMap: toonGradient, side: THREE.DoubleSide }));
        f.position.set(12, 42, 0); g.add(f);
        return g;
      },
      // ---- Bajo la Cama: los trastos de la casa, a tamaño de kart ----
      caja: () => {
        const g = new THREE.Group();
        const c = pick(['#c98a4b', '#b87a3e', '#d79a5c']);
        const alto = 26 + rnd() * 30, ancho = 38 + rnd() * 22;
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, ancho * 0.9), toon(c));
        cuerpo.position.y = alto / 2; g.add(cuerpo);
        const cinta = new THREE.Mesh(new THREE.BoxGeometry(ancho + 1, 4, 11), toon('#e8d9a8'));
        cinta.position.y = alto; g.add(cinta);
        return g;
      },
      bombilla: () => {
        const g = new THREE.Group();
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 130, 4), flat('#15100c'));
        cable.position.y = 125; g.add(cable);
        const casquillo = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 11, 8), toon('#9aa0b5'));
        casquillo.position.y = 62; g.add(casquillo);
        const bulbo = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 10), flat('#fff3b0'));
        bulbo.position.y = 50; g.add(bulbo);
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 5 });
        return g;
      },
      sofa: () => {
        const g = new THREE.Group();
        const c = pick(['#b0303a', '#8d2530', '#6a2f5a', '#2f5a6a']);
        const asiento = new THREE.Mesh(new THREE.BoxGeometry(74, 16, 40), toon(c));
        asiento.position.y = 18; g.add(asiento);
        const respaldo = new THREE.Mesh(new THREE.BoxGeometry(74, 30, 12), toon(shade(c, -0.06)));
        respaldo.position.set(0, 38, -16); g.add(respaldo);
        for (const lado of [-1, 1]) {
          const brazo = new THREE.Mesh(new THREE.BoxGeometry(12, 26, 40), toon(shade(c, 0.05)));
          brazo.position.set(35 * lado, 32, 0); g.add(brazo);
        }
        for (const lado of [-1, 1]) {
          const cojin = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 32), toon(shade(c, 0.12)));
          cojin.position.set(17 * lado, 30, 2); g.add(cojin);
        }
        return g;
      },
      cojin: () => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(26 + rnd() * 14, 9, 26 + rnd() * 14), toon(pick(th.palette)));
        m.position.y = 5; m.rotation.y = rnd() * 3; m.rotation.z = (rnd() - 0.5) * 0.3;
        return m;
      },
      lampara: () => {
        const g = new THREE.Group();
        const pie = new THREE.Mesh(new THREE.CylinderGeometry(3, 10, 74, 8), toon('#5a4632'));
        pie.position.y = 37; g.add(pie);
        const pantalla = new THREE.Mesh(new THREE.ConeGeometry(24, 30, 12, 1, true), new THREE.MeshToonMaterial({ color: '#ffe0a8', gradientMap: toonGradient, side: THREE.DoubleSide }));
        pantalla.position.y = 86; g.add(pantalla);
        const luz = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), flat('#fff3b0'));
        luz.position.y = 74; g.add(luz);
        return g;
      },
      tarro: () => {
        const g = new THREE.Group();
        const alto = 26 + rnd() * 22;
        const cristal = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, alto, 12), new THREE.MeshToonMaterial({ color: '#dff3f7', gradientMap: toonGradient, transparent: true, opacity: 0.75 }));
        cristal.position.y = alto / 2; g.add(cristal);
        const dentro = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, alto * 0.55, 12), toon(pick(['#ff8a00', '#ff2d95', '#39ff88', '#b14bff'])));
        dentro.position.y = alto * 0.3; g.add(dentro);
        const tapa = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 6, 12), toon('#c9a227'));
        tapa.position.y = alto + 2; g.add(tapa);
        return g;
      },
      fogon: () => {
        const g = new THREE.Group();
        const placa = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 8, 16), toon('#2a2a2e'));
        placa.position.y = 4; g.add(placa);
        const corona = new THREE.Mesh(new THREE.TorusGeometry(13, 3.5, 6, 16), toon('#4a4a52'));
        corona.rotation.x = Math.PI / 2; corona.position.y = 9; g.add(corona);
        for (let k = 0; k < 6; k++) {
          const llama = new THREE.Mesh(new THREE.ConeGeometry(4.5, 16, 6), flat(k % 2 ? '#00b4ff' : '#ff8a00'));
          llama.position.set(Math.cos(k * 1.05) * 13, 18, Math.sin(k * 1.05) * 13);
          g.add(llama);
        }
        anim({ kind: 'pulse', obj: g, phase: rnd() * 6 });
        return g;
      },
      cubito: () => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(18 + rnd() * 12, 18 + rnd() * 10, 18 + rnd() * 12),
          new THREE.MeshToonMaterial({ color: '#dff1ff', gradientMap: toonGradient, transparent: true, opacity: 0.85 }));
        m.position.y = 10; m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 0.4);
        return m;
      },
      patito: () => {
        const g = new THREE.Group();
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(16, 14, 10), toon('#ffd400'));
        cuerpo.scale.set(1.25, 0.95, 1); cuerpo.position.y = 15; g.add(cuerpo);
        const cola = new THREE.Mesh(new THREE.ConeGeometry(9, 16, 8), toon('#ffd400'));
        cola.position.set(-18, 20, 0); cola.rotation.z = 1.1; g.add(cola);
        const cabeza = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 9), toon('#ffd400'));
        cabeza.position.set(13, 30, 0); g.add(cabeza);
        const pico = new THREE.Mesh(new THREE.ConeGeometry(4.5, 10, 7), toon('#ff8a00'));
        pico.position.set(22, 29, 0); pico.rotation.z = -Math.PI / 2; g.add(pico);
        for (const lado of [-1, 1]) {
          const ojo = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), flat('#1a1a1a'));
          ojo.position.set(17, 33, 4 * lado); g.add(ojo);
        }
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 4 });
        return g;
      },
      espuma: () => {
        const g = new THREE.Group();
        const n = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const r = 9 + rnd() * 13;
          const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient, transparent: true, opacity: 0.85 }));
          b.position.set((rnd() - 0.5) * 30, r * 0.8, (rnd() - 0.5) * 30);
          g.add(b);
        }
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 3 });
        return g;
      },
      // ---- Mundo Pixel: los cacharros del videojuego ----
      bloque: () => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshToonMaterial({ map: texBloque(), gradientMap: toonGradient }));
        m.position.y = 40 + rnd() * 40; g.add(m);
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 6 });
        return g;
      },
      tuberia: () => {
        const g = new THREE.Group();
        const alto = 34 + rnd() * 40;
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, alto, 12), toon('#1ea81e'));
        cuerpo.position.y = alto / 2; g.add(cuerpo);
        const boca = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 12, 12), toon('#39d139'));
        boca.position.y = alto; g.add(boca);
        return g;
      },
      nube8: () => {
        const g = new THREE.Group();
        for (const [dx, dy, w] of [[0, 0, 34], [-20, -8, 22], [20, -8, 22], [0, 12, 20]]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, 14, 16), toon('#ffffff'));
          b.position.set(dx, 90 + dy + rnd() * 40, 0); g.add(b);
        }
        anim({ kind: 'drift', obj: g, speed: 5 + rnd() * 8 });
        return g;
      },
      pieza: () => {
        const g = new THREE.Group();
        const c = pick(['#00e5ff', '#ffe600', '#b14bff', '#39ff88', '#ff2d95', '#ff6a00']);
        const formas = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]]];
        for (const [a, b] of pick(formas)) {
          const cubo = new THREE.Mesh(new THREE.BoxGeometry(17, 17, 17), toon(c));
          cubo.position.set(a * 18, b * 18 + 9, 0); g.add(cubo);
        }
        g.rotation.y = rnd() * 3;
        anim({ kind: 'spinY', obj: g, speed: 0.2 + rnd() * 0.5 });
        return g;
      },
      fallo: () => {
        const g = new THREE.Group();
        const n = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const cubo = new THREE.Mesh(new THREE.BoxGeometry(14 + rnd() * 26, 10 + rnd() * 20, 14 + rnd() * 20),
            flat(pick(['#00ffa8', '#ff2d95', '#00e5ff', '#ffe600', '#ffffff'])));
          cubo.position.set((rnd() - 0.5) * 40, 10 + k * 16, (rnd() - 0.5) * 30);
          g.add(cubo);
        }
        anim({ kind: 'glitch', obj: g, t: rnd() });
        return g;
      },
      chip: () => {
        const g = new THREE.Group();
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 24), toon('#12131a'));
        cuerpo.position.y = 9; g.add(cuerpo);
        const punto = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 8), toon('#3a3f52'));
        punto.position.set(-12, 15, -8); g.add(punto);
        for (let k = -2; k <= 2; k++) for (const lado of [-1, 1]) {
          const pata = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 8), toon('#c9c9a8'));
          pata.position.set(k * 8, 6, 15 * lado); g.add(pata);
        }
        const led = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), flat(pick(['#39ff88', '#ff2d95', '#ffe600'])));
        led.position.set(14, 16, 6); g.add(led);
        anim({ kind: 'pulse', obj: led, phase: rnd() * 6 });
        return g;
      },
      boton: () => {
        const g = new THREE.Group();
        const c = pick(['#5a6cff', '#39ff88', '#ff6a00', '#ff2d95']);
        const base = new THREE.Mesh(new THREE.BoxGeometry(56, 16, 22), toon(shade(c, -0.12)));
        base.position.y = 8; g.add(base);
        const tapa = new THREE.Mesh(new THREE.BoxGeometry(52, 8, 19), toon(c));
        tapa.position.y = 18; g.add(tapa);
        const brillo = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 5), flat('#ffffff'));
        brillo.position.set(0, 23, -4); g.add(brillo);
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 3 });
        return g;
      },
      barra: () => {
        const g = new THREE.Group();
        const marco = new THREE.Mesh(new THREE.BoxGeometry(78, 14, 10), toon('#2a2f65'));
        marco.position.y = 30; g.add(marco);
        const relleno = new THREE.Mesh(new THREE.BoxGeometry(70 * (0.2 + rnd() * 0.7), 9, 11), flat(pick(['#39ff88', '#00e5ff', '#ffe600'])));
        relleno.position.set(-35 + relleno.geometry.parameters.width / 2, 30, 0); g.add(relleno);
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 6), toon('#8f96b5'));
        poste.position.y = 15; g.add(poste);
        anim({ kind: 'pulse', obj: relleno, phase: rnd() * 6 });
        return g;
      },
      rocket: () => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 46, 12), toon('#ffffff')); body.position.y = 30; g.add(body);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(9, 18, 12), toon(pick(['#ff2d95', '#ff3d3d', '#00e5ff']))); nose.position.y = 62; g.add(nose);
        const win = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), flat('#00e5ff')); win.position.set(8, 38, 0); g.add(win);
        for (let i = 0; i < 3; i++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 2), toon('#ff2d95'));
          fin.position.set(Math.cos(i * 2.1) * 11, 10, Math.sin(i * 2.1) * 11); fin.rotation.y = -i * 2.1; g.add(fin);
        }
        g.userData.big = true;
        return g;
      },
    };
    /*
     * Con biomas, la decoración se planta **a los lados de la pista de su tramo**: en un mundo tan
     * grande como el de Last Dance (25.000 x 20.000), tirar objetos al azar por el mapa dejaba la
     * carretera pelada y llenaba de palmeras sitios donde no pasa nadie.
     */
    if (th.biomas) {
      for (const bioma of th.biomas) {
        const desde = th.biomas.indexOf(bioma) === 0 ? 0 : th.biomas[th.biomas.indexOf(bioma) - 1].hasta;
        const hasta = Math.min(1, bioma.hasta);
        for (const d of bioma.decor || []) {
          const maker = decor[d.kind];
          if (!maker) continue;
          for (let k = 0; k < d.n; k++) {
            const f = desde + (hasta - desde) * ((k + 0.5) / d.n + (rnd() - 0.5) * 0.02);
            const sm = t.samples[Math.floor(((f % 1) + 1) % 1 * t.N) % t.N];
            const lado = rnd() < 0.5 ? -1 : 1;
            const lejos = t.halfW + 110 + rnd() * 900;
            const obj = maker();
            const x = sm.x + sm.nx * lejos * lado, y = sm.y + sm.ny * lejos * lado;
            if (x < 40 || y < 40 || x > t.W - 40 || y > t.H - 40) continue;
            obj.position.x = x; obj.position.z = y; obj.position.y += t.terrainAt(x, y);
            obj.rotation.y += rnd() * Math.PI * 2;
            world.add(obj);
          }
        }
      }
    }
    for (const d of (th.biomas ? [] : th.decor || [])) {
      const maker = decor[d.kind];
      if (!maker) continue;
      let placed = 0, tries = 0;
      while (placed < d.n && tries < 3000) {
        tries++;
        const obj = maker();
        const margin = obj.userData && obj.userData.big ? 190 : 46;
        const { x, y } = juntoALaPista(t, margin, obj.userData && obj.userData.big ? 900 : 620);
        if (x < 30 || y < 30 || x > t.W - 30 || y > t.H - 30) continue;
        if (t.nearest(x, y).d < t.halfW + margin) continue;
        obj.position.x = x; obj.position.z = y;
        // sin terreno no hay dónde apoyarla: flota, unas por encima y otras por debajo de la pista
        obj.position.y += cielo ? (rnd() < 0.45 ? 120 + rnd() * 520 : -260 - rnd() * 700) : t.terrainAt(x, y);
        obj.rotation.y += rnd() * Math.PI * 2;
        world.add(obj);
        placed++;
      }
    }
    /*
     * La cordillera (`theme.montanas`): montañas de verdad —el modelo `montanas.glb`, hecho con
     * `tools/blender/montanas.py`— por todo el hueco que deja la carretera. Van en mallas
     * instanciadas, una por tipo y material, así que noventa montañas cuestan una docena de
     * dibujados; y cada una se tiñe con `setColorAt` del color del bioma por el que cae: verdes en
     * la jungla, blancas en el hielo, negras en la mina.
     *
     * Sin contorno a propósito: el contorno se hincha una distancia fija y en una montaña de dos
     * mil unidades no se vería, así que serían doce dibujados por panel tirados a la basura.
     */
    if (th.montanas && modelos.montanas) {
      const cfg = th.montanas;
      const tipos = [];
      for (const nombre of cfg.tipos || ['Pico', 'PicoDoble', 'Meseta', 'Aguja', 'Macizo', 'Colina']) {
        const nodo = modelos.montanas.getObjectByName(nombre);
        if (!nodo) continue;
        const mallas = [];
        nodo.traverse((o) => { if (o.isMesh) mallas.push(o); });
        if (!mallas.length) continue;
        // lo ancha que es por abajo: hace falta para no plantarla encima de la carretera
        let radio = 0;
        for (const m of mallas) {
          m.geometry.computeBoundingBox();
          const b = m.geometry.boundingBox;
          radio = Math.max(radio, Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z));
        }
        tipos.push({ mallas, radio, sitios: [] });
      }
      const lejos = cfg.lejos || 700;
      if (tipos.length) {
        let puestas = 0, intentos = 0;
        while (puestas < cfg.n && intentos < cfg.n * 80) {
          intentos++;
          /*
           * Primero el tipo y el tamaño, y luego el sitio: lo que hay que dejar libre no es el
           * centro de la montaña, es **su falda**. Midiendo solo el centro, un macizo del 2,8
           * (1.200 px de radio) salía a 600 px de la carretera y la tapaba entera: la cámara
           * empezaba la carrera dentro de la montaña.
           */
          const tipo = tipos[Math.floor(rnd() * tipos.length)];
          const esc = (cfg.min || 0.8) + rnd() * ((cfg.max || 2.6) - (cfg.min || 0.8));
          const falda = lejos + tipo.radio * esc;
          const { x, y } = juntoALaPista(t, falda, cfg.banda || 2600);
          if (x < 150 || y < 150 || x > t.W - 150 || y > t.H - 150) continue;
          const cerca = t.nearest(x, y);
          if (cerca.d < t.halfW + falda) continue;      // que no le salga una montaña en la cara a nadie
          const bioma = biomaDeMuestra(t, cerca.i);
          tipo.sitios.push({
            x, y, esc, giro: rnd() * Math.PI * 2,
            h: (t.terrainAt(x, y) || 0) - 18 * esc,      // un pelín enterradas: no se ve el corte de la base
            roca: shade(bioma ? bioma.ground : th.ground, -0.14),
            nieve: shade(bioma ? bioma.groundAlt : th.groundAlt, 0.4),
          });
          puestas++;
        }
        const dummy = new THREE.Object3D(), col = new THREE.Color();
        for (const tipo of tipos) {
          if (!tipo.sitios.length) continue;
          for (const malla of tipo.mallas) {
            const nieve = ((malla.material && malla.material.name) || '') === 'Nieve';
            const inst = new THREE.InstancedMesh(malla.geometry, toon('#ffffff'), tipo.sitios.length);
            tipo.sitios.forEach((q, k) => {
              dummy.position.set(q.x, q.h, q.y);
              dummy.rotation.set(0, q.giro, 0);
              dummy.scale.setScalar(q.esc);
              dummy.updateMatrix();
              inst.setMatrixAt(k, dummy.matrix);
              inst.setColorAt(k, col.set(nieve ? q.nieve : q.roca));
            });
            if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
            world.add(inst);
          }
        }
      }
    }
    // ---- nubes, sol, estrellas ----
    if (th.clouds) {
      for (let i = 0; i < th.clouds.n; i++) {
        const g = new THREE.Group();
        const n = 3 + Math.floor(rnd() * 3);
        for (let j = 0; j < n; j++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(22 + rnd() * 26, 10, 8), toon(th.clouds.color));
          s.position.set(j * 30 - n * 15, rnd() * 10, (rnd() - 0.5) * 20);
          g.add(s);
        }
        g.position.set(rnd() * t.W, 300 + rnd() * 180, rnd() * t.H - 100);
        anim({ kind: 'drift', obj: g, speed: 8 + rnd() * 10 });
        world.add(g);
      }
    }
    if (th.sun) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(th.sun.r, 20, 14), flat(th.sun.color));
      s.position.set(th.sun.pos[0], th.sun.pos[1], th.sun.pos[2]);
      world.add(s);
      if (th.sun.ring) { const ring = new THREE.Mesh(new THREE.TorusGeometry(th.sun.r * 1.6, th.sun.r * 0.1, 8, 40), flat('#ff00ff')); ring.rotation.x = 1.2; s.add(ring); }
    }
    if (th.stars) {
      const pos = [];
      for (let i = 0; i < 900; i++) {
        const a = rnd() * Math.PI * 2, e = 0.15 + rnd() * 1.2, r = Math.max(3000, Math.hypot(t.W, t.H));
        pos.push(t.W / 2 + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, t.H / 2 + Math.sin(a) * Math.cos(e) * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false }));
      world.add(pts);
    }
    return world;
  }

  function skyTexture(top, bottom) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  let currentWorld = null;
  function setWorld(t) {
    if (currentWorld && currentWorld.userData.track === t) return;
    if (currentWorld) scene.remove(currentWorld);
    if (!t.world) { t.world = buildWorld(t); t.world.userData.track = t; }
    currentWorld = t.world;
    scene.add(currentWorld);
    const th = t.def.theme;
    scene.background = skyTexture(th.sky[0], th.sky[1]);
    // en un mundo grande la cámara de la sala se aleja mucho: si la niebla no se estira con él,
    // el circuito entero se ve gris desde arriba
    const lejos = Math.max(1, Math.max(t.W / MAP_W, t.H / MAP_H));
    scene.fog = new THREE.Fog(new THREE.Color(th.fog), 1800 * lejos, 4200 * lejos);
    hemi.color.set(th.sky[1]); hemi.groundColor.set(th.ground);
  }

  // ===================== Partículas =====================
  const particles = (() => {
    const MAX = 900;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < MAX; i++) mesh.setColorAt(i, white);
    scene.add(mesh);
    const list = new Array(MAX).fill(null).map(() => ({ life: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, g: 0, flat: false, ang: null, largo: 1 }));
    let cursor = 0;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    function emit(x, y, z, o) {
      const n = o.n || 1;
      for (let k = 0; k < n; k++) {
        const p = list[cursor]; const idx = cursor; cursor = (cursor + 1) % MAX;
        const sp = o.spread == null ? 60 : o.spread;
        p.x = x + (Math.random() - 0.5) * (o.jitter || 6); p.y = y + (Math.random() - 0.5) * (o.jitter || 6); p.z = z + (Math.random() - 0.5) * (o.jitter || 6);
        p.vx = (o.vx || 0) + (Math.random() - 0.5) * sp; p.vy = (o.vy || 0) + (Math.random() - 0.5) * sp; p.vz = (o.vz || 0) + (Math.random() - 0.5) * sp;
        p.life = (o.life || 0.5) * (0.7 + Math.random() * 0.6); p.t = 0;
        p.size = (o.size || 4) * (0.7 + Math.random() * 0.6); p.g = o.g == null ? 500 : o.g; p.flat = !!o.flat;
        // `ang` (radianes) deja la partícula quieta y apuntando a donde se le diga, y `largo` la
        // estira en esa dirección: así salen marcas de neumático y rayas de estela, no confeti
        p.ang = o.ang == null ? null : o.ang; p.largo = o.largo || 1;
        const c = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color;
        if (c === 'rainbow') col.setHSL(Math.random(), 1, 0.55); else col.set(c || '#ffffff');
        mesh.setColorAt(idx, col);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    function update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = list[i];
        if (p.t >= p.life) { dummy.scale.set(0, 0, 0); dummy.position.set(0, -1000, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); continue; }
        p.t += dt;
        p.vy -= p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const s = p.size * (1 - p.t / p.life);
        dummy.position.set(p.x, p.y, p.z);
        if (p.ang != null) {
          dummy.scale.set(s * p.largo, p.flat ? s * 0.25 : s, s);
          dummy.rotation.set(0, -p.ang, 0);
        } else {
          dummy.scale.set(p.flat ? s * 1.6 : s, p.flat ? s * 0.3 : s, s);
          dummy.rotation.set(p.t * 5, p.t * 3, 0);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    return { emit, update };
  })();

  // ===================== Estado =====================
  /*
   * Aquí se monta la simulación (sim.mjs) y se le engancha la tele: cada hook convierte un suceso
   * de la carrera en algo que se ve, se oye o se manda al móvil. Los hooks se llaman durante la
   * partida, nunca al construir, así que pueden usar cosas declaradas más abajo.
   */
  const sim = createSim({
    geom: KART_GEOM,
    trackDefs: KART_TRACKS,
    hooks: {
      onPhase: (phase) => {
        if (phase === 'lobby' || phase === 'countdown') clearToasts();
        sendPhase();
        updateOverlays();
        if (phase === 'results') finDeCarrera();
      },
      /*
       * Salida parada con semáforo, como en las carreras de verdad: con cada segundo de la cuenta
       * atrás se enciende una luz roja, y al «¡YA!» se ponen todas verdes y desaparece el panel.
       */
      onCountdown: (n) => { showBig(String(n)); pintarSemaforo(4 - n); },
      onGo: () => {
        showBig('¡YA!');
        semaforoEl.classList.add('ya');
        setTimeout(() => hideBig('¡YA!'), 1100);
        setTimeout(() => { semaforoEl.classList.add('hidden'); semaforoEl.classList.remove('ya'); }, 900);
      },
      onTrackChanged: (t) => setWorld(t),
      onKartAdded: (k) => makeKartModel(k),
      onKartRemoved: (k) => { removeKartModel(k); chases.delete(k); pararMotor(k); },
      onSfx: (name) => sfx(name),
      onDrift: (k, nivel) => { if (nivel > 0) sfx('drift' + nivel); },
      onParticles: (x, h, z, o) => particles.emit(x, h, z, o),
      onToast: (text, dur) => toast(text, dur),
      onStatus: (k) => sendStatus(k),
      onFx: (k, kind) => { if (k.playerId != null) toPlayer(k.playerId, { t: 'fx', kind }); },
      onShake: (n, k) => {
        state.shake = Math.max(state.shake, n);            // la cámara general (la de la tele sin paneles)
        const c = k && chases.get(k);                      // y, si es cosa de un kart, su panel
        if (c) c.shake = Math.max(c.shake, n);
        if (n >= CAM_HITSTOP_MIN) hitStop = Math.max(hitStop, CAM_HITSTOP);
      },
      onFlash: () => { flashEl.style.opacity = '0.85'; setTimeout(() => { flashEl.style.opacity = '0'; }, 60); },
      /*
       * Caracol: la carrera se para y quien lo ha usado elige a quién frenar. En la tele sale el
       * cartelón con los candidatos numerados; al móvil de esa persona le mandamos la lista para
       * que elija tocando, y a los demás un aviso para que sepan por qué se ha parado todo.
       */
      onChoosing: (k, candidatos) => {
        eligiendoAhora = { kart: k, candidatos };
        pintarElegir();
        const opciones = candidatos.map((o) => ({ kart: o.id, name: o.name, emoji: o.emoji, color: o.color, pos: o.rank }));
        if (k.playerId != null) toPlayer(k.playerId, { t: 'pick', opciones, segundos: Math.round(state.eligiendo ? state.eligiendo.queda : 6) });
        for (const p of state.players.values()) if (p.id !== k.playerId) toPlayer(p.id, { t: 'fx', kind: 'pausa' });
        sfx('snail');
      },
      onChosen: (quien, victima) => {
        eligiendoAhora = null;
        pintarElegir();
        for (const p of state.players.values()) toPlayer(p.id, { t: 'fx', kind: 'sigue' });
        if (victima) sfx('snailHit');
      },
      onRescue: (k) => {
        // nubecita de humo y chispas en el sitio donde lo dejan
        particles.emit(k.x, k.z + 30, k.y, { n: 18, color: ['#ffffff', '#00e5ff', '#aab0e8'], spread: 150, vy: 120, life: 0.8, size: 5, g: 240 });
        particles.emit(k.x, k.z + 4, k.y, { n: 10, color: ['#ffffff', '#d5d8ff'], spread: 90, vy: 40, life: 0.6, size: 7, g: 60, flat: true });
        // y que baje el árbitro a recogerte (ver `montarArbitro`)
        const M = k.view;
        if (M && !M.arbitro && modelos.arbitro) {
          M.arbitro = copiaDelModelo('arbitro');
          M.arbitro.scale.setScalar(0.66);
          M.arbitro.visible = false;
          kartsGroup.add(M.arbitro);
        }
      },
      onSquash: (k, dv) => { if (k.view) k.view.sq.vel -= dv; },
      onStretch: (k, dv) => { if (k.view) k.view.st.vel += dv; },
      onProjectileAdded: (pr) => { pr.view = pr.type === 'patito' ? patitoMesh() : shellMesh(pr.type); },
      onProjectileRemoved: (pr) => { if (pr.view) { scene.remove(pr.view); pr.view = null; } },
      onBananaAdded: (b) => { b.view = b.tipo === 'espuma' ? espumaMesh() : bananaMesh(); },
      onBananaRemoved: (b) => { if (b.view) { scene.remove(b.view); b.view = null; } },
    },
  });
  const TRACKS = sim.tracks;
  const state = sim.state;          // fases, circuito, karts, objetos… (lo comparte la simulación)
  // lo que solo existe en la tele: la simulación no mira nada de esto
  state.players = new Map();
  state.hostId = null;
  state.settings = { track: 0, laps: 3, bots: 2, carreras: 4 };
  /*
   * Modo torneo: varias carreras seguidas con los mismos karts. Entre carrera y carrera sale la
   * clasificación con los puntos y cada móvil vota el circuito siguiente; la última puntúa doble y
   * al final hay podio. Las cuentas están en `torneo.mjs` (y se prueban en `npm test`); aquí solo
   * vive el hilo de la sesión.
   */
  state.torneo = null;
  state.kb = null;
  state.replaced = false;
  state.joinUrl = '';
  state.joinSeguro = false;
  state.joinUrlVolante = '';
  state.shake = 0;

  let animT = 0;
  const kartsGroup = new THREE.Group();
  scene.add(kartsGroup);

  // ===================== Red =====================
  let ws = null;
  function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function toPlayer(id, m) { wsSend({ t: 'to', id, m }); }
  function sendPhase() { wsSend({ t: 'phase', phase: state.phase }); }

  function connect() {
    if (state.replaced) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    // la pantalla es la única que conoce `CHARS`: le pasa al servidor los circuitos y **los
    // personajes**, para que los móviles enseñen los que hay de verdad al entrar
    ws.onopen = () => {
      wsSend({
        t: 'screen',
        tracks: KART_TRACKS.map((t) => t.name),
        chars: CHARS.map((c) => ({ name: c.name, emoji: c.emoji, color: c.color })),
        items: ITEM_IDS.map((id) => ({ id, icon: ITEMS[id].icon, name: ITEMS[id].name })),
      });
    };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } handleMessage(m); };
    ws.onclose = () => { if (!state.replaced) setTimeout(connect, 1500); };
    ws.onerror = () => { /* onclose reconecta */ };
  }

  function upsertPlayer(p) {
    const cur = state.players.get(p.id);
    if (cur) { cur.name = p.name; cur.char = p.char; cur.host = p.host; cur.connected = p.connected; cur.easy = !!p.easy; }
    else state.players.set(p.id, { id: p.id, name: p.name, char: p.char, host: p.host, connected: p.connected, easy: !!p.easy, input: { s: 0, g: 0, b: 0, d: 0 } });
    const k = state.karts.find((q) => q.playerId === p.id);
    if (k) k.name = p.name;
  }

  function handleMessage(m) {
    switch (m.t) {
      case 'init':
        state.players.clear();
        for (const p of m.players) upsertPlayer(p);
        state.hostId = m.hostId;
        applySettings(m.settings);
        sendPhase();
        for (const p of state.players.values()) if (state.phase !== 'lobby' && state.phase !== 'warmup' && !state.karts.some((k) => k.playerId === p.id)) toPlayer(p.id, { t: 'spectate' });
        for (const k of state.karts) sendStatus(k);
        updateOverlays();
        break;
      case 'join': {
        upsertPlayer(m.player);
        // calentando todavía no ha empezado nada: quien llega se mete en la pista como los demás
        if (state.phase !== 'lobby' && state.phase !== 'warmup') {
          const k = state.karts.find((q) => q.playerId === m.player.id);
          if (k) sendStatus(k); else toPlayer(m.player.id, { t: 'spectate' });
        }
        updateOverlays();
        break;
      }
      case 'leave': {
        state.players.delete(m.id);
        const gone = state.karts.find((k) => k.playerId === m.id);
        if (gone) sim.removeKart(gone);
        if ((state.phase === 'race' || state.phase === 'countdown') && !state.karts.some((k) => k.isHuman)) sim.backToLobby();
        updateOverlays();
        break;
      }
      case 'conn': {
        const p = state.players.get(m.id);
        if (p) { p.connected = !!m.connected; if (!p.connected) p.input = { s: 0, g: 0, b: 0, d: 0 }; }
        updateOverlays();
        break;
      }
      case 'host': state.hostId = m.hostId; for (const p of state.players.values()) p.host = p.id === m.hostId; updateOverlays(); break;
      case 'i': { const p = state.players.get(m.id); if (p) p.input = { s: m.s, g: m.g, b: m.b, d: m.d }; break; }
      case 'use': { const k = state.karts.find((q) => q.playerId === m.id); if (k) sim.useItem(k); break; }
      case 'picked': {
        // solo cuenta si de verdad es quien está eligiendo
        const k = state.karts.find((q) => q.playerId === m.id);
        if (k && state.eligiendo && state.eligiendo.kartId === k.id) sim.elegirVictima(m.kart);
        break;
      }
      case 'start': startRace(); break;
      case 'again': if (state.phase === 'results') { state.torneo = null; sim.backToLobby(); } break;
      case 'voto':
        if (state.torneo && state.phase === 'results' && Number.isInteger(m.i)) {
          state.torneo.votos.set(m.id, m.i);
          pintarClasificacion();
        }
        break;
      case 'set': applySettings(m.settings); updateOverlays(); break;
      case 'replaced':
        state.replaced = true;
        noticeEl.textContent = 'Se ha abierto la pantalla en otro sitio. Esta pestaña queda inactiva: recárgala para recuperarla.';
        noticeEl.classList.remove('hidden');
        break;
      default: break;
    }
  }

  function applySettings(s) {
    if (!s) return;
    if (Number.isInteger(s.track)) state.settings.track = ((s.track % TRACKS.length) + TRACKS.length) % TRACKS.length;
    if (Number.isInteger(s.laps)) state.settings.laps = clamp(s.laps, 1, 9);
    if (Number.isInteger(s.bots)) state.settings.bots = clamp(s.bots, 0, 7);
    if (Number.isInteger(s.carreras)) state.settings.carreras = clamp(s.carreras, 1, 8);
    if (state.phase === 'lobby' || state.phase === 'warmup') sim.setTrack(state.settings.track);
  }
  function changeSetting(key, delta) {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return;
    const s = { ...state.settings };
    if (key === 'track') s.track = (s.track + delta + TRACKS.length) % TRACKS.length;
    if (key === 'bots') s.bots = clamp(s.bots + delta, 0, 7);
    if (key === 'laps') { const opts = [1, 2, 3, 4, 5]; s.laps = opts[(opts.indexOf(s.laps) + 1) % opts.length] || 3; }
    // torneo: 1 carrera = una suelta de siempre; de 2 en adelante, campeonato con puntos
    if (key === 'carreras') { const opts = [1, 2, 3, 4, 5, 6, 8]; s.carreras = opts[(opts.indexOf(s.carreras || 1) + 1) % opts.length] || 1; }
    applySettings(s);
    wsSend({ t: 'set', settings: s });
    updateOverlays();
  }

  fetch('/info').then((r) => r.json()).then((info) => {
    state.joinUrl = info.url;
    state.joinSeguro = !!info.seguro;       // el QR lleva a https: hay que avisar del cartel del navegador
    state.joinUrlVolante = info.urlVolante || '';  // la cifrada, solo para quien quiera volante
    updateOverlays();
  }).catch(() => {});

  // ===================== Karts =====================
  // Modelo 3D de cada kart: la simulación lo guarda en k.view y nunca lo mira.
  /*
   * El kart modelado (public/modelos/kart.glb, hecho con tools/blender/kart.py).
   *
   * Se carga una vez y se clona por kart. Los materiales del archivo se cambian por los `toon` de
   * siempre según **cómo se llama el material**, no según su color: `Carroceria` lleva el color
   * del personaje y `Detalle` su acento. Si el archivo no está o falla, se monta el kart de cajas
   * de toda la vida: la fiesta nunca se queda sin karts por un modelo.
   */
  const COLOR_MATERIAL = { Oscuro: '#1a1a24', Metal: '#9aa0b5', Goma: '#14141c', Piel: '#ffe600', Claro: '#fdfbf0' };
  const modelos = {};          // los .glb ya cargados, por nombre
  const cargador = new GLTFLoader();
  function cargarModelo(nombre) {
    cargador.load(`/modelos/${nombre}.glb`, (gltf) => { modelos[nombre] = gltf.scene; },
      undefined, (e) => console.warn(`No se ha podido cargar el modelo ${nombre}; se usa el de siempre`, e));
  }
  for (const n of ['kart', 'platano', 'caparazon', 'cabezas', 'arbitro', 'montanas']) cargarModelo(n);

  /*
   * Una copia del modelo lista para meter en la escena: materiales `toon` (el del archivo se cambia
   * por su papel: `Carroceria` lleva `color` y `Detalle` lleva `acento`) y contorno colgado.
   */
  function copiaDelModelo(nombre, { color, acento, contorno = true } = {}) {
    const raiz = modelos[nombre].clone(true);
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const n = (o.material && o.material.name) || '';
      // `Carroceria` y `Detalle` los tiñe el jugador; de los demás se respeta el color que traiga
      // el modelo (así se pueden añadir piezas nuevas en Blender sin tocar esta lista)
      const suyo = o.material && o.material.color ? '#' + o.material.color.getHexString() : '#888899';
      o.material = toon(n === 'Carroceria' ? (color || '#cccccc') : n === 'Detalle' ? (acento || '#ff2d95') : (COLOR_MATERIAL[n] || suyo));
    });
    if (contorno) ponerContorno(raiz, []);
    return raiz;
  }

  // Un kart clonado del modelo, ya pintado con los colores del personaje
  function kartDelModelo(ch) {
    const raiz = copiaDelModelo('kart', { color: ch.color, acento: ch.accent, contorno: false });
    const ruedas = [];
    raiz.traverse((o) => { if (/^Rueda/.test(o.name)) ruedas.push({ obj: o, front: o.name.startsWith('RuedaD') }); });
    return { raiz, ruedas };
  }

  /*
   * Banderitas del kart. Se pintan aquí con un lienzo (nada de imágenes que descargar: la fiesta
   * va sin internet) y se cuelgan detrás del alerón, mirando hacia atrás, que es lo que ve cada
   * jugador de su propio kart.
   */
  const banderas = {};
  function banderaTextura(cual) {
    if (banderas[cual]) return banderas[cual];
    const c = document.createElement('canvas');
    c.width = 192; c.height = 128;
    const g = c.getContext('2d');
    if (cual === 'cataluna') {
      g.fillStyle = '#ffd400'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#da121a';
      for (let i = 0; i < 4; i++) g.fillRect(0, c.height * (0.11 + i * 0.222), c.width, c.height * 0.111);
    } else {   // texas
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#bf0a30'; g.fillRect(0, c.height / 2, c.width, c.height / 2);
      g.fillStyle = '#002868'; g.fillRect(0, 0, c.width / 3, c.height);
      g.fillStyle = '#ffffff';                     // la estrella solitaria
      g.beginPath();
      const cx = c.width / 6, cy = c.height / 2, r = 26;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
        g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    banderas[cual] = tex;
    return tex;
  }

  /*
   * Lo que hace que un kart sea de alguien: su cabeza, su banderita y, si es El Loco, de dónde le
   * sale el humo. Se usa tanto para los karts de la carrera como para los del escaparate de la sala.
   */
  function montarPersonaje(ch, body) {
    // el nombre del objeto dentro de cabezas.glb es el del personaje sin artículo ni espacios
    const nombreCabeza = ch.name.replace(/^El /, '').replace(/\s+/g, '');
    let head;
    if (modelos.cabezas && modelos.cabezas.getObjectByName(nombreCabeza)) {
      head = copiaDelModelo('cabezas', { contorno: false });
      for (const hijo of head.children.slice()) if (hijo.name !== nombreCabeza) head.remove(hijo);
      ponerContorno(head, []);
      // cabezón a propósito, que es lo que hace graciosos a estos juegos
      head.position.set(-3, 31, 0);
      head.scale.setScalar(0.78);
      head.userData.modelo3D = true;    // no se escala como los carteles: es una malla de verdad
      body.add(head);
    } else {
      head = makeSprite(textTexture(ch.emoji, { w: 128, h: 128, font: `96px ${EMOJI_FONT}` }), 8);
      head.material.depthTest = true; head.position.set(-2, 31, 0); body.add(head);
    }
    // El Loco fuma y le sale humo verde: aquí solo se marca de dónde sale; el humo lo echa el bucle
    let humo = null;
    if (ch.name === 'El Loco') {
      humo = new THREE.Object3D();
      humo.position.set(6.5, 28, -1.4);   // la punta del cigarro
      body.add(humo);
    }
    // banderita detrás del alerón, mirando hacia atrás (que es lo que ve cada jugador del suyo)
    if (ch.bandera) {
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(21, 14),
        new THREE.MeshBasicMaterial({ map: banderaTextura(ch.bandera), side: THREE.DoubleSide }));
      tela.position.set(-23, 30, 0);
      tela.rotation.y = -Math.PI / 2;
      body.add(tela);
      const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 16, 6), toon('#9aa0b5'));
      mastil.position.set(-23, 24, 0); body.add(mastil);
    }
    return { head, humo };
  }

  /*
   * Escaparate de la sala: los karts de quien ya ha entrado, en fila delante de la cámara y
   * **dando vueltas**, como la pantalla de elegir personaje de toda la vida. Cada uno lleva su
   * cara, su color y su bandera, así que en cuanto eliges te ves en la tele.
   *
   * Van colgados de la cámara (no del mundo): así se ven igual de grandes den vueltas o no, y no
   * hay que buscarles sitio en el circuito. El mundo sigue girando detrás.
   */
  const escaparate = new THREE.Group();
  scene.add(escaparate);
  const enEscaparate = new Map();          // playerId (o 'kb') -> { char, obj, giro }
  function kartDeExhibicion(ch) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    if (modelos.kart) {
      const { raiz } = kartDelModelo(ch);
      ponerContorno(raiz, []);
      body.add(raiz);
    } else {
      const chasis = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 22), toon(ch.color));
      chasis.position.y = 9; body.add(chasis);
    }
    montarPersonaje(ch, body);
    if (ch.escala) body.scale.setScalar(ch.escala);
    return g;
  }
  function actualizarEscaparate() {
    const quienes = [];
    for (const p of state.players.values()) if (p.connected) quienes.push({ id: 'p' + p.id, char: p.char });
    if (state.kb) {
      // el del teclado no elige personaje: en el escaparate se le pone el primero que quede libre
      const cogidos = new Set(quienes.map((q) => q.char));
      let c = 0; while (c < CHARS.length - 1 && cogidos.has(c)) c++;
      quienes.push({ id: 'kb', char: c });
    }
    // fuera los que ya no están (o los que han cambiado de personaje)
    for (const [id, dato] of [...enEscaparate]) {
      const sigue = quienes.find((q) => q.id === id && q.char === dato.char);
      if (!sigue) { escaparate.remove(dato.obj); enEscaparate.delete(id); }
    }
    for (const q of quienes) {
      if (enEscaparate.has(q.id)) continue;
      const obj = kartDeExhibicion(CHARS[q.char] || CHARS[0]);
      escaparate.add(obj);
      enEscaparate.set(q.id, { char: q.char, obj, giro: Math.random() * Math.PI * 2 });
    }
  }
  /*
   * ¿Está alguien calentando de verdad? Mientras nadie toque el mando, la sala se ve como siempre:
   * el desfile de karts delante de la cámara y la vista general dando vueltas al circuito. En
   * cuanto alguien se mueve, el desfile se aparta y la cámara se va con los karts, que es lo que
   * hace falta para aprenderse los botones. Si todos paran, a los pocos segundos vuelve el desfile.
   */
  let calentando = 0;
  const hayCalentamiento = () => state.phase === 'warmup' && calentando > 0;
  function moverEscaparate(dt) {
    const visible = (state.phase === 'lobby' || state.phase === 'warmup') && !hayCalentamiento();
    escaparate.visible = visible;
    if (!visible || !enEscaparate.size) return;
    const cam = camActiva || camera;
    // en fila delante de la cámara y un poco por debajo, para no tapar la sala
    const lista = [...enEscaparate.values()];
    // cuantos más karts, más lejos la fila: así caben siempre y con poca gente se ven más grandes
    const dist = 300 + lista.length * 20;
    const paso = dist * 0.135, ancho = (lista.length - 1) * paso;
    const delante = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const derecha = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    // desfilan por la franja de abajo, entre el texto de ayuda y las teclas: es el sitio que la
    // sala deja libre a propósito, y desde ahí se ven enteros sin tapar el QR ni la lista
    // y algo a la derecha, que la columna del QR y la ayuda ocupan el lado izquierdo
    const centro = cam.position.clone()
      .addScaledVector(delante, dist)
      .addScaledVector(arriba, -dist * 0.274)
      .addScaledVector(derecha, dist * 0.251);
    lista.forEach((d, i) => {
      d.giro += dt * 0.9;
      d.obj.position.copy(centro).addScaledVector(derecha, -ancho / 2 + i * paso);
      d.obj.quaternion.copy(cam.quaternion);
      d.obj.rotateY(d.giro);
      d.obj.rotateX(-0.12);
      const salto = Math.sin(animT * 2.2 + i) * 2.5;
      d.obj.position.addScaledVector(arriba, salto);
    });
  }

  // ===================== Podio final =====================
  /*
   * El podio del final del torneo, en 3D y en grande: los tres karts de verdad —cada uno con su
   * personaje, su color y su bandera— subidos a su cajón, con focos, la copa del campeón girando
   * detrás y confeti cayendo del cielo. Va colgado de la cámara, igual que el escaparate de la
   * sala: se ve siempre bien esté la cámara donde esté y no hay que buscarle sitio en el circuito.
   *
   * El confeti y los fuegos son **una sola malla instanciada** de 320 trocitos: un dibujado, no
   * trescientos objetos. Como el grupo va girado con la cámara, «abajo» es abajo en la pantalla,
   * así que el confeti cae bien aunque la cámara esté mirando de canto.
   */
  /*
   * El encuadre se calcula, no se fija: la distancia a la que se planta el podio sale del campo de
   * visión de la cámara, de modo que **siempre se ve entero** — en una tele 16:9, en un portátil
   * 16:10 o en la ventana cuadrada de una prueba. Con una distancia fija, la copa se salía por
   * arriba en cuanto la pantalla era menos alta.
   */
  const PODIO_ALTO = 450;              // lo que tiene que caber de alto (del suelo a la copa)
  const PODIO_CENTRO = 150;            // qué altura del podio queda en el centro de la pantalla
  const PODIO_ALTOS = [132, 88, 56];   // lo alto que es el cajón de cada puesto
  const PODIO_XS = [0, -132, 132];     // el primero en medio, el segundo a la izquierda
  const CONFETI_N = 320;
  const CONFETI_COLORES = ['#ff2d95', '#ffe600', '#00e5ff', '#39ff88', '#b14bff', '#ff6a00', '#ffffff'];
  const podio3d = new THREE.Group();
  podio3d.visible = false;
  scene.add(podio3d);
  let podioDatos = null;

  // La copa: cuerpo, boca, asas y peana. Se hace a mano porque es de las pocas cosas que solo se
  // ven una vez por fiesta; no merece un modelo aparte.
  function copaDeCampeon() {
    const g = new THREE.Group();
    const oro = toon('#ffd54a');
    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(26, 13, 36, 16), oro); vaso.position.y = 42;
    const boca = new THREE.Mesh(new THREE.TorusGeometry(26, 3.4, 8, 22), oro); boca.rotation.x = Math.PI / 2; boca.position.y = 60;
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 16, 10), oro); pie.position.y = 16;
    const peana = new THREE.Mesh(new THREE.CylinderGeometry(17, 20, 12, 16), toon('#7a4a12')); peana.position.y = 6;
    g.add(vaso, boca, pie, peana);
    for (const lado of [-1, 1]) {
      const asa = new THREE.Mesh(new THREE.TorusGeometry(12, 2.8, 8, 16, Math.PI), oro);
      asa.position.set(lado * 25, 44, 0);
      asa.rotation.z = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(asa);
    }
    ponerContorno(g, []);
    return g;
  }

  function quitarPodio() {
    for (const hijo of [...podio3d.children]) podio3d.remove(hijo);
    podio3d.visible = false;
    podioDatos = null;
    resultsEl.classList.remove('con-podio');
  }

  function montarPodio(lista) {
    quitarPodio();
    const podio = lista.slice(0, 3);
    if (!podio.length) return;
    const karts = [], focos = [];
    podio.forEach((f, i) => {
      const ch = CHARS[f.char] || CHARS[0];
      const alto = PODIO_ALTOS[i], x = PODIO_XS[i];
      const color = ['#ffd54a', '#dbe3ef', '#e08a4a'][i];
      const cajon = new THREE.Mesh(new THREE.BoxGeometry(108, alto, 98), toon(color));
      cajon.position.set(x, alto / 2, 0);
      ponerContorno(cajon, []);
      podio3d.add(cajon);
      const num = makeSprite(textTexture(String(i + 1), { w: 128, h: 128, font: `900 100px ${UI_FONT}`, color: '#3a2a00', stroke: '#ffffff', strokeW: 10 }), 11);
      num.scale.set(46, 46, 1); num.position.set(x, alto * 0.6, 52);
      podio3d.add(num);
      const kart = kartDeExhibicion(ch);
      kart.position.set(x, alto + 2, 0);
      kart.scale.setScalar(1.35);
      podio3d.add(kart);
      karts.push({ obj: kart, giro: i * 1.3 });
      // el foco: un cono de luz que se mueve despacio sobre cada cajón
      const foco = new THREE.Mesh(new THREE.ConeGeometry(54, 300, 18, 1, true), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      }));
      foco.position.set(x, alto + 160, -20);
      podio3d.add(foco);
      focos.push({ obj: foco, fase: i * 2.1 });
    });
    const copa = copaDeCampeon();
    const copaY = PODIO_ALTOS[0] + 78;
    copa.position.set(0, copaY, -190);
    copa.scale.setScalar(1.35);
    podio3d.add(copa);
    const cartel = makeSprite(textTexture('¡CAMPEÓN!', { w: 768, h: 160, font: `900 92px ${UI_FONT}`, color: '#ffe600', stroke: '#4a0a5e', strokeW: 14 }), 12);
    cartel.scale.set(270, 56, 1); cartel.position.set(0, copaY + 96, -190);
    podio3d.add(cartel);

    // ---- confeti y fuegos: un solo montón de trocitos ----
    const malla = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 11, 1.6),
      new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }), CONFETI_N);
    malla.frustumCulled = false;
    const col = new THREE.Color();
    const trozos = [];
    for (let i = 0; i < CONFETI_N; i++) {
      trozos.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, vr: 0, vr2: 0 });
      malla.setColorAt(i, col.set(CONFETI_COLORES[i % CONFETI_COLORES.length]));
    }
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    podio3d.add(malla);
    podioDatos = {
      karts, focos, copa, copaY, malla, trozos, cursor: 0, fuego: 0.6,
      altos: PODIO_ALTOS.slice(0, podio.length),
    };
    for (const p of trozos) soltarConfeti(p, true);
    podio3d.visible = true;
  }

  // Un trocito de confeti nuevo, cayendo desde arriba (`repartido`: a media caída, para el arranque)
  function soltarConfeti(p, repartido) {
    p.x = (Math.random() - 0.5) * 900;
    p.y = repartido ? Math.random() * 520 - 60 : 420 + Math.random() * 160;
    p.z = (Math.random() - 0.5) * 340;
    p.vx = (Math.random() - 0.5) * 26; p.vy = -60 - Math.random() * 90; p.vz = (Math.random() - 0.5) * 20;
    p.rx = Math.random() * 6; p.ry = Math.random() * 6; p.rz = Math.random() * 6;
    p.vr = 1 + Math.random() * 4; p.vr2 = 1 + Math.random() * 3;
  }

  // Un fuego artificial: un puñado de trozos salen disparados de un punto y luego caen
  function fuegoDePodio(d) {
    const px = (Math.random() - 0.5) * 620, py = 180 + Math.random() * 190, pz = -60 - Math.random() * 120;
    for (let i = 0; i < 26; i++) {
      const p = d.trozos[d.cursor++ % CONFETI_N];
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI, v = 90 + Math.random() * 150;
      p.x = px; p.y = py; p.z = pz;
      p.vx = Math.cos(a) * Math.sin(e) * v; p.vy = Math.cos(e) * v; p.vz = Math.sin(a) * Math.sin(e) * v * 0.6;
      p.vr = 3 + Math.random() * 6; p.vr2 = 2 + Math.random() * 5;
    }
    sfx('star');
  }

  const _podioDummy = new THREE.Object3D();
  function moverPodio(dt) {
    if (!podioDatos) return;
    const d = podioDatos;
    const cam = camActiva || camera;
    const delante = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const dist = (PODIO_ALTO / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    podio3d.position.copy(cam.position).addScaledVector(delante, dist).addScaledVector(arriba, -PODIO_CENTRO);
    podio3d.quaternion.copy(cam.quaternion);
    podio3d.rotateX(-0.13);            // un poco desde arriba, para ver los cajones
    d.karts.forEach((k, i) => {
      k.giro += dt * (0.9 - i * 0.18);
      k.obj.rotation.y = k.giro;
      // el campeón da saltitos; los otros dos, un balanceo
      k.obj.position.y = d.altos[i] + 2 + (i === 0 ? Math.abs(Math.sin(animT * 3.2)) * 16 : Math.sin(animT * 2 + i) * 3);
    });
    d.copa.rotation.y += dt * 0.7;
    d.copa.position.y = d.copaY + Math.sin(animT * 1.5) * 7;
    for (const f of d.focos) f.obj.rotation.z = Math.sin(animT * 0.8 + f.fase) * 0.15;
    d.fuego -= dt;
    if (d.fuego <= 0) { d.fuego = 0.7 + Math.random() * 0.8; fuegoDePodio(d); }
    for (let i = 0; i < CONFETI_N; i++) {
      const p = d.trozos[i];
      p.vy -= 110 * dt;                                     // gravedad floja: el papel cae despacio
      p.x += (p.vx + Math.sin(animT * 2 + i) * 14) * dt;
      p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.vr * dt; p.ry += p.vr2 * dt; p.rz += p.vr * 0.6 * dt;
      if (p.y < -120) soltarConfeti(p, false);
      _podioDummy.position.set(p.x, p.y, p.z);
      _podioDummy.rotation.set(p.rx, p.ry, p.rz);
      _podioDummy.updateMatrix();
      d.malla.setMatrixAt(i, _podioDummy.matrix);
    }
    d.malla.instanceMatrix.needsUpdate = true;
  }

  function makeKartModel(k) {
    const ch = CHARS[k.char];
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    if (modelos.kart) return makeKartModelado(k, ch, g, body);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 22), toon(ch.color)); chassis.position.y = 9; body.add(chassis);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 14), toon(shade(ch.color, -0.14))); hood.position.set(-4, 17, 0); body.add(hood);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 10), toon(ch.accent)); nose.rotation.z = -Math.PI / 2; nose.position.set(23, 9, 0); body.add(nose);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 28), toon(ch.accent)); spoiler.position.set(-19, 21, 0); body.add(spoiler);
    for (const z of [-9, 9]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 2), toon('#222233')); strut.position.set(-18, 16, z); body.add(strut); }
    for (const z of [-6, 6]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 8, 8), toon('#444455')); ex.rotation.z = Math.PI / 2; ex.position.set(-21, 6.5, z); body.add(ex); }
    const wheels = [];
    for (const [x, z] of [[13, -13], [13, 13], [-13, -13], [-13, 13]]) {
      const steerPivot = new THREE.Group(); steerPivot.position.set(x, 6, z);
      const roll = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 14), toon('#1a1a24')); tire.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6.6, 10), toon(ch.accent)); hub.rotation.x = Math.PI / 2;
      roll.add(tire, hub); steerPivot.add(roll); body.add(steerPivot);
      wheels.push({ steer: steerPivot, roll, front: x > 0 });
    }
    const flames = [];
    for (const z of [-6, 6]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 8), flat('#ff9f1c')); f.rotation.z = Math.PI / 2; f.position.set(-30, 6.5, z); f.visible = false;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 8), flat('#ffe74c')); f2.rotation.z = Math.PI / 2; f2.position.set(-27, 6.5, z); f2.visible = false;
      body.add(f, f2); flames.push(f, f2);
    }
    const head = makeSprite(textTexture(ch.emoji, { w: 128, h: 128, font: `96px ${EMOJI_FONT}` }), 8);
    head.material.depthTest = true; head.position.set(-3, 30, 0); body.add(head);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
    glow.position.y = 12; glow.visible = false; g.add(glow);
    const label = makeSprite(textTexture(k.name, { w: 320, h: 80, font: `900 40px ${UI_FONT}`, color: '#fff', stroke: '#1a0b3d', strokeW: 10 }), 20);
    label.position.set(0, 54, 0); g.add(label);
    const item = makeSprite(textTexture('?', { w: 128, h: 128, font: `84px ${EMOJI_FONT}`, bg: 'rgba(255,255,255,0.9)' }), 21);
    item.position.set(0, 82, 0); item.visible = false; g.add(item);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(21, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    // brillo en el suelo mientras se derrapa: dice de un vistazo qué nivel lleva cargado
    const driftGlow = new THREE.Mesh(new THREE.CircleGeometry(30, 20), new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0, depthWrite: false }));
    driftGlow.rotation.x = -Math.PI / 2;
    driftGlow.visible = false;
    kartsGroup.add(g, shadow, driftGlow);
    k.view = { g, body, wheels, flames, head, humo: null, humoT: 0, escala: ch.escala || 1, glow, label, item, shadow, driftGlow, labelText: '', itemText: '', sq: new Spring(120, 9), st: new Spring(120, 9), roll: new Spring(90, 10), pitch: new Spring(90, 10), blink: 0 };
  }
  /*
   * Mismo kart, pero con el modelo de Blender en vez de cajas. Mantiene **exactamente** las mismas
   * piezas en `k.view` (body, wheels, flames, head, glow, label, item, shadow, driftGlow) porque el
   * bucle de dibujado las toca todas: aquí solo cambia de qué están hechas.
   */
  function makeKartModelado(k, ch, g, body) {
    const { raiz, ruedas } = kartDelModelo(ch);
    const conContorno = [];
    ponerContorno(raiz, conContorno);
    body.add(raiz);
    const wheels = ruedas.map((r) => ({ steer: r.obj, roll: r.obj, front: r.front, modelo: true }));
    const flames = [];
    for (const z of [-6, 6]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 8), flat('#ff9f1c')); f.rotation.z = Math.PI / 2; f.position.set(-30, 7.5, z); f.visible = false;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 8), flat('#ffe74c')); f2.rotation.z = Math.PI / 2; f2.position.set(-27, 7.5, z); f2.visible = false;
      body.add(f, f2); flames.push(f, f2);
    }
    /*
     * La cabeza. Si está el modelo de cabezas, va la del personaje (con su pelo, su turbante o sus
     * cuernos); si no, el emoji de siempre en un cartelito. El nombre del objeto dentro del .glb es
     * el del personaje sin espacios ni artículos: «El Loco» → `Loco`.
     */
    const { head, humo } = montarPersonaje(ch, body);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
    glow.position.y = 12; glow.visible = false; g.add(glow);
    const label = makeSprite(textTexture(k.name, { w: 320, h: 80, font: `900 40px ${UI_FONT}`, color: '#fff', stroke: '#1a0b3d', strokeW: 10 }), 20);
    label.position.set(0, 54, 0); g.add(label);
    const item = makeSprite(textTexture('?', { w: 128, h: 128, font: `84px ${EMOJI_FONT}`, bg: 'rgba(255,255,255,0.9)' }), 21);
    item.position.set(0, 82, 0); item.visible = false; g.add(item);
    // Carlota es más pequeña que los demás: su kart, también

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(23 * (ch.escala || 1), 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    const driftGlow = new THREE.Mesh(new THREE.CircleGeometry(30, 20), new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0, depthWrite: false }));
    driftGlow.rotation.x = -Math.PI / 2;
    driftGlow.visible = false;
    kartsGroup.add(g, shadow, driftGlow);
    k.view = { g, body, wheels, flames, head, humo, humoT: 0, escala: ch.escala || 1, glow, label, item, shadow, driftGlow, labelText: '', itemText: '', sq: new Spring(120, 9), st: new Spring(120, 9), roll: new Spring(90, 10), pitch: new Spring(90, 10), blink: 0 };
  }

  function removeKartModel(k) {
    if (!k.view) return;
    if (k.view.arbitro) kartsGroup.remove(k.view.arbitro);
    kartsGroup.remove(k.view.g, k.view.shadow, k.view.driftGlow);
    k.view = null;
  }


  /*
   * Quién juega: los móviles conectados (+ el teclado, si lo hay), cada uno con su personaje. El
   * del teclado no elige, así que se le da el primero libre. Lo usan la carrera y el calentamiento.
   */
  function participantes() {
    const humans = [];
    for (const p of state.players.values()) if (p.connected) humans.push({ playerId: p.id, name: p.name, char: p.char, easy: !!p.easy });
    if (state.kb) humans.push({ playerId: null, kb: true, name: 'Teclado', char: -1 });
    const used = new Set(humans.filter((h) => h.char >= 0).map((h) => h.char));
    const libre = () => { for (let c = 0; c < CHARS.length; c++) if (!used.has(c)) { used.add(c); return c; } return 0; };
    for (const h of humans) if (h.char < 0) h.char = libre();
    return { humans, libre };
  }

  /*
   * Calentamiento: mientras el anfitrión no pulsa EMPEZAR, el kart de quien ya ha entrado está en
   * la parrilla y se puede conducir, para aprenderse los botones sin que nadie te adelante. Se
   * vuelve a llamar cada vez que cambia quién está en la sala o qué circuito se va a correr.
   */
  function sincronizarCalentamiento() {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return;
    const { humans } = participantes();
    if (!humans.length) { if (state.phase === 'warmup') sim.backToLobby(); return; }
    sim.warmup({ entries: humans.slice(0, MAX_KARTS), trackIndex: state.settings.track });
  }

  // Monta la parrilla con quien esté conectado (+ bots) y arranca la carrera en la simulación
  /*
   * ===================== Modo torneo =====================
   *
   * Varias carreras seguidas con los mismos karts: puntos por puesto (10-8-6-4-3-2-1), la última
   * vale doble, y entre carrera y carrera sale la clasificación con las subidas y bajadas mientras
   * cada móvil vota el circuito siguiente. Al final, podio con confeti.
   *
   * Las cuentas están en `torneo.mjs` (probadas en `npm test`); aquí solo vive el hilo: cuándo se
   * enseña qué, a quién se le pide el voto y cuándo arranca la siguiente.
   */
  const CLASIFICACION_SEG = 20;      // lo que dura la pantalla de entre carreras
  let relojTorneo = null;

  function empezarTorneo() {
    const carreras = clamp(state.settings.carreras || 1, 1, 8);
    state.torneo = {
      carreras, actual: 0, tabla: new Map(), tablaAntes: null,
      jugados: [], votos: new Map(), hasta: 0, siguiente: null,
    };
  }

  function finDeCarrera() {
    const T = state.torneo;
    if (!T || !state.results) return;
    // los puntos de esta carrera (la última, dobles)
    const doble = Torneo.esUltima(T.actual, T.carreras);
    T.tablaAntes = T.tabla;
    // los resultados de la simulación traen `name`; el torneo habla de `nombre`
    const llegada = state.results.map((r) => ({ char: r.char, nombre: r.name, emoji: r.emoji, color: r.color }));
    T.tabla = Torneo.sumarCarrera(T.tabla, llegada, doble);
    T.jugados.push(state.settings.track);
    T.actual++;
    if (T.actual >= T.carreras) { pintarPodio(); return; }
    // clasificación + votación del circuito siguiente
    T.votos = new Map();
    T.hasta = Date.now() + CLASIFICACION_SEG * 1000;
    T.lista = TRACKS.map((t, i) => ({ i, nombre: t.name, jugado: T.jugados.includes(i) }));
    repartirVotacion();
    pintarClasificacion();
    clearInterval(relojTorneo);
    relojTorneo = setInterval(() => {
      if (!state.torneo || state.phase !== 'results') { clearInterval(relojTorneo); return; }
      repartirVotacion();
      pintarClasificacion();
      if (Date.now() >= state.torneo.hasta) { clearInterval(relojTorneo); siguienteCarrera(); }
    }, 250);
  }

  /*
   * La lista de circuitos se manda **una y otra vez** mientras dura la votación, no solo al empezar:
   * a quien entre en la sala entre carrera y carrera, o se le caiga el móvil y vuelva, también le
   * tiene que salir la pantalla de votar. El móvil se queda con el voto que ya hubiera dado (ver
   * `votar` en play.js), así que repetir el mensaje no le borra nada.
   */
  let ultimoReparto = 0;
  function repartirVotacion() {
    const T = state.torneo;
    if (!T || !T.lista) return;
    const ahora = Date.now();
    if (ahora - ultimoReparto < 1500) return;
    ultimoReparto = ahora;
    const quedan = Math.max(1, Math.round((T.hasta - ahora) / 1000));
    for (const p of state.players.values()) if (p.connected) toPlayer(p.id, { t: 'votar', circuitos: T.lista, hasta: quedan });
  }

  function siguienteCarrera() {
    const T = state.torneo;
    if (!T) return;
    const g = Torneo.circuitoGanador(T.votos, T.jugados, TRACKS.length, Math.random);
    state.settings.track = g.indice;
    wsSend({ t: 'set', settings: { track: g.indice } });
    for (const p of state.players.values()) toPlayer(p.id, { t: 'votar', circuitos: null });
    sim.backToLobby();
    // un respiro para que la sala se pinte y los móviles cambien de pantalla
    setTimeout(() => {
      if (Torneo.esUltima(T.actual, T.carreras)) {
        showBig('¡ÚLTIMA!');
        toast('🏁 Última carrera del torneo: los puntos valen DOBLE', 5);
        setTimeout(() => hideBig('¡ÚLTIMA!'), 2200);
      }
      startRace();
    }, 900);
  }

  function pintarClasificacion() {
    const T = state.torneo;
    if (!T) return;
    const filas = Torneo.clasificacion(T.tabla, T.tablaAntes);
    const quedan = Math.max(0, Math.ceil((T.hasta - Date.now()) / 1000));
    const votados = new Map();
    for (const i of T.votos.values()) votados.set(i, (votados.get(i) || 0) + 1);
    const flecha = (n) => (n > 0 ? `<span class="sube">▲${n}</span>` : n < 0 ? `<span class="baja">▼${-n}</span>` : '<span class="igual">–</span>');
    const tabla = filas.map((f) => `<tr class="${f.sube > 0 ? 'mejora' : f.sube < 0 ? 'empeora' : ''}">
        <td class="pos">${f.puesto}º</td><td class="emoji">${f.emoji}</td><td>${esc(f.nombre)}</td>
        <td class="mov">${flecha(f.sube)}</td>
        <td class="pts">${f.puntos}<small> pts</small></td>
        <td class="gana">${f.ultimosPuntos ? '+' + f.ultimosPuntos : ''}</td></tr>`).join('');
    const listaCircuitos = TRACKS.map((t, i) => {
      const n = votados.get(i) || 0;
      return `<span class="voto ${T.jugados.includes(i) ? 'jugado' : ''}">${esc(t.name)}${n ? ` <b>${'●'.repeat(Math.min(n, 7))}</b>` : ''}</span>`;
    }).join('');
    resultsEl.innerHTML = `<h1>🏆 Torneo · carrera ${T.actual} de ${T.carreras}</h1>
      <table>${tabla}</table>
      <div class="votacion"><b>Votad el circuito en el móvil</b> · empieza en ${quedan} s${Torneo.esUltima(T.actual, T.carreras) ? ' · <b class="doble">¡la próxima vale DOBLE!</b>' : ''}</div>
      <div class="circuitos">${listaCircuitos}</div>`;
  }

  /*
   * El podio: los tres primeros **en 3D**, cada uno en su cajón con su kart y su personaje (ver
   * `montarPodio`). En HTML se queda solo lo que el 3D no puede decir bien: el título arriba y los
   * puestos del cuarto para abajo abajo del todo, para no taparlo.
   */
  function pintarPodio() {
    const T = state.torneo;
    const filas = Torneo.clasificacion(T.tabla, T.tablaAntes);
    montarPodio(filas);
    const resto = filas.slice(3).map((f) => `<tr><td class="pos">${f.puesto}º</td><td class="emoji">${f.emoji}</td><td>${esc(f.nombre)}</td><td class="pts">${f.puntos}<small> pts</small></td></tr>`).join('');
    // los nombres van en HTML y en el orden del podio (2º - 1º - 3º), que en 3D no se leen de lejos
    const medallas = ['🥇', '🥈', '🥉'];
    const ganador = (i) => (filas[i] ? `<span class="g${i + 1}">${medallas[i]} ${esc(filas[i].nombre)} <b>${filas[i].puntos}</b></span>` : '');
    resultsEl.classList.add('con-podio');
    hudEl.classList.add('hidden');    // el marcador de la carrera sobra: encima tapaba el título
    resultsEl.innerHTML = `<h1>🏆 ¡Fin del torneo!</h1>
      <div class="ganadores">${ganador(1)}${ganador(0)}${ganador(2)}</div>
      ${resto ? `<table class="resto">${resto}</table>` : ''}
      <div class="again">El anfitrión pulsa <b>OTRA CARRERA</b> en su móvil (o <b>Intro</b> en el teclado) para empezar otro torneo</div>`;
    confeti();
    sfx('finish');
    state.torneo = null;      // el próximo EMPEZAR arranca un torneo nuevo
  }

  // Confeti del podio: trozos de papel que caen por delante de todo, con CSS
  function confeti() {
    const capa = document.createElement('div');
    capa.className = 'confeti';
    const colores = ['#ff2d95', '#ffe600', '#00e5ff', '#39ff88', '#b14bff', '#ff6a00'];
    for (let i = 0; i < 120; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colores[i % colores.length];
      p.style.animationDelay = (Math.random() * 2.5).toFixed(2) + 's';
      p.style.animationDuration = (2.6 + Math.random() * 2.4).toFixed(2) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      capa.appendChild(p);
    }
    resultsEl.appendChild(capa);
    setTimeout(() => capa.remove(), 9000);
  }

  function startRace() {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return;
    const { humans, libre } = participantes();
    if (!humans.length) { toast('Hace falta al menos un jugador conectado'); return; }
    const entries = humans.slice(0, MAX_KARTS);
    const nBots = Math.min(state.settings.bots, MAX_KARTS - entries.length);
    for (let i = 0; i < nBots; i++) { const c = libre(); entries.push({ playerId: null, bot: true, name: CHARS[c].name + ' (bot)', char: c }); }

    if (!state.torneo && (state.settings.carreras || 1) > 1) empezarTorneo();
    if (!sim.startRace({ entries, trackIndex: state.settings.track, laps: state.settings.laps })) return;
    buildHud();
    camStart();
    for (const p of state.players.values()) if (!state.karts.some((k) => k.playerId === p.id)) toPlayer(p.id, { t: 'spectate' });
    updateOverlays();
  }

  /*
   * Vaciar la sala desde la tele. Es el último recurso de la fiesta: si un móvil que ya nadie
   * tiene delante se queda de anfitrión (una pestaña vieja abierta, alguien que se fue con el
   * juego puesto), nadie puede empezar la carrera y desde el móvil no hay forma de echarlo.
   * Se pide dos veces seguidas para no vaciarla sin querer al apoyarse en el teclado.
   */
  let vaciarPedidoEn = 0;
  function vaciarSala() {
    const ahora = Date.now();
    if (ahora - vaciarPedidoEn > 4000) {
      vaciarPedidoEn = ahora;
      toast('¿Vaciar la sala y que vuelvan a entrar todos? Pulsa V otra vez', 4);
      return;
    }
    vaciarPedidoEn = 0;
    wsSend({ t: 'vaciar' });
    state.players.clear();
    state.hostId = null;
    toast('Sala vacía: que todos vuelvan a escanear el QR', 5);
    updateOverlays();
  }

  function toggleKeyboardPlayer() {
    if (state.phase !== 'lobby' && state.phase !== 'warmup') return;
    state.kb = state.kb ? null : { input: { s: 0, g: 0, b: 0, d: 0 } };
    updateOverlays();
  }

  function sendStatus(k) {
    if (k.playerId == null) return;
    toPlayer(k.playerId, {
      t: 'st', pos: k.rank, n: state.karts.length, lap: sim.displayLap(k), laps: state.laps,
      item: k.item, rolling: !!k.rolling, fin: k.finished, finPos: k.finished ? k.finishRank : 0, phase: state.phase,
    });
  }

  let eligiendoAhora = null;
  function pintarElegir() {
    if (!eligiendoAhora) { elegirEl.classList.add('hidden'); return; }
    const { kart, candidatos } = eligiendoAhora;
    const filas = candidatos.map((o, i) => `<div class="cand" style="border-color:${o.color}"><span class="n">${i + 1}</span><span class="em">${o.emoji}</span><span>${esc(o.name)}</span></div>`).join('');
    elegirEl.innerHTML = `<div class="quien">🐌 <b>${esc(kart.name)}</b> elige a quién frenar…</div>`
      + `<div class="lista">${filas}</div>`
      + `<div class="reloj" id="elegir-reloj"></div>`;
    elegirEl.classList.remove('hidden');
  }
  function refrescarReloj() {
    if (!eligiendoAhora || !state.eligiendo) return;
    const el = $('elegir-reloj');
    if (el) el.textContent = `${Math.max(0, Math.ceil(state.eligiendo.queda))} s… si no elige, se lo lleva el de delante`;
  }

  function toast(text, dur) {
    const el = document.createElement('div');
    el.textContent = text;
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, (dur || 3) * 1000);
  }
  function clearToasts() { toastsEl.innerHTML = ''; }

  // ===================== Mallas de objetos =====================
  function shellMesh(type) {
    const g = new THREE.Group();
    const colorConcha = type === 'red' ? '#ff3d3d' : type === 'blue' ? '#2a6bff' : '#39ff88';
    if (modelos.caparazon) {
      const c = copiaDelModelo('caparazon', { acento: colorConcha });
      if (type === 'blue') c.scale.setScalar(1.25);      // el azul es más gordo y da más miedo
      g.add(c);
      scene.add(g);
      return g;
    }
    const s = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), toon(colorConcha));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9.5, 2.4, 8, 20), toon('#ffffff'));
    rim.rotation.x = Math.PI / 2;
    const spikes = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), flat('#ffffff'));
    spikes.position.y = 6;
    g.add(s, rim, spikes);
    scene.add(g);
    return g;
  }
  /*
   * El patito de goma que rebota (Bajo la Cama). Va dando tumbos por la carretera, así que se le
   * pone cara: de frente se ve venir y da risa, que es de lo que se trata.
   */
  function patitoMesh() {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), toon('#ffd400'));
    cuerpo.scale.set(1.25, 0.95, 1); cuerpo.position.y = 11;
    const cola = new THREE.Mesh(new THREE.ConeGeometry(7, 13, 8), toon('#ffd400'));
    cola.position.set(-14, 15, 0); cola.rotation.z = 1.1;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 9), toon('#ffd400'));
    cabeza.position.set(10, 23, 0);
    const pico = new THREE.Mesh(new THREE.ConeGeometry(3.6, 8, 7), toon('#ff8a00'));
    pico.position.set(17, 22, 0); pico.rotation.z = -Math.PI / 2;
    g.add(cuerpo, cola, cabeza, pico);
    for (const lado of [-1, 1]) {
      const ojo = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), flat('#1a1a1a'));
      ojo.position.set(13, 26, 3.2 * lado); g.add(ojo);
    }
    ponerContorno(g, []);
    scene.add(g);
    return g;
  }
  /*
   * La mancha de espuma (Bajo la Cama): un charco de burbujas a ras de suelo. Se ve blanca y
   * gorda a propósito — es lo bastante grande como para que haya que decidir por dónde pasas.
   */
  function espumaMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient, transparent: true, opacity: 0.82 });
    for (let i = 0; i < 9; i++) {
      const r = 16 + Math.random() * 20;
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      const a = Math.random() * Math.PI * 2, d = Math.random() * 40;
      b.position.set(Math.cos(a) * d, r * 0.35, Math.sin(a) * d);
      b.scale.y = 0.45;
      g.add(b);
    }
    scene.add(g);
    return g;
  }
  function bananaMesh() {
    if (modelos.platano) {
      const g = new THREE.Group();
      g.add(copiaDelModelo('platano'));
      g.rotation.y = Math.random() * 6;
      scene.add(g);
      return g;
    }
    // el de siempre (por si falta el modelo), envuelto en un grupo para que gire igual: sobre sí mismo
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusGeometry(8, 3.2, 8, 12, Math.PI * 0.9), toon('#ffe600'));
    m.rotation.set(Math.PI / 2, 0, 0);
    g.add(m);
    g.rotation.y = Math.random() * 6;
    scene.add(g);
    return g;
  }

  // ===================== Cámara =====================
  const cam = { fx: MAP_W / 2, fz: MAP_H / 2, dist: 2600, orbit: 0, intro: 0 };
  const CAM_PITCH = THREE.MathUtils.degToRad(56);
  function camStart() { cam.intro = 1; }
  function updateCamera(dt) {
    const t = state.track;
    let fx, fz, dist, angle = 0, pitch = CAM_PITCH;
    if (state.phase === 'lobby' || (state.phase === 'warmup' && !hayCalentamiento())) {
      cam.orbit += dt * 0.12;
      fx = t.W / 2; fz = t.H / 2 + 40; dist = 2300 * Math.max(1, Math.max(t.W / MAP_W, t.H / MAP_H)); angle = cam.orbit; pitch = THREE.MathUtils.degToRad(38);
      cam.fx = fx; cam.fz = fz; cam.dist = dist;
    } else {
      const active = state.karts.filter((k) => !k.finished);
      const list = active.length ? active : state.karts;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const k of list) { minX = Math.min(minX, k.x); maxX = Math.max(maxX, k.x); minY = Math.min(minY, k.y); maxY = Math.max(maxY, k.y); }
      if (!list.length) { minX = 0; maxX = t.W; minY = 0; maxY = t.H; }
      const margin = 240;
      const ex = (maxX - minX) / 2 + margin, ey = (maxY - minY) / 2 + margin;
      fx = (minX + maxX) / 2; fz = (minY + maxY) / 2;
      const fovV = THREE.MathUtils.degToRad(camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      const dW = ex / Math.tan(fovH / 2), dH = (ey * Math.sin(CAM_PITCH)) / Math.tan(fovV / 2) + ey * 0.35;
      const maxD = Math.max(t.W / 2 / Math.tan(fovH / 2), (t.H / 2 * Math.sin(CAM_PITCH)) / Math.tan(fovV / 2) + 260);
      dist = clamp(Math.max(dW, dH), 1000, maxD);
      if (state.phase === 'countdown') {
        const u = smoothstep(0, 3, state.countdownT);
        const g0 = t.grid[0];
        fx = lerp(g0.x, fx, u); fz = lerp(g0.y, fz, u); dist = lerp(520, dist, u);
        if (cam.intro) { cam.fx = g0.x; cam.fz = g0.y; cam.dist = 520; cam.intro = 0; }
      }
      const lam = state.phase === 'countdown' ? 6 : 2.2;
      cam.fx = THREE.MathUtils.damp(cam.fx, fx, lam, dt);
      cam.fz = THREE.MathUtils.damp(cam.fz, fz, lam, dt);
      cam.dist = THREE.MathUtils.damp(cam.dist, dist, dist > cam.dist ? 3 : 1.6, dt);
    }
    const D = cam.dist;
    const px = cam.fx + Math.sin(angle) * D * Math.cos(pitch), pz = cam.fz + Math.cos(angle) * D * Math.cos(pitch), py = D * Math.sin(pitch);
    let sx = 0, sy = 0, sz = 0;
    if (state.shake > 0) { sx = (Math.random() - 0.5) * state.shake; sy = (Math.random() - 0.5) * state.shake; sz = (Math.random() - 0.5) * state.shake; state.shake = Math.max(0, state.shake - dt * 30); }
    camera.position.set(px + sx, py + sy, pz + sz);
    camera.lookAt(cam.fx, t.groundAt(cam.fx, cam.fz) * 0.5, cam.fz);
  }

  // ===================== Pantalla dividida (una cámara por persona) =====================
  // Cada persona ve su kart desde atrás en su panel; los bots no tienen panel. La sala, la cuenta
  // atrás y los resultados siguen usando la cámara general, que es la que enseña todo el circuito.
  const chases = new Map();   // kart -> { cam, x, y, z, ang }
  let panelesActivos = [];    // [{ kart, rect }] del frame actual, para el HUD de cada panel
  let enPaneles = false;      // ¿estamos con pantalla dividida? cambia cómo se miden los carteles

  function personasEnCarrera() {
    return state.karts.filter((k) => k.isHuman);
  }
  function modoPaneles() {
    return state.phase === 'race' && personasEnCarrera().length > 0;
  }
  function chaseDe(k) {
    let c = chases.get(k);
    if (!c) {
      // arranca ya colocada detrás del kart, para que el primer frame no venga de un salto raro
      c = {
        cam: new THREE.PerspectiveCamera(fovVertical(16 / 9), 16 / 9, 12, 9000),
        x: k.x - Math.cos(k.angle) * CHASE_DIST, y: k.z + CHASE_HEIGHT, z: k.y - Math.sin(k.angle) * CHASE_DIST,
        ang: k.angle, dist: CHASE_DIST, fovExtra: 0, shake: 0, enAire: !!k.air, vz: 0,
      };
      chases.set(k, c);
    }
    return c;
  }
  function updateChase(k, dt) {
    const c = chaseDe(k);
    const t = state.track;
    // el ángulo al que mira la cámara sigue al kart por el camino más corto
    const objetivoAng = k.angle;
    c.ang += wrapPi(objetivoAng - c.ang) * (1 - Math.exp(-CHASE_LAG * 0.55 * dt));
    const vel = Math.min(1, Math.abs(k.speed) / (BASE_MAX_SPEED * 1.5));
    const distObj = CHASE_DIST + CHASE_SPEED_DIST * vel;
    c.dist = THREE.MathUtils.damp(c.dist, distObj, 3, dt);
    const cosA = Math.cos(c.ang), sinA = Math.sin(c.ang);
    const px = k.x - cosA * c.dist, pz = k.y - sinA * c.dist;
    const suelo = t ? t.groundAt(px, pz) : 0;
    const py = Math.max(k.z, suelo) + CHASE_HEIGHT;
    c.x = THREE.MathUtils.damp(c.x, px, CHASE_LAG, dt);
    c.z = THREE.MathUtils.damp(c.z, pz, CHASE_LAG, dt);
    c.y = THREE.MathUtils.damp(c.y, py, CHASE_LAG, dt);
    // en turbo la cámara se abre un poco y tiembla: velocidad sin tocar la física
    const turbo = k.boostUntil > state.simTime || k.starUntil > state.simTime;
    c.fovExtra = THREE.MathUtils.damp(c.fovExtra, turbo ? CHASE_FOV_BOOST : 0, 6, dt);
    /*
     * Aterrizajes: si venía cayendo fuerte y acaba de tocar suelo, sacudida. Se mira desde aquí, en
     * la tele, porque la simulación no tiene que enterarse de cómo se ve el juego.
     */
    if (c.enAire && !k.air && c.vz < -CAM_SACUDIDA_CAIDA_FUERTE) {
      c.shake = Math.max(c.shake, Math.min(CAM_SACUDIDA_MAX, -c.vz / 90));
    }
    c.enAire = !!k.air; c.vz = k.vz;
    c.shake = Math.max(0, c.shake - dt * CAM_SACUDIDA_CAIDA);
    let sx = 0, sy = 0, sz = 0;
    const meneo = Math.min(CAM_SACUDIDA_MAX, c.shake) + (turbo ? 2.5 : 0);
    if (meneo > 0) { sx = (Math.random() - 0.5) * meneo; sy = (Math.random() - 0.5) * meneo; sz = (Math.random() - 0.5) * meneo; }
    c.cam.position.set(c.x + sx, c.y + sy, c.z + sz);
    // cuanto más rápido vas, más lejos mira: el kart baja en el panel y se ve venir más circuito
    const mira = CHASE_AHEAD + CHASE_AHEAD_SPEED * vel;
    c.cam.lookAt(k.x + cosA * mira, k.z + 40, k.y + sinA * mira);
    return c;
  }
  // vertical que hace falta para ver CHASE_HFOV grados a lo ancho en un panel de esta forma
  function fovVertical(aspect) {
    const h = THREE.MathUtils.degToRad(CHASE_HFOV);
    const v = 2 * Math.atan(Math.tan(h / 2) / Math.max(0.01, aspect));
    return clamp(THREE.MathUtils.radToDeg(v), CHASE_FOV_MIN, CHASE_FOV_MAX);
  }
  function wrapPi(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

  // Dibuja la escena una vez por panel, recortando el trozo de lienzo de cada uno
  /*
   * Qué carteles se ven en un panel concreto. La escena es una sola y se dibuja una vez por
   * panel, así que esto se llama justo antes de cada dibujado para encender y apagar sprites.
   *  - **Tu nombre y tu objeto no se dibujan en tu propio panel**: los tienes en el mini-marcador
   *    de la esquina y flotando te tapaban justo la carretera que viene.
   *  - Los nombres de los karts lejanos tampoco: a esa distancia no los vas a leer y solo
   *    ensucian. El kart se sigue viendo, con su color y su emoji.
   */
  const _vCartel = new THREE.Vector3();
  function carteles(propio, cam, altoPx) {
    for (const k of state.karts) {
      const M = k.view;
      if (!M) continue;
      const soyYo = k === propio;
      const lejos = !soyYo && _vCartel.set(k.x, k.z, k.y).distanceTo(cam.position) > ETIQ_LEJOS;
      // solo las personas llevan nombre encima: saber cuál de los karts es tu amigo importa,
      // y los ocho nombres de los bots a la vez no dejaban ver la carretera
      M.label.visible = k.isHuman && !soyYo && !lejos;
      M.item.visible = !!M.itemVisible && !soyYo;
      // el tamaño, con la cámara y el alto de ESTE panel: así sale igual de pequeño en todos
      if (M.label.visible) screenScale(M.label, ETIQ_ALTO, ETIQ_ANCHO, cam, altoPx);
      if (M.item.visible) screenScale(M.item, ICONO_OBJETO, 1, cam, altoPx);
      if (!M.head.userData.modelo3D) {
        screenScale(M.head, CABEZA, 1, cam, altoPx);
        const sc = M.g.scale.x;
        M.head.scale.x = Math.max(M.head.scale.x, 22 * sc); M.head.scale.y = Math.max(M.head.scale.y, 22 * sc);
      }
    }
  }
  // fuera de la pantalla dividida (sala, resultados, cámara general) se ven todos
  function cartelesTodos() {
    for (const k of state.karts) {
      const M = k.view;
      if (!M) continue;
      M.label.visible = true;
      M.item.visible = !!M.itemVisible;
    }
  }

  /*
   * Pone la niebla y el cielo del bioma por el que va ese kart. Se llama justo antes de dibujar su
   * panel: como la escena es una y se pinta una vez por jugador, cada uno puede ver su paisaje
   * aunque estén en biomas distintos (uno en la mina, a oscuras, y otro en el cielo, despejado).
   */
  let ambienteActual = null;
  function ambienteDe(k) {
    const t = state.track, th = t.def.theme;
    if (!th.biomas) return;
    const b = biomaEn(t, (((k.dist % t.N) + t.N) % t.N) / t.N);
    if (!b || b === ambienteActual) return;
    ambienteActual = b;
    scene.background = cieloDeBioma(b, th);
    const lejos = Math.max(1, Math.max(t.W / MAP_W, t.H / MAP_H));
    scene.fog.color.set(b.fog || th.fog);
    hemi.color.set((b.sky || th.sky)[1]);
    hemi.groundColor.set(b.ground || th.ground);
    // en la mina y en el centro de la tierra se ve menos: la niebla aprieta
    const cierra = b.nombre === 'Mina' || b.nombre === 'Centro de la Tierra' ? 0.55 : 1;
    scene.fog.near = 1800 * lejos * cierra;
    scene.fog.far = 4200 * lejos * cierra;
  }

  function renderPaneles(dt) {
    const gente = personasEnCarrera();
    const rects = panelLayout(gente.length);
    panelesActivos = gente.map((k, i) => ({ kart: k, rect: rects[i] }));
    renderer.setScissorTest(true);
    for (let i = 0; i < gente.length; i++) {
      const k = gente[i], r = rects[i];
      const px = panelEnPixeles(r, viewW, viewH);
      if (px.w < 2 || px.h < 2) continue;
      const c = updateChase(k, dt);
      c.cam.aspect = px.w / px.h;
      c.cam.fov = fovVertical(c.cam.aspect) + c.fovExtra;
      c.cam.updateProjectionMatrix();
      carteles(k, c.cam, px.h);
      ambienteDe(k);        // la niebla y el cielo del bioma por el que va ESTE jugador
      renderer.setViewport(px.x, px.y, px.w, px.h);
      renderer.setScissor(px.x, px.y, px.w, px.h);
      renderer.render(scene, c.cam);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, viewW, viewH);
  }

  // Mini-marcador HTML encima de cada panel: nombre, emoji, posición, vuelta, objeto y avisos
  const panelHud = new Map();   // kart -> elemento
  let hudPanelT = 0;
  function pintarHudPaneles(dt) {
    const cont = $('panels');
    if (!panelesActivos.length) {
      if (panelHud.size) { cont.innerHTML = ''; panelHud.clear(); }
      return;
    }
    const vivos = new Set(panelesActivos.map((p) => p.kart));
    for (const [k, el] of panelHud) if (!vivos.has(k)) { el.remove(); panelHud.delete(k); }
    hudPanelT += dt;
    const tocaTexto = hudPanelT >= 0.15;
    if (tocaTexto) hudPanelT = 0;
    for (const { kart, rect } of panelesActivos) {
      let el = panelHud.get(kart);
      if (!el) {
        el = document.createElement('div');
        el.className = 'panel';
        el.innerHTML = '<div class="tinta"></div><div class="pinfo"><span class="pem"></span><span class="pnm"></span></div>'
          + '<div class="ppos"></div><div class="plap"></div><div class="pitem"></div><div class="pmsg"></div>';
        el.querySelector('.pem').textContent = kart.emoji;
        el.querySelector('.pnm').textContent = kart.name;
        el.querySelector('.pinfo').style.borderLeftColor = kart.color;
        cont.appendChild(el);
        panelHud.set(kart, el);
      }
      el.style.left = (rect.x * 100) + '%';
      el.style.top = (rect.y * 100) + '%';
      el.style.width = (rect.w * 100) + '%';
      el.style.height = (rect.h * 100) + '%';
      // todo el mini-marcador va en «em», así que con el tamaño de letra se escala entero
      el.style.fontSize = Math.max(11, Math.round(rect.h * viewH * 0.055)) + 'px';
      if (!tocaTexto) continue;
      el.querySelector('.ppos').textContent = kart.finished ? '🏁' : ordinal(kart.rank);
      el.querySelector('.plap').textContent = kart.finished ? fmtTime(kart.finishTime) : `Vuelta ${sim.displayLap(kart)}/${state.laps}`;
      el.querySelector('.pitem').textContent = kart.rolling ? '🎰' : kart.item ? ITEMS[kart.item].icon : '';
      const msg = el.querySelector('.pmsg');
      msg.textContent = avisoDePanel(kart);
      msg.classList.toggle('alreves', !!kart.wrongWay);
      el.classList.toggle('manchado', kart.inkUntil > state.simTime);
    }
  }
  function avisoDePanel(k) {
    if (k.rocketUntil > state.simTime) return '🚀 ¡COHETE!';
    if (k.wrongWay) return '↩ ¡VAS AL REVÉS!';
    if (k.finished) return '¡META!';
    if (k.rescueUntil > state.simTime) return '¡Te devolvemos a la pista!';
    if (k.trick) return '¡TRUCO!';
    if (k.driftLevel > 0) return '★'.repeat(k.driftLevel);
    // El aviso de la última vuelta salta al cruzar la meta y se va enseguida: antes se quedaba
    // clavado en el marcador los cuarenta segundos que dura la vuelta y tapaba todo lo demás
    // (el derrape, el truco, el rescate), que es justo lo que hay que ver mientras conduces.
    if (!k.finished && sim.displayLap(k) === state.laps && state.laps > 1
      && state.simTime - k.lapAt < AVISO_ULTIMA_VUELTA) return '¡ÚLTIMA VUELTA!';
    return '';
  }

  // ===================== Visual por frame =====================
  const _hsl = new THREE.Color();
  const _vHumo = new THREE.Vector3();
  function updateVisuals(dt) {
    animT += dt;
    const now = state.simTime;
    // ambiente
    if (currentWorld) {
      for (const a of currentWorld.userData.animated) {
        if (a.kind === 'bob') a.obj.position.y += Math.sin(animT * 1.3 + a.phase) * a.amp * dt;
        else if (a.kind === 'spinY') a.obj.rotation.y += a.speed * dt;
        else if (a.kind === 'drift') { a.obj.position.x += a.speed * dt; if (a.obj.position.x > state.track.W + 200) a.obj.position.x = -200; }
        else if (a.kind === 'pad') a.tex.offset.x -= dt * 1.5;
        else if (a.kind === 'pulse') { const s = 1 + Math.sin(animT * 3 + a.phase) * 0.08; a.obj.scale.set(s, s, s); }
        else if (a.kind === 'pool') { const s = 1 + Math.sin(animT * 1.2 + a.phase) * 0.03; a.obj.scale.set(s, 1, s); }
        else if (a.kind === 'glitch') {
          // el fallo del sistema: cada poco se descoloca de golpe y a veces desaparece
          if (a.x === undefined) { a.x = a.obj.position.x; a.z = a.obj.position.z; }
          a.t -= dt;
          if (a.t <= 0) {
            a.t = 0.08 + Math.random() * 0.25;
            a.obj.position.x = a.x + (Math.random() - 0.5) * 34;
            a.obj.position.z = a.z + (Math.random() - 0.5) * 20;
            a.obj.visible = Math.random() > 0.12;
          }
        }
        else if (a.kind === 'volcano') { a.t -= dt; if (a.t <= 0) { a.t = 0.15; particles.emit(a.obj.position.x, a.obj.position.y + 150, a.obj.position.z, { n: 2, color: ['#ff5e00', '#ffd000', '#ff2d95'], spread: 90, vy: 220, life: 1.4, size: 6, g: 260 }); } }
      }
    }
    // cajas
    for (const box of state.track.boxes) {
      const m = box.view; if (!m) continue;
      const active = box.respawnAt <= now;
      const target = active ? 1 : 0;
      const s = lerp(m.scale.x, target, 1 - Math.exp(-8 * dt));
      m.scale.set(s, s, s);
      m.visible = s > 0.02;
      m.rotation.x += dt * 1.3; m.rotation.y += dt * 2.1;
      m.position.y = box.h + 18 + Math.sin(animT * 2 + box.x) * 3;
      _hsl.setHSL((animT * 0.4 + box.x * 0.001) % 1, 1, 0.6);
      m.material.color.copy(_hsl);
    }
    // proyectiles y plátanos
    for (const p of state.projectiles) { if (p.view) { p.view.position.set(p.x, p.z, p.y); p.view.rotation.y += dt * 14; } }
    for (const b of state.bananas) { if (!b.view) continue; if (b.z == null) b.z = state.track.groundAt(b.x, b.y) + 4; b.view.position.set(b.x, b.z, b.y); b.view.rotation.y += dt * 2; }
    // karts
    for (const k of state.karts) {
      const M = k.view; if (!M) continue;
      const cohete = k.rocketUntil > now;
      const boosting = k.boostUntil > now || cohete, star = k.starUntil > now, small = k.shrinkUntil > now, spinning = k.spinUntil > now;
      M.g.position.set(k.x, k.z, k.y);
      /*
       * Rescate: no te teletransportas y ya. Baja **Chuma vestido de árbitro** con su rotor, te
       * engancha y te deja en la carretera. Es solo cosa de la tele: la simulación ya te ha puesto
       * donde toca y te tiene parado ese ratito (RESCUE_TIME), así que aquí se dibuja la maniobra.
       */
      if (k.rescueUntil > now) {
        const queda = clamp((k.rescueUntil - now) / RESCUE_TIME, 0, 1);
        // el kart se levanta un palmo (más y se sale del encuadre de la cámara de persecución)
        const alto = 46 * queda * queda;
        M.g.position.y += alto;
        if (M.arbitro) {
          M.arbitro.visible = true;
          // el árbitro es el que hace el viaje: entra desde arriba, te deja y se va
          M.arbitro.position.set(k.x, k.z + alto + 62 + 150 * queda * queda, k.y);
          M.arbitro.rotation.y = -k.angle + Math.sin(animT * 2.4) * 0.22;
          M.arbitro.position.y += Math.sin(animT * 7) * 1.6;      // el vaivén del rotor
        }
      } else if (M.arbitro && M.arbitro.visible) M.arbitro.visible = false;
      let yaw = -k.angle;
      if (spinning) yaw -= (1 - (k.spinUntil - now) / SPIN_TIME) * Math.PI * 4;
      M.g.rotation.y = yaw;
      const sc = lerp(M.g.scale.x, small ? 0.62 : 1, 1 - Math.exp(-6 * dt));
      M.g.scale.set(sc, sc, sc);
      // inclinación exagerada
      const inp = k.isBot || k.finished ? null : k.input;
      const s = inp ? inp.s : 0, g = inp ? inp.g : (k.isBot ? 1 : 0), b = inp ? inp.b : 0;
      const drifting = k.driftT > 0;
      const rollT = drifting ? k.driftDir * 0.5 : s * 0.22;
      let pitchT = k.air ? clamp(k.vz / 500, -0.55, 0.55) : (g && Math.abs(k.speed) < 300 ? 0.14 : b ? -0.1 : 0);
      if (boosting) pitchT += 0.12;
      M.roll.step(rollT, dt); M.pitch.step(pitchT, dt); M.sq.step(0, dt); M.st.step(0, dt);
      const sq = clamp(M.sq.v, -0.6, 0.6), st = clamp(M.st.v, -0.5, 0.8);
      M.body.rotation.set(M.roll.v, 0, M.pitch.v + (k.trick ? k.trickAngle : 0));
      // el achuchón de los golpes y los saltos, por el tamaño del personaje (Carlota es pequeñaja)
      const e = M.escala;
      M.body.scale.set((1 - 0.5 * sq + st) * e, (1 + sq - 0.4 * st) * e, (1 - 0.5 * sq) * e);
      // El Loco va fumando: humo verde saliendo del cigarro mientras corre
      if (M.humo) {
        M.humoT += dt;
        if (M.humoT > 0.13) {
          M.humoT = 0;
          M.humo.getWorldPosition(_vHumo);
          particles.emit(_vHumo.x, _vHumo.y, _vHumo.z, { n: 1, color: ['#39ff88', '#8dffc0'], spread: 26, vy: 46, life: 1.1, size: 3.5, g: -20 });
        }
      }
      for (const w of M.wheels) { w.roll.rotation.z -= k.speed * dt / 6; if (w.front) w.steer.rotation.y = -s * 0.45; }
      for (let i = 0; i < M.flames.length; i++) { const f = M.flames[i]; f.visible = boosting; if (boosting) f.scale.set(0.8 + Math.random() * 0.6, 1, 1); }
      M.glow.visible = star;
      if (star) { _hsl.setHSL((animT * 1.5) % 1, 1, 0.6); M.glow.material.color.copy(_hsl); M.glow.scale.setScalar(1 + Math.sin(animT * 12) * 0.08); }
      M.g.visible = !(k.invUntil > now && !spinning && Math.floor(animT * 14) % 2 === 0);
      // sombra
      M.shadow.position.set(k.x, k.ground + 1.9, k.y);
      const hs = clamp(1 - (k.z - k.ground) / 300, 0.35, 1) * sc;
      M.shadow.scale.set(hs, hs, hs);
      M.shadow.material.opacity = 0.38 * hs;
      // brillo del derrape en el suelo (blanco al deslizar, y el color del nivel al cargarlo)
      M.driftGlow.visible = drifting && !k.air;
      if (M.driftGlow.visible) {
        M.driftGlow.position.set(k.x, k.ground + 1.6, k.y);
        M.driftGlow.material.color.set(DRIFT_COLORS[k.driftLevel]);
        M.driftGlow.material.opacity = (k.driftLevel ? 0.3 + 0.12 * k.driftLevel : 0.16) + Math.sin(animT * 18) * 0.05;
        const ds = 1 + 0.12 * k.driftLevel;
        M.driftGlow.scale.set(ds, ds, ds);
      }
      // partículas de derrape / turbo / estrella
      if (drifting && !k.air && Math.random() < 0.8) {
        const c = DRIFT_COLORS[k.driftLevel];
        const cosA = Math.cos(k.angle), sinA = Math.sin(k.angle);
        for (const side of [-1, 1]) particles.emit(k.x - cosA * 13 - sinA * 13 * side, k.z + 3, k.y - sinA * 13 + cosA * 13 * side, { n: 1, color: c, vx: -cosA * 120, vz: -sinA * 120, spread: 90, vy: 60, life: 0.35, size: 3, g: 400 });
      }
      if (boosting && Math.random() < 0.9) particles.emit(k.x - Math.cos(k.angle) * 24, k.z + 7, k.y - Math.sin(k.angle) * 24, { n: 2, color: ['#ff9f1c', '#ffe74c', '#ff2d95'], vx: -Math.cos(k.angle) * 200, vz: -Math.sin(k.angle) * 200, spread: 60, life: 0.35, size: 4, g: 0 });
      /*
       * Marcas de neumático: mientras derrapa, dos rayas negras pegadas al suelo, una por rueda de
       * atrás, que se van borrando. No son un decal aparte: son partículas quietas y estiradas del
       * mismo saco, así que se borran solas y no hay nada que limpiar.
       */
      M.marcaT = (M.marcaT || 0) + dt;
      if (drifting && !k.air && M.marcaT >= MARCA_CADA) {
        M.marcaT = 0;
        const cosA = Math.cos(k.angle), sinA = Math.sin(k.angle);
        for (const side of [-1, 1]) {
          particles.emit(k.x - cosA * 15 - sinA * 14 * side, k.ground + 2.2, k.y - sinA * 15 + cosA * 14 * side,
            { n: 1, color: '#1a1526', spread: 0, jitter: 1, vy: 0, g: 0, life: MARCA_VIDA, size: 5, flat: true, ang: k.moveAngle, largo: 3.4 });
        }
      }
      // Estela de velocidad: con turbo o estrella, rayas largas que salen por detrás
      M.estelaT = (M.estelaT || 0) + dt;
      if ((boosting || star) && !k.air && M.estelaT >= ESTELA_CADA) {
        M.estelaT = 0;
        const cosA = Math.cos(k.angle), sinA = Math.sin(k.angle);
        particles.emit(k.x - cosA * 30, k.z + 16, k.y - sinA * 30,
          { n: 1, color: star ? 'rainbow' : ['#ffe74c', '#ff9f1c', '#ffffff'], spread: 0, jitter: 10, vy: 0, g: 0, life: 0.3, size: 4, ang: k.angle, largo: 7 });
      }
      /*
       * Humo al aterrizar: si venía cayendo fuerte y acaba de tocar suelo. Se mira aquí, en la
       * tele, con lo que ya se sabe del kart: la simulación no tiene que enterarse.
       */
      if (M.enAire && !k.air && M.vzPrev < -HUMO_CAIDA) {
        const fuerza = Math.min(2.2, -M.vzPrev / 600);
        particles.emit(k.x, k.ground + 6, k.y, { n: Math.round(6 * fuerza), color: ['#ffffff', '#d5d8ff', '#aab0e8'], spread: 150 * fuerza, vy: 70, life: 0.55, size: 6, g: 260, flat: true });
      }
      M.enAire = !!k.air; M.vzPrev = k.vz;
      if (star && Math.random() < 0.7) particles.emit(k.x, k.z + 12, k.y, { n: 1, color: 'rainbow', spread: 80, vy: 70, life: 0.6, size: 4, g: 0 });
      // caracol: baba verde pegada al suelo mientras va frenado, para que se vea a quién le ha caído
      if (k.slowUntil > now && Math.random() < 0.8) particles.emit(k.x, k.z + 4, k.y, { n: 1, color: ['#7dff3f', '#39ff88', '#b9ff7a'], spread: 30, vy: 10, life: 0.9, size: 6, g: 40, flat: true });
      // etiquetas
      // solo el nombre: la posición ya la canta el mini-marcador de cada panel, y repetida sobre
      // ocho karts en ocho paneles tapaba la carretera
      // sin el «(bot)»: el cartel es para saber por quién vas, y ese sufijo solo ocupa sitio
      const labelText = k.name.replace(' (bot)', '');
      // la letra ocupa casi toda la textura: a 11 píxeles de alto, cada pixel cuenta
      if (labelText !== M.labelText) { M.labelText = labelText; M.label.material.map = textTexture(labelText, { w: 320, h: 80, font: `900 58px ${UI_FONT}`, color: k.isHuman ? '#fff' : '#cfd3ff', stroke: '#1a0b3d', strokeW: 11 }); M.label.material.needsUpdate = true; }
      // con paneles el tamaño se pone panel a panel, en `carteles()`: aquí no se sabe con qué
      // cámara se va a dibujar cada uno
      if (!enPaneles) {
        screenScale(M.label, ETIQ_ALTO, ETIQ_ANCHO);
        if (!M.head.userData.modelo3D) {
          screenScale(M.head, CABEZA, 1);
          M.head.scale.x = Math.max(M.head.scale.x, 22 * sc); M.head.scale.y = Math.max(M.head.scale.y, 22 * sc);
        }
      }
      let icon = null;
      if (k.rolling) icon = ITEMS[ITEM_IDS[Math.floor(animT * 12) % ITEM_IDS.length]].icon;
      else if (k.item) icon = ITEMS[k.item].icon;
      M.itemVisible = !!icon;   // lo que tocaría enseñar; cada panel decide si lo tapa (ver `carteles`)
      M.item.visible = !!icon;
      if (icon && icon !== M.itemText) { M.itemText = icon; M.item.material.map = textTexture(icon, { w: 128, h: 128, font: `84px ${EMOJI_FONT}`, bg: 'rgba(255,255,255,0.92)' }); M.item.material.needsUpdate = true; }
      if (icon && !enPaneles) screenScale(M.item, ICONO_OBJETO, 1);
    }
    particles.update(dt);
  }

  // ===================== HUD / overlays =====================
  const hudEntries = new Map();
  function buildHud() {
    const wrap = $('hud-entries');
    wrap.innerHTML = '';
    hudEntries.clear();
    for (const k of state.karts) {
      const el = document.createElement('div');
      el.className = 'e' + (state.karts.length > 5 ? ' small' : '');
      el.style.borderLeftColor = k.color;
      el.innerHTML = `<div class="top"><span class="rk"></span><span class="em">${k.emoji}</span><span class="nm">${esc(k.name)}</span></div><div class="sub"></div>`;
      wrap.appendChild(el);
      hudEntries.set(k, el);
    }
    $('hud-track').textContent = state.track.name;
    $('hud-laps').textContent = `${state.laps} ${state.laps === 1 ? 'vuelta' : 'vueltas'}`;
  }
  let hudTimer = 0;
  function updateHud(dt) {
    $('hud-time').textContent = fmtTime(state.raceTime);
    timeChipEl.textContent = fmtTime(state.raceTime);
    hudTimer += dt;
    if (hudTimer < 0.15) return;
    hudTimer = 0;
    for (const k of state.karts) {
      const el = hudEntries.get(k); if (!el) continue;
      el.style.order = k.rank;
      el.querySelector('.rk').textContent = ordinal(k.rank);
      el.querySelector('.sub').textContent = k.finished ? `¡Meta! ${fmtTime(k.finishTime)}` : `Vuelta ${sim.displayLap(k)}/${state.laps}` + (k.item ? '  ' + ITEMS[k.item].icon : '');
      el.classList.toggle('fin', k.finished);
    }
  }
  // Enciende las `n` primeras luces del semáforo (y lo saca a la pantalla si estaba escondido)
  function pintarSemaforo(n) {
    semaforoEl.classList.remove('hidden', 'ya');
    const luces = semaforoEl.children;
    for (let i = 0; i < luces.length; i++) luces[i].classList.toggle('on', i < n);
  }

  function showBig(text) {
    bigEl.textContent = text;
    bigEl.classList.remove('hidden', 'pop');
    void bigEl.offsetWidth; // reinicia la animación
    bigEl.classList.add('pop');
  }
  function hideBig(ifText) { if (!ifText || bigEl.textContent === ifText) bigEl.classList.add('hidden'); }

  // evita que `updateOverlays` se llame a sí misma al cambiar la fase desde dentro (ver abajo)
  let sincronizando = false;
  function updateOverlays() {
    // en el calentamiento la sala sigue puesta: el anfitrión tiene que poder pulsar EMPEZAR
    const enSala = state.phase === 'lobby' || state.phase === 'warmup';
    lobbyEl.classList.toggle('hidden', !enSala);
    resultsEl.classList.toggle('hidden', state.phase !== 'results');
    if (state.phase !== 'results' && podioDatos) quitarPodio();
    hudEl.classList.toggle('hidden', enSala || panelesPrev || !!podioDatos);
    if (state.phase !== 'countdown' && state.phase !== 'race') bigEl.classList.add('hidden');
    if (state.phase !== 'countdown') { semaforoEl.classList.add('hidden'); semaforoEl.classList.remove('ya'); }
    if (enSala) renderLobby();
    if (state.phase === 'results') renderResults();
    // los karts del calentamiento siguen a quien esté en la sala: aquí se pasa cada vez que cambia
    if (enSala && !sincronizando) {
      sincronizando = true;
      try { sincronizarCalentamiento(); } finally { sincronizando = false; }
    }
  }

  function renderLobby() {
    actualizarEscaparate();     // los karts que dan vueltas delante de la cámara
    $('url').textContent = state.joinUrl || `http://${location.host}/play`;
    $('aviso-https').classList.toggle('hidden', !state.joinUrlVolante);
    $('url-volante').textContent = state.joinUrlVolante;
    const rows = [];
    for (const p of state.players.values()) {
      const ch = CHARS[p.char] || CHARS[0];
      rows.push(`<div class="slot full" style="border-color:${ch.color}"><span class="emoji">${ch.emoji}</span><span>${esc(p.name)}</span>${p.host ? '<span class="tag">👑 anfitrión</span>' : ''}${p.easy ? '<span class="tag">🦺 modo fácil</span>' : ''}<span class="dot ${p.connected ? '' : 'off'}"></span></div>`);
    }
    if (state.kb) rows.push('<div class="slot full"><span class="emoji">⌨️</span><span>Teclado</span><span class="tag">flechas · espacio objeto · el derrape sale solo</span></div>');
    while (rows.length < MAX_KARTS) rows.push('<div class="slot empty"><span class="emoji">·</span><span>libre</span></div>');
    $('players').innerHTML = rows.slice(0, MAX_KARTS).join('');
    $('setTrack').innerHTML = `Circuito: <b>${esc(TRACKS[state.settings.track].name)}</b>`;
    $('setLaps').innerHTML = `Vueltas: <b>${state.settings.laps}</b>`;
    $('setBots').innerHTML = `Bots: <b>${state.settings.bots}</b>`;
    const nCarreras = state.settings.carreras || 1;
    $('setTorneo').innerHTML = nCarreras > 1
      ? `Torneo: <b>${nCarreras} carreras</b>`
      : 'Torneo: <b>no</b>';
  }

  function renderResults() {
    if (!state.results) return;
    if (state.torneo) return;      // en torneo manda la pantalla de clasificación
    /*
     * Con el podio puesto, esta pantalla no pinta nada: el torneo se cierra poniendo `state.torneo`
     * a null (para que el siguiente EMPEZAR arranque uno nuevo), así que sin esto la primera cosa
     * que llame a `updateOverlays` —un móvil que se reconecta, un cambio de sala— borraba el podio
     * y dejaba la tabla de la última carrera encima de los cajones.
     */
    if (podioDatos) return;
    const rows = state.results.map((r) => `<tr><td class="pos">${r.pos}º</td><td class="emoji">${r.emoji}</td><td>${esc(r.name)}</td><td class="time">${r.finished ? fmtTime(r.time) : 'vuelta ' + r.lap}</td></tr>`).join('');
    resultsEl.innerHTML = `<h1>🏆 Resultados · ${esc(state.track.name)}</h1><table>${rows}</table><div class="again">El anfitrión pulsa <b>OTRA CARRERA</b> en su móvil (o <b>Intro</b> en el teclado)</div>`;
  }

  // ===================== Teclado =====================
  function kbInput() { return state.kb ? state.kb.input : null; }
  window.addEventListener('keydown', (e) => {
    ensureAudio();
    const inp = kbInput();
    const key = e.key;
    if (inp && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      e.preventDefault();
      if (state.phase !== 'lobby') {
        if (key === 'ArrowUp') inp.g = 1;
        if (key === 'ArrowDown') inp.b = 1;
        if (key === 'ArrowLeft') inp.s = -1;
        if (key === 'ArrowRight') inp.s = 1;
        if (key === ' ' && !e.repeat) { const k = state.karts.find((q) => q.isKb); if (k) sim.useItem(k); }
      }
    }
    if (e.repeat) return;
    if (key === 'f' || key === 'F') { toggleFullscreen(); return; }
    if (key === 'm' || key === 'M') { silenciar(); return; }
    // caracol: si quien elige es el jugador de teclado, se elige con los números
    if (eligiendoAhora && eligiendoAhora.kart.isKb && key >= '1' && key <= '8') {
      const elegido = eligiendoAhora.candidatos[Number(key) - 1];
      if (elegido) sim.elegirVictima(elegido.id);
      return;
    }
    // contador de fps: para comprobar en la fiesta que la pantalla dividida no se atraganta
    if (key === 'p' || key === 'P') { fpsEl.classList.toggle('hidden'); return; }
    /*
     * En la sala **y en el calentamiento**: en cuanto entra alguien (o se añade el jugador del
     * teclado) la fase pasa a `warmup`, y hasta ahora eso dejaba muertas todas las teclas de la
     * tele — las mismas que la sala anuncia en su lista de ayuda. Así que ni se podía cambiar de
     * circuito ni quitar el jugador del teclado sin echar a todo el mundo.
     */
    if (state.phase === 'lobby' || state.phase === 'warmup') {
      if (key === 'Enter') startRace();
      else if (key === 'k' || key === 'K') toggleKeyboardPlayer();
      else if (key === 'ArrowLeft') changeSetting('track', -1);
      else if (key === 'ArrowRight') changeSetting('track', 1);
      else if (key === 'b' || key === 'B') changeSetting('bots', 1);
      else if (key === 'n' || key === 'N') changeSetting('bots', -1);
      else if (key === 'l' || key === 'L') changeSetting('laps', 1);
      else if (key === 't' || key === 'T') changeSetting('carreras', 1);
      else if (key === 'v' || key === 'V') vaciarSala();
    } else if (state.phase === 'results') {
      if (key === 'Enter') sim.backToLobby();
    }
  });
  window.addEventListener('keyup', (e) => {
    const inp = kbInput();
    if (!inp) return;
    const key = e.key;
    if (key === 'ArrowUp') inp.g = 0;
    if (key === 'ArrowDown') inp.b = 0;
    if (key === 'ArrowLeft' && inp.s === -1) inp.s = 0;
    if (key === 'ArrowRight' && inp.s === 1) inp.s = 0;
  });
  window.addEventListener('blur', () => { const inp = kbInput(); if (inp) { inp.s = 0; inp.g = 0; inp.b = 0; } });
  window.addEventListener('pointerdown', ensureAudio);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  // ===================== Audio (sintetizado) =====================
  /*
   * Todo el sonido sale por el mismo sitio: `bus` (el volumen general, que la tecla `M` pone a
   * cero) y detrás un compresor, para que ocho motores sonando a la vez más un rayo no revienten
   * los altavoces de la tele. Antes cada tono iba directo a la salida y no había manera de callar
   * el juego ni de meter nada continuo sin que saturara.
   */
  let ac = null, bus = null, silencio = false;
  function ensureAudio() {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        bus = ac.createGain();
        bus.gain.value = silencio ? 0 : 1;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 8;
        comp.attack.value = 0.004; comp.release.value = 0.22;
        bus.connect(comp).connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (_) { ac = null; bus = null; }
  }
  function silenciar() {
    silencio = !silencio;
    if (bus) bus.gain.setTargetAtTime(silencio ? 0 : 1, ac.currentTime, 0.02);
    toast(silencio ? '🔇 Sonido apagado (M)' : '🔊 Sonido encendido (M)', 1.6);
  }
  function tone(freq, dur, opts = {}) {
    if (!ac || ac.state !== 'running' || !bus) return;
    const o = ac.createOscillator(), g = ac.createGain();
    const t0 = ac.currentTime + (opts.when || 0);
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    g.gain.setValueAtTime(opts.vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /*
   * Un motor por kart: un oscilador de sierra que no para, con el tono siguiendo la velocidad. Se
   * enciende cuando aparece el kart y se apaga cuando desaparece, así que no quedan osciladores
   * sueltos sonando cuando acaba la carrera.
   */
  const motores = new Map();    // kart -> { osc, gain }
  function motorDe(k) {
    if (!ac || ac.state !== 'running' || !bus) return null;
    let m = motores.get(k);
    if (!m) {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = MOTOR_HZ_MIN;
      gain.gain.value = 0;
      osc.connect(gain).connect(bus);
      osc.start();
      m = { osc, gain };
      motores.set(k, m);
    }
    return m;
  }
  function pararMotor(k) {
    const m = motores.get(k);
    if (!m) return;
    try { m.gain.gain.cancelScheduledValues(ac.currentTime); m.gain.gain.value = 0; m.osc.stop(ac.currentTime + 0.05); } catch (_) { /* ya parado */ }
    motores.delete(k);
  }
  function actualizarMotores() {
    if (!ac || ac.state !== 'running') return;
    const corriendo = state.phase === 'race' || state.phase === 'countdown' || state.phase === 'warmup';
    for (const k of [...motores.keys()]) if (!corriendo || !state.karts.includes(k)) pararMotor(k);
    if (!corriendo) return;
    const ahora = ac.currentTime;
    for (const k of state.karts) {
      const m = motorDe(k);
      if (!m) return;
      const v = Math.min(1, Math.abs(k.speed) / BASE_MAX_SPEED);
      const turbo = k.boostUntil > state.simTime || k.starUntil > state.simTime;
      const hz = (MOTOR_HZ_MIN + (MOTOR_HZ_MAX - MOTOR_HZ_MIN) * v) * (turbo ? MOTOR_TURBO : 1);
      // el volumen sube con el gas pero nunca llega a tapar los efectos, y los bots suenan flojito
      const vol = MOTOR_VOL * (0.35 + 0.65 * v) * (k.isHuman ? 1 : MOTOR_BOT) * (k.finished ? 0.3 : 1);
      m.osc.frequency.setTargetAtTime(hz, ahora, 0.08);
      m.gain.gain.setTargetAtTime(vol, ahora, 0.1);
    }
  }
  /*
   * Música: un secuenciador de corcheas. Cada frame se miran los 0,25 s siguientes y se dejan las
   * notas ya programadas en el reloj de WebAudio, que es el único que no se salta un latido aunque
   * la tele vaya justa de fps. Los temas son listas de notas MIDI (0 = silencio), una de bajo y
   * otra de melodía, en do mayor porque es lo que suena alegre sin pensarlo mucho.
   */
  const NOTA = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const TEMAS = {
    // sala: tranquilo, para que se oiga la gente entrar
    sala: {
      bpm: 96, tipo: 'triangle',
      bajo: [48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 50, 0, 0, 0],
      lead: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 83, 81, 79, 76, 74],
    },
    // carrera: el mismo do mayor pero con prisa y con bombo
    carrera: {
      bpm: 132, tipo: 'square',
      bajo: [40, 40, 47, 47, 45, 45, 47, 47, 40, 40, 47, 47, 45, 45, 43, 43],
      lead: [76, 79, 83, 79, 77, 81, 84, 81, 76, 79, 83, 86, 84, 83, 79, 77],
    },
  };
  const musica = { tema: null, paso: 0, hasta: 0, rapido: false };
  function notaMusical(freq, t0, dur, tipo, vol) {
    if (!ac || !bus) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.9);
    o.connect(g).connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function temaAhora() {
    if (state.phase === 'lobby' || state.phase === 'warmup') return TEMAS.sala;
    if (state.phase === 'race' || state.phase === 'countdown') return TEMAS.carrera;
    return null;     // resultados: la fanfarria de meta ya suena ahí (`sfx('finish')`), no hace falta más
  }
  // ¿última vuelta de alguna persona? entonces el tema corre más
  function ultimaVuelta() {
    if (state.phase !== 'race') return false;
    for (const k of state.karts) if (k.isHuman && !k.finished && k.lapCount >= state.laps - 1) return true;
    return false;
  }
  function actualizarMusica() {
    if (!ac || ac.state !== 'running' || !bus) return;
    const tema = temaAhora();
    if (!tema) { musica.tema = null; return; }
    const rapido = ultimaVuelta();
    if (tema !== musica.tema || rapido !== musica.rapido) {
      musica.tema = tema; musica.rapido = rapido;
      musica.paso = 0; musica.hasta = Math.max(musica.hasta, ac.currentTime + 0.05);
    }
    const dur = 60 / (tema.bpm * (rapido ? MUSICA_ULTIMA : 1)) / 2;
    if (musica.hasta < ac.currentTime) musica.hasta = ac.currentTime;
    while (musica.hasta < ac.currentTime + 0.25) {
      const i = musica.paso % tema.lead.length;
      const b = tema.bajo[i], l = tema.lead[i];
      if (b) notaMusical(NOTA(b), musica.hasta, dur * 0.9, 'triangle', MUSICA_VOL);
      if (l) notaMusical(NOTA(l + (rapido ? 12 : 0)), musica.hasta, dur * 0.8, tema.tipo, MUSICA_VOL * 0.75);
      musica.paso++;
      musica.hasta += dur;
    }
  }
  function sfx(name) {
    switch (name) {
      case 'beep': tone(440, 0.18); break;
      case 'go': tone(880, 0.6, { vol: 0.15 }); break;
      case 'pickup': tone(600, 0.08); tone(900, 0.12, { when: 0.08 }); break;
      case 'hit': tone(220, 0.35, { type: 'sawtooth', to: 60, vol: 0.15 }); break;
      case 'boost': tone(300, 0.35, { type: 'sine', to: 1000, vol: 0.12 }); break;
      case 'shell': tone(500, 0.12, { type: 'triangle', to: 200 }); break;
      case 'drop': tone(300, 0.1, { type: 'triangle' }); break;
      case 'star': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, { when: i * 0.07, type: 'triangle' })); break;
      case 'lightning': tone(120, 0.5, { type: 'sawtooth', to: 40, vol: 0.18 }); break;
      case 'lap': tone(660, 0.1); tone(880, 0.15, { when: 0.1 }); break;
      case 'finishKart': [784, 988, 1175].forEach((f, i) => tone(f, 0.18, { when: i * 0.12, type: 'triangle' })); break;
      case 'finish': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { when: i * 0.15, type: 'triangle', vol: 0.14 })); break;
      case 'boing': tone(180, 0.25, { type: 'sine', to: 420, vol: 0.14 }); break;
      case 'bump': tone(140, 0.12, { type: 'square', to: 90, vol: 0.1 }); break;
      case 'jump': tone(400, 0.25, { type: 'sine', to: 900, vol: 0.08 }); break;
      case 'land': tone(120, 0.15, { type: 'triangle', to: 60, vol: 0.12 }); break;
      case 'trick': [660, 880, 1320].forEach((f, i) => tone(f, 0.1, { when: i * 0.06, type: 'square', vol: 0.08 })); break;
      case 'pad': tone(500, 0.2, { type: 'sawtooth', to: 1400, vol: 0.1 }); break;
      case 'drift1': tone(520, 0.12, { type: 'square', to: 700, vol: 0.05 }); break;
      case 'drift2': tone(700, 0.14, { type: 'square', to: 950, vol: 0.06 }); break;
      case 'drift3': [900, 1200, 1500].forEach((f, i) => tone(f, 0.1, { when: i * 0.05, type: 'square', vol: 0.06 })); break;
      case 'wrong': [400, 300, 400].forEach((f, i) => tone(f, 0.18, { when: i * 0.14, type: 'square', vol: 0.09 })); break;
      case 'snail': [660, 520, 400, 300].forEach((f, i) => tone(f, 0.22, { when: i * 0.1, type: 'sine', vol: 0.12 })); break;
      case 'snailHit': tone(240, 0.7, { type: 'triangle', to: 70, vol: 0.14 }); break;
      case 'rescue': [880, 660, 990].forEach((f, i) => tone(f, 0.14, { when: i * 0.09, type: 'sine', vol: 0.09 })); break;
      // los de la casa y los del videojuego
      case 'freno': tone(320, 0.4, { type: 'sawtooth', to: 80, vol: 0.13 }); break;
      case 'espuma': tone(900, 0.4, { type: 'sine', to: 320, vol: 0.09 }); break;
      case 'patito': [700, 900].forEach((f, i) => tone(f, 0.12, { when: i * 0.08, type: 'square', vol: 0.09 })); break;
      case 'glitch': [1200, 300, 900, 200].forEach((f, i) => tone(f, 0.07, { when: i * 0.05, type: 'square', vol: 0.11 })); break;
      case 'bicho': [220, 180, 260, 150].forEach((f, i) => tone(f, 0.1, { when: i * 0.07, type: 'sawtooth', vol: 0.1 })); break;
      default: break;
    }
  }

  // ===================== Bucle principal =====================
  // Lo último que mandó cada móvil (o el teclado) entra en la simulación antes de cada frame
  function pushInputs() {
    for (const k of state.karts) {
      if (k.isBot || k.finished) continue;
      const inp = k.isKb ? (state.kb ? state.kb.input : null) : (state.players.get(k.playerId) || {}).input;
      if (inp) sim.setInput(k, inp);
    }
  }

  let last = performance.now(), acc = 0, panelesPrev = false;
  // «hit-stop»: segundos que queda la imagen congelada tras un golpe fuerte (ver CAM_HITSTOP)
  let hitStop = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (hitStop > 0) {
      // la simulación no avanza, pero el reloj sí: el frenazo dura lo que dura y no se acumula
      hitStop = Math.max(0, hitStop - dt);
      acc = 0;
    } else {
      acc += dt;
      pushInputs();
      let n = 0;
      while (acc >= DT && n < 6) { sim.update(DT); acc -= DT; n++; }
      if (n === 6) acc = 0;
    }
    const paneles = modoPaneles();
    if (paneles !== panelesPrev) {
      panelesPrev = paneles;
      hudEl.classList.toggle('hidden', paneles || state.phase === 'lobby' || state.phase === 'warmup' || !!podioDatos);
      timeChipEl.classList.toggle('hidden', !paneles);
      // con muchos paneles, dibujar la escena 8 veces cuesta: se baja la resolución interna
      renderer.setPixelRatio(paneles && personasEnCarrera().length > 4 ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewW, viewH, false);
    }
    if (state.phase === 'warmup') {
      const alguien = state.karts.some((k) => Math.abs(k.speed) > 30);
      calentando = alguien ? 6 : Math.max(0, calentando - dt);
    } else calentando = 0;
    enPaneles = paneles;
    camActiva = paneles ? (chases.get(personasEnCarrera()[0]) || {}).cam || camera : camera;
    altoActivo = paneles ? viewH / panelLayout(personasEnCarrera().length).length : viewH;
    updateVisuals(dt);
    actualizarMotores();
    actualizarMusica();
    moverEscaparate(dt);
    moverPodio(dt);
    if (paneles) {
      renderPaneles(dt);
      updateCamera(dt);            // la general sigue al día para cuando se vuelva a ella
    } else {
      panelesActivos = [];
      cartelesTodos();
      if (state.karts.length) ambienteDe(state.karts[0]);
      updateCamera(dt);
      renderer.render(scene, camera);
    }
    if (eligiendoAhora) refrescarReloj();
    if (state.phase !== 'lobby' && state.phase !== 'warmup') updateHud(dt);
    pintarHudPaneles(dt);
    contarFps(dt, paneles ? panelesActivos.length : 1);
    requestAnimationFrame(frame);
  }

  let fpsAcc = 0, fpsCuenta = 0;
  function contarFps(dt, paneles) {
    fpsAcc += dt; fpsCuenta++;
    if (fpsAcc < 0.5) return;
    if (!fpsEl.classList.contains('hidden')) fpsEl.textContent = `${Math.round(fpsCuenta / fpsAcc)} fps · ${paneles} panel${paneles > 1 ? 'es' : ''}`;
    fpsAcc = 0; fpsCuenta = 0;
  }

  window.KART_DEBUG = {
    sim, state, stats: sim.stats, TRACKS, aiInput: sim.aiInput, startRace,
    backToLobby: sim.backToLobby, useItem: sim.useItem, hitKart: sim.hitKart, scene, camera,
  };

  if (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 900 && !location.search.includes('screen')) {
    location.replace('/play');
  } else {
    setWorld(state.track);
    connect();
    updateOverlays();
    requestAnimationFrame(frame);
  }
})();
